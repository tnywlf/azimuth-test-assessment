import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getNotifications,
  markRead,
  markAllRead,
  deleteNotification,
} from "../controllers/notification.controller";

const router = Router();

router.get("/", authenticate, getNotifications);
router.put("/read-all", authenticate, markAllRead);
router.put("/:id/read", authenticate, markRead);
router.delete("/:id", authenticate, deleteNotification);

export default router;
