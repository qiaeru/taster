// SPDX-License-Identifier: MIT
// Typed fetch wrapper. Mutations carry the CSRF token; the taste list and the
// categories are cached in observables so pages share one fetch.

import type {
  AdminTasteSummary,
  Category,
  SessionInfo,
  TasteDetail,
  TasteSummary,
} from "@taster/shared";
import { Observable } from "./lib/store.js";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, details?: unknown) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET" && method !== "HEAD") {
    headers["x-csrf-token"] = await getCsrfToken();
  }
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK");
  }
  if (res.status === 204) return undefined as T;
  let data: { error?: string; details?: unknown } | null = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || "REQUEST_FAILED", data?.details);
  }
  return data as T;
}

let csrfToken: string | null = null;
async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const { token } = await request<{ token: string }>("GET", "/api/auth/csrf");
  csrfToken = token;
  return token;
}
// A 403 CSRF failure after a server restart just needs a fresh token.
export function invalidateCsrf(): void {
  csrfToken = null;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

// ---- Shared public data (fetched once, shared by list/detail/stats) ----

export interface Catalog {
  tastes: TasteSummary[];
  categories: Category[];
}

export const catalog$ = new Observable<Catalog | null>(null);

let catalogPromise: Promise<Catalog> | null = null;

export function loadCatalog(force = false): Promise<Catalog> {
  if (!force && catalogPromise) return catalogPromise;
  catalogPromise = Promise.all([
    api.get<TasteSummary[]>("/api/tastes"),
    api.get<Category[]>("/api/categories"),
  ]).then(([tastes, categories]) => {
    const value = { tastes, categories };
    catalog$.set(value);
    return value;
  });
  catalogPromise.catch(() => {
    // Let a later call retry instead of caching the failure forever.
    catalogPromise = null;
  });
  return catalogPromise;
}

export function invalidateCatalog(): void {
  catalogPromise = null;
  catalog$.set(null);
}

export const publicApi = {
  tasteDetail: (id: string) => api.get<TasteDetail>(`/api/tastes/${id}`),
  tags: () => api.get<{ id: number; name: string }[]>("/api/tags"),
};

export const authApi = {
  session: () => api.get<SessionInfo>("/api/auth/session"),
  login: (username: string, password: string) =>
    api.post<{ authenticated: boolean; mustChangePassword: boolean }>("/api/auth/login", {
      username,
      password,
    }),
  logout: () => api.post<{ ok: boolean }>("/api/auth/logout"),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ ok: boolean }>("/api/auth/change-password", { currentPassword, newPassword }),
};

export const adminApi = {
  tastes: () => api.get<AdminTasteSummary[]>("/api/admin/tastes"),
};

export function thumbUrl(imageFile: string): string {
  return `/uploads/${imageFile.replace(/\.webp$/, ".thumb.webp")}`;
}

export function displayUrl(imageFile: string): string {
  return `/uploads/${imageFile}`;
}
