"use client";

import { useEffect, useState } from "react";
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

interface UseProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = () => setTick((t) => t + 1);

  useEffect(() => {
    const supabase = createClient();

    async function fetchProfile() {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

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

        if (profileError) {
          setError("Erro ao carregar perfil.");
          setProfile(null);
          return;
        }

        setProfile({ ...data, email: user.email });
      } catch {
        setError("Erro inesperado ao carregar perfil.");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [tick]);

  return { profile, loading, error, refetch };
}

/** Returns true if the role has any admin/staff access */
export function isStaff(role: UserRole): boolean {
  return role !== "jovem";
}

/** Returns true if the role can access the full admin panel */
export function canAccessAdmin(role: UserRole): boolean {
  return role !== "jovem" && role !== "consultor";
}

/** Returns true if the role can manage users and companies */
export function canManageUsers(role: UserRole): boolean {
  return role === "coordenador" || role === "casal_diretor";
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
  medico: "Médico(a)",
  logistica: "Logística",
  coordenador: "Coordenador(a)",
  casal_diretor: "Casal Diretor",
};
