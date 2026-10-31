"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { CommitRegistrationImportResponse, RegistrationImportMode, RegistrationPreviewSummary } from "@/types/registrations";
import { commitImport, newIdempotencyKey, previewImport, RegistrationsApiError } from "./RegistrationsApi";
import { IssueList, Metric, Notice, Panel, btn, formatBytes } from "./RegistrationsUi";

const MAX_BYTES = 10 * 1024 * 1024;
const REPLACE_WORD = "SUBSTITUIR";

interface Attempt {
  key: string;
  previewId: string;
  mode: RegistrationImportMode;
  useNormalizedNames: boolean;
}

type Feedback = { tone: "ok" | "warn" | "error"; text: string; offerRefresh?: boolean } | null;

export function RegistrationsImport({ onCommitted }: { onCommitted: (result: CommitRegistrationImportResponse) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RegistrationPreviewSummary | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [mode, setMode] = useState<RegistrationImportMode>("upsert");
  const [useNormalizedNames, setUseNormalizedNames] = useState(true);
  const [confirmText, setConfirmText] = useState("");
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
    setFeedback(null);
    setPreview(null);
    attempt.current = null;
    setConfirmText("");
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
      attempt.current.useNormalizedNames === useNormalizedNames;
    if (!same) attempt.current = { key: newIdempotencyKey(), previewId: preview.previewId, mode, useNormalizedNames };
    setBusy("commit");
    setFeedback(null);
    try {
      const result = await commitImport({
        previewId: preview.previewId,
        mode,
        expectedRevision: preview.baseRevision,
        idempotencyKey: attempt.current!.key,
        useNormalizedNames,
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
          : `Importação aplicada: ${result.insertedCount} nova(s), ${result.updatedCount} atualizada(s)${result.deletedCount ? `, ${result.deletedCount} removida(s)` : ""}. Revisão ${result.currentRevision}.`,
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
  const canSubmit =
    !!preview && preview.canCommit && !expired && busy === null && (!replaceNeedsConfirm || confirmText.trim().toUpperCase() === REPLACE_WORD);

  return (
    <div className="space-y-5">
      <Panel
        title="Importar planilha de inscrições"
        description={
          <>
            Envie o Excel oficial (abas Consultor, Participante e Todas). Nada é gravado até você revisar e confirmar. A importação não altera contas, perfis, fichas médicas nem companhias.
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
            "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center transition-colors",
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
            onChange={(event) => choose(event.target.files?.[0] ?? null)}
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btn.primary} disabled={!file || busy !== null} onClick={() => void runPreview()}>
            {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
            {busy === "preview" ? "Lendo planilha…" : "Gerar pré-visualização"}
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
          title="Revisão antes de aplicar"
          description={
            <>
              <span className="font-semibold">{preview.filename}</span> · {formatBytes(preview.fileSizeBytes)} · revisão base {preview.baseRevision}
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
              <Metric label="Pessoas na planilha" value={preview.totalCanonicalRows} />
              <Metric label="Novas" value={preview.diffSummary.insertCount} tone="info" />
              <Metric label="Atualizadas" value={preview.diffSummary.updateCount} tone="info" />
              <Metric label="Sem mudança" value={preview.diffSummary.unchangedCount} />
              <Metric label="Participantes" value={preview.participantCount} />
              <Metric label="Consultores" value={preview.counselorCount} />
              <Metric label="Erros bloqueantes" value={preview.blockingErrorCount} tone={preview.blockingErrorCount ? "danger" : "neutral"} />
              <Metric label="Avisos" value={preview.warningCount} tone={preview.warningCount ? "warning" : "neutral"} />
            </div>

            <ul className="flex flex-wrap gap-2 text-xs" aria-label="Abas encontradas">
              {preview.sheets.map((sheet) => (
                <li
                  key={sheet.sheetName}
                  className={cn(
                    "rounded-full border px-3 py-1 font-semibold",
                    sheet.present && sheet.headerMatched
                      ? "border-[#BFE3A0] bg-[#F2FAEA] text-[#2F5413] dark:border-[#3D5A22] dark:bg-[#14210B] dark:text-[#D6F0BC]"
                      : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100"
                  )}
                >
                  {sheet.sheetName}: {sheet.present ? `${sheet.totalRows} linha(s)${sheet.headerMatched ? "" : " · cabeçalho diferente"}` : "ausente"}
                </li>
              ))}
            </ul>

            {(preview.healthAlertCount > 0 || preview.missingGuardianMinorCount > 0 || preview.documentWarningCount > 0) && (
              <p className="text-sm text-slate-800 dark:text-slate-200">
                {preview.healthAlertCount} com informação de saúde · {preview.missingGuardianMinorCount} menor(es) sem responsável (AA/AB) · {preview.documentWarningCount} com documento a conferir.
              </p>
            )}

            {preview.issues.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">Ocorrências</h3>
                <IssueList issues={preview.issues} />
              </div>
            )}

            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Nomes revisados</h3>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {preview.normalizedNamesChangedCount} nome(s) ajustados para maiúsculas e minúsculas. Confira abaixo: nomes com grafia própria (ex.: McDonald, II) podem ser alterados indevidamente.
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
                        : `Amostra de ${visibleNames.length} de ${preview.normalizedNamesChangedCount}; o servidor não enviou a lista completa.`}
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
            </div>

            <fieldset>
              <legend className="text-sm font-bold text-slate-900 dark:text-white">Como aplicar</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className={cn("flex min-h-11 cursor-pointer gap-3 rounded-2xl border p-3 text-sm", mode === "upsert" ? "border-[#007DA5] bg-[#F2F9FC] dark:border-[#01B6D1] dark:bg-[#0C2733]" : "border-slate-200 dark:border-slate-700")}>
                  <input type="radio" name="import-mode" value="upsert" className="mt-0.5 h-5 w-5 accent-[#007DA5]" checked={mode === "upsert"} onChange={() => { setMode("upsert"); setConfirmText(""); }} />
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
                    className="mt-1"
                  />
                </div>
              )}
            </fieldset>

            {!preview.canCommit && (
              <Notice tone="error">A planilha tem erros bloqueantes. Corrija o arquivo e gere outra pré-visualização; nada foi gravado.</Notice>
            )}

            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
              <button type="button" className={mode === "replace_all" ? btn.danger : btn.primary} disabled={!canSubmit} onClick={() => void commit()}>
                {busy === "commit" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                {busy === "commit" ? "Aplicando…" : mode === "replace_all" ? "Substituir inscrições" : "Aplicar importação"}
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
