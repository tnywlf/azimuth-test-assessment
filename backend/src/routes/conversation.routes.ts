import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getConversations,
  createConversation,
  getConversationById,
  sendMessage,
} from "../controllers/conversation.controller";

const router = Router();

router.get("/", authenticate, getConversations);
router.post("/", authenticate, createConversation);
router.get("/:id", authenticate, getConversationById);
router.post("/:id/messages", authenticate, sendMessage);

export default router;
