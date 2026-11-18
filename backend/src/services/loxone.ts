/**
 * Loxone Miniserver client
 *
 * The Miniserver address and credentials live in the backend's environment
 * only (LOXONE_BASE_URL, LOXONE_USERNAME, LOXONE_PASSWORD) — the backend runs
 * in the same network as the Miniserver. Clients never see or send them.
 */
import { Agent, setGlobalDispatcher, type buildConnector } from 'undici';

const TEMPERATURE_TIMEOUT_MS = 15000;
const STRUCTURE_FILE_TIMEOUT_MS = 90000; // structure files can be 5-20MB
const MAX_REDIRECTS = 5;
// Sensor UUIDs come from clients and end up in the request path.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{16}$/i;

// Bypass system PAC proxy for Loxone Miniserver requests — the macOS PAC
// resolver is unable to reach hosts on the local LAN (e.g. 172.16.3.5) and
// fails every fetch with "fetch failed". Browsers get through because they
// fall back to direct connection more aggressively. Use a no-proxy dispatcher.
setGlobalDispatcher(
  new Agent({
    connect: { family: 4 } as buildConnector.BuildOptions, // IPv4 only — avoids IPv6/IPv4 fallback races
  }),
);

export interface TemperatureSensor {
  uuid: string;
  name: string;
  room: string;
  category: string;
  type: string;
}

interface StructureFile {
  controls: {
    [uuid: string]: {
      name: string;
      type: string;
      room?: string;
      cat?: string;
      states?: { temperature?: string };
    };
  };
  rooms: { [uuid: string]: { name: string } };
  cats: { [uuid: string]: { name: string } };
}

export class LoxoneNotConfiguredError extends Error {
  constructor() {
    super('LOXONE_BASE_URL, LOXONE_USERNAME and LOXONE_PASSWORD must be set');
    this.name = 'LoxoneNotConfiguredError';
  }
}

export function isLoxoneUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function getConfig(): { baseURL: string; auth: string } {
  const { LOXONE_BASE_URL, LOXONE_USERNAME, LOXONE_PASSWORD } = process.env;
  if (!LOXONE_BASE_URL || !LOXONE_USERNAME || !LOXONE_PASSWORD) {
    throw new LoxoneNotConfiguredError();
  }
  return {
    baseURL: LOXONE_BASE_URL.replace(/\/$/, ''),
    auth: `Basic ${Buffer.from(`${LOXONE_USERNAME}:${LOXONE_PASSWORD}`).toString('base64')}`,
  };
}

async function loxoneGetJson<T>(path: string, timeoutMs: number): Promise<T> {
  const { baseURL, auth } = getConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let url = `${baseURL}${path}`;
    const { hostname } = new URL(url);
    let response: Response;
    let hops = 0;

    while (true) {
      response = await fetch(url, {
        headers: {
          Authorization: auth,
          // The Miniserver sends gzip-encoded bodies without advertising
          // Content-Encoding — force identity encoding to get raw bytes.
          'Accept-Encoding': 'identity',
        },
        signal: controller.signal,
        // manual: the default 'follow' policy strips the Authorization
        // header on cross-origin hops (e.g. http → https).
        redirect: 'manual',
      });
      const location = response.headers.get('location');
      if (response.status < 300 || response.status >= 400 || !location) break;

      url = new URL(location, url).toString();
      // The credentials only ever go to the configured Miniserver.
      if (new URL(url).hostname !== hostname) {
        throw new Error('Miniserver redirected to another host');
      }
      if (++hops > MAX_REDIRECTS) {
        throw new Error(`Exceeded ${MAX_REDIRECTS} redirects`);
      }
    }

    if (!response.ok) {
      throw new Error(`Miniserver responded with ${response.status}`);
    }
    return JSON.parse(await response.text()) as T;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error(`Miniserver request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Read the current value of a temperature sensor.
 */
export async function getTemperature(uuid: string): Promise<number> {
  if (!isLoxoneUuid(uuid)) {
    throw new Error(`Invalid sensor UUID: ${uuid}`);
  }
  const data = await loxoneGetJson<{ LL?: { value?: string } }>(
    `/jdev/sps/io/${uuid}`,
    TEMPERATURE_TIMEOUT_MS,
  );
  const temperature = parseFloat(data.LL?.value ?? '');
  if (isNaN(temperature)) {
    throw new Error(`Invalid temperature value: ${data.LL?.value}`);
  }
  return temperature;
}

/**
 * List all temperature sensors from the Structure File (LoxAPP3.json).
 */
export async function getTemperatureSensors(): Promise<TemperatureSensor[]> {
  const structureFile = await loxoneGetJson<StructureFile>(
    '/data/LoxAPP3.json',
    STRUCTURE_FILE_TIMEOUT_MS,
  );
  const sensors: TemperatureSensor[] = [];

  // Types that contain temperature: InfoOnlyAnalog, IRoomControllerV2, etc.
  for (const [uuid, control] of Object.entries(structureFile.controls)) {
    const isTemperatureSensor =
      control.type === 'InfoOnlyAnalog' ||
      control.type === 'IRoomControllerV2' ||
      control.type === 'IRoomController' ||
      control.states?.temperature !== undefined;

    if (isTemperatureSensor) {
      sensors.push({
        uuid,
        name: control.name,
        room: (control.room && structureFile.rooms[control.room]?.name) || 'Unknown',
        category: (control.cat && structureFile.cats[control.cat]?.name) || 'Unknown',
        type: control.type,
      });
    }
  }

  return sensors;
}
