import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handlePredictions } from "./routes/predictions";
import { handlePerformanceStats } from "./routes/performance-stats";
import { handleFixtureIds } from "./routes/fixture-ids";
import { handlePastPredictions } from "./routes/past-predictions";
import { handleBetigoloHistory } from "./routes/betigolo-history";
import {
  handleBetminerAccumulators,
  handleClearBetminerCache,
} from "./routes/betminer-accumulators";
import { handleCheckAuth, handleVerifySubscription } from "./routes/auth";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/debug/env", (_req, res) => {
    res.json({
      hasApiKey: !!process.env.RAPIDAPI_KEY,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/auth", handleCheckAuth);
  app.post("/api/auth/verify", handleVerifySubscription);
  app.get("/api/demo", handleDemo);
  app.get("/api/predictions", handlePredictions);
  app.get("/api/performance-stats", handlePerformanceStats);
  app.get("/api/fixture-ids", handleFixtureIds);
  app.get("/api/past-predictions", handlePastPredictions);
  app.get("/api/betigolo-history", handleBetigoloHistory);
  app.get("/api/betminer-accumulators", handleBetminerAccumulators);
  app.post("/api/cache/clear", handleClearBetminerCache);

  return app;
}
