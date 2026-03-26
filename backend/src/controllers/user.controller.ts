import { Response } from "express";
import { supabase } from "../config/supabase";
import { AuthRequest } from "../types";

/**
 * GET /api/users
 * List users with optional role filter.
 */
export const getUsers = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { role } = req.query;

    let query = supabase
      .from("profiles")
      .select("id, email, full_name, role, phone, created_at")
      .order("full_name");

    if (role && typeof role === "string") {
      query = query.eq("role", role);
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: "Failed to fetch users" });
      return;
    }

    res.json({ data });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * GET /api/users/:id
 * Get a single user's profile.
 */
export const getUserById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, phone, created_at")
      .eq("id", id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ data });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};
