"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type UserRole =
  | "jovem"
  | "consultor"
  | "midia"
  | "medico"
  | "logistica"
  | "coordenador"
  | "casal_diretor";

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  company_id: string | null;
  stake: string | null;
  room: string | null;
  phone: string | null;
  avatar_url: string | null;
  email?: string;
}

export interface UseProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const ProfileContext = createContext<UseProfileReturn | undefined>(undefined);

/**
 * Shared ProfileProvider: ensures Supabase user profile is loaded once and shared
 * across the entire application, eliminating staggered loading and duplicate network calls.
 */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function fetchProfile() {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (userError || !user) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (!isMounted) return;

        if (profileError) {
          setError("Erro ao carregar perfil.");
          setProfile(null);
        } else {
          setProfile({ ...data, email: user.email });
        }
      } catch {
        if (isMounted) {
          setError("Erro inesperado ao carregar perfil.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchProfile();

    // Listen to auth state changes to keep profile in sync
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setLoading(false);
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        fetchProfile();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [tick]);

  const value = useMemo(
    () => ({ profile, loading, error, refetch }),
    [profile, loading, error, refetch]
  );

  return React.createElement(ProfileContext.Provider, { value }, children);
}

function useInternalProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function fetchProfile() {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (userError || !user) {
          setError("Sessão expirada. Faça login novamente.");
          setProfile(null);
          return;
        }

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (!isMounted) return;

        if (profileError) {
          setError("Erro ao carregar perfil.");
          setProfile(null);
          return;
        }

        setProfile({ ...data, email: user.email });
      } catch {
        if (isMounted) {
          setError("Erro inesperado ao carregar perfil.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [tick]);

  return { profile, loading, error, refetch };
}

/**
 * Access the shared user profile. If rendered outside ProfileProvider,
 * automatically falls back to an isolated fetch instance.
 */
export function useProfile(): UseProfileReturn {
  const context = useContext(ProfileContext);
  const fallback = useInternalProfile();
  return context ?? fallback;
}

/** Returns true if the role is a master admin (Casal Diretor, Coordenadores, Logística) with full access to all panels */
export function isMasterAdmin(role: UserRole): boolean {
  return role === "casal_diretor" || role === "coordenador" || role === "logistica";
}

/** Returns true if the role has any admin/staff access */
export function isStaff(role: UserRole): boolean {
  return role !== "jovem";
}

/** Returns true if the role can access the full admin panel */
export function canAccessAdmin(role: UserRole): boolean {
  return role !== "jovem" && role !== "consultor";
}

/** Returns true if the role can manage users */
export function canManageUsers(role: UserRole): boolean {
  return role === "coordenador" || role === "casal_diretor" || role === "logistica";
}

/** Returns true if the role can manage companies and assign counselors */
export function canManageCompanies(role: UserRole): boolean {
  return role === "coordenador" || role === "casal_diretor" || role === "logistica";
}

/** Returns true if the role can manage media/photos */
export function canManageMedia(role: UserRole): boolean {
  return role !== "jovem" && role !== "consultor";
}

/** Human-readable role labels in Portuguese */
export const ROLE_LABELS: Record<UserRole, string> = {
  jovem: "Jovem",
  consultor: "Consultor(a)",
  midia: "Mídia",
  medico: "Equipe Multidisciplinar",
  logistica: "Logística",
  coordenador: "Coordenador(a)",
  casal_diretor: "Casal Diretor",
};
