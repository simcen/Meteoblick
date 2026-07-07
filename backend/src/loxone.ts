/**
 * Loxone Proxy Router
 *
 * The iOS app runs in an environment where CFNetwork/PAC proxy handling
 * cancels direct connections to user-defined hosts (manual local IP, Loxone
 * Cloud HTTPS). This proxy lets the app reach the Miniserver through the
 * backend, which is not subject to the simulator's PAC issue.
 *
 * App sends:
 *   - X-Loxone-BaseURL: full base URL (e.g. "http://192.168.1.47" or
 *                        "https://connect.loxonecloud.com/504F94A1874F")
 *   - X-Loxone-Auth:    full Authorization header value (e.g. "Basic dXNlcjpwYXNz")
 *   - X-Loxone-Method:  optional override (default = request method)
 *
 * Backend forwards the request as-is to (baseURL + path) and returns the
 * response (status, headers, body) unchanged.
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { Agent, setGlobalDispatcher } from 'undici';

const LOXONE_TIMEOUT_MS = 90000; // matches structure file timeout in app
const ALLOWED_BASEURL_PATTERNS = [
  /^https:\/\/connect\.loxonecloud\.com\/[A-F0-9]{12}$/i,
  /^https:\/\/dns\.loxonecloud\.com$/i,
  /^https:\/\/[a-z0-9.-]+\.dns\.loxonecloud\.com$/i,
  /^http:\/\/(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(?::\d{1,5})?$/,
];

// Bypass system PAC proxy for Loxone Miniserver requests — the macOS PAC
// resolver is unable to reach hosts on the local LAN (e.g. 172.16.3.5) and
// fails every fetch with "fetch failed". Browsers get through because they
// fall back to direct connection more aggressively. Use a no-proxy dispatcher.
setGlobalDispatcher(
  new Agent({
    connect: { family: 4 }, // IPv4 only — avoids IPv6/IPv4 fallback races
  }),
);

function isAllowedBaseURL(url: string): boolean {
  return ALLOWED_BASEURL_PATTERNS.some((re) => re.test(url));
}

async function proxyToLoxone(c: Context): Promise<Response> {
  const baseURL = c.req.header('X-Loxone-BaseURL');
  const auth = c.req.header('X-Loxone-Auth');
  const isProbe = c.req.header('X-Loxone-Probe') === '1';

  if (!baseURL) {
    return c.json({ error: 'missing_header', message: 'X-Loxone-BaseURL header is required' }, 400);
  }
  // Probe requests (DNS query, reachability checks) may omit X-Loxone-Auth so
  // they don't count as failed login attempts on the Miniserver. Authenticated
  // requests still require the header.
  if (!auth && !isProbe) {
    return c.json({ error: 'missing_header', message: 'X-Loxone-Auth header is required' }, 400);
  }
  if (!isAllowedBaseURL(baseURL)) {
    return c.json({ error: 'invalid_baseurl', message: 'X-Loxone-BaseURL is not an allowed Loxone host' }, 400);
  }

  // Path after /api/loxone/
  const path = c.req.path.replace(/^\/api\/loxone\/?/, '');
  const targetURL = `${baseURL.replace(/\/$/, '')}/${path}`;

  // Forward original query string
  const url = c.req.url;
  const queryIndex = url.indexOf('?');
  const fullTarget = queryIndex >= 0 ? `${targetURL}${url.slice(queryIndex)}` : targetURL;

  console.log(`[LoxoneProxy] ${c.req.method} ${fullTarget}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOXONE_TIMEOUT_MS);

  try {
    // Pass-through body for non-GET/HEAD requests
    const requestHeaders: Record<string, string> = {
      // The Loxone Miniserver sends gzip-encoded bodies without advertising
      // Content-Encoding, causing the Content-Length header to mismatch the
      // actual body length — this causes "JSON Parse error: Unexpected end
      // of input" on the client side. Force identity encoding to get raw bytes.
      'Accept-Encoding': 'identity',
    };
    if (auth) requestHeaders.Authorization = auth;

    const init: RequestInit = {
      method: c.req.method,
      headers: requestHeaders,
      signal: controller.signal,
      // manual: we re-send auth headers on each redirect hop, which the
      // default 'follow' policy strips for cross-origin hops (→ 401 on
      // Loxone Cloud's final redirect target).
      redirect: 'manual',
    };
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      init.body = await c.req.raw.arrayBuffer();
    }

    let currentURL = fullTarget;
    let response: Response;
    let hops = 0;
    const MAX_HOPS = 5;

    while (true) {
      response = await fetch(currentURL, init);
      // 3xx with Location → manually follow with same auth headers
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) break;
        // Resolve relative Location
        currentURL = new URL(location, currentURL).toString();
        hops++;
        if (hops > MAX_HOPS) {
          clearTimeout(timeoutId);
          return c.json({ error: 'too_many_redirects', message: `Exceeded ${MAX_HOPS} redirects` }, 502);
        }
        console.log(`[LoxoneProxy] → ${response.status} ${currentURL}`);
        continue;
      }
      break;
    }

    clearTimeout(timeoutId);

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      // Skip headers we shouldn't forward
      if (['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) return;
      responseHeaders.set(key, value);
    });
    // Prevent iOS / CFNetwork from caching Miniserver responses — they've
    // caused "JSON Parse error: Unexpected end of input" when a cached body
    // is read back truncated. Miniserver responses are user/state-specific
    // and never shareable.
    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    responseHeaders.set('Pragma', 'no-cache');

    const body = await response.arrayBuffer();
    const bodyLength = body.byteLength;

    console.log(`[LoxoneProxy] ${c.req.method} ${fullTarget} → ${response.status} (after ${hops} redirect${hops === 1 ? '' : 's'})`);
    console.log(`[LoxoneProxy]   body: ${bodyLength} bytes, content-length header: ${response.headers.get('content-length')}`);
    if (response.headers.get('content-length') && parseInt(response.headers.get('content-length')!) !== bodyLength) {
      console.warn(`[LoxoneProxy]   ⚠️  body length mismatch — header says ${response.headers.get('content-length')}, got ${bodyLength}`);
    }

    return new Response(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error(`[LoxoneProxy] Timeout after ${LOXONE_TIMEOUT_MS}ms: ${fullTarget}`);
      return c.json({ error: 'timeout', message: `Loxone request timed out after ${LOXONE_TIMEOUT_MS}ms` }, 504);
    }
    console.error(`[LoxoneProxy] Fetch failed: ${error.message}`);
    return c.json({ error: 'fetch_failed', message: error.message }, 502);
  }
}

export const loxoneRouter = new Hono();

// Catch-all for any HTTP method on /api/loxone/*
// Hono needs explicit method registration; we cover the verbs the app uses.
loxoneRouter.get('/api/loxone/*', proxyToLoxone);
loxoneRouter.post('/api/loxone/*', proxyToLoxone);
loxoneRouter.put('/api/loxone/*', proxyToLoxone);
loxoneRouter.delete('/api/loxone/*', proxyToLoxone);