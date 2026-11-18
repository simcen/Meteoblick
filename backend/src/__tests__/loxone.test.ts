/**
 * Unit tests for the Loxone proxy's base URL check: the proxy is
 * unauthenticated and must only reach hosts in the backend's own LAN.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { isAllowedBaseURL, loxoneRouter } from '../loxone.js';

describe('isAllowedBaseURL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows private IPv4 addresses over http and https, with optional port', async () => {
    expect(await isAllowedBaseURL('http://192.168.1.47')).toBe(true);
    expect(await isAllowedBaseURL('https://10.0.0.5')).toBe(true);
    expect(await isAllowedBaseURL('http://172.16.3.5:8080')).toBe(true);
  });

  it('rejects public, loopback and link-local addresses', async () => {
    expect(await isAllowedBaseURL('http://8.8.8.8')).toBe(false);
    expect(await isAllowedBaseURL('http://172.32.0.1')).toBe(false);
    expect(await isAllowedBaseURL('http://127.0.0.1')).toBe(false);
    expect(await isAllowedBaseURL('http://169.254.169.254')).toBe(false);
    expect(await isAllowedBaseURL('http://[::1]')).toBe(false);
  });

  it('rejects host names that do not resolve to a private address', async () => {
    expect(await isAllowedBaseURL('http://localhost')).toBe(false);
    expect(await isAllowedBaseURL('http://does-not-exist.invalid')).toBe(false);
  });

  it('rejects anything that is not a bare http(s) origin', async () => {
    expect(await isAllowedBaseURL('ftp://192.168.1.47')).toBe(false);
    expect(await isAllowedBaseURL('http://192.168.1.47/jdev')).toBe(false);
    expect(await isAllowedBaseURL('http://user:pw@192.168.1.47')).toBe(false);
    expect(await isAllowedBaseURL('http://192.168.1.47?x=1')).toBe(false);
    expect(await isAllowedBaseURL('192.168.1.47')).toBe(false);
  });

  it('normalizes alternative IPv4 notations before checking', async () => {
    // 0x7f.1 is 127.0.0.1 — must not slip through as a "name".
    expect(await isAllowedBaseURL('http://0x7f.1')).toBe(false);
    expect(await isAllowedBaseURL('http://3232235823')).toBe(true); // 192.168.1.47
  });

  it('only allows the hosts listed in LOXONE_ALLOWED_HOSTS when set', async () => {
    vi.stubEnv('LOXONE_ALLOWED_HOSTS', '192.168.1.47, Miniserver.lan:8443');

    expect(await isAllowedBaseURL('http://192.168.1.47')).toBe(true);
    expect(await isAllowedBaseURL('http://192.168.1.48')).toBe(false);
    expect(await isAllowedBaseURL('http://192.168.1.47:8080')).toBe(false);
    // Listed, but still has to be a private address
    vi.stubEnv('LOXONE_ALLOWED_HOSTS', '8.8.8.8');
    expect(await isAllowedBaseURL('http://8.8.8.8')).toBe(false);
  });
});

describe('loxone proxy redirects', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const request = () =>
    loxoneRouter.request('/api/loxone/jdev/sps/io/abc', {
      headers: { 'X-Loxone-BaseURL': 'http://192.168.1.47', 'X-Loxone-Auth': 'Basic xxx' },
    });

  it('follows a redirect within the local network with the credentials', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: 'https://192.168.1.47/jdev/sps/io/abc' } }))
      .mockResolvedValueOnce(new Response('{"LL":{"value":"21.5"}}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await request();

    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[1][0]).toBe('https://192.168.1.47/jdev/sps/io/abc');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Basic xxx');
  });

  it('refuses a redirect that leaves the local network', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://example.com/steal' } }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await request();

    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toBe('invalid_redirect');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
