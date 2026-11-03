"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, FileDown, Loader2, X } from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";
import { MAX_AUTHORIZATION_PDF_BATCH_SIZE } from "@/types/authorizations";
import type { RegistrationListMetrics, RegistrationRoleCategory } from "@/types/registrations";
import { downloadAuthorizationZipPart, downloadTemplatePdf, RegistrationsApiError } from "./RegistrationsApi";
import { Notice, Panel, btn } from "./RegistrationsUi";

type Scope = RegistrationRoleCategory | "all";
interface Progress { done: number; total: number; generated: number; overflow: number }

export function RegistrationsAuthorizations({ metrics, selectedIds, onClearSelection }: {
  metrics: RegistrationListMetrics | null;
  selectedIds: string[];
  onClearSelection: () => void;
}) {
  const [scope, setScope] = useState<Scope>("all");
  const [useNormalizedNames, setUseNormalizedNames] = useState(true);
  const [running, setRunning] = useState<"all" | "selected" | "template" | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const downloadPdfs = async (selected: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(selected ? "selected" : "all");
    setFeedback(null);
    const state: Progress = { done: 0, total: selected ? Math.ceil(selectedIds.length / MAX_AUTHORIZATION_PDF_BATCH_SIZE) : 1, generated: 0, overflow: 0 };
    setProgress({ ...state });
    try {
      for (let part = 1; part <= state.total; part++) {
        if (controller.signal.aborted) throw new DOMException("Geração interrompida", "AbortError");
        const ids = selected ? selectedIds.slice((part - 1) * MAX_AUTHORIZATION_PDF_BATCH_SIZE, part * MAX_AUTHORIZATION_PDF_BATCH_SIZE) : undefined;
        const result = await downloadAuthorizationZipPart({
          registrationIds: ids,
          ...(selected ? {} : { roleCategory: scope, partIndex: part, partSize: MAX_AUTHORIZATION_PDF_BATCH_SIZE }),
          useNormalizedNames,
        }, controller.signal);
        // O servidor informa a quantidade real de aprovados: aguardando e cancelados não entram.
        if (!selected) {
          if (!Number.isInteger(result.partCount) || result.partCount < 1) throw new Error("Quantidade de pacotes indisponível.");
          state.total = result.partCount;
          state.generated = result.totalEligible;
        } else {
          state.generated += result.totalEligible;
        }
        state.done++;
        state.overflow += result.overflowWarnings || 0;
        setProgress({ ...state });
      }
      setFeedback({ tone: state.overflow ? "warn" : "ok", text: `${state.generated} autorização(ões) em ${state.done} pacote(s) baixado(s).${state.overflow ? ` Confira no manifesto ${state.overflow} ficha(s) com campos além do espaço disponível.` : ""}` });
    } catch (error) {
      setFeedback((error as { name?: string })?.name === "AbortError"
        ? { tone: "warn", text: "Geração interrompida. Os pacotes já baixados continuam no seu aparelho." }
        : { tone: "error", text: error instanceof RegistrationsApiError ? error.message : "Não foi possível baixar as autorizações. Os pacotes já concluídos continuam no seu aparelho." });
    } finally {
      setRunning(null);
    }
  };

  const getTemplate = async () => {
    setRunning("template");
    setFeedback(null);
    try { await downloadTemplatePdf(); }
    catch (error) { setFeedback({ tone: "error", text: error instanceof RegistrationsApiError ? error.message : "Não foi possível baixar a ficha em branco." }); }
    finally { setRunning(null); }
  };

  const busy = running !== null;
  return (
    <Panel title="Baixar autorizações" description="Os arquivos usam os dados importados e os ajustes salvos. Cada PDF leva o nome do inscrito."
      actions={<button type="button" className={btn.secondary} onClick={() => void getTemplate()} disabled={busy}>{running === "template" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileDown className="h-4 w-4" aria-hidden="true" />} Ficha em branco</button>}>
      <div className="space-y-5">
        {selectedIds.length > 0 && <section aria-label="Inscritos selecionados" className="space-y-3 rounded-2xl border border-[#007DA5]/30 bg-[#F2F9FC] p-4 dark:bg-[#0C2733]">
          <p className="text-sm font-semibold">{selectedIds.length} inscrito(s) selecionado(s)</p>
          <p className="text-sm">Cancelados não entram no download. Os demais selecionados mantêm a situação indicada na lista.</p>
          <div className="flex flex-wrap gap-2"><button type="button" className={btn.primary} disabled={busy} onClick={() => void downloadPdfs(true)}>{running === "selected" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />} Baixar autorizações dos selecionados</button><button type="button" className={btn.ghost} disabled={busy} onClick={onClearSelection}>Limpar seleção</button></div>
        </section>}
        <section aria-label="Todos os aprovados" className="space-y-3">
          <label className="block max-w-sm text-sm font-semibold">Quem incluir entre os aprovados<NativeSelect value={scope} disabled={busy} onChange={(event) => setScope(event.target.value as Scope)} className="mt-1 min-h-11"><option value="all">Todos os tipos</option><option value="Participante">Participantes</option><option value="Consultor">Consultores</option></NativeSelect></label>
          <p className="text-sm text-slate-700 dark:text-slate-300">O download de todos inclui apenas aprovados. Aguardando aprovação e lista de espera podem ser baixados pela seleção individual.</p>
          <button type="button" className={selectedIds.length ? btn.secondary : btn.primary} disabled={busy || !metrics?.totalCount} onClick={() => void downloadPdfs(false)}>{running === "all" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />} Baixar autorizações de todos os aprovados</button>
        </section>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={useNormalizedNames} disabled={busy} onChange={(event) => setUseNormalizedNames(event.target.checked)} className="h-5 w-5 accent-[#007DA5]" /> Usar nomes revisados nas fichas</label>
        <p className="text-sm text-slate-700 dark:text-slate-300">Até {MAX_AUTHORIZATION_PDF_BATCH_SIZE} PDFs por ZIP, baixados em sequência. O navegador pode solicitar permissão para vários arquivos.</p>
        {progress && <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><p id="zip-progress-label" role="status" className="text-sm">{busy ? `Baixando pacote ${Math.min(progress.done + 1, progress.total)} de ${progress.total}…` : `${progress.done} de ${progress.total} pacote(s) concluído(s)`}</p>{busy && running !== "template" && <button type="button" className={btn.ghost} onClick={() => abortRef.current?.abort()}><X className="h-4 w-4" aria-hidden="true" /> Interromper</button>}</div><progress aria-labelledby="zip-progress-label" value={progress.done} max={progress.total} className="h-3 w-full accent-[#007DA5]" /></div>}
        {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
      </div>
    </Panel>
  );
}
