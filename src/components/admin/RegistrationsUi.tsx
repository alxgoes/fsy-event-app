"use client";

import React from "react";
import { AlertTriangle, HeartPulse, IdCard, Pencil, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RegistrationRecord, RegistrationValidationIssue } from "@/types/registrations";

/** Classes de ação compartilhadas (alvo mínimo de 44 px, foco visível do painel). */
export const btn = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#007DA5] px-4 text-sm font-semibold text-white hover:bg-[#005E7C] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#01B6D1] dark:text-slate-950",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
  danger:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#B91C1C] px-4 text-sm font-semibold text-white hover:bg-[#991B1B] disabled:cursor-not-allowed disabled:opacity-60",
  ghost:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#005E7C] hover:bg-[#007DA5]/10 disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#7DE3F4]",
};

export function Panel({ title, description, actions, children, className, headingLevel = "h2" }: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <section className={cn("fsy-panel rounded-3xl bg-white p-4 dark:bg-slate-900 sm:p-6", className)}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Heading className="font-heading text-lg font-bold text-slate-900 dark:text-white">{title}</Heading>
          {description && <div className="mt-1 max-w-prose text-sm text-slate-700 dark:text-slate-300">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Metric({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "info" | "warning" | "danger" }) {
  const tones = {
    neutral: "text-slate-900 dark:text-white",
    info: "text-[#005E7C] dark:text-[#7DE3F4]",
    warning: "text-amber-800 dark:text-amber-300",
    danger: "text-[#B91C1C] dark:text-red-300",
  };
  return (
    <div data-registration-stat-card="" className="min-w-0 rounded-2xl border border-slate-200 bg-[#FAF8F5] p-3 dark:border-slate-700 dark:bg-slate-800/60">
      <p className="break-words text-xs font-semibold text-slate-700 [overflow-wrap:anywhere] dark:text-slate-300">{label}</p>
      <p data-kpi="" className={cn("fsy-figure mt-1 text-2xl font-bold", tones[tone])}>{value}</p>
    </div>
  );
}

/** Indicadores da linha: ícone + texto (cor nunca é o único sinal). */
export function RecordFlags({ record, compact = false }: { record: RegistrationRecord; compact?: boolean }) {
  const flags: { key: string; icon: React.ElementType; label: string; className: string }[] = [];
  if (record.hasAuthorizationAdjustments || record.authorizationAdjustments)
    flags.push({ key: "edited", icon: Pencil, label: "Editado", className: "bg-[#F2F9FC] text-[#005E7C] border-[#007DA5]/40 dark:bg-[#0C2733] dark:text-[#7DE3F4] dark:border-[#01B6D1]/40" });
  if (record.hasHealthAlert)
    flags.push({ key: "health", icon: HeartPulse, label: "Saúde", className: "bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800" });
  if (record.hasMissingGuardianForMinor)
    flags.push({ key: "guardian", icon: UserX, label: "Sem responsável", className: "bg-amber-50 text-amber-950 border-amber-300 dark:bg-amber-950/60 dark:text-amber-100 dark:border-amber-700" });
  if (record.hasDocumentWarning)
    flags.push({ key: "doc", icon: IdCard, label: "Documento", className: "bg-amber-50 text-amber-950 border-amber-300 dark:bg-amber-950/60 dark:text-amber-100 dark:border-amber-700" });
  const otherIssues = record.issues.length - [record.hasMissingGuardianForMinor, record.hasDocumentWarning].filter(Boolean).length;
  if (otherIssues > 0)
    flags.push({ key: "issues", icon: AlertTriangle, label: `${otherIssues} aviso${otherIssues > 1 ? "s" : ""}`, className: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600" });
  if (!flags.length) return <span className="text-xs text-slate-600 dark:text-slate-400">Sem alertas</span>;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Alertas da inscrição">
      {flags.map(({ key, icon: Icon, label, className }) => (
        <li key={key} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold", className)}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {compact && key !== "issues" && key !== "edited" ? <span className="sr-only">{label}</span> : <span>{label}</span>}
        </li>
      ))}
    </ul>
  );
}

const SHEET_LABEL: Record<string, string> = { Workbook: "Arquivo", Consultor: "Aba Consultor", Participante: "Aba Participante", Todas: "Aba Todas" };

export function isCancelledRegistration(record: Pick<RegistrationRecord, "status">): boolean {
  return record.status.toLocaleLowerCase("pt-BR").includes("cancelad");
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLocaleLowerCase("pt-BR");
  const tone = normalized.includes("cancelad") ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200" : normalized.includes("aguard") || normalized.includes("espera") ? "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100" : "bg-[#F2FAEA] text-[#2F5413] dark:bg-[#14210B] dark:text-[#D6F0BC]";
  return <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-semibold", tone)}>{status || "Sem situação informada"}</span>;
}

const ISSUE_LABELS: Record<string, string> = {
  MISSING_REQUIRED_FIELD: "Dados incompletos",
  INVALID_ROLE_CATEGORY: "Tipo a conferir",
  CONFLICTING_DUPLICATE_KEY: "Inscrições duplicadas resolvidas",
  PROBABLE_DUPLICATE_PERSON: "Possíveis inscrições da mesma pessoa",
  CROSS_SHEET_MISMATCH: "Diferenças entre abas",
  MISSING_GUARDIAN_FOR_MINOR: "Responsável não informado",
  TRUNCATED_OR_INVALID_CPF: "CPF a conferir",
  SUSPICIOUS_DOCUMENT_NUMBER: "Documento a conferir",
  FORMULA_CHARACTER_NEUTRALIZED: "Texto protegido na exportação",
  UNPARSABLE_BIRTH_DATE: "Nascimento a conferir",
  MISSING_SHEET: "Aba ausente",
  HEADER_MISMATCH: "Colunas incompatíveis",
  EMPTY_WORKBOOK: "Planilha vazia",
};

export function GroupedIssues({ issues }: { issues: RegistrationValidationIssue[] }) {
  const groups = new Map<string, RegistrationValidationIssue[]>();
  for (const issue of issues) groups.set(issue.code, [...(groups.get(issue.code) ?? []), issue]);
  return <div className="space-y-2">{[...groups].map(([code, items]) => <details key={code} className="rounded-2xl border border-slate-200 dark:border-slate-700"><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">{ISSUE_LABELS[code] ?? "Dados para conferir"} <span className="fsy-figure">({items.length})</span></summary><div className="p-3 pt-0"><IssueList issues={items} /></div></details>)}</div>;
}

export function IssueList({ issues, max = 40 }: { issues: RegistrationValidationIssue[]; max?: number }) {
  if (!issues.length) return null;
  const sorted = [...issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
  const shown = sorted.slice(0, max);
  return (
    <div>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        {shown.map((issue, index) => (
          <li key={`${issue.code}-${issue.sheetName}-${issue.rowNumber}-${issue.columnKey}-${index}`} className="flex gap-3 bg-white p-3 text-sm dark:bg-slate-900">
            <span
              className={cn(
                "mt-0.5 inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-bold",
                issue.severity === "error" ? "bg-[#B91C1C] text-white" : "bg-amber-100 text-amber-950 dark:bg-amber-900 dark:text-amber-100"
              )}
            >
              {issue.severity === "error" ? "Erro" : "Aviso"}
            </span>
            <span className="min-w-0">
              <span className="block text-slate-900 dark:text-slate-100">{issue.message}</span>
              <span className="block text-xs text-slate-600 dark:text-slate-400">
                {SHEET_LABEL[issue.sheetName] ?? issue.sheetName}
                {issue.rowNumber ? ` · linha ${issue.rowNumber}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {sorted.length > max && (
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
          Mostrando {max} de {sorted.length} ocorrências deste grupo.
        </p>
      )}
    </div>
  );
}

export function displayName(record: RegistrationRecord, normalized: boolean): string {
  return (normalized ? record.fullNameNormalized || record.fullNameRaw : record.fullNameRaw || record.fullNameNormalized) || "Sem nome";
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(date);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export function Notice({ tone, children, role }: { tone: "ok" | "warn" | "error" | "info"; children: React.ReactNode; role?: "status" | "alert" }) {
  const tones = {
    ok: "border-[#BFE3A0] bg-[#F2FAEA] text-[#2F5413] dark:border-[#3D5A22] dark:bg-[#14210B] dark:text-[#D6F0BC]",
    warn: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100",
    error: "border-[#F4B4A8] bg-[#FDF1EE] text-[#7A1F12] dark:border-[#7A2E22] dark:bg-[#2A1410] dark:text-[#FFD2C8]",
    info: "border-[#007DA5]/30 bg-[#F2F9FC] text-slate-900 dark:border-[#01B6D1]/40 dark:bg-[#0C2733] dark:text-slate-100",
  };
  return (
    <div role={role ?? (tone === "error" ? "alert" : "status")} className={cn("fsy-fade-in rounded-2xl border px-4 py-3 text-sm", tones[tone])}>
      {children}
    </div>
  );
}
