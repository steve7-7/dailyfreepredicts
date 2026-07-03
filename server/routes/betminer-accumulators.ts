import { RequestHandler } from "express";
import * as fs from "fs";
import * as path from "path";

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "betminer-accumulators.json");
const CACHE_DURATION_MS = (24 * 60 * 60 * 1000) / 5; // 5 times a day = every 4.8 hours

interface CacheData {
  timestamp: number;
  data: any;
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCachedData(): any | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, "utf-8");
      const cache: CacheData = JSON.parse(content);
      const age = Date.now() - cache.timestamp;

      // If cache is fresh (less than 4.8 hours old), return it
      if (age < CACHE_DURATION_MS) {
        console.log(
          `Using cached data (${Math.round(age / 1000 / 60)} minutes old)`,
        );
        return cache.data;
      }
    }
  } catch (error) {
    console.error("Error reading cache:", error);
  }
  return null;
}

function saveCacheData(data: any) {
  try {
    ensureCacheDir();
    const cache: CacheData = {
      timestamp: Date.now(),
      data,
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log("Cache saved successfully");
  } catch (error) {
    console.error("Error saving cache:", error);
  }
}

async function fetchFromBetminer(): Promise<any> {
  const apiKey = process.env.RAPIDAPI_KEY;

  if (!apiKey) {
    throw new Error("RAPIDAPI_KEY environment variable is not set");
  }

  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
  const url = `https://betminer.p.rapidapi.com/bm/v3/accumulators/${date}`;

  const options = {
    method: "GET" as const,
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "betminer.p.rapidapi.com",
      "Content-Type": "application/json",
    },
  };

  console.log(`Fetching betminer accumulators for ${date}`);
  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Betminer API error ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json();
  return data;
}

export const handleBetminerAccumulators: RequestHandler = async (req, res) => {
  try {
    // Try to get cached data first
    let data = getCachedData();

    // If no fresh cache, fetch new data
    if (!data) {
      console.log("Cache expired or not found, fetching new data...");
      data = await fetchFromBetminer();
      saveCacheData(data);
    }

    res.json({
      data,
      cached: data ? true : false,
      cacheExpiry: new Date(Date.now() + CACHE_DURATION_MS).toISOString(),
    });
  } catch (error) {
    console.error("Error fetching betminer accumulators:", error);
    res.status(500).json({
      error: "Failed to fetch betminer accumulators",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const handleClearBetminerCache: RequestHandler = async (req, res) => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
      console.log("Cache cleared");
    }
    res.json({ message: "Cache cleared successfully" });
  } catch (error) {
    console.error("Error clearing cache:", error);
    res.status(500).json({
      error: "Failed to clear cache",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
