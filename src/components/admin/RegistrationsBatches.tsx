"use client";

import React, { useState } from "react";
import { History, Loader2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DeleteRegistrationBatchResponse, RegistrationImportBatchSummary } from "@/types/registrations";
import { deleteBatch, listRegistrations, RegistrationsApiError } from "./RegistrationsApi";
import { Notice, Panel, btn, formatBytes, formatDateTime } from "./RegistrationsUi";

const DELETE_WORD = "EXCLUIR";

interface PendingDelete {
  batch: RegistrationImportBatchSummary;
  affected: number | null;
  loadingCount: boolean;
}

export function RegistrationsBatches({
  batches,
  onDeleted,
}: {
  batches: RegistrationImportBatchSummary[];
  onDeleted: (result: DeleteRegistrationBatchResponse) => void;
}) {
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const open = async (batch: RegistrationImportBatchSummary) => {
    setConfirmText("");
    setFeedback(null);
    setPending({ batch, affected: null, loadingCount: true });
    try {
      // Conta exatamente o que o servidor removerá: inscrições que ainda pertencem a este lote.
      const response = await listRegistrations({ batchId: batch.id, page: 1, pageSize: 1 });
      setPending((current) => (current?.batch.id === batch.id ? { ...current, affected: response.pagination.totalFiltered, loadingCount: false } : current));
    } catch {
      setPending((current) => (current?.batch.id === batch.id ? { ...current, loadingCount: false } : current));
    }
  };

  const confirmDelete = async () => {
    if (!pending) return;
    setDeleting(true);
    try {
      const result = await deleteBatch(pending.batch.id);
      setPending(null);
      setFeedback({
        tone: "ok",
        text: `Lote excluído: ${result.deletedRecordsCount} inscrição(ões) removida(s). ${result.activeBatch ? "O lote ativo continua o mesmo." : "Não há lote ativo; nenhum lote anterior foi reativado."}`,
      });
      onDeleted(result);
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof RegistrationsApiError ? error.message : "Não foi possível excluir o lote." });
    } finally {
      setDeleting(false);
    }
  };

  const pendingIsActive = pending?.batch.isActiveBatch ?? false;

  return (
    <Panel
      title="Lotes importados"
      description="Cada confirmação de planilha cria um lote. Excluir um lote nunca reativa um lote anterior."
    >
      {feedback && <div className="mb-4"><Notice tone={feedback.tone}>{feedback.text}</Notice></div>}
      {batches.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-600">
          <History className="h-6 w-6 text-slate-600 dark:text-slate-300" aria-hidden="true" />
          <p className="text-sm text-slate-700 dark:text-slate-300">Nenhum lote importado ainda. Use a aba Importar planilha para criar o primeiro.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {batches.map((batch) => (
            <li key={batch.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <span className="break-all">{batch.filename || "Planilha sem nome"}</span>
                  {batch.isActiveBatch && (
                    <span className="rounded-full bg-[#007DA5] px-2 py-0.5 text-xs font-bold text-white dark:bg-[#01B6D1] dark:text-slate-950">Lote ativo</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                  Revisão <span className="fsy-figure">{batch.revision}</span> · {formatDateTime(batch.createdAt)} · {batch.importedByName ?? "autor não registrado"} ·{" "}
                  {batch.importMode === "replace_all" ? "Substituição total" : "Adicionar e atualizar"} · {formatBytes(batch.fileSizeBytes)}
                </p>
                <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                  Após a importação: <span className="fsy-figure">{batch.totalCount}</span> inscritos ({batch.participantCount} participantes, {batch.counselorCount} consultores) · {batch.warningCount} com avisos
                </p>
              </div>
              <button type="button" className={btn.secondary} onClick={() => void open(batch)} aria-label={`Excluir lote ${batch.filename || batch.id}`}>
                <Trash2 className="h-4 w-4 text-[#B91C1C] dark:text-red-300" aria-hidden="true" /> Excluir lote
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!pending} onOpenChange={(isOpen) => { if (!isOpen && !deleting) setPending(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-slate-900 dark:text-white">Excluir lote selecionado</DialogTitle>
            <DialogDescription className="text-sm text-slate-700 dark:text-slate-300">
              {pending?.batch.filename} · revisão {pending?.batch.revision}
            </DialogDescription>
          </DialogHeader>
          {pending && (
            <div className="space-y-3 text-sm text-slate-800 dark:text-slate-200">
              {pending.loadingCount ? (
                <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Contando inscrições deste lote…</p>
              ) : (
                <Notice tone="warn" role="alert">
                  {pending.affected === null
                    ? "Não foi possível contar as inscrições afetadas. O servidor remove as inscrições que ainda pertencem a este lote."
                    : <>Serão removidas <strong>{pending.affected}</strong> inscrição(ões) que ainda pertencem a este lote. Inscrições que vieram de outros lotes continuam na lista.</>}
                </Notice>
              )}
              {pendingIsActive && (
                <p>Este é o lote ativo: a lista fica sem lote ativo e nenhum lote anterior volta a valer.</p>
              )}
              <p>Esta ação não pode ser desfeita pela interface. Para recuperar, importe a planilha novamente.</p>
              <div>
                <label htmlFor="delete-batch-confirm" className="font-semibold">Digite {DELETE_WORD} para confirmar</label>
                <Input id="delete-batch-confirm" autoComplete="off" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} className="mt-1" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <button type="button" className={btn.secondary} onClick={() => setPending(null)} disabled={deleting}>Cancelar</button>
            <button
              type="button"
              className={btn.danger}
              onClick={() => void confirmDelete()}
              disabled={deleting || pending?.loadingCount || confirmText.trim().toUpperCase() !== DELETE_WORD}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              {deleting ? "Excluindo…" : "Excluir lote"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
