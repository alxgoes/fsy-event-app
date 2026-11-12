"use client";

import React, { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  INVALID_WHATSAPP_INVITE_MESSAGE,
  normalizeWhatsappInvite,
  type CompanyWhatsappLink,
} from "@/types/company-whatsapp";

interface CompanyWhatsappDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  currentUrl: string | null;
  onSaved: (updated: CompanyWhatsappLink) => void;
}

export function CompanyWhatsappDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  currentUrl,
  onSaved,
}: CompanyWhatsappDialogProps) {
  const [rawUrl, setRawUrl] = useState(currentUrl ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const trimmed = rawUrl.trim();
  const normalized = trimmed ? normalizeWhatsappInvite(trimmed) : null;
  const instantError =
    trimmed.length > 0 && !normalized ? INVALID_WHATSAPP_INVITE_MESSAGE : null;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmRemove(false);
      setServerError(null);
    }
    onOpenChange(nextOpen);
  }

  async function submitUpdate(inviteUrl: string | null) {
    setSaving(true);
    setServerError(null);
    try {
      const res = await fetch("/api/companies/whatsapp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          invite_url: inviteUrl,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: CompanyWhatsappLink;
        error?: string;
      };
      if (!res.ok || body.error || !body.data) {
        throw new Error(
          body.error ||
            "Não foi possível salvar o link do grupo agora. Tente novamente."
        );
      }
      onSaved(body.data);
      handleOpenChange(false);
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar o link do grupo agora. Tente novamente."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!normalized) {
      setServerError(INVALID_WHATSAPP_INVITE_MESSAGE);
      return;
    }
    await submitUpdate(normalized);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {confirmRemove ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Remover link do grupo?</DialogTitle>
              <DialogDescription>
                Os jovens da {companyName} deixarão de ver o botão para entrar
                no grupo do WhatsApp. Você poderá adicionar um novo link quando
                quiser.
              </DialogDescription>
            </DialogHeader>
            {serverError && (
              <p
                role="alert"
                className="break-words text-sm font-medium text-red-700 [overflow-wrap:anywhere] dark:text-red-300"
              >
                {serverError}
              </p>
            )}
            <DialogFooter className="gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setConfirmRemove(false);
                  setServerError(null);
                }}
                className="min-h-11 rounded-full px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 whitespace-normal break-words dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => submitUpdate(null)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60 whitespace-normal break-words"
              >
                {saving && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                <span>Confirmar remoção</span>
              </button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Grupo do WhatsApp — {companyName}</DialogTitle>
              <DialogDescription>
                Cole o link de convite do grupo da companhia para que os jovens
                possam entrar pelo aplicativo e pelo site.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label
                htmlFor="company-whatsapp-invite-input"
                className="block text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                Link de convite do grupo
              </label>
              <Input
                id="company-whatsapp-invite-input"
                type="url"
                inputMode="url"
                autoComplete="off"
                value={rawUrl}
                onChange={(e) => {
                  setRawUrl(e.target.value);
                  if (serverError) setServerError(null);
                }}
                placeholder="https://chat.whatsapp.com/..."
                aria-label="Link de convite do grupo do WhatsApp"
                aria-invalid={Boolean(instantError || serverError)}
                className="min-h-12"
              />
              {(instantError || serverError) && (
                <p
                  role="alert"
                  className="break-words text-sm font-medium text-red-700 [overflow-wrap:anywhere] dark:text-red-300"
                >
                  {instantError || serverError}
                </p>
              )}
            </div>
            <DialogFooter className="flex flex-wrap items-center justify-between gap-2 sm:justify-between">
              {currentUrl ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setServerError(null);
                    setConfirmRemove(true);
                  }}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 whitespace-normal break-words dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span>Remover link</span>
                </button>
              ) : (
                <span className="hidden sm:inline" />
              )}
              <button
                type="submit"
                disabled={saving || !normalized}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#007DA5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#005E7C] disabled:opacity-60 whitespace-normal break-words sm:w-auto"
              >
                {saving && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                <span>Salvar</span>
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
