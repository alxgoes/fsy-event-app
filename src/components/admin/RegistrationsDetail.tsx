"use client";

import React, { startTransition, useEffect, useState } from "react";
import { Eye, EyeOff, FileDown, HeartPulse, Loader2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RegistrationRecord } from "@/types/registrations";
import { downloadAuthorizationPdf, getRegistration, RegistrationsApiError } from "./RegistrationsApi";
import { IssueList, Notice, RecordFlags, StatusBadge, btn, displayName, isCancelledRegistration } from "./RegistrationsUi";
import { RegistrationAuthorizationEditor } from "./RegistrationAuthorizationEditor";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2 sm:grid-cols-[11rem_1fr] sm:gap-3">
      <dt className="text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="break-words text-sm text-slate-900 dark:text-slate-100">{empty ? <span className="text-slate-500 dark:text-slate-400">Não informado</span> : value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 px-4 py-2 dark:border-slate-700">
      <h3 className="pt-2 text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
      <dl className="divide-y divide-slate-100 dark:divide-slate-800">{children}</dl>
    </section>
  );
}

/**
 * Detalhe privado de uma inscrição. Documentos e saúde ficam ocultos até um toque
 * intencional; ao fechar, voltam a ficar ocultos. Nada é copiado para armazenamento local.
 */
export function RegistrationsDetail({
  record: summary,
  useNormalizedNames,
  onClose,
  onChanged,
}: {
  /** Item da lista (projeção mínima, sem documentos nem saúde). */
  record: RegistrationRecord | null;
  useNormalizedNames: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  // Detalhe completo vem de GET [id] só quando o diálogo abre; fica apenas em memória.
  const [full, setFull] = useState<RegistrationRecord | null>(null);
  const [detailState, setDetailState] = useState<"loading" | "ready" | "error">("loading");
  const [detailError, setDetailError] = useState<string | null>(null);
  const summaryId = summary?.id ?? null;

  useEffect(() => {
    if (!summaryId) return;
    const controller = new AbortController();
    startTransition(() => {
      setFull(null);
      setDetailState("loading");
      setDetailError(null);
    });
    getRegistration(summaryId, controller.signal)
      .then((value) => {
        setFull(value);
        setDetailState("ready");
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name === "AbortError") return;
        setDetailError(error instanceof RegistrationsApiError ? error.message : "Não foi possível carregar o detalhe.");
        setDetailState("error");
      });
    return () => controller.abort();
  }, [summaryId]);

  const record = full ?? summary;
  const [showDocs, setShowDocs] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [editing, setEditing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);

  const close = () => {
    setShowDocs(false);
    setShowHealth(false);
    setEditing(false);
    setFeedback(null);
    setFull(null);
    onClose();
  };

  const getPdf = async () => {
    if (!record) return;
    setDownloading(true);
    setFeedback(null);
    try {
      const result = await downloadAuthorizationPdf(record.id, useNormalizedNames);
      const overflow = result.headers.get("x-authorization-overflow-warning") === "1";
      const fields = result.headers.get("x-authorization-overflow-fields");
      setFeedback(
        overflow
          ? { tone: "warn", text: `${result.filename} baixado. Texto além do espaço em: ${fields || "alguns campos"}. Confira e complete à mão.` }
          : { tone: "ok", text: `${result.filename} baixado. Campos sem dado na planilha ficaram em branco.` }
      );
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof RegistrationsApiError ? error.message : "Não foi possível gerar a ficha." });
    } finally {
      setDownloading(false);
    }
  };

  const minor = record?.ageAtRegistration !== null && record?.ageAtRegistration !== undefined && record.ageAtRegistration < 18;

  return (
    <Dialog open={!!record} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className={`max-h-[90vh] overflow-y-auto ${editing ? "sm:max-w-4xl" : "sm:max-w-2xl"}`}>
        {record && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-10 font-heading text-xl font-bold text-slate-900 dark:text-white">{displayName(record, useNormalizedNames)}</DialogTitle>
              <DialogDescription className="text-sm text-slate-700 dark:text-slate-300">
                {record.roleCategory} · {record.status}
                {record.wasNameNormalized && <> · na planilha: “{record.fullNameRaw}”</>}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <RecordFlags record={record} />
              <StatusBadge status={record.status} />

              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn.primary} onClick={() => void getPdf()} disabled={downloading || isCancelledRegistration(record)}>
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileDown className="h-4 w-4" aria-hidden="true" />}
                  Baixar ficha de autorização
                </button>
                <button type="button" className={btn.secondary} disabled={detailState !== "ready"} onClick={() => setEditing((value) => !value)} aria-expanded={editing} aria-controls={`authorization-editor-${record.id}`}>
                  <Pencil className="h-4 w-4" aria-hidden="true" /> Editar dados da autorização
                </button>
              </div>
              {isCancelledRegistration(record) && <Notice tone="info">Inscrição cancelada. Ela permanece no histórico e não entra nas autorizações.</Notice>}
              {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
              {detailState === "loading" && (
                <p className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300" aria-live="polite">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando o detalhe privado…
                </p>
              )}
              {detailState === "error" && <Notice tone="error">{detailError} Documentos e saúde não foram carregados.</Notice>}

              {editing && full && <RegistrationAuthorizationEditor key={full.id} record={full} useNormalizedNames={useNormalizedNames} onCancel={() => setEditing(false)} onSaved={(value) => { setFull(value); onChanged?.(); }} />}

              <Section title="Identificação">
                <Row label="Nome (revisado)" value={record.fullNameNormalized} />
                <Row label="Nome (planilha)" value={record.fullNameRaw} />
                <Row label="Nome de preferência" value={record.preferredNameNormalized ?? record.preferredNameRaw} />
                <Row label="Nascimento" value={record.birthDateRaw} />
                <Row label="Idade na inscrição" value={record.ageAtRegistration ?? null} />
                <Row label="Sexo" value={record.sex} />
                <Row label="Estaca/distrito" value={record.stakeName} />
                <Row label="Ala/ramo" value={record.wardName} />
                <Row label="Membro da Igreja" value={record.isChurchMemberRaw} />
                <Row label="Camiseta" value={record.tshirtSize} />
              </Section>

              <Section title="Contato">
                <Row label="Telefone" value={record.phoneRaw} />
                <Row label="E-mail" value={record.email} />
                <Row label="Responsável (AA)" value={record.guardianNameNormalized ?? record.guardianNameRaw} />
                <Row label="Telefone do responsável (AB)" value={record.guardianPhoneRaw} />
                <Row label="Contato 1" value={[record.contact1NameNormalized ?? record.contact1NameRaw, record.contact1PhoneRaw, record.contact1Email].filter(Boolean).join(" · ")} />
                <Row label="Contato 2" value={[record.contact2NameNormalized ?? record.contact2NameRaw, record.contact2PhoneRaw, record.contact2Email].filter(Boolean).join(" · ")} />
                <Row label="Bispo" value={[record.bishopNameNormalized ?? record.bishopNameRaw, record.bishopEmail].filter(Boolean).join(" · ")} />
              </Section>
              {minor && !record.guardianNameRaw && (
                <Notice tone="warn">Menor de idade sem responsável na planilha (colunas AA/AB). Contatos 1 e 2 não substituem o responsável legal na ficha.</Notice>
              )}

              <section className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Documentos</h3>
                  <button type="button" className={btn.ghost} aria-expanded={showDocs} disabled={detailState !== "ready"} onClick={() => setShowDocs((v) => !v)}>
                    {showDocs ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    {showDocs ? "Ocultar documentos" : "Mostrar documentos"}
                  </button>
                </div>
                {showDocs && (
                  <dl className="divide-y divide-slate-100 dark:divide-slate-800">
                    <Row label="RG/CIN/Passaporte" value={record.documentRgOrPassportRaw} />
                    <Row label="Órgão emissor" value={record.issuingAgencyRaw} />
                    <Row label="CPF (como na planilha)" value={record.cpfRaw} />
                  </dl>
                )}
              </section>

              <section className="rounded-2xl border border-rose-200 px-4 py-3 dark:border-rose-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <HeartPulse className="h-4 w-4 text-rose-700 dark:text-rose-300" aria-hidden="true" /> Saúde e alimentação
                  </h3>
                  <button type="button" className={btn.ghost} aria-expanded={showHealth} disabled={detailState !== "ready"} onClick={() => setShowHealth((v) => !v)}>
                    {showHealth ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    {showHealth ? "Ocultar saúde" : "Mostrar saúde"}
                  </button>
                </div>
                {showHealth && (
                  <dl className="divide-y divide-slate-100 dark:divide-slate-800">
                    <Row label="Informações médicas" value={record.medicalInfoRaw} />
                    <Row label="Alimentação" value={record.dietaryInfoRaw} />
                    <Row label="Condições relatadas" value={record.healthConditionsSummaryRaw} />
                    <Row label="Detalhes" value={record.healthConditionsDetailsRaw} />
                  </dl>
                )}
              </section>

              <Section title="Inscrição">
                <Row label="Data da inscrição" value={record.registrationDateRaw} />
                <Row label="Apresentação no show" value={record.talentShowPresentationRaw} />
                <Row label="Compromisso com a autorização" value={record.parentAuthorizationAckRaw} />
                <Row
                  label="Origem na planilha"
                  value={Object.entries(record.sourceRowNumbers).map(([sheet, row]) => `${sheet} linha ${row}`).join(" · ")}
                />
              </Section>

              {record.issues.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">Ocorrências desta inscrição</h3>
                  <IssueList issues={record.issues} />
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
