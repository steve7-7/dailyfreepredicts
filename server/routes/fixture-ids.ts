import { RequestHandler } from "express";

export const handleFixtureIds: RequestHandler = async (req, res) => {
  const url =
    "https://football-prediction-api.p.rapidapi.com/api/v2/get-list-of-fixture-ids";
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
    res.json(data);
  } catch (error) {
    console.error("Error fetching fixture IDs:", error);
    res.status(500).json({ error: "Failed to fetch fixture IDs" });
  }
};
