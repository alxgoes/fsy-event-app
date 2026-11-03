"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { CommitRegistrationImportResponse, RegistrationImportMode, RegistrationPreviewSummary } from "@/types/registrations";
import { commitImport, newIdempotencyKey, previewImport, RegistrationsApiError } from "./RegistrationsApi";
import { GroupedIssues, Metric, Notice, Panel, btn, formatBytes } from "./RegistrationsUi";

const MAX_BYTES = 10 * 1024 * 1024;
const REPLACE_WORD = "SUBSTITUIR";

interface Attempt {
  key: string;
  previewId: string;
  mode: RegistrationImportMode;
  useNormalizedNames: boolean;
  acknowledgeAdjustmentRemoval: boolean;
}

type Feedback = { tone: "ok" | "warn" | "error"; text: string; offerRefresh?: boolean } | null;

export function RegistrationsImport({ onCommitted }: { onCommitted: (result: CommitRegistrationImportResponse) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RegistrationPreviewSummary | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [mode, setMode] = useState<RegistrationImportMode>("upsert");
  const [useNormalizedNames, setUseNormalizedNames] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [acknowledgeAdjustmentRemoval, setAcknowledgeAdjustmentRemoval] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [now, setNow] = useState(() => Date.now());
  const [dragOver, setDragOver] = useState(false);
  const attempt = useRef<Attempt | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Relógio da validade da pré-visualização (atualiza a cada 15 s, só com pré-visualização aberta).
  useEffect(() => {
    if (!preview) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [preview]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const expiresInMs = preview ? new Date(preview.expiresAt).getTime() - now : 0;
  const expired = Boolean(preview) && expiresInMs <= 0;
  const minutesLeft = Math.max(0, Math.ceil(expiresInMs / 60_000));

  const choose = (next: File | null) => {
    if (busy !== null) return;
    setFeedback(null);
    setPreview(null);
    attempt.current = null;
    setConfirmText("");
    setAcknowledgeAdjustmentRemoval(false);
    if (!next) return setFile(null);
    if (!next.name.toLowerCase().endsWith(".xlsx")) {
      setFile(null);
      return setFeedback({ tone: "error", text: "Envie a planilha no formato .xlsx (Excel). Arquivos .xls, .csv ou .pdf não são aceitos." });
    }
    if (next.size > MAX_BYTES) {
      setFile(null);
      return setFeedback({ tone: "error", text: `A planilha tem ${formatBytes(next.size)}; o limite é 10 MB.` });
    }
    setFile(next);
  };

  const runPreview = async (target: File | null = file) => {
    if (!target) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy("preview");
    setFeedback(null);
    attempt.current = null;
    setConfirmText("");
    setAcknowledgeAdjustmentRemoval(false);
    try {
      const summary = await previewImport(target, controller.signal);
      setPreview(summary);
      setNow(Date.now());
      if (summary.diffSummary.deleteCountOnReplaceAll === 0 && mode === "replace_all") setMode("upsert");
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return;
      setPreview(null);
      setFeedback({ tone: "error", text: error instanceof RegistrationsApiError ? error.message : "Não foi possível ler a planilha." });
    } finally {
      if (abortRef.current === controller) setBusy(null);
    }
  };

  const commit = async () => {
    if (!preview) return;
    // Mesma tentativa (rede caiu) reaproveita a chave; qualquer mudança gera chave nova.
    const same =
      attempt.current &&
      attempt.current.previewId === preview.previewId &&
      attempt.current.mode === mode &&
      attempt.current.useNormalizedNames === useNormalizedNames &&
      attempt.current.acknowledgeAdjustmentRemoval === acknowledgeAdjustmentRemoval;
    if (!same) attempt.current = { key: newIdempotencyKey(), previewId: preview.previewId, mode, useNormalizedNames, acknowledgeAdjustmentRemoval };
    setBusy("commit");
    setFeedback(null);
    try {
      const result = await commitImport({
        previewId: preview.previewId,
        mode,
        expectedRevision: preview.baseRevision,
        idempotencyKey: attempt.current!.key,
        useNormalizedNames,
        acknowledgeAdjustmentRemoval: mode === "replace_all" && acknowledgeAdjustmentRemoval,
      });
      attempt.current = null;
      setPreview(null);
      setFile(null);
      setConfirmText("");
      if (inputRef.current) inputRef.current.value = "";
      setFeedback({
        tone: "ok",
        text: result.idempotentReplay
          ? "Esta importação já tinha sido aplicada; nada foi duplicado."
          : `Importação confirmada: ${result.insertedCount} nova(s), ${result.updatedCount} atualizada(s)${result.deletedCount ? `, ${result.deletedCount} removida(s)` : ""}.`,
      });
      onCommitted(result);
    } catch (error) {
      const apiError = error instanceof RegistrationsApiError ? error : null;
      if (apiError?.kind === "conflict") {
        attempt.current = null;
        setFeedback({ tone: "warn", text: apiError.message, offerRefresh: true });
      } else if (apiError?.kind === "network") {
        // Mantém a chave: repetir não aplica duas vezes.
        setFeedback({ tone: "error", text: `${apiError.message} Ao tentar de novo, a mesma confirmação é reenviada sem duplicar dados.` });
      } else {
        attempt.current = null;
        setFeedback({ tone: "error", text: apiError?.message ?? "Não foi possível aplicar a importação." });
      }
    } finally {
      setBusy(null);
    }
  };

  // Lista completa do servidor quando disponível; senão, só a amostra.
  const fullNameList = Boolean(preview?.nameChanges);
  const nameChanges =
    preview?.nameChanges?.map((c) => ({ id: c.id, raw: c.fullNameRaw, normalized: c.fullNameNormalized })) ??
    preview?.sampleRows.filter((row) => row.wasNameNormalized).map((r) => ({ id: r.id, raw: r.fullNameRaw, normalized: r.fullNameNormalized })) ??
    [];
  const [showAllNames, setShowAllNames] = useState(false);
  const visibleNames = showAllNames ? nameChanges : nameChanges.slice(0, 20);
  const replaceNeedsConfirm = mode === "replace_all";
  const adjustmentsRemoved = preview?.authorizationAdjustmentImpact?.removedCountOnReplaceAll ?? 0;
  const canSubmit =
    !!preview && preview.canCommit && !expired && busy === null && (!replaceNeedsConfirm || (confirmText.trim().toUpperCase() === REPLACE_WORD && (adjustmentsRemoved === 0 || acknowledgeAdjustmentRemoval)));

  return (
    <div className="space-y-5">
      <ol aria-label="Etapas da importação" className="flex flex-wrap gap-3 text-sm font-semibold"><li aria-current={!preview ? "step" : undefined}>1. Escolher planilha</li><li aria-current={preview ? "step" : undefined}>2. Conferir resumo</li><li>3. Confirmar</li></ol>
      <Panel
        title="Importar planilha de inscrições"
        description={
          <>
            Escolha o Excel exportado das inscrições. Confira o resumo e confirme para salvar.
          </>
        }
      >
        <label
          htmlFor="registrations-file"
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            choose(event.dataTransfer.files?.[0] ?? null);
          }}
          className={cn(
            "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#007DA5]",
            dragOver ? "border-[#007DA5] bg-[#F2F9FC] dark:bg-[#0C2733]" : "border-slate-300 bg-[#FAF8F5] hover:border-[#007DA5] dark:border-slate-600 dark:bg-slate-800/50"
          )}
        >
          <FileSpreadsheet className="h-7 w-7 text-[#005E7C] dark:text-[#7DE3F4]" aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {file ? file.name : "Escolha ou arraste a planilha .xlsx"}
          </span>
          <span className="text-xs text-slate-600 dark:text-slate-400">{file ? formatBytes(file.size) : "Até 10 MB"}</span>
          <input
            ref={inputRef}
            id="registrations-file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={busy !== null}
            onChange={(event) => choose(event.target.files?.[0] ?? null)}
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btn.primary} disabled={!file || busy !== null} onClick={() => void runPreview()}>
            {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
            {busy === "preview" ? "Lendo planilha…" : "Conferir planilha"}
          </button>
          {busy === "preview" && (
            <button type="button" className={btn.secondary} onClick={() => abortRef.current?.abort()}>
              <X className="h-4 w-4" aria-hidden="true" /> Cancelar leitura
            </button>
          )}
          {file && busy === null && (
            <button type="button" className={btn.ghost} onClick={() => { choose(null); if (inputRef.current) inputRef.current.value = ""; }}>
              Remover arquivo
            </button>
          )}
        </div>

        {feedback && (
          <div className="mt-4">
            <Notice tone={feedback.tone}>
              <p>{feedback.text}</p>
              {feedback.offerRefresh && file && (
                <button type="button" className={cn(btn.secondary, "mt-3")} onClick={() => void runPreview()} disabled={busy !== null}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Gerar nova pré-visualização com o mesmo arquivo
                </button>
              )}
            </Notice>
          </div>
        )}
      </Panel>

      {preview && (
        <Panel
          title="Resumo da importação"
          description={
            <>
              <span className="font-semibold">{preview.filename}</span>
            </>
          }
        >
          <div className="space-y-5">
            {expired ? (
              <Notice tone="warn">
                <p>A pré-visualização expirou. Gere outra para conferir os dados atuais antes de aplicar.</p>
                <button type="button" className={cn(btn.secondary, "mt-3")} onClick={() => void runPreview()} disabled={busy !== null || !file}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar pré-visualização
                </button>
              </Notice>
            ) : (
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300" aria-live="polite">
                Válida por mais {minutesLeft} min. Depois disso, gere novamente.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Inscritos na planilha" value={preview.totalCanonicalRows} />
              <Metric label="Participantes" value={preview.participantCount} />
              <Metric label="Consultores" value={preview.counselorCount} />
              <Metric label="Avisos" value={preview.warningCount} tone={preview.warningCount ? "warning" : "neutral"} />
            </div>
            <p className="text-sm">{preview.diffSummary.insertCount} nova(s) · {preview.diffSummary.updateCount} atualizada(s) · {preview.diffSummary.unchangedCount} sem mudança. Cancelados ficam no histórico e fora das autorizações.</p>
            {(preview.authorizationAdjustmentImpact?.retainedCount ?? 0) > 0 && <Notice tone="info">Os ajustes de autorização de {preview.authorizationAdjustmentImpact?.retainedCount} inscrito(s) serão preservados após importar.</Notice>}

            {preview.issues.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">Avisos para conferir</h3>
                {preview.canCommit && <p className="mb-3 text-sm">Você pode confirmar a importação. Os avisos abaixo ficam disponíveis para revisão.</p>}
                <GroupedIssues issues={preview.issues} />
              </div>
            )}

            <details>
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-slate-900 dark:text-white">Conferir nomes revisados ({preview.normalizedNamesChangedCount})</summary>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                Confira os ajustes de maiúsculas e minúsculas antes de usar os nomes revisados.
              </p>
              {nameChanges.length > 0 ? (
                <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700" tabIndex={0} role="region" aria-label="Nomes originais e revisados (role para os lados no celular)">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <caption className="sr-only">Nomes originais e revisados</caption>
                    <thead className="bg-slate-50 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-semibold">Como veio na planilha</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Revisado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {visibleNames.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{row.raw}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">{row.normalized}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
                    <span>
                      {fullNameList
                        ? `Mostrando ${visibleNames.length} de ${nameChanges.length}.`
                        : `Amostra de ${visibleNames.length} de ${preview.normalizedNamesChangedCount}.`}
                    </span>
                    {nameChanges.length > 20 && (
                      <button type="button" className={btn.ghost} onClick={() => setShowAllNames((v) => !v)}>
                        {showAllNames ? "Mostrar menos" : "Mostrar todos"}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                preview.normalizedNamesChangedCount > 0 && (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">A amostra recebida não contém nomes alterados.</p>
                )
              )}
              <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[#007DA5]"
                  checked={useNormalizedNames}
                  onChange={(event) => setUseNormalizedNames(event.target.checked)}
                />
                Usar os nomes revisados (o original continua guardado)
              </label>
            </details>

            <fieldset>
              <legend className="text-sm font-bold text-slate-900 dark:text-white">Como aplicar</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className={cn("flex min-h-11 cursor-pointer gap-3 rounded-2xl border p-3 text-sm", mode === "upsert" ? "border-[#007DA5] bg-[#F2F9FC] dark:border-[#01B6D1] dark:bg-[#0C2733]" : "border-slate-200 dark:border-slate-700")}>
                  <input type="radio" name="import-mode" value="upsert" className="mt-0.5 h-5 w-5 accent-[#007DA5]" checked={mode === "upsert"} onChange={() => { setMode("upsert"); setConfirmText(""); setAcknowledgeAdjustmentRemoval(false); }} />
                  <span>
                    <span className="block font-semibold text-slate-900 dark:text-white">Adicionar e atualizar</span>
                    <span className="text-slate-700 dark:text-slate-300">Inclui novas pessoas e atualiza as existentes. Quem não está na planilha permanece.</span>
                  </span>
                </label>
                <label className={cn("flex min-h-11 cursor-pointer gap-3 rounded-2xl border p-3 text-sm", mode === "replace_all" ? "border-[#B91C1C] bg-[#FDF1EE] dark:border-red-500 dark:bg-[#2A1410]" : "border-slate-200 dark:border-slate-700")}>
                  <input type="radio" name="import-mode" value="replace_all" className="mt-0.5 h-5 w-5 accent-[#B91C1C]" checked={mode === "replace_all"} onChange={() => setMode("replace_all")} />
                  <span>
                    <span className="block font-semibold text-slate-900 dark:text-white">Substituir todas</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      A lista passa a ser exatamente esta planilha. <strong className="fsy-figure">{preview.diffSummary.deleteCountOnReplaceAll}</strong> inscrição(ões) atual(is) que não estão nela serão removidas.
                    </span>
                  </span>
                </label>
              </div>
              {replaceNeedsConfirm && (
                <div className="mt-3 max-w-sm">
                  <label htmlFor="replace-confirm" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Para confirmar a substituição, digite {REPLACE_WORD}
                  </label>
                  <Input
                    id="replace-confirm"
                    autoComplete="off"
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.target.value)}
                    className="mt-1 min-h-11"
                  />
                </div>
              )}
              {replaceNeedsConfirm && adjustmentsRemoved > 0 && <div className="mt-3"><Notice tone="warn"><p>A substituição removerá {adjustmentsRemoved} inscrito(s) com ajustes de autorização.</p><label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 font-semibold"><input type="checkbox" className="h-5 w-5 shrink-0 accent-[#007DA5]" checked={acknowledgeAdjustmentRemoval} onChange={(event) => setAcknowledgeAdjustmentRemoval(event.target.checked)} /> Entendo que esses inscritos e seus ajustes serão apagados.</label></Notice></div>}
            </fieldset>

            {!preview.canCommit && (
              <Notice tone="error">Não foi possível importar esta planilha. Confira os problemas indicados e envie o arquivo novamente.</Notice>
            )}

            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
              <button type="button" className={mode === "replace_all" ? btn.danger : btn.primary} disabled={!canSubmit} onClick={() => void commit()}>
                {busy === "commit" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                {busy === "commit" ? "Confirmando…" : mode === "replace_all" ? "Confirmar substituição" : "Confirmar importação"}
              </button>
              <button type="button" className={btn.secondary} disabled={busy !== null} onClick={() => choose(null)}>
                Descartar pré-visualização
              </button>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
