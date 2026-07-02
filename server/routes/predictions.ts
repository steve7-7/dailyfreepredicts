import { RequestHandler } from "express";
import { hasActiveSubscription } from "./auth";

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

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
        console.warn(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        if (attempt < maxRetries - 1) {
          await sleep(waitTime);
          continue;
        }
      }

      return response;
    } catch (error) {
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
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

  try {
    const response = await fetchWithRetry(url, options);

    if (!response.ok) {
      console.error(`API Error: ${response.status} ${response.statusText}`);
      if (response.status === 403) {
        return res.status(403).json({
          error: "API authentication failed",
          details: "Invalid or expired API key"
        });
      }
      return res.status(response.status).json({
        error: `Failed to fetch predictions: ${response.statusText}`,
        status: response.status
      });
    }

    const data = await response.json();

    if (!isSubscribed && Array.isArray(data.data)) {
      res.json({
        ...data,
        data: data.data.map(redactPredictionForVisitor),
        isSubscribed: false,
      });
      return;
    }

    res.json({ ...data, isSubscribed });
  } catch (error) {
    console.error("Error fetching predictions:", error);
    res.status(500).json({ error: "Failed to fetch predictions" });
  }
};
