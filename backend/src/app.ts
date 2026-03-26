import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import { router as apiRouter } from "./routes";

const app: Application = express();

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Request Logger ───
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  if (req.method !== "GET" && Object.keys(req.body || {}).length > 0) {
    // Log body but redact sensitive fields
    const safeBody = { ...req.body };
    if (safeBody.password) safeBody.password = "***";
    if (safeBody.token) safeBody.token = "***";
    console.log("  Body:", JSON.stringify(safeBody));
  }
  if (req.headers.authorization) {
    console.log("  Auth: Bearer ***" + req.headers.authorization.slice(-8));
  } else {
    console.log("  Auth: (none)");
  }
  next();
});

// Routes
app.use("/api", apiRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[ERROR]", err.message, err.stack);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
