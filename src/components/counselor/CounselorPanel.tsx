"use client";

import React, { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Heart, Loader2, MessageCircle, Pencil, Phone, Plus, Search, Trash2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Avatar } from "@/components/profile/Avatar";
import { PhotoReviews } from "@/components/counselor/PhotoReviews";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProfile } from "@/lib/supabase/useProfile";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/ui/relativeTime";
import { cn } from "@/lib/utils";

interface CompanyData {
  id: string;
  name: string;
  motto: string | null;
  color: string;
  counselors: string[];
}

interface YouthMember {
  id: string;
  full_name: string;
  room: string | null;
  stake: string | null;
  phone: string | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  target_company_id: string | null;
  created_at: string;
  likes_count?: number;
  profiles?: { full_name: string } | null;
}

type Priority = "normal" | "important" | "urgent";
const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "important", label: "Importante" },
  { value: "urgent", label: "Urgente" },
];

async function readJson(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error || "Não foi possível concluir. Tente de novo.");
  return body;
}

export function CounselorPanel() {
  const { profile, loading: profileLoading } = useProfile();
  const reduce = useReducedMotion();

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [youth, setYouth] = useState<YouthMember[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [notices, setNotices] = useState<Announcement[]>([]);
  const [firstLoad, setFirstLoad] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<"jovens" | "recados">("jovens");
  const [search, setSearch] = useState("");

  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [posting, setPosting] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [mottoOpen, setMottoOpen] = useState(false);
  const [motto, setMotto] = useState("");
  const [savingMotto, setSavingMotto] = useState(false);
  const [mottoError, setMottoError] = useState<string | null>(null);

  const companyId = profile?.company_id ?? null;

  /** Recarrega em segundo plano: a tela nunca some durante uma ação. */
  const load = useCallback(async () => {
    if (!companyId) {
      setFirstLoad(false);
      return;
    }
    setLoadError(null);
    try {
      const supabase = createClient();
      const [comp, members, ann, pics] = await Promise.all([
        supabase.from("companies").select("*").eq("id", companyId).single(),
        supabase.from("profiles").select("id, full_name, room, stake, phone").eq("company_id", companyId).eq("role", "jovem").order("full_name"),
        fetch(`/api/announcements?company_id=${encodeURIComponent(companyId)}&_t=${Date.now()}`).then(readJson),
        fetch("/api/profile/photo/company", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { data: {} })),
      ]);
      if (comp.error) throw comp.error;
      if (members.error) throw members.error;
      setCompany(comp.data as CompanyData);
      setYouth((members.data ?? []) as YouthMember[]);
      setNotices(((ann.data ?? []) as Announcement[]).filter((a) => a.target_company_id === companyId));
      setAvatars(pics.data ?? {});
    } catch {
      setLoadError("Não foi possível atualizar o painel agora. Verifique a conexão e tente de novo.");
    } finally {
      setFirstLoad(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!profileLoading && profile) startTransition(() => { load(); });
  }, [profileLoading, profile, load]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    setPosting(true);
    setComposeError(null);
    try {
      await readJson(
        await fetch("/api/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), content: content.trim(), priority, category: "Companhia", target_company_id: companyId }),
        })
      );
      setTitle("");
      setContent("");
      setPriority("normal");
      setComposeOpen(false);
      setTab("recados");
      await load();
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : "Não foi possível publicar.");
    } finally {
      setPosting(false);
    }
  }

  async function remove() {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await readJson(await fetch(`/api/announcements?id=${encodeURIComponent(toDelete.id)}`, { method: "DELETE" }));
      setNotices((list) => list.filter((n) => n.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Não foi possível remover.");
    } finally {
      setDeleting(false);
    }
  }

  async function saveMotto(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setSavingMotto(true);
    setMottoError(null);
    try {
      await readJson(
        await fetch("/api/companies", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: company.id, motto: motto.trim() || null, previous_motto: company.motto }),
        })
      );
      setCompany({ ...company, motto: motto.trim() || null });
      setMottoOpen(false);
    } catch (err) {
      setMottoError(err instanceof Error ? err.message : "Não foi possível salvar o lema.");
    } finally {
      setSavingMotto(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return youth;
    return youth.filter((y) => [y.full_name, y.room, y.stake].some((v) => (v ?? "").toLowerCase().includes(q)));
  }, [youth, search]);

  return (
    <div className="min-h-screen pb-28 md:pb-12">
      <Header />
      <main className="mx-auto max-w-5xl space-y-5 px-4 pt-6 sm:px-6">
        {firstLoad || profileLoading ? (
          <div className="space-y-4" aria-busy>
            <div className="h-24 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800" />
            <div className="h-64 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800" />
          </div>
        ) : !companyId ? (
          <section className="rounded-3xl bg-white p-6 text-center dark:bg-slate-900">
            <h1 className="font-heading text-2xl font-bold text-slate-950 dark:text-white">Painel do consultor</h1>
            <p className="mx-auto mt-2 max-w-md text-[15px] text-slate-700 dark:text-slate-300">
              Você ainda não está vinculado a uma companhia. Assim que a coordenação designar, seus jovens e recados aparecem aqui.
            </p>
            <div className="mt-6 text-left">
              <PhotoReviews />
            </div>
          </section>
        ) : (
          <>
            <section aria-label="Minha companhia" className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Painel do consultor</p>
                <h1 data-counselor-company-title="" className="break-words font-heading text-3xl font-bold text-slate-950 [overflow-wrap:anywhere] dark:text-white">{company?.name}</h1>
                <button
                  type="button"
                  onClick={() => {
                    setMotto(company?.motto ?? "");
                    setMottoOpen(true);
                  }}
                  className="group mt-1 inline-flex min-h-11 max-w-full items-center gap-2 text-left"
                >
                  <span className={cn("min-w-0 break-words font-scripture text-lg italic [overflow-wrap:anywhere]", company?.motto ? "text-slate-800 dark:text-slate-200" : "text-slate-500")}>
                    {company?.motto ? `“${company.motto}”` : "Definir lema da companhia"}
                  </span>
                  <Pencil className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:-rotate-12" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#007DA5] px-5 text-[15px] font-semibold text-white transition-[background-color,transform] hover:bg-[#005E7C] active:scale-[0.97]"
              >
                <Plus className="h-5 w-5" /> Novo recado
              </button>
            </section>

            {loadError && (
              <p role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
                {loadError}
                <button type="button" onClick={load} className="min-h-11 font-semibold underline">Tentar de novo</button>
              </p>
            )}

            <PhotoReviews />

            <div role="tablist" aria-label="Seções do painel" className="grid w-full min-w-0 max-w-md grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-1 rounded-2xl bg-slate-200/60 p-1 dark:bg-slate-800">
              {([
                ["jovens", `Jovens (${youth.length})`],
                ["recados", `Recados (${notices.length})`],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  type="button"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cn("relative min-h-11 min-w-0 whitespace-normal break-words rounded-full px-3 py-2 text-sm font-medium", tab === key ? "text-slate-950 dark:text-white" : "text-slate-600 dark:text-slate-300")}
                >
                  {tab === key && (
                    <motion.span layoutId="counselor-tab" className="absolute inset-0 rounded-full bg-white shadow-sm dark:bg-slate-950" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 44 }} />
                  )}
                  <span className="relative fsy-figure">{label}</span>
                </button>
              ))}
            </div>

            {tab === "jovens" ? (
              <section aria-label="Jovens da companhia" className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, quarto ou estaca" className="h-12 rounded-full pl-10" aria-label="Buscar jovem" />
                </div>
                {filtered.length === 0 ? (
                  <p className="rounded-2xl bg-white px-5 py-8 text-center text-[15px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    {youth.length === 0 ? "Nenhum jovem designado ainda." : "Ninguém encontrado com essa busca."}
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200/80 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                    {filtered.map((y) => {
                      const phone = y.phone?.replace(/\D/g, "") || null;
                      return (
                        <li key={y.id} className="flex items-center gap-3 px-4 py-3">
                          <Avatar name={y.full_name} src={avatars[y.id]} size={44} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-medium text-slate-950 dark:text-white">{y.full_name}</p>
                            <p className="truncate text-sm text-slate-600 dark:text-slate-300">
                              {[y.room ? `Quarto ${y.room}` : "Quarto a definir", y.stake].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          {phone && (
                            <div className="flex shrink-0 gap-1">
                              <a href={`https://wa.me/55${phone}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${y.full_name}`} className="flex h-11 w-11 items-center justify-center rounded-full text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50">
                                <MessageCircle className="h-5 w-5" />
                              </a>
                              <a href={`tel:${phone}`} aria-label={`Ligar para ${y.full_name}`} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                                <Phone className="h-5 w-5" />
                              </a>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ) : (
              <section aria-label="Recados da companhia" className="space-y-3">
                {notices.length === 0 ? (
                  <p className="rounded-2xl bg-white px-5 py-8 text-center text-[15px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">Nenhum recado publicado para a companhia ainda.</p>
                ) : (
                  <AnimatePresence initial={false}>
                    {notices.map((n) => (
                      <motion.article key={n.id} layout={!reduce} exit={{ opacity: 0 }} className="rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                              {n.profiles?.full_name || "Consultor"} · {relativeTime(n.created_at)}
                              {n.priority === "urgent" ? " · Urgente" : n.priority === "important" ? " · Importante" : ""}
                            </p>
                            <h3 className="mt-0.5 text-[17px] font-semibold text-slate-950 dark:text-white">{n.title}</h3>
                            <p className="mt-1 whitespace-pre-line text-[15px] text-slate-800 dark:text-slate-200">{n.content}</p>
                            <p className="mt-2 inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                              <Heart className="h-4 w-4" /> <span className="fsy-figure">{n.likes_count ?? 0}</span>
                            </p>
                          </div>
                          <button type="button" onClick={() => { setDeleteError(null); setToDelete(n); }} aria-label={`Remover recado ${n.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40">
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </motion.article>
                    ))}
                  </AnimatePresence>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={post} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Novo recado para a companhia</DialogTitle>
              <DialogDescription>Seus jovens recebem no Início, em Avisos e por notificação no app.</DialogDescription>
            </DialogHeader>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" required minLength={2} maxLength={150} aria-label="Título" className="h-12" />
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Mensagem" required minLength={2} maxLength={5000} aria-label="Mensagem" className="min-h-32" />
            <div role="radiogroup" aria-label="Prioridade" className="grid grid-cols-3 gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={priority === p.value}
                  onClick={() => setPriority(p.value)}
                  className={cn("min-h-11 rounded-full text-sm font-medium", priority === p.value ? "bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white" : "text-slate-600 dark:text-slate-300")}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {composeError && <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">{composeError}</p>}
            <DialogFooter>
              <button type="submit" disabled={posting} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#007DA5] px-5 text-[15px] font-semibold text-white hover:bg-[#005E7C] disabled:opacity-60 sm:w-auto">
                {posting && <Loader2 className="h-4 w-4 animate-spin" />} Publicar
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(toDelete)} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover recado?</DialogTitle>
            <DialogDescription>“{toDelete?.title}” deixa de aparecer para os jovens. Não dá para desfazer.</DialogDescription>
          </DialogHeader>
          {deleteError && <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">{deleteError}</p>}
          <DialogFooter className="gap-2">
            <button type="button" onClick={() => setToDelete(null)} className="min-h-11 rounded-full px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">Cancelar</button>
            <button type="button" onClick={remove} disabled={deleting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-60">
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />} Remover
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mottoOpen} onOpenChange={setMottoOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={saveMotto} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Lema da companhia</DialogTitle>
              <DialogDescription>Aparece no Início de cada jovem da {company?.name}.</DialogDescription>
            </DialogHeader>
            <Input value={motto} onChange={(e) => setMotto(e.target.value)} maxLength={120} placeholder="Ex.: Juntos em Cristo" aria-label="Lema" className="h-12" />
            {mottoError && <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">{mottoError}</p>}
            <DialogFooter>
              <button type="submit" disabled={savingMotto} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#007DA5] px-5 text-[15px] font-semibold text-white hover:bg-[#005E7C] disabled:opacity-60 sm:w-auto">
                {savingMotto && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
