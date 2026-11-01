/**
 * Talks to the SpeedDex API on the same origin.
 *
 * Tokens: the short-lived access token is kept in memory only. The refresh
 * token is kept in sessionStorage so a page reload stays signed in; it is
 * dropped when the tab closes. Neither is ever logged or put in a URL.
 */

export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: FieldError[] = [],
    readonly requestId?: string,
  ) {
    super(message);
  }
}

type Session = { accessToken: string; accessTokenExpiresAt: string; refreshToken: string };

const REFRESH_KEY = 'sdx.admin.refresh';

export type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type Fetch = typeof fetch;

export class ApiClient {
  private access: { token: string; expiresAt: number } | null = null;
  private refreshing: Promise<boolean> | null = null;
  /** Called when the session ends (signed out elsewhere, revoked, suspended). */
  onSignedOut: () => void = () => {};

  constructor(
    private readonly fetchFn: Fetch = (...a) => fetch(...a),
    private readonly storage: Storage = sessionStorage,
    private readonly now: () => number = Date.now,
  ) {}

  get hasSession() {
    return this.access != null || this.storage.getItem(REFRESH_KEY) != null;
  }

  async login(email: string, password: string) {
    const s = await this.send<Session>('POST', '/v1/auth/login', { email, password }, false);
    this.keep(s);
  }

  async logout() {
    const refreshToken = this.storage.getItem(REFRESH_KEY);
    this.clear();
    if (refreshToken) {
      await this.send('POST', '/v1/auth/logout', { refreshToken }, false).catch(() => {});
    }
  }

  get<T>(path: string, query?: Record<string, string | number | boolean | null | undefined>) {
    return this.request<T>('GET', path + toQuery(query));
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body ?? {});
  }
  patch<T>(path: string, body: unknown) {
    return this.request<T>('PATCH', path, body);
  }
  delete<T>(path: string, body?: unknown) {
    return this.request<T>('DELETE', path, body ?? {});
  }
  /** PUT a file as the raw request body (e.g. an image/jpeg). */
  put<T>(path: string, file: Blob, query?: Record<string, string | number | boolean | null | undefined>) {
    return this.request<T>('PUT', path + toQuery(query), file);
  }

  /** Sends an authenticated request, refreshing the access token once if it has expired. */
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.access || this.access.expiresAt - this.now() < 30_000) {
      if (!(await this.refresh())) throw this.signedOut();
    }
    try {
      return await this.send<T>(method, path, body, true);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      // The token may have been revoked or expired early: one fresh try.
      this.access = null;
      if (!(await this.refresh())) throw this.signedOut();
      return this.send<T>(method, path, body, true);
    }
  }

  /** One refresh at a time: refresh tokens rotate, and reusing one ends the session. */
  private refresh(): Promise<boolean> {
    this.refreshing ??= (async () => {
      const refreshToken = this.storage.getItem(REFRESH_KEY);
      if (!refreshToken) return false;
      try {
        this.keep(await this.send<Session>('POST', '/v1/auth/refresh', { refreshToken }, false));
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) this.clear();
        else throw e;
        return false;
      }
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private keep(s: Session) {
    this.access = { token: s.accessToken, expiresAt: Date.parse(s.accessTokenExpiresAt) };
    this.storage.setItem(REFRESH_KEY, s.refreshToken);
  }

  private clear() {
    this.access = null;
    this.storage.removeItem(REFRESH_KEY);
  }

  private signedOut() {
    this.clear();
    this.onSignedOut();
    return new ApiError(401, 'AUTH_REQUIRED', 'Your session has ended. Sign in again.');
  }

  private async send<T>(method: string, path: string, body: unknown, auth: boolean): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' };
    const raw = body instanceof Blob;
    if (body !== undefined) headers['content-type'] = raw ? body.type || 'application/octet-stream' : 'application/json';
    if (auth && this.access) headers.authorization = `Bearer ${this.access.token}`;
    let res: Response;
    try {
      res = await this.fetchFn(path, {
        method,
        headers,
        body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
        credentials: 'omit',
        cache: 'no-store',
      });
    } catch {
      throw new ApiError(0, 'NETWORK', "Couldn't reach the server. Check your connection and try again.");
    }
    const text = await res.text();
    const json = text ? safeJson(text) : null;
    if (!res.ok) {
      const err = (json as { error?: { code?: string; message?: string; fieldErrors?: FieldError[]; requestId?: string } } | null)?.error;
      throw new ApiError(
        res.status,
        err?.code ?? 'HTTP_ERROR',
        err?.message ?? `The server answered ${res.status}.`,
        err?.fieldErrors ?? [],
        err?.requestId,
      );
    }
    return json as T;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function toQuery(q?: Record<string, string | number | boolean | null | undefined>) {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Hosts that publish openly licensed catalogue photos (allowed by the console's CSP too). */
const PHOTO_HOSTS = new Set(['speeddexgame.com', 'www.speeddexgame.com']);

/**
 * Photo URLs are signed absolute URLs on the API host: load them through the
 * same origin as the console (in development, Vite's proxy). Catalogue photos
 * published on the SpeedDex website load from there directly.
 */
export function sameOrigin(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' && PHOTO_HOSTS.has(u.hostname)) return u.href;
    return u.pathname.startsWith('/v1/media/') ? u.pathname + u.search : null;
  } catch {
    return null;
  }
}
