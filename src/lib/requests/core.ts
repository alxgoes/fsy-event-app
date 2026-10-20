// Núcleo da camada de requisições do navegador: sem dependências, testável em Node.
// Tudo aqui vive na memória de UMA aba (ou de uma instância); não é fila global
// entre usuários nem reduz conexões do Postgres por si só.

export type RequestErrorCode = "timeout" | "aborted" | "queue_full";

export class RequestError extends Error {
  readonly code: RequestErrorCode;

  constructor(code: RequestErrorCode, message: string) {
    super(message);
    this.name = "RequestError";
    this.code = code;
    Object.setPrototypeOf(this, RequestError.prototype);
  }
}

export const isRequestError = (error: unknown, code?: RequestErrorCode): error is RequestError =>
  typeof error === "object" && error !== null && (error as { name?: string }).name === "RequestError" &&
  (!code || (error as RequestError).code === code);

export type Task<T> = (signal: AbortSignal) => Promise<T>;

export interface RunOptions {
  /** Cancela a espera na fila ou a execução. */
  signal?: AbortSignal;
  /** Prazo total (fila + execução). 0 desativa. */
  timeoutMs?: number;
}

export interface Limiter {
  run<T>(task: Task<T>, options?: RunOptions): Promise<T>;
  stats(): { active: number; queued: number };
}

export interface LimiterOptions {
  maxConcurrent: number;
  /** Fila curta: acima dela a chamada é recusada na hora (queue_full). */
  maxQueue: number;
  defaultTimeoutMs?: number;
}

/** Limita tarefas simultâneas com fila FIFO limitada, timeout e cancelamento. */
export function createLimiter({ maxConcurrent, maxQueue, defaultTimeoutMs = 0 }: LimiterOptions): Limiter {
  let active = 0;
  const queue: Array<() => void> = [];

  const pump = () => {
    while (active < maxConcurrent && queue.length) queue.shift()!();
  };

  function run<T>(task: Task<T>, { signal, timeoutMs = defaultTimeoutMs }: RunOptions = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) return reject(new RequestError("aborted", "Requisição cancelada."));
      if (active >= maxConcurrent && queue.length >= maxQueue) {
        return reject(new RequestError("queue_full", "Muitas requisições em espera nesta aba."));
      }

      const controller = new AbortController();
      let state: "queued" | "running" | "done" = "queued";
      let timer: ReturnType<typeof setTimeout> | undefined;

      const start = () => {
        state = "running";
        active++;
        Promise.resolve()
          .then(() => task(controller.signal))
          .then((value) => finish(() => resolve(value)), (error) => finish(() => reject(error)));
      };
      // A vaga é liberada quando a tarefa termina ou quando a abortamos (timeout/cancelamento),
      // para que uma busca que ignore o sinal não prenda a fila.
      const finish = (settle: () => void) => {
        if (state === "done") return;
        const wasRunning = state === "running";
        state = "done";
        if (timer) clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        if (wasRunning) {
          active--;
          pump();
        } else {
          const index = queue.indexOf(start);
          if (index >= 0) queue.splice(index, 1);
        }
        settle();
      };
      const fail = (code: RequestErrorCode, message: string) => {
        if (state === "done") return;
        controller.abort();
        finish(() => reject(new RequestError(code, message)));
      };
      const onAbort = () => fail("aborted", "Requisição cancelada.");

      signal?.addEventListener("abort", onAbort, { once: true });
      if (timeoutMs > 0) timer = setTimeout(() => fail("timeout", "Tempo de resposta esgotado."), timeoutMs);
      if (active < maxConcurrent) start();
      else queue.push(start);
    });
  }

  return { run, stats: () => ({ active, queued: queue.length }) };
}

export interface CacheGetOptions extends RunOptions {
  /** Tempo de reaproveitamento do resultado. 0 (padrão) = só deduplica em voo. */
  ttlMs?: number;
}

export interface RequestCache {
  get<T>(key: string, fetcher: Task<T>, options?: CacheGetOptions): Promise<T>;
  /** Descarta resultados (e desliga buscas em voo do cache) cujas chaves começam com o prefixo. */
  invalidate(prefix: string): void;
  /** Aborta buscas em voo e esvazia tudo (troca de sessão). */
  clear(): void;
}

interface Entry {
  promise: Promise<unknown>;
  controller: AbortController;
  subscribers: number;
  settled: boolean;
  value?: unknown;
  expiresAt: number;
}

/**
 * Deduplica buscas pela chave e guarda o resultado por pouco tempo.
 * A chave DEVE conter a identidade (usuário/companhia) dona dos dados.
 */
export function createRequestCache({
  limiter,
  maxEntries = 50,
  now = () => Date.now(),
}: {
  limiter: Limiter;
  maxEntries?: number;
  now?: () => number;
}): RequestCache {
  const entries = new Map<string, Entry>();

  const prune = () => {
    const settled: string[] = [];
    entries.forEach((entry, key) => { if (entry.settled) settled.push(key); });
    while (entries.size > maxEntries && settled.length) entries.delete(settled.shift()!);
  };

  const subscribe = <T>(key: string, entry: Entry, signal?: AbortSignal) => {
    entry.subscribers++;
    return new Promise<T>((resolve, reject) => {
      const leave = () => {
        signal?.removeEventListener("abort", onAbort);
        entry.subscribers--;
        if (entry.subscribers === 0 && !entry.settled) {
          if (entries.get(key) === entry) entries.delete(key);
          entry.controller.abort();
        }
      };
      const onAbort = () => {
        leave();
        reject(new RequestError("aborted", "Requisição cancelada."));
      };
      if (signal?.aborted) return onAbort();
      signal?.addEventListener("abort", onAbort, { once: true });
      entry.promise.then(
        (value) => { signal?.removeEventListener("abort", onAbort); resolve(value as T); },
        (error) => { signal?.removeEventListener("abort", onAbort); reject(error); }
      );
    });
  };

  function get<T>(key: string, fetcher: Task<T>, { signal, ttlMs = 0, timeoutMs }: CacheGetOptions = {}) {
    const existing = entries.get(key);
    if (existing?.settled) {
      if (existing.expiresAt > now()) return Promise.resolve(existing.value as T);
      entries.delete(key);
    } else if (existing) {
      return subscribe<T>(key, existing, signal);
    }

    const controller = new AbortController();
    const entry: Entry = {
      controller,
      subscribers: 0,
      settled: false,
      expiresAt: 0,
      promise: limiter.run(fetcher, { signal: controller.signal, timeoutMs }),
    };
    entry.promise.then(
      (value) => {
        if (entries.get(key) !== entry) return; // invalidada ou sessão trocada durante a busca
        if (ttlMs <= 0) return void entries.delete(key);
        entry.settled = true;
        entry.value = value;
        entry.expiresAt = now() + ttlMs;
        prune();
      },
      () => { if (entries.get(key) === entry) entries.delete(key); } // falha nunca fica em cache
    );
    entries.set(key, entry);
    return subscribe<T>(key, entry, signal);
  }

  return {
    get,
    invalidate(prefix) {
      const stale: string[] = [];
      entries.forEach((_, key) => { if (key.startsWith(prefix)) stale.push(key); });
      stale.forEach((key) => entries.delete(key));
    },
    clear() {
      const inFlight: Entry[] = [];
      entries.forEach((entry) => { if (!entry.settled) inFlight.push(entry); });
      entries.clear();
      inFlight.forEach((entry) => entry.controller.abort());
    },
  };
}
