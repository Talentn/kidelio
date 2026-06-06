/**
 * JSON REST over HTTPS (dev: proxied to Rails).
 * Auth: HttpOnly session cookie (credentials: include).
 *
 * Performance layer:
 *   - GET deduplication  — concurrent identical URLs share one in-flight fetch
 *   - Short-lived cache  — GET responses cached for GET_TTL ms (stale-while-revalidate)
 *   - Mutation invalidation — any non-GET request wipes the cache
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const API_V1    = "/api/v1";
const API_ADMIN = "/api/admin";

/* ── GET cache ─────────────────────────────────────────────────────── */
const GET_TTL   = 5 * 60_000;  // 5 min — serve instantly without refetch
const STALE_TTL = 30 * 60_000; // 30 min — still usable for instant hydration

interface CacheEntry { data: unknown; ts: number }
const responseCache = new Map<string, CacheEntry>();
const inflight      = new Map<string, Promise<unknown>>();

function cacheEntry(url: string): CacheEntry | undefined {
  return responseCache.get(url);
}

function isFresh(entry: CacheEntry) {
  return Date.now() - entry.ts < GET_TTL;
}

function isUsable(entry: CacheEntry) {
  return Date.now() - entry.ts < STALE_TTL;
}

function cacheGet<T>(url: string): T | null {
  const entry = cacheEntry(url);
  if (entry && isFresh(entry)) return entry.data as T;
  return null;
}

/** Synchronous read for instant page hydration (includes slightly stale cache). */
export function peekCache(url: string): unknown | null {
  const entry = cacheEntry(url);
  if (entry && isUsable(entry)) return entry.data;
  return null;
}

export function peekCacheV1<T>(path: string): T | null {
  return peekCache(`${API_V1}${path}`) as T | null;
}

/** Synchronous read only when cache is still fresh (avoids stale hero / carousel flashes). */
export function peekFreshCacheV1<T>(path: string): T | null {
  const entry = cacheEntry(`${API_V1}${path}`);
  if (entry && isFresh(entry)) return entry.data as T;
  return null;
}

export function peekCacheAdmin<T>(path: string): T | null {
  return peekCache(`${API_ADMIN}${path}`) as T | null;
}

/** Warm the cache without blocking UI (fire-and-forget). */
export function prefetch(url: string, options?: RequestInit) {
  request<unknown>(url, options).catch(() => {});
}

export function prefetchV1(path: string) {
  prefetch(`${API_V1}${path}`);
}

export function prefetchAdmin(path: string) {
  prefetch(`${API_ADMIN}${path}`);
}

function cacheSet(url: string, data: unknown) {
  responseCache.set(url, { data, ts: Date.now() });
}

/** Wipe cached entries that start with a given prefix (e.g. after a mutation). */
export function invalidateCache(prefix?: string) {
  if (!prefix) { responseCache.clear(); return; }
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) responseCache.delete(key);
  }
}

/* ── Core fetch ─────────────────────────────────────────────────────── */
async function fetchJson<T>(url: string, options: RequestInit): Promise<T> {
  const isForm = options.body instanceof FormData;
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(options.headers as Record<string, string>),
    },
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      json.error ||
      json.errors?.join?.(", ") ||
      json.message ||
      `Erreur ${res.status}`;
    throw new ApiError(msg, res.status);
  }

  if (json && json.ok === true && "data" in json) return json.data as T;
  return json as T;
}

/* ── Main request function ──────────────────────────────────────────── */
function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const method  = (options.method ?? "GET").toUpperCase();
  const isGet   = method === "GET";
  const isAdmin = url.startsWith(API_ADMIN);

  if (isGet && !isAdmin) {
    // 1. Serve from cache if still fresh
    const cached = cacheGet<T>(url);
    if (cached !== null) return Promise.resolve(cached);

    // 2. Deduplicate: reuse the in-flight promise for the same URL
    const existing = inflight.get(url);
    if (existing) return existing as Promise<T>;

    // 3. Stale-while-revalidate — return cached data now, refresh in background
    const stale = cacheEntry(url);
    if (stale && isUsable(stale)) {
      const promise = fetchJson<T>(url, options)
        .then((data) => { cacheSet(url, data); return data; })
        .finally(() => inflight.delete(url));
      inflight.set(url, promise);
      return Promise.resolve(stale.data as T);
    }

    // 4. New fetch — store promise immediately to catch concurrent callers
    const promise = fetchJson<T>(url, options)
      .then((data) => { cacheSet(url, data); return data; })
      .finally(() => inflight.delete(url));

    inflight.set(url, promise);
    return promise;
  }

  // Non-GET mutates data → invalidate cache for the parent namespace
  // e.g. POST /api/v1/auth/login clears all /api/v1/auth/* entries (including /me)
  const segments = url.split("?")[0].replace(/\/\d+$/, "").split("/");
  const namespace = segments.slice(0, -1).join("/") || url.split("?")[0];
  invalidateCache(namespace);

  return fetchJson<T>(url, options);
}

/* ── Public helpers ─────────────────────────────────────────────────── */
export function apiV1<T>(path: string, options?: RequestInit) {
  return request<T>(`${API_V1}${path}`, options);
}

/** Always hits the network — use when UI must reflect latest server config (e.g. homepage hero). */
export function apiV1Fresh<T>(path: string, options?: RequestInit) {
  const url = `${API_V1}${path}`;
  return fetchJson<T>(url, options ?? {}).then((data) => {
    cacheSet(url, data);
    return data;
  });
}

export function apiAdmin<T>(path: string, options?: RequestInit) {
  return request<T>(`${API_ADMIN}${path}`, options);
}

export function login(email: string, password: string) {
  return apiV1<{ user: { role: string; name: string; email: string } }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return apiV1("/auth/logout", { method: "DELETE" });
}

export function me() {
  return apiV1<{ user: { id: number; email: string; name: string; role: string } | null }>(
    "/auth/me"
  );
}
