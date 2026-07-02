import { RequestHandler } from "express";
import { hasActiveSubscription } from "./auth";

interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

interface PendingRequest {
  promise: Promise<unknown>;
}

const cache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, PendingRequest>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface PredictionApiMatch {
  id: number;
  home_team: string;
  away_team: string;
  [key: string]: unknown;
}

function redactPredictionForVisitor(match: PredictionApiMatch) {
  return {
    id: match.id,
    home_team: match.home_team,
    away_team: match.away_team,
  };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 5): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt + 1) * 1000;
        console.warn(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        if (attempt < maxRetries - 1) {
          await sleep(waitTime);
          continue;
        }
      }

      return response;
    } catch (error) {
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt + 1) * 1000;
        console.warn(`Fetch failed, retrying in ${waitTime}ms:`, error);
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

export const handlePredictions: RequestHandler = async (req, res) => {
  const isSubscribed = hasActiveSubscription(req);
  const cacheKey = `predictions:${isSubscribed}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    console.log("Returning cached predictions");
    return res.json(cached.data);
  }

  // Check if request is already in flight
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    console.log("Waiting for in-flight prediction request");
    try {
      const data = await pending.promise;
      return res.json(data);
    } catch (error) {
      return res.status(500).json({
        error: "Failed to fetch predictions",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  const url =
    "https://football-prediction-api.p.rapidapi.com/api/v2/predictions?market=classic";

  const apiKey = process.env.RAPIDAPI_KEY || process.env.PREDICTIONS_KEY;

  if (!apiKey) {
    console.error("API key not configured");
    return res.status(500).json({
      error: "API key not configured",
      details: "RAPIDAPI_KEY or PREDICTIONS_KEY environment variable is missing"
    });
  }

  const options: RequestInit = {
    method: "GET",
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "football-prediction-api.p.rapidapi.com",
      "Content-Type": "application/json",
    },
  };

  // Create promise for request deduplication
  const requestPromise = (async () => {
    try {
      console.log("Fetching predictions from RapidAPI...");
      const response = await fetchWithRetry(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error: ${response.status} ${response.statusText}`, errorText);

        if (response.status === 403) {
          throw new Error("API authentication failed: Invalid or expired API key");
        }
        throw new Error(`Failed to fetch predictions: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Predictions fetched successfully");

      let responseData;
      if (!isSubscribed && Array.isArray(data.data)) {
        responseData = {
          ...data,
          data: data.data.map(redactPredictionForVisitor),
          isSubscribed: false,
        };
      } else {
        responseData = { ...data, isSubscribed };
      }

      // Cache the response
      cache.set(cacheKey, {
        data: responseData,
        timestamp: Date.now(),
        ttl: CACHE_TTL
      });

      return responseData;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, { promise: requestPromise });

  try {
    const data = await requestPromise;
    res.json(data);
  } catch (error) {
    console.error("Error fetching predictions:", error);
    res.status(500).json({
      error: "Failed to fetch predictions",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
