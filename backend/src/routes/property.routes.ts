import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
  getProperties,
  getAllProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  assignTenant,
  removeTenant,
} from "../controllers/property.controller";

const router = Router();

router.get("/", authenticate, getProperties);
router.get("/all", authenticate, getAllProperties);
router.get("/:id", authenticate, getPropertyById);
router.post("/", authenticate, authorize("landlord", "agent"), createProperty);
router.put("/:id", authenticate, authorize("landlord", "agent"), updateProperty);
router.post("/:id/tenants", authenticate, authorize("landlord", "agent"), assignTenant);
router.delete("/:id/tenants/:tenantId", authenticate, authorize("landlord", "agent"), removeTenant);

export default router;
