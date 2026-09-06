import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface InstagramPostRecord {
  id: string;
  imageUrl: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  timestamp: string;
  authorHandle: string;
  authorAvatar?: string;
  postUrl: string;
  location?: string;
  visible: boolean;
  mediaType?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
}

export const OFFICIAL_INSTAGRAM_HANDLE = "fsy_ribeiraopreto";
export const OFFICIAL_INSTAGRAM_URL = "https://www.instagram.com/fsy_ribeiraopreto/";

export const DEFAULT_INSTAGRAM_POSTS: InstagramPostRecord[] = [
  {
    id: "ig-behold-1",
    imageUrl: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80",
    caption: "A energia das companhias no grito de guerra foi surreal! 🔥 Quem aí já decorou todas as rimas? #FSYRibeiraoPreto #FirmeNaFe",
    likesCount: 214,
    commentsCount: 38,
    timestamp: "há 2 horas",
    authorHandle: OFFICIAL_INSTAGRAM_HANDLE,
    postUrl: OFFICIAL_INSTAGRAM_URL,
    location: "Campo de Futebol Principal",
    visible: true,
  },
  {
    id: "ig-behold-2",
    imageUrl: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&auto=format&fit=crop&q=80",
    caption: "Momento especial do Devocional ao pôr do sol. 'Olhai para Mim em todos os pensamentos' ✨🙏",
    likesCount: 289,
    commentsCount: 47,
    timestamp: "há 5 horas",
    authorHandle: OFFICIAL_INSTAGRAM_HANDLE,
    postUrl: OFFICIAL_INSTAGRAM_URL,
    location: "Bosque das Palmeiras",
    visible: true,
  },
  {
    id: "ig-behold-3",
    imageUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop&q=80",
    caption: "Noite dos Talentos a todo vapor! 🎭 Muita música, esquetes engraçadas e a dança sincronizada dos consultores!",
    likesCount: 345,
    commentsCount: 62,
    timestamp: "Ontem",
    authorHandle: OFFICIAL_INSTAGRAM_HANDLE,
    postUrl: OFFICIAL_INSTAGRAM_URL,
    location: "Auditório Master",
    visible: true,
  },
  {
    id: "ig-behold-4",
    imageUrl: "https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=800&auto=format&fit=crop&q=80",
    caption: "Almoço das Companhias: união, amizade e a preparação para os jogos da tarde. Quem ganha a prova da esteira?",
    likesCount: 198,
    commentsCount: 24,
    timestamp: "Ontem",
    authorHandle: OFFICIAL_INSTAGRAM_HANDLE,
    postUrl: OFFICIAL_INSTAGRAM_URL,
    location: "Refeitório Central",
    visible: true,
  },
];

interface BeholdItem {
  id: string;
  timestamp?: string;
  caption?: string;
  prunedCaption?: string;
  likeCount?: number;
  likesCount?: number;
  mediaType?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  mediaUrl?: string;
  permalink?: string;
  thumbnailUrl?: string;
  sizes?: {
    small?: { mediaUrl: string };
    medium?: { mediaUrl: string };
    large?: { mediaUrl: string };
    full?: { mediaUrl: string };
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryFeedId = searchParams.get("feedId");
    const feedId =
      queryFeedId ||
      process.env.NEXT_PUBLIC_BEHOLD_FEED_ID ||
      process.env.BEHOLD_FEED_ID;

    // If Behold Feed ID is configured, fetch live feed from Behold (https://behold.so)
    if (feedId && feedId.trim() && feedId !== "your_behold_feed_id") {
      try {
        const beholdRes = await fetch(`https://feeds.behold.so/${feedId.trim()}`, {
          next: { revalidate: 300 }, // Cache on server for 5 minutes
          headers: {
            Accept: "application/json",
          },
        });

        if (beholdRes.ok) {
          const rawData: unknown = await beholdRes.json();
          let items: BeholdItem[] = [];
          let profileInfo: { username?: string; profilePictureUrl?: string; followersCount?: number } = {};

          if (Array.isArray(rawData)) {
            items = rawData as BeholdItem[];
          } else if (rawData && typeof rawData === "object") {
            const obj = rawData as Record<string, unknown>;
            if (Array.isArray(obj.posts)) {
              items = obj.posts as BeholdItem[];
            }
            profileInfo = {
              username: typeof obj.username === "string" ? obj.username : OFFICIAL_INSTAGRAM_HANDLE,
              profilePictureUrl: typeof obj.profilePictureUrl === "string" ? obj.profilePictureUrl : undefined,
              followersCount: typeof obj.followersCount === "number" ? obj.followersCount : undefined,
            };
          }

          if (items.length > 0) {
            const mapped: InstagramPostRecord[] = items.map((item, idx) => {
              const dateStr = item.timestamp
                ? new Date(item.timestamp).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  })
                : "Recente";

              const img =
                item.sizes?.large?.mediaUrl ||
                item.sizes?.medium?.mediaUrl ||
                item.sizes?.full?.mediaUrl ||
                item.mediaUrl ||
                item.thumbnailUrl ||
                DEFAULT_INSTAGRAM_POSTS[idx % DEFAULT_INSTAGRAM_POSTS.length].imageUrl;

              const caption =
                item.prunedCaption ||
                item.caption ||
                "Publicação Oficial FSY Ribeirão Preto";

              const realLikes =
                typeof item.likeCount === "number"
                  ? item.likeCount
                  : typeof item.likesCount === "number"
                  ? item.likesCount
                  : 0;

              return {
                id: String(item.id || `behold-${idx}`),
                imageUrl: img,
                caption,
                likesCount: realLikes,
                timestamp: dateStr,
                authorHandle: profileInfo.username || OFFICIAL_INSTAGRAM_HANDLE,
                authorAvatar: profileInfo.profilePictureUrl,
                postUrl: item.permalink || OFFICIAL_INSTAGRAM_URL,
                location: "FSY 2027 • Ribeirão Preto",
                visible: true,
                mediaType: item.mediaType,
              };
            });

            return NextResponse.json({
              data: mapped,
              source: "behold",
              beholdConnected: true,
              feedId: feedId.trim(),
              profile: profileInfo,
            });
          }
        }
      } catch (beholdErr) {
        console.error("Behold feed fetch error, falling back to default posts:", beholdErr);
      }
    }

    // Fallback when Behold is not configured yet or during network issues
    return NextResponse.json({
      data: DEFAULT_INSTAGRAM_POSTS,
      source: "fallback",
      beholdConnected: false,
      feedId: feedId || null,
      officialUrl: OFFICIAL_INSTAGRAM_URL,
      handle: OFFICIAL_INSTAGRAM_HANDLE,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { error: message, data: DEFAULT_INSTAGRAM_POSTS, beholdConnected: false },
      { status: 500 }
    );
  }
}
