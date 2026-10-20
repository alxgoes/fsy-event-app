/**
 * Limitador simples em memória por instância. Em hospedagem serverless cada
 * instância tem sua própria contagem; o Supabase Auth aplica limites próprios.
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }: { limit: number; windowMs: number; now?: () => number }) {
  const hits = new Map<string, number[]>();
  return {
    hit(key: string): boolean {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
      return true;
    },
  };
}
