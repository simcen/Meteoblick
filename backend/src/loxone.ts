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

const LOXONE_TIMEOUT_MS = 90000; // matches structure file timeout in app
const ALLOWED_BASEURL_PATTERNS = [
  /^https:\/\/connect\.loxonecloud\.com\/[A-F0-9]{12}$/i,
  /^https:\/\/dns\.loxonecloud\.com$/i,
  /^https:\/\/[a-z0-9.-]+\.dns\.loxonecloud\.com$/i,
  /^http:\/\/(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(?::\d{1,5})?$/,
];

function isAllowedBaseURL(url: string): boolean {
  return ALLOWED_BASEURL_PATTERNS.some((re) => re.test(url));
}

async function proxyToLoxone(c: Context): Promise<Response> {
  const baseURL = c.req.header('X-Loxone-BaseURL');
  const auth = c.req.header('X-Loxone-Auth');

  if (!baseURL) {
    return c.json({ error: 'missing_header', message: 'X-Loxone-BaseURL header is required' }, 400);
  }
  if (!auth) {
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
    const init: RequestInit = {
      method: c.req.method,
      headers: { Authorization: auth },
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

    const body = await response.arrayBuffer();

    console.log(`[LoxoneProxy] ${c.req.method} ${fullTarget} → ${response.status} (after ${hops} redirect${hops === 1 ? '' : 's'})`);
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