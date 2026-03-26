import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  summarize,
  smartReplies,
  issueDetection,
  dashboardInsights,
  semanticSearch,
} from "../controllers/ai.controller";

const router = Router();

router.post("/summarize/:conversationId", authenticate, summarize);
router.post("/smart-replies/:conversationId", authenticate, smartReplies);
router.post("/detect-issues/:conversationId", authenticate, issueDetection);
router.get("/insights", authenticate, dashboardInsights);
router.post("/search", authenticate, semanticSearch);

export default router;
