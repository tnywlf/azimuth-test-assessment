import { Response } from "express";
import { supabase } from "../config/supabase";
import { AuthRequest } from "../types";
import { createNotification } from "../services/notification.service";

const PROPERTY_SELECT = `
  *,
  landlord:landlord_id(id, full_name, email, role),
  agent:agent_id(id, full_name, email, role),
  property_tenants(
    id, tenant_id, lease_start, lease_end, status,
    tenant:tenant_id(id, full_name, email, role)
  )
`;

/**
 * GET /api/properties
 * List properties filtered by the current user's role.
 */
export const getProperties = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user!;
    let query = supabase.from("properties").select(PROPERTY_SELECT);

    if (user.role === "landlord") {
      query = query.eq("landlord_id", user.id);
    } else if (user.role === "agent") {
      query = query.eq("agent_id", user.id);
    } else if (user.role === "tenant") {
      // Tenants see properties they are assigned to
      const { data: assignments } = await supabase
        .from("property_tenants")
        .select("property_id")
        .eq("tenant_id", user.id);

      const propertyIds = assignments?.map((a) => a.property_id) || [];
      if (propertyIds.length === 0) {
        res.json({ data: [] });
        return;
      }
      query = query.in("id", propertyIds);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: "Failed to fetch properties" });
      return;
    }

    res.json({ data });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * GET /api/properties/all
 * List all properties (for agents to browse unassigned ones too).
 */
export const getAllProperties = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from("properties")
      .select(PROPERTY_SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: "Failed to fetch properties" });
      return;
    }

    res.json({ data });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * GET /api/properties/:id
 */
export const getPropertyById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("properties")
      .select(PROPERTY_SELECT)
      .eq("id", id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: "Property not found" });
      return;
    }

    res.json({ data });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * POST /api/properties
 * Create a new property (landlord or agent only).
 */
export const createProperty = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user!;
    const {
      title,
      description,
      address,
      city,
      state,
      zip_code,
      property_type,
      bedrooms,
      bathrooms,
      rent_amount,
    } = req.body;

    if (!title || !address) {
      res.status(400).json({ error: "title and address are required" });
      return;
    }

    const insertData: Record<string, unknown> = {
      title,
      description,
      address,
      city,
      state,
      zip_code,
      property_type: property_type || "apartment",
      bedrooms: bedrooms || 0,
      bathrooms: bathrooms || 0,
      rent_amount: rent_amount || 0,
      landlord_id: user.role === "landlord" ? user.id : req.body.landlord_id,
    };

    if (user.role === "agent") {
      insertData.agent_id = user.id;
      if (!req.body.landlord_id) {
        res.status(400).json({ error: "landlord_id is required when agent creates property" });
        return;
      }
    }

    const { data, error } = await supabase
      .from("properties")
      .insert(insertData)
      .select(PROPERTY_SELECT)
      .single();

    if (error) {
      res.status(500).json({ error: "Failed to create property", details: error.message });
      return;
    }

    res.status(201).json({ data });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * PUT /api/properties/:id
 */
export const updateProperty = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    // Verify ownership
    const { data: existing } = await supabase
      .from("properties")
      .select("landlord_id, agent_id")
      .eq("id", id)
      .single();

    if (!existing) {
      res.status(404).json({ error: "Property not found" });
      return;
    }

    if (existing.landlord_id !== user.id && existing.agent_id !== user.id) {
      res.status(403).json({ error: "Not authorized to update this property" });
      return;
    }

    const allowedFields = [
      "title", "description", "address", "city", "state", "zip_code",
      "property_type", "bedrooms", "bathrooms", "rent_amount", "status",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const { data, error } = await supabase
      .from("properties")
      .update(updateData)
      .eq("id", id)
      .select(PROPERTY_SELECT)
      .single();

    if (error) {
      res.status(500).json({ error: "Failed to update property" });
      return;
    }

    res.json({ data });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * POST /api/properties/:id/tenants
 * Assign a tenant to a property.
 */
export const assignTenant = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { tenant_id, lease_start, lease_end } = req.body;

    if (!tenant_id) {
      res.status(400).json({ error: "tenant_id is required" });
      return;
    }

    // Verify ownership
    const { data: property } = await supabase
      .from("properties")
      .select("landlord_id, agent_id")
      .eq("id", id)
      .single();

    if (!property) {
      res.status(404).json({ error: "Property not found" });
      return;
    }

    if (property.landlord_id !== user.id && property.agent_id !== user.id) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    // Verify tenant exists and is a tenant
    const { data: tenant } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", tenant_id)
      .single();

    if (!tenant || tenant.role !== "tenant") {
      res.status(400).json({ error: "Invalid tenant ID" });
      return;
    }

    const { data, error } = await supabase
      .from("property_tenants")
      .insert({
        property_id: id,
        tenant_id,
        lease_start: lease_start || null,
        lease_end: lease_end || null,
      })
      .select("*, tenant:tenant_id(id, full_name, email, role)")
      .single();

    if (error) {
      if (error.code === "23505") {
        res.status(409).json({ error: "Tenant already assigned to this property" });
        return;
      }
      res.status(500).json({ error: "Failed to assign tenant" });
      return;
    }

    // Update property status to occupied
    await supabase.from("properties").update({ status: "occupied" }).eq("id", id);

    // Get property title for notification
    const { data: propInfo } = await supabase
      .from("properties")
      .select("title")
      .eq("id", id)
      .single();

    // Send push notification to the assigned tenant
    createNotification({
      userId: tenant_id,
      type: "tenant_assigned",
      title: "Assigned to Property",
      body: `You have been assigned to "${propInfo?.title || "a property"}" by ${user.full_name}.`,
      data: { property_id: id },
    }).catch((err) =>
      console.error("[NOTIFY] Tenant assignment notification error:", err)
    );

    res.status(201).json({ data });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * DELETE /api/properties/:id/tenants/:tenantId
 * Remove a tenant from a property.
 */
export const removeTenant = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user!;
    const { id, tenantId } = req.params;

    // Verify ownership
    const { data: property } = await supabase
      .from("properties")
      .select("landlord_id, agent_id")
      .eq("id", id)
      .single();

    if (!property) {
      res.status(404).json({ error: "Property not found" });
      return;
    }

    if (property.landlord_id !== user.id && property.agent_id !== user.id) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const { error } = await supabase
      .from("property_tenants")
      .delete()
      .eq("property_id", id)
      .eq("tenant_id", tenantId);

    if (error) {
      res.status(500).json({ error: "Failed to remove tenant" });
      return;
    }

    // Check if property still has tenants
    const { data: remaining } = await supabase
      .from("property_tenants")
      .select("id")
      .eq("property_id", id);

    if (!remaining || remaining.length === 0) {
      await supabase.from("properties").update({ status: "available" }).eq("id", id);
    }

    // Get property title for notification
    const { data: propInfo } = await supabase
      .from("properties")
      .select("title")
      .eq("id", id)
      .single();

    // Send push notification to the removed tenant
    createNotification({
      userId: tenantId,
      type: "tenant_removed",
      title: "Removed from Property",
      body: `You have been removed from "${propInfo?.title || "a property"}" by ${user.full_name}.`,
      data: { property_id: id },
    }).catch((err) =>
      console.error("[NOTIFY] Tenant removal notification error:", err)
    );

    res.json({ message: "Tenant removed successfully" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};
