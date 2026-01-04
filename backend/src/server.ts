import express from "express";
import type { Request, Response } from "express";
import logsRouter from "./routes/logs";
import { logger } from "./logger";

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json({ limit: "1mb" })); // For parsing JSON request bodies
app.use(express.urlencoded({ extended: true }));

// CORS for frontend
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Routes
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/logs", logsRouter);

app.listen(PORT, () => {
  logger.info("Backend server started", {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
  });
});
