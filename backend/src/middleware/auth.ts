import { createHash, timingSafeEqual } from 'node:crypto';
import type { Context, Next } from 'hono';

// Hash first so both buffers have the same length for timingSafeEqual.
function safeEqual(a: string, b: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/**
 * Pre-shared secret between app/widget and API: every /api request must
 * carry `Authorization: Bearer <API_TOKEN>`. Without a configured token the
 * API stays closed.
 */
export async function requireApiToken(c: Context, next: Next) {
  // Admin endpoints carry their own bearer token (ADMIN_TOKEN).
  if (c.req.path.startsWith('/api/admin/')) {
    return next();
  }

  const apiToken = process.env.API_TOKEN;
  if (!apiToken) {
    console.warn('⚠️  API_TOKEN not configured - API endpoints disabled');
    return c.json({ error: 'API_DISABLED', message: 'API_TOKEN is not configured' }, 503);
  }

  const authHeader = c.req.header('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
  if (!safeEqual(token, apiToken)) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Missing or invalid API token' }, 401);
  }

  await next();
}

export async function requireAdminToken(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    console.warn('⚠️  ADMIN_TOKEN not configured - admin endpoints disabled');
    return c.json({ error: 'ADMIN_DISABLED', message: 'Admin endpoints are disabled' }, 503);
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.substring(7);

  if (token !== adminToken) {
    return c.json({ error: 'FORBIDDEN', message: 'Invalid admin token' }, 403);
  }

  await next();
}
