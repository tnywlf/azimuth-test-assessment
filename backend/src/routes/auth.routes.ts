import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { registerUser, loginUser, getMe } from "../controllers/auth.controller";

const router = Router();

// Public endpoints (no auth required)
router.post("/register", registerUser);
router.post("/login", loginUser);

// Authenticated endpoint
router.get("/me", authenticate, getMe);

export default router;
