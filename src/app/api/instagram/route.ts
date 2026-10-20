import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import type { InstagramPost } from "@/types/instagram";

const OFFICIAL_INSTAGRAM_HANDLE = "fsy_ribeiraopreto";
const OFFICIAL_INSTAGRAM_URL = "https://www.instagram.com/fsy_ribeiraopreto/";

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

const DEFAULT_BEHOLD_FEED_ID = "KjHNorrOyv2vHpAmLE0F";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // Aceita apenas identificadores no formato do Behold (sem caminhos ou URLs).
    const rawQueryFeedId = searchParams.get("feedId");
    const queryFeedId = rawQueryFeedId && /^[A-Za-z0-9]{8,40}$/.test(rawQueryFeedId) ? rawQueryFeedId : null;
    const feedId =
      queryFeedId ||
      process.env.NEXT_PUBLIC_BEHOLD_FEED_ID ||
      process.env.BEHOLD_FEED_ID ||
      DEFAULT_BEHOLD_FEED_ID;

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
            const mapped: InstagramPost[] = items.flatMap((item, idx) => {
              // Vídeos: a mediaUrl é o arquivo de vídeo; a imagem é a miniatura.
              const img =
                item.sizes?.large?.mediaUrl ||
                item.sizes?.medium?.mediaUrl ||
                item.sizes?.full?.mediaUrl ||
                (item.mediaType === "VIDEO" ? item.thumbnailUrl : item.mediaUrl) ||
                item.thumbnailUrl;

              if (!img) return [];

              return {
                id: String(item.id || `behold-${idx}`),
                imageUrl: img,
                // Legenda integral; prunedCaption do Behold vem cortada.
                caption: (item.caption ?? item.prunedCaption ?? "").trim(),
                publishedAt: item.timestamp ?? null,
                authorHandle: profileInfo.username || OFFICIAL_INSTAGRAM_HANDLE,
                postUrl: item.permalink || OFFICIAL_INSTAGRAM_URL,
                mediaType: item.mediaType ?? "IMAGE",
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
        console.error("Behold feed fetch error, feed unavailable:", beholdErr);
      }
    }

    // Fallback when Behold is not configured yet or during network issues
    return NextResponse.json({
      data: [],
      source: "unavailable",
      beholdConnected: false,
      feedId: feedId || null,
      officialUrl: OFFICIAL_INSTAGRAM_URL,
      handle: OFFICIAL_INSTAGRAM_HANDLE,
    });
  } catch (err: unknown) {
    console.error("[api] instagram", err instanceof Error ? err.name : "");
    return NextResponse.json({ error: "Feed indisponível no momento.", data: [], beholdConnected: false }, { status: 502 });
  }
}
