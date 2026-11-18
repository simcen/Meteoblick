/**
 * Unit tests for the pre-shared API token check on /api/*.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { requireApiToken } from '../middleware/auth.js';

const app = new Hono();
app.use('/api/*', requireApiToken);
app.get('/api/weather/1', (c) => c.json({ ok: true }));
app.post('/api/admin/sync', (c) => c.json({ ok: true }));
app.get('/', (c) => c.json({ ok: true }));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('requireApiToken', () => {
  it('accepts the configured token', async () => {
    vi.stubEnv('API_TOKEN', 'secret-token');

    const res = await app.request('/api/weather/1', { headers: { Authorization: 'Bearer secret-token' } });

    expect(res.status).toBe(200);
  });

  it('rejects a missing, malformed or wrong token', async () => {
    vi.stubEnv('API_TOKEN', 'secret-token');

    expect((await app.request('/api/weather/1')).status).toBe(401);
    expect((await app.request('/api/weather/1', { headers: { Authorization: 'secret-token' } })).status).toBe(401);
    expect((await app.request('/api/weather/1', { headers: { Authorization: 'Bearer secret-toke' } })).status).toBe(401);
    expect((await app.request('/api/weather/1', { headers: { Authorization: 'Bearer ' } })).status).toBe(401);
  });

  it('keeps the API closed when no token is configured', async () => {
    vi.stubEnv('API_TOKEN', '');

    const res = await app.request('/api/weather/1', { headers: { Authorization: 'Bearer ' } });

    expect(res.status).toBe(503);
  });

  it('leaves admin endpoints (own token) and the public root alone', async () => {
    vi.stubEnv('API_TOKEN', 'secret-token');

    expect((await app.request('/api/admin/sync', { method: 'POST' })).status).toBe(200);
    expect((await app.request('/')).status).toBe(200);
  });
});
