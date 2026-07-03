import { RequestHandler } from "express";
import { hasActiveSubscription } from "./auth";
import { ApiErrorResponse, ApiErrorCode } from "../../shared/api";

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 5,
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const waitTime = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.pow(2, attempt + 1) * 1000;
        console.warn(
          `Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`,
        );
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
  throw new Error("Max retries exceeded");
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
    console.log("[Predictions] Waiting for in-flight prediction request");
    try {
      const data = await pending.promise;
      return res.json(data);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("[Predictions] Pending request failed:", errorMessage);
      const errorResponse: ApiErrorResponse = {
        error: "Failed to fetch predictions",
        code: ApiErrorCode.FETCH_FAILED,
        details: errorMessage,
        retryable: true,
      };
      return res.status(500).json(errorResponse);
    }
  }

  const url =
    "https://football-prediction-api.p.rapidapi.com/api/v2/predictions?market=classic";

  const apiKey = process.env.RAPIDAPI_KEY || process.env.PREDICTIONS_KEY;

  if (!apiKey) {
    console.error(
      "[Predictions] API key not configured - RAPIDAPI_KEY or PREDICTIONS_KEY missing",
    );
    const errorResponse: ApiErrorResponse = {
      error: "API configuration error",
      code: ApiErrorCode.API_KEY_MISSING,
      details:
        "Server is missing required API credentials. Please contact support.",
      retryable: false,
    };
    return res.status(500).json(errorResponse);
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
      console.log("[Predictions] Fetching predictions from RapidAPI...");
      const response = await fetchWithRetry(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[Predictions] API Error: ${response.status} ${response.statusText}`,
          errorText,
        );

        if (response.status === 403) {
          const error = new Error("API_AUTH_FAILED");
          (error as any).code = ApiErrorCode.API_AUTH_FAILED;
          (error as any).retryable = false;
          throw error;
        }

        if (response.status === 429) {
          const retryAfter = response.headers.get("retry-after");
          const error = new Error("RATE_LIMITED");
          (error as any).code = ApiErrorCode.RATE_LIMITED;
          (error as any).retryable = true;
          (error as any).retryAfter = retryAfter ? parseInt(retryAfter) : 60;
          throw error;
        }

        const error = new Error(`API Error: ${response.statusText}`);
        (error as any).code = ApiErrorCode.FETCH_FAILED;
        (error as any).retryable = true;
        throw error;
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error(
          "[Predictions] Failed to parse API response as JSON:",
          parseError,
        );
        const error = new Error("INVALID_RESPONSE");
        (error as any).code = ApiErrorCode.INVALID_RESPONSE;
        (error as any).retryable = false;
        throw error;
      }

      console.log("[Predictions] Fetched successfully, processing data");

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
        ttl: CACHE_TTL,
      });

      return responseData;
    } catch (error) {
      const errorCode = (error as any)?.code || ApiErrorCode.FETCH_FAILED;
      const retryable = (error as any)?.retryable ?? true;
      const retryAfter = (error as any)?.retryAfter;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error(
        `[Predictions] Request failed with code ${errorCode}:`,
        errorMessage,
      );

      // Re-throw with additional metadata
      const enrichedError = new Error(errorMessage);
      (enrichedError as any).code = errorCode;
      (enrichedError as any).retryable = retryable;
      if (retryAfter) (enrichedError as any).retryAfter = retryAfter;
      throw enrichedError;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, { promise: requestPromise });

  try {
    const data = await requestPromise;
    res.json(data);
  } catch (error) {
    const errorCode = (error as any)?.code || ApiErrorCode.FETCH_FAILED;
    const retryable = (error as any)?.retryable ?? true;
    const retryAfter = (error as any)?.retryAfter;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error(`[Predictions] Request failed:`, {
      code: errorCode,
      retryable,
      message: errorMessage,
    });

    // Determine HTTP status code based on error type
    let statusCode = 500;
    if (errorCode === ApiErrorCode.API_AUTH_FAILED) statusCode = 403;
    if (errorCode === ApiErrorCode.RATE_LIMITED) statusCode = 429;

    const errorResponse: ApiErrorResponse = {
      error: getErrorMessage(errorCode),
      code: errorCode,
      details: errorMessage,
      retryable,
      ...(retryAfter && { retryAfter }),
    };

    res.status(statusCode).json(errorResponse);
  }
};

/**
 * Get user-friendly error message based on error code
 */
function getErrorMessage(code: string): string {
  switch (code) {
    case ApiErrorCode.API_KEY_MISSING:
      return "API configuration error";
    case ApiErrorCode.API_AUTH_FAILED:
      return "API authentication failed";
    case ApiErrorCode.RATE_LIMITED:
      return "Too many requests";
    case ApiErrorCode.INVALID_RESPONSE:
      return "Invalid API response format";
    case ApiErrorCode.NETWORK_ERROR:
      return "Network error";
    case ApiErrorCode.FETCH_FAILED:
      return "Failed to fetch predictions";
    case ApiErrorCode.JSON_PARSE_ERROR:
      return "Failed to parse response";
    default:
      return "An error occurred";
  }
}
