"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, FileDown, Loader2, X } from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";
import { MAX_AUTHORIZATION_PDF_BATCH_SIZE } from "@/types/authorizations";
import type { RegistrationListMetrics, RegistrationRoleCategory } from "@/types/registrations";
import { downloadAuthorizationZipPart, downloadTemplatePdf, RegistrationsApiError } from "./RegistrationsApi";
import { Notice, Panel, btn } from "./RegistrationsUi";

type Scope = RegistrationRoleCategory | "all";

interface Progress {
  done: number;
  total: number;
  overflow: number;
  files: string[];
}

export function RegistrationsAuthorizations({
  metrics,
  selectedIds,
  onClearSelection,
}: {
  metrics: RegistrationListMetrics | null;
  selectedIds: string[];
  onClearSelection: () => void;
}) {
  const [scope, setScope] = useState<Scope>("Participante");
  const [useNormalizedNames, setUseNormalizedNames] = useState(true);
  const [running, setRunning] = useState<"all" | "selected" | number | "template" | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const eligible = !metrics ? 0 : scope === "Participante" ? metrics.participantCount : scope === "Consultor" ? metrics.counselorCount : metrics.totalCount;
  const parts = Math.ceil(eligible / MAX_AUTHORIZATION_PDF_BATCH_SIZE);
  const range = (part: number) => `${(part - 1) * MAX_AUTHORIZATION_PDF_BATCH_SIZE + 1}–${Math.min(part * MAX_AUTHORIZATION_PDF_BATCH_SIZE, eligible)}`;

  const fail = (error: unknown) => {
    if ((error as { name?: string })?.name === "AbortError") {
      setFeedback({ tone: "warn", text: "Geração interrompida. As partes já baixadas continuam no seu aparelho." });
      return;
    }
    setFeedback({ tone: "error", text: error instanceof RegistrationsApiError ? error.message : "Não foi possível gerar as fichas." });
  };

  const runParts = async (which: number[]) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setFeedback(null);
    setRunning(which.length === 1 ? which[0] : "all");
    const state: Progress = { done: 0, total: which.length, overflow: 0, files: [] };
    setProgress({ ...state });
    try {
      for (const part of which) {
        const result = await downloadAuthorizationZipPart(
          // Sem batchId: o servidor usa todas as inscrições atuais (inclusive as que vieram de lotes anteriores).
          { roleCategory: scope, partIndex: part, partSize: MAX_AUTHORIZATION_PDF_BATCH_SIZE, useNormalizedNames },
          controller.signal
        );
        state.done += 1;
        state.overflow += Number.isFinite(result.overflowWarnings) ? result.overflowWarnings : 0;
        state.files.push(result.filename);
        setProgress({ ...state, files: [...state.files] });
      }
      setFeedback(
        state.overflow > 0
          ? { tone: "warn", text: `${state.files.length} pacote(s) baixado(s). ${state.overflow} ficha(s) tiveram texto reduzido ou cortado; confira o manifesto dentro do ZIP e complete à mão.` }
          : { tone: "ok", text: `${state.files.length} pacote(s) baixado(s). Campos sem dado na planilha ficaram em branco para preenchimento manual.` }
      );
    } catch (error) {
      fail(error);
    } finally {
      setRunning(null);
    }
  };

  const runSelected = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setFeedback(null);
    setRunning("selected");
    setProgress({ done: 0, total: 1, overflow: 0, files: [] });
    try {
      const result = await downloadAuthorizationZipPart({ registrationIds: selectedIds, useNormalizedNames }, controller.signal);
      setProgress({ done: 1, total: 1, overflow: result.overflowWarnings || 0, files: [result.filename] });
      setFeedback(
        result.overflowWarnings > 0
          ? { tone: "warn", text: `${result.filename} baixado. ${result.overflowWarnings} ficha(s) com texto além do espaço; confira o manifesto.` }
          : { tone: "ok", text: `${result.filename} baixado com ${selectedIds.length} ficha(s).` }
      );
    } catch (error) {
      fail(error);
    } finally {
      setRunning(null);
    }
  };

  const getTemplate = async () => {
    setRunning("template");
    setFeedback(null);
    try {
      await downloadTemplatePdf();
    } catch (error) {
      fail(error);
    } finally {
      setRunning(null);
    }
  };

  const runPartFromButton = (event: React.MouseEvent<HTMLButtonElement>) => {
    void runParts([Number(event.currentTarget.dataset.part)]);
  };

  const busy = running !== null;
  const percent = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Panel
      title="Fichas de autorização (PDF oficial)"
      description={
        <>
          Cada pessoa recebe a ficha oficial preenchida com o próprio nome no arquivo. O que não está na planilha fica em branco (responsável 2, parentesco, endereço, assinaturas, foto). Contatos 1 e 2 nunca são usados como responsável legal.
        </>
      }
      actions={
        <button type="button" className={btn.secondary} onClick={() => void getTemplate()} disabled={busy}>
          {running === "template" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileDown className="h-4 w-4" aria-hidden="true" />}
          Ficha em branco
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Quem incluir
            <NativeSelect value={scope} onChange={(event) => setScope(event.target.value as Scope)} disabled={busy} className="mt-1">
              <option value="Participante">Participantes ({metrics?.participantCount ?? 0})</option>
              <option value="Consultor">Consultores ({metrics?.counselorCount ?? 0})</option>
              <option value="all">Todos ({metrics?.totalCount ?? 0})</option>
            </NativeSelect>
          </label>
          <label className="flex min-h-11 items-center gap-3 self-end text-sm font-semibold text-slate-900 dark:text-slate-100">
            <input type="checkbox" className="h-5 w-5 accent-[#007DA5]" checked={useNormalizedNames} onChange={(event) => setUseNormalizedNames(event.target.checked)} disabled={busy} />
            Usar nomes revisados nas fichas
          </label>
        </div>

        {eligible === 0 ? (
          <p className="text-sm text-slate-700 dark:text-slate-300">Nenhuma inscrição neste recorte. Importe uma planilha para gerar as fichas.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-800 dark:text-slate-200">
              <span className="fsy-figure font-semibold">{eligible}</span> ficha(s) em {parts} pacote(s) ZIP de até {MAX_AUTHORIZATION_PDF_BATCH_SIZE}. Seu navegador pode pedir permissão para baixar vários arquivos.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn.primary} disabled={busy} onClick={() => void runParts(Array.from({ length: parts }, (_, i) => i + 1))}>
                {running === "all" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                {parts > 1 ? `Baixar as ${parts} partes em sequência` : "Baixar ZIP"}
              </button>
              {parts > 1 &&
                Array.from({ length: parts }, (_, i) => i + 1).map((part) => (
                  <button key={part} type="button" data-part={part} className={btn.secondary} disabled={busy} onClick={runPartFromButton}>
                    {running === part ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    Parte {part} ({range(part)})
                  </button>
                ))}
            </div>
          </div>
        )}

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#007DA5]/30 bg-[#F2F9FC] p-3 dark:border-[#01B6D1]/40 dark:bg-[#0C2733]">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedIds.length} selecionada(s) na lista</span>
            <button type="button" className={btn.primary} disabled={busy} onClick={() => void runSelected()}>
              {running === "selected" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
              Baixar fichas selecionadas
            </button>
            <button type="button" className={btn.ghost} disabled={busy} onClick={onClearSelection}>Limpar seleção</button>
          </div>
        )}

        {progress && (running === "all" || typeof running === "number" || running === "selected" || progress.done > 0) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
              <span id="zip-progress-label">
                {running !== null ? `Gerando pacote ${Math.min(progress.done + 1, progress.total)} de ${progress.total}…` : `${progress.done} de ${progress.total} pacote(s) concluído(s)`}
              </span>
              {running !== null && running !== "template" && (
                <button type="button" className={btn.ghost} onClick={() => abortRef.current?.abort()}>
                  <X className="h-4 w-4" aria-hidden="true" /> Interromper
                </button>
              )}
            </div>
            <div
              role="progressbar"
              aria-labelledby="zip-progress-label"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
              className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
            >
              <div className="h-full origin-left rounded-full bg-[#007DA5] transition-transform duration-200 motion-reduce:transition-none dark:bg-[#01B6D1]" style={{ transform: `scaleX(${percent / 100})` }} />
            </div>
          </div>
        )}

        {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
      </div>
    </Panel>
  );
}
