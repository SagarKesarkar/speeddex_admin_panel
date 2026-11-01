import { describe, expect, it } from 'vitest';
import { ApiClient, ApiError, sameOrigin, toQuery } from './client';

class MemoryStorage {
  map = new Map<string, string>();
  getItem = (k: string) => this.map.get(k) ?? null;
  setItem = (k: string, v: string) => void this.map.set(k, v);
  removeItem = (k: string) => void this.map.delete(k);
}

type Call = { path: string; method: string; body: unknown; auth?: string };

/** A fake API: answers from [routes] and records every call. */
function fakeApi(routes: Record<string, (c: Call) => [number, unknown]>) {
  const calls: Call[] = [];
  const fn = (async (path: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>;
    const c = { path, method: init.method!, body: init.body ? JSON.parse(init.body as string) : undefined, auth: headers.authorization };
    calls.push(c);
    const route = routes[`${c.method} ${path.split('?')[0]}`];
    const [status, json] = route ? route(c) : [404, { error: { code: 'RESOURCE_NOT_FOUND', message: 'Not found.' } }];
    return new Response(JSON.stringify(json), { status });
  }) as typeof fetch;
  return { fn, calls };
}

let n = 0;
const session = (ttlMs = 15 * 60_000) => ({
  accessToken: `access-${++n}`,
  accessTokenExpiresAt: new Date(Date.now() + ttlMs).toISOString(),
  refreshToken: `refresh-${n}-xxxxxxxxxxxxxxxxxxxx`,
});

describe('ApiClient', () => {
  it('signs in, sends the access token, and keeps only the refresh token in storage', async () => {
    const s = session();
    const api = fakeApi({ 'POST /v1/auth/login': () => [200, s], 'GET /v1/admin/me': () => [200, { userId: 1 }] });
    const storage = new MemoryStorage();
    const client = new ApiClient(api.fn, storage);
    await client.login('a@b.co', 'pw');
    expect(await client.get('/v1/admin/me')).toEqual({ userId: 1 });
    expect(api.calls[1]!.auth).toBe(`Bearer ${s.accessToken}`);
    expect([...storage.map.values()]).toEqual([s.refreshToken]);
  });

  it('refreshes once for concurrent requests after a reload', async () => {
    const storage = new MemoryStorage();
    storage.setItem('sdx.admin.refresh', 'refresh-old-xxxxxxxxxxxxxxxx');
    const fresh = session();
    const api = fakeApi({ 'POST /v1/auth/refresh': () => [200, fresh], 'GET /v1/admin/stats': () => [200, { ok: true }] });
    const client = new ApiClient(api.fn, storage);
    await Promise.all([client.get('/v1/admin/stats'), client.get('/v1/admin/stats'), client.get('/v1/admin/stats')]);
    // Refresh tokens rotate: presenting the old one twice would end the session.
    expect(api.calls.filter((c) => c.path === '/v1/auth/refresh')).toHaveLength(1);
    expect(storage.getItem('sdx.admin.refresh')).toBe(fresh.refreshToken);
  });

  it('retries once with a new token when the server says the old one is no longer valid', async () => {
    let first = true;
    const api = fakeApi({
      'POST /v1/auth/login': () => [200, session()],
      'POST /v1/auth/refresh': () => [200, session()],
      'GET /v1/admin/users': () => {
        if (first) {
          first = false;
          return [401, { error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Expired.' } }];
        }
        return [200, { items: [] }];
      },
    });
    const client = new ApiClient(api.fn, new MemoryStorage());
    await client.login('a@b.co', 'pw');
    expect(await client.get('/v1/admin/users')).toEqual({ items: [] });
  });

  it('ends the session when the refresh token is refused', async () => {
    const storage = new MemoryStorage();
    storage.setItem('sdx.admin.refresh', 'refresh-revoked-xxxxxxxxxxxx');
    const api = fakeApi({ 'POST /v1/auth/refresh': () => [401, { error: { code: 'AUTH_SESSION_REVOKED', message: 'Please sign in again.' } }] });
    const client = new ApiClient(api.fn, storage);
    let signedOut = false;
    client.onSignedOut = () => (signedOut = true);
    await expect(client.get('/v1/admin/me')).rejects.toMatchObject({ status: 401 });
    expect(signedOut).toBe(true);
    expect(client.hasSession).toBe(false);
  });

  it('passes on the server error envelope', async () => {
    const api = fakeApi({
      'POST /v1/auth/login': () => [200, session()],
      'POST /v1/admin/users/2/status': () => [400, {
        error: { code: 'VALIDATION_FAILED', message: 'Some fields are invalid.', fieldErrors: [{ field: 'reason', message: 'Required' }], requestId: 'req-1' },
      }],
    });
    const client = new ApiClient(api.fn, new MemoryStorage());
    await client.login('a@b.co', 'pw');
    const e = await client.post('/v1/admin/users/2/status', { status: 'banned' }).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 400, code: 'VALIDATION_FAILED', requestId: 'req-1', fieldErrors: [{ field: 'reason' }] });
  });

  it('logs out on the server and forgets the tokens', async () => {
    const api = fakeApi({ 'POST /v1/auth/login': () => [200, session()], 'POST /v1/auth/logout': () => [200, {}] });
    const storage = new MemoryStorage();
    const client = new ApiClient(api.fn, storage);
    await client.login('a@b.co', 'pw');
    await client.logout();
    expect(api.calls.at(-1)!.path).toBe('/v1/auth/logout');
    expect(storage.map.size).toBe(0);
    expect(client.hasSession).toBe(false);
  });
});

describe('helpers', () => {
  it('builds query strings without empty values', () => {
    expect(toQuery({ a: 'x y', b: '', c: null, d: 0, e: false })).toBe('?a=x+y&d=0&e=false');
    expect(toQuery({})).toBe('');
  });

  it('loads photos from the console origin and refuses other URLs', () => {
    expect(sameOrigin('https://api.example.com/v1/media/captures/1.jpg?exp=1&sig=abc')).toBe('/v1/media/captures/1.jpg?exp=1&sig=abc');
    expect(sameOrigin('https://evil.example/x.jpg')).toBeNull();
    expect(sameOrigin('javascript:alert(1)')).toBeNull();
    expect(sameOrigin(null)).toBeNull();
  });
});

describe('labels', async () => {
  const { humanize } = await import('../lib/format');
  it('reads codes as words', () => {
    expect(humanize('provider_http_503')).toBe('AI overloaded');
    expect(humanize('provider_http_500')).toBe('AI error 500');
    expect(humanize('ADMIN_ADJUSTMENT')).toBe('Admin adjustment');
    expect(humanize('review_required')).toBe('Needs review');
    expect(humanize(null)).toBe('—');
  });
});

describe('photo URLs', () => {
  it('keeps signed media on the console origin and allows the website for catalogue photos', async () => {
    const { sameOrigin } = await import('./client');
    expect(sameOrigin('https://api.example.com/v1/media/a.jpg?exp=1&sig=x')).toBe('/v1/media/a.jpg?exp=1&sig=x');
    expect(sameOrigin('https://speeddexgame.com/catalog/variants/12-front.jpg')).toBe('https://speeddexgame.com/catalog/variants/12-front.jpg');
    expect(sameOrigin('http://speeddexgame.com/catalog/variants/12-front.jpg')).toBeNull();
    expect(sameOrigin('https://evil.example/x.jpg')).toBeNull();
  });
});
