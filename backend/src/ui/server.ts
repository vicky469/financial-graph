/**
 * Job Configuration API Server
 *
 * REST API for job mutations using Express.
 * Reads use InstantDB live queries in the frontend.
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger.json";
import { createLogger } from "../utils/logger";
import { asyncHandler } from "../utils/async-handler";
import { JobService } from "../services/job-service";

const logger = createLogger("ui/server");

export async function startDirectUIServer(): Promise<void> {
  const PORT = process.env.UI_PORT || 3001;
  const app = express();
  const jobService = new JobService();
  const isDev = process.env.NODE_ENV !== "production";

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Swagger UI
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Logo handler - serves from shared/public/logo.svg
  const serveLogo = (_req: Request, res: Response) => {
    const logoPath = path.resolve(__dirname, "../../../shared/public/logo.svg");
    const content = fs.readFileSync(logoPath, "utf-8");
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(content);
  };

  app.get("/favicon.ico", serveLogo);
  app.get("/logo.svg", serveLogo);

  // Chrome DevTools PWA manifest - return 204 No Content to suppress error
  app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
    res.status(204).end();
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post(
    "/api/jobs/:id/toggle",
    asyncHandler(async (req: Request, res: Response) => {
      const id = req.params.id as string;
      const { enabled } = req.body;

      if (typeof enabled !== "boolean") {
        return res
          .status(400)
          .json({ error: "enabled field must be a boolean" });
      }

      const job = await jobService.toggleJob(id, enabled);
      logger.info(`Toggled job ${id} to ${enabled ? "enabled" : "disabled"}`);

      res.json({ job });
    }),
  );

  app.post(
    "/api/jobs/:id/execute",
    asyncHandler(async (req: Request, res: Response) => {
      const id = req.params.id as string;
      const execution = await jobService.executeJob(id, "ui-user");

      logger.info(`Started execution ${execution.id} for job ${id}`);
      res.json({ execution });
    }),
  );

  app.post(
    "/api/jobs/:id/executions/:executionId/stop",
    asyncHandler(async (req: Request, res: Response) => {
      const id = req.params.id as string;
      const executionId = req.params.executionId as string;

      // Update execution status to failed/cancelled
      await jobService.updateExecutionStatus(executionId, "failed", {
        errorMessage: "Job stopped by user",
      });

      logger.info(`Stopped execution ${executionId} for job ${id}`);
      res.json({ success: true, message: "Job execution stopped" });
    }),
  );

  app.delete(
    "/api/jobs/:id",
    asyncHandler(async (req: Request, res: Response) => {
      const id = req.params.id as string;
      await jobService.deleteJob(id);

      logger.info(`Deleted job ${id}`);
      res.json({ success: true });
    }),
  );

  app.post(
    "/api/jobs",
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body;

      // Log received payload for debugging
      logger.info("[API POST /api/jobs] Received payload:", { payload: body });

      if (!body.name || typeof body.name !== "string") {
        return res.status(400).json({ error: "Job name is required" });
      }

      body.created_by = body.created_by || "ui-user";
      const job = await jobService.createJob(body);

      logger.info(`Created job ${job.id} (${job.name})`);
      res.status(201).json({ job });
    }),
  );

  app.put(
    "/api/jobs/:id",
    asyncHandler(async (req: Request, res: Response) => {
      const id = req.params.id as string;
      const body = req.body;

      // Log received payload for debugging
      logger.info(`[API PUT /api/jobs/${id}] Received payload:`, {
        payload: body,
      });

      const job = await jobService.updateJob(id, body);

      logger.info(`Updated job ${id}`);
      res.json({ job });
    }),
  );

  // Get execution details
  app.get(
    "/api/executions/:executionId/details",
    asyncHandler(async (req: Request, res: Response) => {
      const executionId = req.params.executionId as string;

      // Get execution from InstantDB
      const execution = await jobService.getExecution(executionId);

      res.json({
        execution,
        logs: [],
      });
    }),
  );

  // Serve static files with no-cache in dev mode
  if (isDev) {
    app.use((req, res, next) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      next();
    });
  }
  app.use(express.static(path.join(__dirname)));

  // Serve React app for all other routes (must be before error handler)
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
  });

  // Error handler (must be last, with 4 parameters)
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error(`Request error on ${req.method} ${req.path}:`, err);
    res.status(500).json({
      error: "Request failed",
      message: err.message,
    });
  });

  app.listen(PORT, () => {
    logger.info(`Job Configuration UI running on http://localhost:${PORT}`);
    logger.info(`Swagger API docs: http://localhost:${PORT}/api-docs`);
  });
}
