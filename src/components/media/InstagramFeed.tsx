"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, ExternalLink, Sparkles, X } from "lucide-react";

export interface InstagramPost {
  id: string;
  imageUrl: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  timestamp: string;
  authorHandle: string;
  authorAvatar?: string;
  tag: string;
  location?: string;
}

const MOCK_INSTAGRAM_POSTS: InstagramPost[] = [
  {
    id: "ig-1",
    imageUrl: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80",
    caption: "A energia da Companhia 4 no grito de guerra foi surreal! 🔥 Quem aí já decorou todas as rimas? #FSYRibeirao2 #Cia4Alma #FirmeNaFe",
    likesCount: 184,
    commentsCount: 29,
    timestamp: "há 2 horas",
    authorHandle: "fsy_ribeirao2",
    tag: "Gincana",
    location: "Campo de Futebol Principal",
  },
  {
    id: "ig-2",
    imageUrl: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&auto=format&fit=crop&q=80",
    caption: "Momento especial do Devocional ao pôr do sol. 'Olhai para Mim em todos os pensamentos' ✨🙏",
    likesCount: 245,
    commentsCount: 42,
    timestamp: "há 5 horas",
    authorHandle: "fsy_ribeirao2",
    tag: "Espiritual",
    location: "Bosque das Palmeiras",
  },
  {
    id: "ig-3",
    imageUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop&q=80",
    caption: "Noite dos Talentos a todo vapor! 🎭 Muita música, esquetes engraçadas e a dança sincronizada dos consultores!",
    likesCount: 312,
    commentsCount: 56,
    timestamp: "Ontem",
    authorHandle: "fsy_ribeirao2",
    tag: "Noite dos Talentos",
    location: "Auditório Master",
  },
  {
    id: "ig-4",
    imageUrl: "https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=800&auto=format&fit=crop&q=80",
    caption: "Almoço das Companhias: união, amizade e a preparação para os jogos da tarde. Quem ganha a prova da esteira?",
    likesCount: 167,
    commentsCount: 18,
    timestamp: "Ontem",
    authorHandle: "fsy_ribeirao2",
    tag: "Companhias",
    location: "Refeitório Central",
  },
];

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

export function InstagramFeed() {
  const [posts, setPosts] = useState<InstagramPost[]>(MOCK_INSTAGRAM_POSTS);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);

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
      {/* Feed Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {posts.map((post) => {
          const isLiked = likedPosts[post.id];

          return (
            <motion.div
              key={post.id}
              whileHover={{ y: -4 }}
              onClick={() => setSelectedPost(post)}
              className="group relative overflow-hidden rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-brutal-sm cursor-pointer flex flex-col justify-between"
            >
              {/* Image Container with overlay */}
              <div className="relative aspect-square w-full overflow-hidden bg-slate-100 dark:bg-slate-700">
                <img
                  src={post.imageUrl}
                  alt={post.caption}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Tag Badge */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="rounded-lg bg-black/60 backdrop-blur-md px-2 py-0.5 text-[10px] font-black text-white border border-white/20 uppercase">
                    {post.tag}
                  </span>
                </div>

                {/* Hover Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end text-white">
                  <p className="text-xs font-bold line-clamp-2 leading-snug drop-shadow-md">
                    {post.caption}
                  </p>
                  <span className="text-[10px] font-semibold text-white/80 mt-1">
                    {post.timestamp}
                  </span>
                </div>
              </div>

              {/* Bottom Card Bar */}
              <div className="p-3 border-t-2 border-slate-900 dark:border-slate-700 flex items-center justify-between text-xs bg-white dark:bg-slate-800">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <span className="text-[11px] font-extrabold text-[#4361EE]">@{post.authorHandle}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => toggleLike(post.id, e)}
                    className={`flex items-center gap-1 font-bold transition-colors ${
                      isLiked
                        ? "text-[#FF6B8B]"
                        : "text-slate-500 hover:text-[#FF6B8B]"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${isLiked ? "fill-[#FF6B8B]" : ""}`} />
                    <span className="text-xs">{post.likesCount}</span>
                  </button>

                  <div className="flex items-center gap-1 text-slate-500 font-bold">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-xs">{post.commentsCount}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Direct Instagram Profile Link */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-[#FFD166]" />
          <span>Use a hashtag <strong>#FSYRibeirao2</strong> para aparecer no mural oficial</span>
        </div>

        <a
          href="https://instagram.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-black text-[#FF6B8B] hover:underline"
        >
          <InstagramIcon className="h-3.5 w-3.5" />
          <span>Ver perfil oficial @fsy_ribeirao2</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

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
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl overflow-hidden rounded-3xl border-2 border-slate-900 bg-white dark:bg-slate-900 shadow-brutal-md text-slate-900 dark:text-slate-100 flex flex-col md:flex-row"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedPost(null)}
                className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-xl bg-black/60 text-white hover:bg-black transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Modal Image */}
              <div className="md:w-1/2 bg-slate-950 flex items-center justify-center aspect-square md:aspect-auto">
                <img
                  src={selectedPost.imageUrl}
                  alt={selectedPost.caption}
                  className="h-full w-full object-cover max-h-[360px] md:max-h-full"
                />
              </div>

              {/* Modal Post Content */}
              <div className="md:w-1/2 p-6 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF6B8B] text-white font-bold text-xs">
                      FSY
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                        @{selectedPost.authorHandle}
                      </p>
                      {selectedPost.location && (
                        <p className="text-[10px] text-slate-500 font-medium">
                          {selectedPost.location}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                    {selectedPost.caption}
                  </p>

                  <span className="text-[11px] font-bold text-slate-400 block mt-2">
                    Publicado {selectedPost.timestamp}
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => toggleLike(selectedPost.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm font-black text-xs transition-all ${
                      likedPosts[selectedPost.id]
                        ? "bg-pink-100 text-[#FF6B8B]"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${likedPosts[selectedPost.id] ? "fill-[#FF6B8B]" : ""}`} />
                    <span>{selectedPost.likesCount} Curtidas</span>
                  </button>

                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-bold text-[#4361EE] hover:underline"
                  >
                    <span>Abrir no Instagram</span>
                    <ExternalLink className="h-3 w-3" />
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
