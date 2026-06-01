import { API_ROOT } from "../config";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const res = await fetch(`${API_ROOT}${path}`, {
    ...options,
    credentials: "include",
    headers: isForm
      ? { Accept: "application/json", ...(options.headers || {}) }
      : {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(options.headers || {}),
        },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.errors?.join?.(", ") || "Erreur");
  return data as T;
}

export async function login(email: string, password: string) {
  return api<{ user: { role: string } }>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  return api("/v1/auth/logout", { method: "DELETE" });
}

export async function me() {
  return api<{ user: { id: number; email: string; name: string; role: string } | null }>(
    "/v1/auth/me"
  );
}
