"use client";

import React, { startTransition, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, Download, ExternalLink, Loader2, RefreshCw, Share, ShieldCheck, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { EVENT_DATES, EVENT_NAME, EVENT_THEME } from "@/lib/event/identity";
import type { AppDistributionManifest, PlatformReleaseStatus } from "@/types/app-distribution";
import { FsyTempleMark, FsyFloatingLetters } from "@/components/brand/FsyLogo";
import { ErrorState, OfflineBanner } from "@/components/ui/states";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { usePwa } from "./PwaContext";

const primary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#007DA5] px-5 text-sm font-semibold text-white hover:bg-[#005E7C] dark:bg-[#01B6D1] dark:text-slate-950";
const secondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

/** Só um endereço HTTPS válido vira link de download; nunca se fabrica URL. */
function httpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const ANDROID_VERSION: Record<number, string> = { 24: "7.0", 26: "8.0", 28: "9", 29: "10", 30: "11", 31: "12", 33: "13", 34: "14", 35: "15" };

function formatSize(bytes: number | null | undefined) {
  if (!bytes) return null;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

function StatusPill({ tone, children }: { tone: "ready" | "pending"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        tone === "ready"
          ? "border-[#BFE3A0] bg-[#F2FAEA] text-[#2F5413] dark:border-[#3D5A22] dark:bg-[#14210B] dark:text-[#D6F0BC]"
          : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100"
      )}
    >
      {tone === "ready" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Clock className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

function BrowserInstall() {
  const { isIOS, canPromptInstall, triggerInstall, isInstalled } = usePwa();
  if (isInstalled) return <p className="text-sm text-slate-700 dark:text-slate-300">O portal já está instalado neste aparelho.</p>;
  if (canPromptInstall) {
    return (
      <button type="button" className={secondary} onClick={() => void triggerInstall()}>
        <Download className="h-4 w-4" aria-hidden="true" /> Instalar o portal pelo navegador
      </button>
    );
  }
  return (
    <p className="text-sm text-slate-700 dark:text-slate-300">
      {isIOS ? (
        <>No Safari, toque em <Share className="inline h-4 w-4 align-text-bottom" aria-hidden="true" /> (Compartilhar) e escolha <strong>Adicionar à Tela de Início</strong>.</>
      ) : (
        <>No Chrome, abra o menu <strong>⋮</strong> e escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</>
      )}
    </p>
  );
}

function AndroidCard({ status }: { status: PlatformReleaseStatus }) {
  const url = httpsUrl(status.downloadUrl);
  const meta = status.androidMetadata;
  const direct = status.availability === "ready_direct_download" && url;
  const store = status.availability === "ready_external_store" && url;
  const built = status.availability === "local_artifact_built";
  const androidVersion = meta ? ANDROID_VERSION[meta.minSdk] : undefined;

  return (
    <section aria-labelledby="android-title" className="fsy-panel rounded-3xl bg-white p-5 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="android-title" className="font-heading text-xl font-bold text-slate-900 dark:text-white">Android</h2>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Aplicativo nativo da sessão, com programação, avisos e companhia.</p>
        </div>
        {direct || store ? <StatusPill tone="ready">Disponível</StatusPill> : <StatusPill tone="pending">{built ? "Aguardando publicação" : "Ainda não publicado"}</StatusPill>}
      </div>

      <div className="mt-5 space-y-4">
        {direct ? (
          <>
            <a href={url} className={primary} rel="noopener">
              <Download className="h-5 w-5" aria-hidden="true" /> Baixar o app Android (APK)
            </a>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-200">
              <li>Abra o arquivo baixado. Se o Android pedir, permita instalar apps desta fonte só para este download.</li>
              <li>Confirme que o pacote é <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{meta?.applicationId ?? "br.com.fsyrp2.app"}</code>.</li>
              <li>Abra o app e entre com a mesma conta do portal.</li>
            </ol>
          </>
        ) : store ? (
          <a href={url} className={primary} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-5 w-5" aria-hidden="true" /> Abrir na loja de aplicativos
          </a>
        ) : (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">
            {built
              ? "O APK assinado já foi gerado e está aguardando um endereço seguro de download. Quando a coordenação publicar, o botão aparece aqui."
              : "O app Android ainda não tem download publicado. Enquanto isso, use o portal pelo navegador; ele pode ser instalado na tela inicial."}
          </div>
        )}

        {!direct && !store && <BrowserInstall />}

        {meta && (direct || built) && (
          <details className="rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-700">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Dados do pacote para conferência
            </summary>
            <dl className="mt-2 grid gap-2 sm:grid-cols-[10rem_1fr]">
              <dt className="text-slate-600 dark:text-slate-400">Versão</dt>
              <dd className="fsy-figure">{meta.versionName} ({meta.versionCode})</dd>
              {androidVersion && (<><dt className="text-slate-600 dark:text-slate-400">Requer</dt><dd>Android {androidVersion} ou superior</dd></>)}
              {formatSize(meta.sizeBytes) && (<><dt className="text-slate-600 dark:text-slate-400">Tamanho</dt><dd>{formatSize(meta.sizeBytes)}</dd></>)}
              {meta.sha256 && (<><dt className="text-slate-600 dark:text-slate-400">SHA-256 do APK</dt><dd className="break-all font-mono text-xs">{meta.sha256}</dd></>)}
              {meta.signerCertificateSha256 && (<><dt className="text-slate-600 dark:text-slate-400">Certificado</dt><dd className="break-all font-mono text-xs">{meta.signerCertificateSha256}</dd></>)}
            </dl>
          </details>
        )}
      </div>
    </section>
  );
}

function IosCard({ status }: { status: PlatformReleaseStatus }) {
  const url = status.availability === "ready_external_store" ? httpsUrl(status.downloadUrl) : null;
  return (
    <section aria-labelledby="ios-title" className="fsy-panel rounded-3xl bg-white p-5 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="ios-title" className="font-heading text-xl font-bold text-slate-900 dark:text-white">iPhone e iPad</h2>
        {url ? <StatusPill tone="ready">Disponível</StatusPill> : <StatusPill tone="pending">Pelo Safari</StatusPill>}
      </div>
      <div className="mt-4 space-y-3">
        {url ? (
          <a href={url} className={primary} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-5 w-5" aria-hidden="true" /> Abrir na App Store / TestFlight
          </a>
        ) : (
          <BrowserInstall />
        )}
      </div>
    </section>
  );
}

export function InstallAppPage() {
  const { isIOS, isOffline } = usePwa();
  const [manifest, setManifest] = useState<AppDistributionManifest | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch("/api/app-release", { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(String(response.status));
      setManifest((await response.json()) as AppDistributionManifest);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [load]);

  return (
    <div className="min-h-screen bg-fsy-watermark p-4 text-slate-900 dark:text-slate-100 sm:p-6">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 py-2">
        <Link href="/dashboard" className="fsy-action-link gap-2 text-sm font-semibold text-[#005E7C] dark:text-[#7DE3F4]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao portal
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-5 py-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-10 items-center justify-center overflow-hidden rounded-t-full rounded-b-lg border border-slate-200 bg-[#EFEFE7] p-0.5 dark:border-slate-700 dark:bg-slate-800">
              <FsyTempleMark colorMode="four-color" className="h-full w-auto" />
            </span>
            <FsyFloatingLetters size="sm" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-slate-900 dark:text-white">Instalar o app</h1>
          <p className="max-w-prose text-sm text-slate-700 dark:text-slate-300">
            {EVENT_NAME} · {EVENT_THEME} · {EVENT_DATES}
          </p>
        </div>

        <OfflineBanner />

        {state === "loading" && (
          <div className="space-y-3" aria-live="polite">
            <p className="flex items-center justify-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Verificando a versão disponível…
            </p>
            <div className="h-40 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800" aria-hidden="true" />
          </div>
        )}

        {state === "error" && (
          <ErrorState
            title="Não foi possível verificar o app"
            description={isOffline ? "Você está sem conexão. Conecte-se para ver se há uma versão para baixar." : "O servidor não respondeu. Nenhum link foi exibido para evitar um download incorreto."}
            actions={
              <button type="button" className={secondary} onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Tentar novamente
              </button>
            }
          />
        )}

        {state === "ready" && manifest && (
          <div className="fsy-fade-in space-y-5">
            {isIOS ? (
              <>
                <IosCard status={manifest.ios} />
                <AndroidCard status={manifest.android} />
              </>
            ) : (
              <>
                <AndroidCard status={manifest.android} />
                <IosCard status={manifest.ios} />
              </>
            )}
            <p className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Baixe somente por esta página. A coordenação nunca envia o app por mensagem de outra pessoa.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
