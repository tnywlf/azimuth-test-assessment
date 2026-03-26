import { Router } from "express";
import healthRouter from "./health.routes";
import authRouter from "./auth.routes";
import userRouter from "./user.routes";
import propertyRouter from "./property.routes";
import conversationRouter from "./conversation.routes";
import aiRouter from "./ai.routes";
import notificationRouter from "./notification.routes";

const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/properties", propertyRouter);
router.use("/conversations", conversationRouter);
router.use("/ai", aiRouter);
router.use("/notifications", notificationRouter);

export { router };
