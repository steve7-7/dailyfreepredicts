import { RequestHandler } from "express";

export const handlePerformanceStats: RequestHandler = async (req, res) => {
  const market = req.query.market || "classic";
  const apiKey = process.env.RAPIDAPI_KEY;

  // Check if API key is set
  if (!apiKey) {
    console.error("RAPIDAPI_KEY environment variable is not set");
    return res.status(500).json({
      error: "API key not configured",
      details: "RAPIDAPI_KEY environment variable is missing"
    });
  }

  const url = `https://football-prediction-api.p.rapidapi.com/api/v2/performance-stats?market=${market}`;

  const options = {
    method: "GET" as const,
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "football-prediction-api.p.rapidapi.com",
      "Content-Type": "application/json",
    },
  };

  try {
    console.log(`Fetching performance stats from: ${url}`);
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${response.status} ${response.statusText}`, errorText);
      return res.status(response.status).json({
        error: `Failed to fetch performance stats: ${response.statusText}`,
        status: response.status
      });
    }

    const data = await response.json();
    console.log("Performance stats fetched successfully");
    res.json(data);
  } catch (error) {
    console.error("Error fetching performance stats:", error);
    res.status(500).json({
      error: "Failed to fetch performance stats",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
