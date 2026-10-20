/** Publicação do perfil oficial vinda do Behold (somente leitura). */
export interface InstagramPost {
  id: string;
  imageUrl: string;
  /** Legenda integral, com quebras de linha originais. Pode ser vazia. */
  caption: string;
  publishedAt: string | null;
  authorHandle: string;
  postUrl: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
}
