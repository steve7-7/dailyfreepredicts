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

export const handlePredictions: RequestHandler = async (req, res) => {
  const isSubscribed = hasActiveSubscription(req);
  const url =
    "https://football-prediction-api.p.rapidapi.com/api/v2/predictions?market=classic";
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": process.env.RAPIDAPI_KEY || "",
      "x-rapidapi-host": "football-prediction-api.p.rapidapi.com",
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await fetch(url, options);
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
