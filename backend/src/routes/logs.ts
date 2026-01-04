import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import type { LogEntry } from "@financial-graph/shared/logger";
import fs from "node:fs/promises";
import path from "node:path";

const router: Router = createRouter();

// Directory for frontend logs
const FRONTEND_LOG_DIR = path.join(
  process.cwd(),
  "output",
  "logs",
  "frontend"
);

// Ensure log directory exists
async function ensureLogDir() {
  await fs.mkdir(FRONTEND_LOG_DIR, { recursive: true });
}

/**
 * Endpoint to receive logs from frontend
 * POST /api/logs
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { logs } = req.body as { logs: LogEntry[] };

    if (!Array.isArray(logs) || logs.length === 0) {
      res.status(400).json({ error: "Invalid logs payload" });
      return;
    }

    // Ensure log directory exists
    await ensureLogDir();

    // Group logs by date for daily rotation
    const logsByDate = new Map<string, LogEntry[]>();

    for (const log of logs) {
      const isoDate = new Date(log.timestamp).toISOString();
      const date = isoDate.split("T")[0] || isoDate;
      const dateLogs = logsByDate.get(date);
      if (dateLogs) {
        dateLogs.push(log);
      } else {
        logsByDate.set(date, [log]);
      }
    }

    // Write logs to date-specific files
    for (const [date, dateLogs] of logsByDate.entries()) {
      const logFile = path.join(FRONTEND_LOG_DIR, `frontend-${date}.log`);

      // Append logs as newline-delimited JSON
      const logLines = dateLogs.map((log) => JSON.stringify(log)).join("\n");

      await fs.appendFile(logFile, logLines + "\n", "utf-8");
    }

    res.json({
      success: true,
      received: logs.length,
    });
  } catch (error) {
    console.error("Error writing frontend logs:", error);
    res.status(500).json({ error: "Failed to write logs" });
  }
});

export default router;
