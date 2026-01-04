import express from "express";
import type { Request, Response } from "express";

const app = express();
const PORT = process.env.PORT || 4000;

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[financial-graph-backend] Listening on port ${PORT}`);
});
