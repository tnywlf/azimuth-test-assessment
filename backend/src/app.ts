import express, { Application } from "express";
import cors from "cors";
import { router as apiRouter } from "./routes";

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", apiRouter);

export default app;
