"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Script from "next/script";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ExternalLink, Sparkles, X } from "lucide-react";

function InstagramIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export interface InstagramPost {
  id: string;
  imageUrl: string;
  caption: string;
  likesCount: number;
  commentsCount?: number;
  timestamp: string;
  authorHandle: string;
  authorAvatar?: string;
  tag?: string;
  postUrl?: string;
  location?: string;
}

const STORAGE_KEY_IG = "fsy_behold_instagram_posts_v4";
const OFFICIAL_HANDLE = "fsy_ribeiraopreto";
const OFFICIAL_URL = "https://www.instagram.com/fsy_ribeiraopreto/";
const DEFAULT_BEHOLD_FEED_ID = "KjHNorrOyv2vHpAmLE0F";

export function InstagramFeed() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);
  const [beholdFeedId, setBeholdFeedId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Try local storage cache first for instantaneous display
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(STORAGE_KEY_IG);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPosts(parsed);
            setLoading(false);
          }
        }
      } catch {}
    }

    // 2. Fetch fresh posts from /api/instagram (which queries Behold if configured)
    async function loadFeed() {
      try {
        const envFeedId = process.env.NEXT_PUBLIC_BEHOLD_FEED_ID || DEFAULT_BEHOLD_FEED_ID;
        const url = `/api/instagram?feedId=${envFeedId}&_t=${Date.now()}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            setPosts(json.data);
            setBeholdFeedId(json.feedId || envFeedId || null);

            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(STORAGE_KEY_IG, JSON.stringify(json.data));
              } catch {}
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar feed do Instagram via Behold:", err);
      } finally {
        setLoading(false);
      }
    }

    loadFeed();
  }, []);

  const toggleLike = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setLikedPosts((prev) => {
      const isLiked = !prev[id];
      setPosts((current) =>
        current.map((p) =>
          p.id === id
            ? { ...p, likesCount: p.likesCount + (isLiked ? 1 : -1) }
            : p
        )
      );
      return { ...prev, [id]: isLiked };
    });
  };

  return (
    <div className="space-y-4">
      {/* Loading Skeleton */}
      {loading && posts.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="aspect-square rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse border-2 border-slate-200 dark:border-slate-700"
            />
          ))}
        </div>
      ) : null}

      {/* Feed Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {posts.map((post) => {
          const isLiked = likedPosts[post.id];

          return (
            <motion.div
              key={post.id}
              whileHover={{ y: -4 }}
              onClick={() => setSelectedPost(post)}
              className="group relative overflow-hidden rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm cursor-pointer flex flex-col justify-between"
            >
              {/* Image Container */}
              <div className="relative aspect-square w-full overflow-hidden bg-slate-100 dark:bg-slate-700">
                <Image
                  src={post.imageUrl}
                  alt={post.caption}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Top Badge */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="rounded-lg bg-black/60 backdrop-blur-md px-2 py-0.5 text-xs font-black text-white border border-white/20 uppercase">
                    FSY 2027
                  </span>
                </div>

                {/* Hover Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end text-white">
                  <p className="text-xs font-bold line-clamp-2 leading-snug drop-shadow-md">
                    {post.caption}
                  </p>
                  <span className="text-[11px] font-semibold text-slate-300 mt-1">
                    {post.timestamp}
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="p-3 border-t-2 border-slate-900 dark:border-slate-700 flex flex-col justify-between gap-2 flex-1">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-2 leading-tight">
                  {post.caption}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60">
                  <button
                    type="button"
                    onClick={(e) => toggleLike(post.id, e)}
                    aria-label={`Curtir postagem de @${post.authorHandle}`}
                    className={`flex items-center gap-1 font-bold text-xs transition-colors p-1 -ml-1 rounded-lg min-h-[44px] cursor-pointer ${
                      isLiked
                        ? "text-[#FC4E6D]"
                        : "text-slate-600 dark:text-slate-300 hover:text-[#FC4E6D]"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${isLiked ? "fill-[#FC4E6D]" : ""}`} />
                    <span className="text-xs">{post.likesCount} {post.likesCount === 1 ? "curtida" : "curtidas"}</span>
                  </button>

                  <a
                    href={post.postUrl || OFFICIAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[11px] font-bold text-slate-500 hover:text-[#007DA5] dark:hover:text-[#01B6D1] flex items-center gap-1 p-1 min-h-[44px]"
                    aria-label="Ver no Instagram"
                  >
                    <span>Ver no Insta</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Official Profile Link (No hashtag) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <Sparkles className="h-3.5 w-3.5 text-[#FFE48A]" />
          <span>Acompanhe todas as atualizações e novidades no perfil oficial!</span>
        </div>

        <a
          href={OFFICIAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-black text-[#FC4E6D] hover:underline min-h-[44px] cursor-pointer"
          aria-label={`Ver perfil oficial @${OFFICIAL_HANDLE} no Instagram`}
        >
          <InstagramIcon className="h-4 w-4" />
          <span>Ver perfil oficial @{OFFICIAL_HANDLE}</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Behold Widget Option (if configured with Behold web component script) */}
      {beholdFeedId && (
        <Script
          src="https://w.behold.so/widget.js"
          type="module"
          strategy="lazyOnload"
        />
      )}

      {/* Lightbox / Post Detail Modal */}
      <AnimatePresence>
        {selectedPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPost(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-900 dark:border-slate-700 overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedPost(null)}
                aria-label="Fechar modal do post"
                className="absolute top-3 right-3 z-10 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-black/60 text-white hover:bg-black transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Modal Image */}
              <div className="relative md:w-1/2 bg-slate-950 flex items-center justify-center aspect-square md:aspect-auto min-h-[300px]">
                <Image
                  src={selectedPost.imageUrl}
                  alt={selectedPost.caption}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>

              {/* Modal Post Content */}
              <div className="md:w-1/2 p-6 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FC4E6D] text-white font-bold text-xs">
                      FSY
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                        @{OFFICIAL_HANDLE}
                      </p>
                      {selectedPost.location && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                          {selectedPost.location}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                    {selectedPost.caption}
                  </p>

                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mt-2">
                    Publicado {selectedPost.timestamp}
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleLike(selectedPost.id)}
                    aria-label={`Curtir publicação de @${OFFICIAL_HANDLE}`}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-slate-900 dark:border-slate-700 shadow-sm font-black text-xs transition-all min-h-[44px] cursor-pointer ${
                      likedPosts[selectedPost.id]
                        ? "bg-pink-100 text-[#FC4E6D]"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${likedPosts[selectedPost.id] ? "fill-[#FC4E6D]" : ""}`} />
                    <span>{selectedPost.likesCount} Curtidas</span>
                  </button>

                  <a
                    href={selectedPost.postUrl || OFFICIAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-tr from-[#FD1D1D] via-[#E1306C] to-[#C13584] text-white font-black text-xs hover:opacity-90 transition-opacity min-h-[44px]"
                    aria-label="Abrir esta publicação no Instagram"
                  >
                    <InstagramIcon className="h-4 w-4" />
                    <span>Ver no Instagram</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
