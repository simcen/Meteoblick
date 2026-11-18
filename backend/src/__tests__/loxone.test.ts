/**
 * Unit tests for the Loxone proxy's base URL check: the proxy is
 * unauthenticated and must only reach hosts in the backend's own LAN.
 */

import { describe, it, expect } from 'vitest';
import { isAllowedBaseURL } from '../loxone.js';

describe('isAllowedBaseURL', () => {
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
});
