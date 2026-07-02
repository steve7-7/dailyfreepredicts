import { RequestHandler } from "express";

interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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

export const handlePastPredictions: RequestHandler = async (req, res) => {
  const status = req.query.status || "finished";
  const limit = req.query.limit || "50";
  const cacheKey = `past-predictions:${status}:${limit}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    console.log("Returning cached past predictions");
    return res.json(cached.data);
  }

  const url = `https://football-prediction-api.p.rapidapi.com/api/v2/predictions?status=${status}&limit=${limit}&market=classic`;

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

  try {
    console.log(`Fetching past predictions from: ${url}`);
    const response = await fetchWithRetry(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${response.status} ${response.statusText}`, errorText);

      if (response.status === 403) {
        return res.status(403).json({
          error: "API authentication failed",
          details: "Invalid or expired API key"
        });
      }

      return res.status(response.status).json({
        error: `Failed to fetch past predictions: ${response.statusText}`,
        status: response.status
      });
    }

    const data = await response.json();
    console.log("Past predictions fetched successfully");

    // Cache the response
    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl: CACHE_TTL
    });

    res.json(data);
  } catch (error) {
    console.error("Error fetching past predictions:", error);
    res.status(500).json({
      error: "Failed to fetch past predictions",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
