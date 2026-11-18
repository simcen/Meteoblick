/**
 * Loxone API Client
 *
 * The Miniserver address and credentials are configured on the backend,
 * which runs in the same network as the Miniserver. The app only asks the
 * backend for the list of temperature sensors and for their values.
 */

import { apiFetch } from './client';

export interface LoxoneTemperatureSensor {
  uuid: string;
  name: string;
  room: string;
  category: string;
  type: string;
}

const TEMPERATURE_TIMEOUT_MS = 15000;
// The backend reads the Structure File, which can be 5-20MB for complex projects
const SENSOR_LIST_TIMEOUT_MS = 90000;

async function getJson<T>(path: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await apiFetch(path, { signal: controller.signal });
    if (response.status === 503) {
      throw new Error('Loxone ist auf dem Server nicht konfiguriert.');
    }
    if (response.status === 401) {
      throw new Error('Der Server lehnt das API-Token der App ab.');
    }
    if (!response.ok) {
      throw new Error(`Loxone-Abfrage fehlgeschlagen (Status ${response.status}).`);
    }
    return (await response.json()) as T;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Zeitüberschreitung bei der Loxone-Abfrage.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export class LoxoneAPI {
  /**
   * Get all temperature sensors of the Miniserver
   */
  static async getTemperatureSensors(): Promise<LoxoneTemperatureSensor[]> {
    const data = await getJson<{ sensors: LoxoneTemperatureSensor[] }>(
      '/api/loxone/sensors',
      SENSOR_LIST_TIMEOUT_MS,
    );
    return data.sensors;
  }

  /**
   * Fetch temperatures for multiple sensors. Sensors the Miniserver could
   * not read are missing from the result — caller should fall back to the
   * cached value for that sensor.
   */
  static async getTemperatures(
    uuids: string[],
  ): Promise<Array<{ uuid: string; temperature: number }>> {
    if (uuids.length === 0) return [];
    const data = await getJson<{ readings: Array<{ uuid: string; temperature: number }> }>(
      `/api/loxone/temperatures?uuids=${encodeURIComponent(uuids.join(','))}`,
      TEMPERATURE_TIMEOUT_MS,
    );
    return data.readings.map(({ uuid, temperature }) => ({ uuid, temperature }));
  }
}
