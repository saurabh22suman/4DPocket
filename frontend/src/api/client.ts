// Same-origin requests use the server's HttpOnly session cookie.
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const incomingHeaders = (options.headers ?? {}) as Record<string, string>;
  // Only set Content-Type if not explicitly provided as empty (for FormData)
  const headers: Record<string, string> = Object.keys(incomingHeaders).length === 0
    ? { "Content-Type": "application/json" }
    : { ...incomingHeaders };
  // If body is FormData, remove Content-Type so browser sets it with boundary
  if (options.body instanceof FormData) {
    delete headers["Content-Type"];
  }
  const res = await fetch(url, { ...options, headers });

  // Auto-redirect to login on 401 (except for auth endpoints)
  if (res.status === 401 && !url.includes("/auth/")) {
    const { pathname, search, hash } = window.location;
    const returnTo = encodeURIComponent(pathname + search + hash);
    window.location.href = `/login?returnTo=${returnTo}`;
  }

  return res;
}

// API helper functions
export const api = {
  async get<T>(url: string): Promise<T> {
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
    return res.json();
  },

  async post<T>(url: string, body?: unknown): Promise<T> {
    const res = await apiFetch(url, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const err = await res.json();
        detail = err.detail || detail;
      } catch {}
      throw new Error(detail);
    }
    return res.json();
  },

  async patch<T>(url: string, body: unknown): Promise<T> {
    const res = await apiFetch(url, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const err = await res.json();
        detail = err.detail || detail;
      } catch {}
      throw new Error(detail);
    }
    return res.json();
  },

  async del(url: string, body?: unknown): Promise<void> {
    const res = await apiFetch(url, {
      method: "DELETE",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let detail = `${res.status}: ${res.statusText}`;
      try {
        const err = await res.json();
        if (err?.detail) detail = typeof err.detail === "string" ? err.detail : detail;
      } catch {}
      throw new Error(detail);
    }
  },

  async login(identifier: string, password: string): Promise<void> {
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: identifier, password }),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Invalid credentials");
  },

  async logout(): Promise<void> {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
  },

  async register(
    email: string,
    password: string,
    displayName?: string,
    username?: string,
    inviteToken?: string,
  ): Promise<unknown> {
    return this.post("/api/v1/auth/register", {
      email,
      username: username || email.split("@")[0],
      password,
      display_name: displayName,
      invite_token: inviteToken,
    });
  },
};
