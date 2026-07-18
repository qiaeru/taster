// SPDX-License-Identifier: MIT
// Typed fetch wrapper. Mutations carry the CSRF token; the taste list and the
// categories are cached in observables so pages share one fetch.

import type {
  AdminTasteSummary,
  Category,
  CategoryInput,
  SessionInfo,
  TasteDetail,
  TasteInput,
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

async function request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  const mutating = method !== "GET" && method !== "HEAD";
  if (mutating) {
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
  // The cached CSRF token goes stale whenever the session secret changes
  // (logout/login without a reload, server restart). The app never returns
  // 403 for anything else on /api, so refresh the token and retry once.
  if (res.status === 403 && mutating && !retried) {
    invalidateCsrf();
    return request<T>(method, path, body, true);
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
function invalidateCsrf(): void {
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

// The session answer is constant for the whole visit (it only changes through
// login/logout/password change below), yet the list and detail pages both ask
// for it on every render; cache it so a browse session costs one request.
let sessionPromise: Promise<SessionInfo> | null = null;
function invalidateSession(): void {
  sessionPromise = null;
}

export const authApi = {
  session: (): Promise<SessionInfo> => {
    if (!sessionPromise) {
      sessionPromise = api.get<SessionInfo>("/api/auth/session");
      sessionPromise.catch(invalidateSession);
    }
    return sessionPromise;
  },
  login: (username: string, password: string) =>
    api
      .post<{ authenticated: boolean; mustChangePassword: boolean }>("/api/auth/login", {
        username,
        password,
      })
      .then((r) => {
        invalidateSession();
        return r;
      }),
  logout: () =>
    api.post<{ ok: boolean }>("/api/auth/logout").then((r) => {
      // Logging out replaces the session, which voids the cached CSRF token.
      invalidateCsrf();
      invalidateSession();
      return r;
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api
      .post<{ ok: boolean }>("/api/auth/change-password", { currentPassword, newPassword })
      .then((r) => {
        // mustChangePassword just flipped; the cached answer is stale.
        invalidateSession();
        return r;
      }),
};

export const adminApi = {
  tastes: () => api.get<AdminTasteSummary[]>("/api/admin/tastes"),
  createTaste: (input: TasteInput) => api.post<TasteDetail>("/api/admin/tastes", input),
  updateTaste: (id: string, input: TasteInput) =>
    api.put<TasteDetail>(`/api/admin/tastes/${id}`, input),
  deleteTaste: (id: string) => api.delete<{ ok: boolean }>(`/api/admin/tastes/${id}`),
  setFavorite: (id: string, favorite: boolean) =>
    api.put<{ favorite: boolean }>(`/api/admin/tastes/${id}/favorite`, { favorite }),
  bulkTastes: (action: "publish" | "unpublish" | "delete", ids: string[]) =>
    api.post<{ affected: number }>("/api/admin/tastes/bulk", { action, ids }),
  uploadImage: async (id: string, blob: Blob, filename: string) => {
    const send = async () => {
      const form = new FormData();
      form.append("file", blob, filename);
      return fetch(`/api/admin/tastes/${id}/image`, {
        method: "PUT",
        headers: { "x-csrf-token": await getCsrfToken() },
        body: form,
      });
    };
    let res = await send();
    if (res.status === 403) {
      // Stale CSRF token (see request()): refresh and retry once.
      invalidateCsrf();
      res = await send();
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.error || "REQUEST_FAILED");
    return data as { imageFile: string };
  },
  deleteImage: (id: string) => api.delete<{ ok: boolean }>(`/api/admin/tastes/${id}/image`),
  createCategory: (input: CategoryInput) => api.post<Category>("/api/admin/categories", input),
  updateCategory: (id: number, input: CategoryInput) =>
    api.put<Category>(`/api/admin/categories/${id}`, input),
  deleteCategory: (id: number) => api.delete<{ ok: boolean }>(`/api/admin/categories/${id}`),
  reorderCategories: (ids: number[]) =>
    api.put<Category[]>("/api/admin/categories/reorder", { ids }),
  tags: () => api.get<{ id: number; name: string; count: number }[]>("/api/admin/tags"),
  renameTag: (id: number, name: string, merge = false) =>
    api.put<{ ok: boolean; merged: boolean }>(
      `/api/admin/tags/${id}`,
      merge ? { name, merge: true } : { name }
    ),
  deleteTag: (id: number) => api.delete<{ ok: boolean }>(`/api/admin/tags/${id}`),
  setStatuses: (id: number, statuses: { id?: number; name: string }[]) =>
    api.put<Category>(`/api/admin/categories/${id}/statuses`, { statuses }),
};

export function thumbUrl(imageFile: string): string {
  return `/uploads/${imageFile.replace(/\.webp$/, ".thumb.webp")}`;
}

export function displayUrl(imageFile: string): string {
  return `/uploads/${imageFile}`;
}
