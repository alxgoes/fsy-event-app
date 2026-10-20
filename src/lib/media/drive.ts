/**
 * Fontes de imagem a partir dos links cadastrados pela equipe de mídia.
 * O Google Drive continua sendo a origem; nada é copiado ou tornado público.
 * Só aceitamos https (e http local em desenvolvimento) para evitar esquemas perigosos.
 */
const DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);
const IMAGE_EXT = /\.(avif|gif|jpe?g|png|svg|webp)(\?|$)/i;

function parse(url: string | null | undefined): URL | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    const localDev = process.env.NODE_ENV !== "production" && parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
    return parsed.protocol === "https:" || localDev ? parsed : null;
  } catch {
    return null;
  }
}

export function driveFileId(url: string | null | undefined): string | null {
  const parsed = parse(url);
  if (!parsed || !DRIVE_HOSTS.has(parsed.hostname)) return null;
  const fromPath = parsed.pathname.match(/\/file\/d\/([\w-]+)/)?.[1];
  const fromQuery = parsed.searchParams.get("id");
  const id = fromPath || fromQuery;
  return id && /^[\w-]+$/.test(id) ? id : null;
}

export interface PhotoSources {
  /** Miniatura leve para a grade. */
  thumb: string;
  /** Versão grande para a visualização ampliada. */
  full: string;
  /** Link para abrir no Google Drive (ou a própria imagem). */
  original: string;
}

export function photoSources(photo: { drive_url: string; thumbnail_url: string | null }): PhotoSources | null {
  const id = driveFileId(photo.drive_url);
  if (id) {
    return {
      thumb: `https://drive.google.com/thumbnail?id=${id}&sz=w640`,
      full: `https://lh3.googleusercontent.com/d/${id}=w2048`,
      original: `https://drive.google.com/file/d/${id}/view`,
    };
  }
  const direct = parse(photo.drive_url);
  if (direct && !DRIVE_HOSTS.has(direct.hostname) && IMAGE_EXT.test(direct.pathname)) {
    const thumb = parse(photo.thumbnail_url)?.href ?? direct.href;
    return { thumb, full: direct.href, original: direct.href };
  }
  return null;
}
