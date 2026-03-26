import { Request, Response } from "express";
import { supabase } from "../config/supabase";
import { AuthRequest } from "../types";

/**
 * POST /api/auth/register
 * Full server-side registration: creates Supabase auth user + profile.
 * No auth middleware needed — this is the public registration endpoint.
 * Uses the service role key to auto-confirm the email.
 */
export const registerUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password, full_name, role, phone } = req.body;
    console.log("[REGISTER] Attempt:", email, "role:", role);

    // Validate input
    if (!email || !password || !full_name || !role) {
      res.status(400).json({
        error: "email, password, full_name, and role are required",
      });
      return;
    }

    if (!["tenant", "landlord", "agent"].includes(role)) {
      res
        .status(400)
        .json({ error: "role must be tenant, landlord, or agent" });
      return;
    }

    if (password.length < 6) {
      res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
      return;
    }

    // 1. Create the auth user via admin API (auto-confirms email)
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // <-- auto-confirms
        user_metadata: { full_name, role },
      });

    if (authError) {
      console.error("[REGISTER] Auth error:", authError.message);

      // Handle duplicate email
      if (authError.message.includes("already been registered")) {
        res.status(409).json({ error: "An account with this email already exists" });
        return;
      }

      res.status(400).json({ error: authError.message });
      return;
    }

    const user = authData.user;
    console.log("[REGISTER] Auth user created:", user.id);

    // 2. Create the profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        full_name,
        role,
        phone: phone || null,
      })
      .select()
      .single();

    if (profileError) {
      console.error(
        "[REGISTER] Profile error:",
        profileError.message,
        profileError.details
      );
      // Clean up: delete the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(user.id);
      res
        .status(500)
        .json({ error: "Failed to create profile: " + profileError.message });
      return;
    }

    console.log("[REGISTER] Profile created:", profile.id, profile.full_name);

    // 3. Sign in the user to get a session (so frontend can use it)
    // We don't return the session from here — frontend will sign in separately.
    res.status(201).json({ data: profile });
  } catch (err: any) {
    console.error("[REGISTER] Exception:", err.message);
    res.status(500).json({ error: "Registration failed: " + err.message });
  }
};

/**
 * POST /api/auth/login
 * Server-side login: validates credentials via Supabase and returns session.
 * This endpoint lets us log the login attempt and return the session + profile.
 */
export const loginUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;
    console.log("[LOGIN] Attempt:", email);

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    // Sign in via Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log("[LOGIN] Failed:", error.message);
      res.status(401).json({ error: error.message });
      return;
    }

    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      console.log("[LOGIN] No profile found for user:", data.user.id);
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    console.log("[LOGIN] Success:", profile.full_name, `(${profile.role})`);

    res.json({
      data: {
        session: data.session,
        profile,
      },
    });
  } catch (err: any) {
    console.error("[LOGIN] Exception:", err.message);
    res.status(500).json({ error: "Login failed: " + err.message });
  }
};

/**
 * GET /api/auth/me
 * Return the current authenticated user's profile.
 * Uses `authenticate` middleware.
 */
export const getMe = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    console.log("[GET ME] Returning profile for:", req.user?.full_name);
    res.json({ data: req.user });
  } catch (err: any) {
    console.error("[GET ME] Exception:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
