import type { Context, Next } from 'hono';

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
