import { API_BASE_URL, API_TOKEN } from '../constants';

/**
 * fetch against the Meteoblick API. Every /api request carries the
 * pre-shared token the backend checks.
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${API_TOKEN}` },
  });
}
