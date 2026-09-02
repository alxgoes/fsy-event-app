"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Search,
  Save,
  RefreshCw,
  Edit3,
  CheckCircle2,
  Loader2,
  X,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UserRole, ROLE_LABELS } from "@/lib/supabase/useProfile";

interface UserRecord {
  id: string;
  full_name: string;
  role: UserRole;
  company_id: string | null;
  stake: string | null;
  room: string | null;
  email?: string;
  avatar_url: string | null;
}

interface Company {
  id: string;
  name: string;
}

const ALL_ROLES: UserRole[] = [
  "jovem",
  "consultor",
  "midia",
  "medico",
  "logistica",
  "coordenador",
  "casal_diretor",
];

const ROLE_COLORS: Record<UserRole, string> = {
  jovem: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  consultor: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  midia: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  medico: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  logistica: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  coordenador: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  casal_diretor: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

export function UserManager() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<UserRecord>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Try server admin API route with anti-cache
      const res = await fetch(`/api/users?_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.users) {
          setUsers(json.users as UserRecord[]);
          if (json.companies) setCompanies(json.companies as Company[]);
          setLoading(false);
          return;
        }
      }

      // 2. Fallback to client Supabase
      const supabase = createClient();
      const [usersRes, companiesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, role, company_id, stake, room, avatar_url")
          .order("full_name"),
        supabase.from("companies").select("id, name").order("name"),
      ]);

      if (usersRes.error) {
        setError("Erro ao carregar usuários: " + usersRes.error.message);
      } else {
        setUsers(usersRes.data as UserRecord[]);
      }

      if (!companiesRes.error && companiesRes.data) {
        setCompanies(companiesRes.data as Company[]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError("Erro ao carregar usuários: " + msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const startEdit = (user: UserRecord) => {
    setEditingId(user.id);
    setEditValues({
      role: user.role,
      company_id: user.company_id,
      stake: user.stake,
      room: user.room,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveUser = async (userId: string) => {
    setSaving(userId);
    setError(null);

    try {
      const payload = {
        id: userId,
        role: editValues.role,
        company_id: editValues.company_id || null,
        stake: editValues.stake || null,
        room: editValues.room || null,
      };

      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Falha ao salvar usuário no banco de dados.");
      }

      setSavedId(userId);
      setTimeout(() => setSavedId(null), 2500);

      // Update local state immediately
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? ({ ...u, ...editValues } as UserRecord) : u
        )
      );
      setEditingId(null);
      setEditValues({});

      // Reload fresh data from database
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError("Erro ao salvar alteração: " + msg);
    } finally {
      setSaving(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.full_name.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#007DA5] text-white border-2 border-slate-900 dark:border-slate-700 shadow-sm">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-heading text-2xl font-black text-slate-900 dark:text-white">
              Gestão de Usuários
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {users.length} usuário(s) registrado(s)
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 px-4 py-2.5 text-sm font-black shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-2xl border-2 border-red-500 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm font-bold text-red-700 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="underline text-xs">
            fechar
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            aria-label="Buscar usuário por nome"
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007DA5] transition-all"
          />
        </div>
        <select
          aria-label="Filtrar usuários por função"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-4 py-2.5 rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007DA5] transition-all"
        >
          <option value="all">Todas as funções</option>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      {/* User Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#007DA5]" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500">
          <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-bold">Nenhum usuário encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => {
            const isEditing = editingId === user.id;
            const isSaving = saving === user.id;
            const justSaved = savedId === user.id;

            return (
              <motion.div
                key={user.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border-2 p-4 transition-all ${
                  isEditing
                    ? "border-[#007DA5] bg-sky-50/50 dark:bg-sky-950/20 shadow-sm"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* User Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#06D6A0] text-slate-950 font-black text-sm border-2 border-slate-900 dark:border-slate-600 shrink-0">
                      {user.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {user.full_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-black ${ROLE_COLORS[user.role] || "bg-slate-100 text-slate-800"}`}
                        >
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                        {user.company_id && (
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {user.company_id}
                          </span>
                        )}
                        {user.room && (
                          <span className="text-xs font-bold text-slate-400">
                            • {user.room}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Edit Form (shown when editing) */}
                  {isEditing ? (
                    <div className="flex flex-col sm:flex-row gap-3 flex-1">
                      {/* Role */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-black uppercase text-slate-500">
                          Função
                        </label>
                        <select
                          aria-label="Alterar função"
                          value={editValues.role}
                          onChange={(e) =>
                            setEditValues((v) => ({
                              ...v,
                              role: e.target.value as UserRole,
                            }))
                          }
                          className="px-3 py-2 rounded-xl border-2 border-slate-900 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007DA5]"
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Company */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-black uppercase text-slate-500">
                          Companhia
                        </label>
                        <select
                          aria-label="Alterar companhia"
                          value={editValues.company_id ?? ""}
                          onChange={(e) =>
                            setEditValues((v) => ({
                              ...v,
                              company_id: e.target.value || null,
                            }))
                          }
                          className="px-3 py-2 rounded-xl border-2 border-slate-900 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007DA5]"
                        >
                          <option value="">Sem companhia</option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Room */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-black uppercase text-slate-500">
                          Alojamento
                        </label>
                        <input
                          type="text"
                          aria-label="Alterar alojamento"
                          placeholder="ex: Bloco A - 204"
                          value={editValues.room ?? ""}
                          onChange={(e) =>
                            setEditValues((v) => ({ ...v, room: e.target.value }))
                          }
                          className="px-3 py-2 rounded-xl border-2 border-slate-900 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007DA5] w-32"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex items-end gap-2">
                        <button
                          onClick={() => saveUser(user.id)}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 rounded-xl bg-[#007DA5] text-white px-3 py-2 text-xs font-black border-2 border-slate-900 shadow-sm hover:bg-[#005E7C] disabled:opacity-60 transition-colors"
                        >
                          {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Salvar
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-1 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 text-xs font-black border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {justSaved && (
                        <span className="flex items-center gap-1 text-xs font-black text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-4 w-4" />
                          Salvo!
                        </span>
                      )}
                      <button
                        onClick={() => startEdit(user)}
                        className="flex items-center gap-1.5 rounded-xl bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 px-3 py-2 text-xs font-black text-slate-700 dark:text-slate-300 hover:border-slate-900 dark:hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all shadow-brutal-sm"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Editar
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
