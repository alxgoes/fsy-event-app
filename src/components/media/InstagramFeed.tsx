"use client";
import { startTransition } from "react";


import React, { useEffect, useId, useState } from "react";
import Image from "next/image";
import { ExternalLink, ImageOff } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { isLongCaption, tokenizeCaption } from "@/lib/media/caption";
import type { InstagramPost } from "@/types/instagram";

const OFFICIAL_URL = "https://www.instagram.com/fsy_ribeiraopreto/";
const DEFAULT_FEED = "KjHNorrOyv2vHpAmLE0F";
const controlClass = "inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#005E7C] dark:text-[#7DE3F4] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/30 dark:text-[#7DE3F4]";

function Caption({ text }: { text: string }) {
  return <>{tokenizeCaption(text).map((token, index) => token.type === "text"
    ? <React.Fragment key={index}>{token.value}</React.Fragment>
    : <a key={index} href={token.href} target="_blank" rel="noopener noreferrer" className="text-[#005E7C] dark:text-[#7DE3F4] underline underline-offset-4 focus-visible:outline focus-visible:outline-2">{token.value}</a>)}</>;
}

function PostImage({ post, full = false }: { post: InstagramPost; full?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className={`relative w-full bg-slate-100 dark:bg-slate-800 ${full ? "h-[30dvh] sm:h-[45dvh]" : "aspect-square"}`}>
    {post.imageUrl && !failed ? <Image src={post.imageUrl} alt={`Publicação de @${post.authorHandle}`} fill unoptimized sizes="(max-width: 640px) 100vw, 50vw" className="object-contain" onError={() => setFailed(true)} />
      : <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-300"><ImageOff aria-hidden="true" className="h-5 w-5" /> Imagem indisponível</span>}
  </div>;
}

function PostCard({ post }: { post: InstagramPost }) {
  const [expanded, setExpanded] = useState(false);
  const captionId = useId();
  const date = post.publishedAt ? new Date(post.publishedAt) : null;
  return <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
    <Dialog>
      <DialogTrigger className="block w-full rounded-t-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#007DA5]/40" aria-label={`Ampliar publicação de @${post.authorHandle}`}>
        <PostImage post={post} />
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-2xl motion-reduce:animate-none">
        <DialogTitle className="pr-12 leading-normal">Publicação de @{post.authorHandle}</DialogTitle>
        <PostImage post={post} full />
        <div role="region" aria-label="Legenda integral da publicação" tabIndex={0} className="max-h-[30dvh] overflow-y-auto whitespace-pre-line break-words p-1 text-base leading-relaxed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#007DA5] [overflow-wrap:anywhere]">
          <Caption text={post.caption || "Publicação sem legenda."} />
        </div>
        <a href={post.postUrl || OFFICIAL_URL} target="_blank" rel="noopener noreferrer" className={controlClass}>Abrir original no Instagram <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
      </DialogContent>
    </Dialog>
    <div className="space-y-2 p-3">
      <p id={captionId} className={`whitespace-pre-line break-words text-sm leading-relaxed text-slate-800 dark:text-slate-200 [overflow-wrap:anywhere] ${expanded ? "" : "line-clamp-3"}`}>{expanded ? <Caption text={post.caption || "Publicação sem legenda."} /> : (post.caption || "Publicação sem legenda.")}</p>
      {isLongCaption(post.caption) && <button type="button" className={controlClass} aria-expanded={expanded} aria-controls={captionId} onClick={() => setExpanded(!expanded)}>{expanded ? "Ver menos" : "Ver mais"}</button>}
      {date && !Number.isNaN(date.getTime()) && <time dateTime={post.publishedAt!} className="block text-xs text-slate-600 dark:text-slate-300">{date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>}
      <a href={post.postUrl || OFFICIAL_URL} target="_blank" rel="noopener noreferrer" className={controlClass}>Ver no Instagram <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
    </div>
  </article>;
}

export function InstagramFeed() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    startTransition(() => { setLoading(true); });
    startTransition(() => { setFailed(false); });
    async function load() {
      try {
        const feed = process.env.NEXT_PUBLIC_BEHOLD_FEED_ID || DEFAULT_FEED;
        const response = await fetch(`/api/instagram?feedId=${encodeURIComponent(feed)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Feed indisponível");
        const json = await response.json();
        if (!Array.isArray(json.data)) throw new Error("Resposta inválida");
        startTransition(() => { setPosts(json.data); });
      } catch {
        if (!controller.signal.aborted) startTransition(() => { setFailed(true); });
      } finally {
        if (!controller.signal.aborted) startTransition(() => { setLoading(false); });
      }
    }
    startTransition(() => { void load(); });
    return () => controller.abort();
  }, [attempt]);
  return <div className="space-y-4" aria-busy={loading}>
    {loading && <p role="status" className="text-sm text-muted-foreground">Carregando publicações…</p>}
    {failed && <div role="status"><p className="text-sm text-muted-foreground">Não foi possível carregar as publicações. Você pode acessar o perfil oficial.</p><button type="button" onClick={() => setAttempt(attempt + 1)} className={controlClass}>Tentar novamente</button></div>}
    {!loading && !failed && posts.length === 0 && <p className="text-sm text-muted-foreground">As publicações estão disponíveis no perfil oficial do FSY Ribeirão Preto.</p>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{posts.map(post => <PostCard key={post.id} post={post} />)}</div>
    <a href={OFFICIAL_URL} target="_blank" rel="noopener noreferrer" className={controlClass}>Ver perfil oficial @fsy_ribeiraopreto <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
  </div>;
}
