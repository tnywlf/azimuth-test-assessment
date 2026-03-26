import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../config/supabase";
import { authApi } from "../services/api";
import { Profile } from "../types";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: string,
    phone?: string
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from backend
  const fetchProfile = async () => {
    try {
      console.log("[Auth] Fetching profile...");
      const response = await authApi.getMe();
      console.log("[Auth] Profile loaded:", response.data.data?.full_name);
      setProfile(response.data.data);
    } catch (err: any) {
      console.error(
        "[Auth] fetchProfile failed:",
        err.response?.data?.error || err.message
      );
      setProfile(null);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      console.log("[Auth] Initial session:", s ? s.user.email : "none");
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      console.log("[Auth] State changed:", event);
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile();
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Register: calls backend which creates Supabase user + profile,
   * then signs in via Supabase client to get a local session.
   */
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: string,
    phone?: string
  ) => {
    console.log("[Auth] Registering:", email, "as", role);

    // 1. Create user + profile via backend (auto-confirms email)
    try {
      await authApi.register({
        email,
        password,
        full_name: fullName,
        role,
        phone,
      });
    } catch (err: any) {
      const message =
        err.response?.data?.error || "Registration failed";
      console.error("[Auth] Register error:", message);
      throw new Error(message);
    }

    // 2. Sign in via Supabase client to establish a local session
    console.log("[Auth] Signing in after registration...");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("[Auth] Post-register signIn error:", error.message);
      throw new Error(error.message);
    }

    console.log("[Auth] Signed in, session ready");
    setSession(data.session);
    setUser(data.user);

    await fetchProfile();
  };

  /**
   * Login: uses Supabase client to sign in, then fetches the profile.
   */
  const signIn = async (email: string, password: string) => {
    console.log("[Auth] Signing in:", email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("[Auth] signIn error:", error.message);
      throw error;
    }

    console.log("[Auth] SignIn OK");
    setSession(data.session);
    setUser(data.user);

    await fetchProfile();
  };

  const signOut = async () => {
    console.log("[Auth] Signing out");
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, session, loading, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
