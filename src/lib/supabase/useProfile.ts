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

/** Share one profile subscription across all consumers inside the provider. */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const value = useInternalProfile(true);
  return React.createElement(ProfileContext.Provider, { value }, children);
}

function useInternalProfile(enabled: boolean): UseProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    let requestVersion = 0;
    let currentUserId: string | null = null;
    let currentRole: UserRole | null = null;
    let fetching = false;
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    const supabase = createClient();

    async function fetchProfile(background = false) {
      if (background && fetching) return;
      const version = ++requestVersion;
      const isCurrent = () => isMounted && version === requestVersion;
      fetching = true;
      if (!background) setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!isCurrent()) return;

        if (userError) {
          setError("Erro ao verificar a sessão.");
          if (!background) {
            currentUserId = null;
            currentRole = null;
            setProfile(null);
          }
          return;
        }

        if (!user) {
          currentUserId = null;
          currentRole = null;
          setProfile(null);
          return;
        }

        currentUserId = user.id;
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (!isCurrent()) return;

        if (profileError) {
          setError("Erro ao carregar perfil.");
          if (!background) setProfile(null);
        } else {
          setProfile({ ...data, email: user.email });
          const roleChanged = currentRole !== null && currentRole !== data.role;
          currentRole = data.role;
          // A página nova aplica o redirecionamento do cargo e descarta dados da tela anterior.
          if (roleChanged) window.location.reload();
        }
      } catch {
        if (isCurrent()) {
          if (!background) setProfile(null);
          setError("Erro inesperado ao carregar perfil.");
        }
      } finally {
        if (isCurrent()) {
          fetching = false;
          if (!background) setLoading(false);
        }
      }
    }

    void fetchProfile();

    // Alterações administrativas não disparam eventos do Auth para a outra pessoa.
    // Revalida sem desmontar formulários; as APIs já consultam o cargo a cada chamada.
    const refreshVisibleProfile = () => {
      if (!isMounted || !currentUserId || document.visibilityState === "hidden") return;
      void fetchProfile(true);
    };
    const refreshInterval = window.setInterval(refreshVisibleProfile, 60_000);
    window.addEventListener("focus", refreshVisibleProfile);
    document.addEventListener("visibilitychange", refreshVisibleProfile);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT") {
        // Discard any profile response that arrives after logout.
        ++requestVersion;
        clearTimeout(authTimer);
        currentUserId = null;
        currentRole = null;
        setProfile(null);
        setError(null);
        setLoading(false);
      } else if (
        event === "USER_UPDATED" ||
        event === "TOKEN_REFRESHED" ||
        (event === "SIGNED_IN" && session?.user.id !== currentUserId)
      ) {
        const nextUserId = session?.user.id ?? null;
        if (nextUserId !== currentUserId) {
          currentRole = null;
          setProfile(null);
        }
        const background = event === "TOKEN_REFRESHED" && nextUserId === currentUserId;
        currentUserId = nextUserId;
        clearTimeout(authTimer);
        if (!background) {
          ++requestVersion;
          setLoading(true);
        }
        // Auth callbacks run under the client's lock. Fetch after it is released.
        authTimer = setTimeout(() => void fetchProfile(background), 0);
      }
    });

    return () => {
      isMounted = false;
      ++requestVersion;
      clearTimeout(authTimer);
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshVisibleProfile);
      document.removeEventListener("visibilitychange", refreshVisibleProfile);
      subscription.unsubscribe();
    };
  }, [enabled, tick]);

  return useMemo(
    () => ({ profile, loading, error, refetch }),
    [profile, loading, error, refetch]
  );
}

/** Consumers outside the provider retain an independent profile subscription. */
export function useProfile(): UseProfileReturn {
  const context = useContext(ProfileContext);
  const fallback = useInternalProfile(context === undefined);
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
