/**
 * Legendas do Instagram como tokens de texto: nada de HTML de terceiros é
 * renderizado. Links (http/https), @menções e #hashtags viram âncoras seguras.
 */
export type CaptionToken =
  | { type: "text"; value: string }
  | { type: "link" | "mention" | "hashtag"; value: string; href: string };

const PATTERN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])|(@[A-Za-z0-9._]{1,30})|(#[A-Za-z0-9_\u00C0-\u024F]{1,100})/g;

export function tokenizeCaption(text: string): CaptionToken[] {
  const tokens: CaptionToken[] = [];
  let last = 0;
  PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PATTERN.exec(text)) !== null) {
    const index = match.index;
    if (index > last) tokens.push({ type: "text", value: text.slice(last, index) });
    const [value, link, mention, hashtag] = match;
    if (link) tokens.push({ type: "link", value, href: link });
    else if (mention) tokens.push({ type: "mention", value, href: `https://www.instagram.com/${mention.slice(1)}/` });
    else if (hashtag) tokens.push({ type: "hashtag", value, href: `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag.slice(1))}/` });
    last = index + value.length;
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) });
  return tokens;
}

export function isLongCaption(text: string, maxChars = 140, maxLines = 3): boolean {
  return text.length > maxChars || text.split("\n").length > maxLines;
}
