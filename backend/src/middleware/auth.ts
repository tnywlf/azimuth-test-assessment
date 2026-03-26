import { Response, NextFunction } from "express";
import { supabase } from "../config/supabase";
import { AuthRequest } from "../types";

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(req: AuthRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.split(" ")[1];
}

/**
 * Light middleware — verifies Supabase JWT only (no profile required).
 * Used for the registration endpoint where the profile doesn't exist yet.
 */
export const verifyToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractToken(req);
  if (!token) {
    console.log("[AUTH] verifyToken: No token provided");
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.log("[AUTH] verifyToken: Invalid token —", error?.message);
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    console.log("[AUTH] verifyToken: OK — user:", user.id, user.email);
    req.supabaseUser = user;
    req.token = token;
    next();
  } catch (err: any) {
    console.error("[AUTH] verifyToken: Exception —", err.message);
    res.status(401).json({ error: "Authentication failed" });
  }
};

/**
 * Full middleware — verifies JWT AND loads the user profile.
 * Used for all authenticated endpoints that need the profile.
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractToken(req);
  if (!token) {
    console.log("[AUTH] authenticate: No token provided");
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.log("[AUTH] authenticate: Invalid token —", error?.message);
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.log(
        "[AUTH] authenticate: Profile not found for user:",
        user.id,
        "—",
        profileError?.message
      );
      res
        .status(403)
        .json({ error: "Profile not found. Please complete registration." });
      return;
    }

    console.log("[AUTH] authenticate: OK —", profile.full_name, `(${profile.role})`);
    req.user = profile;
    req.supabaseUser = user;
    req.token = token;
    next();
  } catch (err: any) {
    console.error("[AUTH] authenticate: Exception —", err.message);
    res.status(401).json({ error: "Authentication failed" });
  }
};

/**
 * Role-based authorization middleware.
 * Must be used AFTER `authenticate`.
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      console.log("[AUTH] authorize: Denied — role:", req.user?.role, "required:", roles);
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
};
