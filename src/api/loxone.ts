/**
 * Loxone Miniserver API Client
 *
 * Supports:
 * - Connection to a Miniserver by network address (IP or DNS name) over
 *   http or https, routed through the backend proxy — the backend runs in
 *   the same network as the Miniserver
 * - Structure File parsing for sensor discovery
 * - Temperature sensor value reading
 *
 * Auth strategy: HTTP Basic Auth via Authorization header (forwarded by
 * the proxy).
 *
 * Reference:
 * - /Users/siba5/Development/_projects/Inside-The-Loxone-Miniserver/
 * - sample/CommunicatingWithMiniserver.pdf
 */

import { API_BASE_URL } from '../constants';

const LOXONE_PROXY_BASE = `${API_BASE_URL}/api/loxone`;

export type LoxoneProtocol = 'http' | 'https';

export interface LoxoneConfig {
  host: string;                // IP or DNS name, optional ":port", e.g. "192.168.1.47"
  protocol: LoxoneProtocol;
  username: string;
  password: string;
  temperatureSensorUUID?: string; // Selected sensor UUID
}

export interface LoxoneConnection {
  baseURL: string;
}

export function buildLoxoneBaseURL(protocol: LoxoneProtocol, host: string): string {
  return `${protocol}://${host}`;
}

/**
 * Normalize what the user typed into the address field. Accepts a bare
 * host ("192.168.1.47", "miniserver.lan:8080") or a pasted URL — in which
 * case the protocol is returned too and any path is dropped.
 * Returns null when the input is not a valid host.
 */
export function parseLoxoneAddress(
  input: string,
): { host: string; protocol?: LoxoneProtocol } | null {
  const match = input.trim().match(/^(?:(https?):\/\/)?([^/]*)/i);
  const host = match?.[2] ?? '';
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i.test(host)) return null;
  const protocol = match?.[1]?.toLowerCase() as LoxoneProtocol | undefined;
  return protocol ? { host, protocol } : { host };
}

export interface LoxoneStructureFile {
  lastModified: string;
  msInfo: {
    serialNr: string;
    msName: string;
    projectName: string;
    localUrl: string;
    remoteUrl: string;
    tempUnit: number; // 0 = Celsius, 1 = Fahrenheit
    currency: string;
    location: string;
  };
  controls: {
    [uuid: string]: {
      name: string;
      type: string;
      uuidAction: string;
      room?: string;
      cat?: string;
      details?: {
        format?: string;
      };
      states?: {
        temperature?: string;
        value?: string;
      };
    };
  };
  rooms: { [uuid: string]: { name: string } };
  cats: { [uuid: string]: { name: string } };
}

export interface LoxoneTemperatureSensor {
  uuid: string;
  name: string;
  room: string;
  category: string;
  type: string;
}

export interface LoxoneValueResponse {
  LL: {
    control: string;
    value: string;
    Code: string;
  };
}

const TEMPERATURE_TIMEOUT_MS = 15000;
const STRUCTURE_FILE_TIMEOUT_MS = 90000;

/**
 * Parse a Response as JSON, with a clear error on empty or malformed
 * bodies. The default `response.json()` throws "JSON Parse error:
 * Unexpected end of input" on an empty body — common transient case
 * (401, network blip, Cloud auth expired) that previously surfaced as a
 * raw cryptic error in the UI.
 */
async function parseJsonOrThrow<T>(response: Response, context: string): Promise<T> {
  const raw = await response.text();
  if (!raw) {
    throw new Error(
      `${context}: leere Antwort (Status ${response.status}). ` +
        'Verbindung prüfen und erneut versuchen.',
    );
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      `${context}: ungültige JSON-Antwort (Status ${response.status}).`,
    );
  }
}
const AUTH_HEADER_TIMEOUT_MS = 10000;

export class LoxoneAPI {
  private config: LoxoneConfig;
  private connection: LoxoneConnection | null = null;

  constructor(config: LoxoneConfig) {
    this.config = config;
  }

  /**
   * Get the Miniserver connection from the configured address. All requests
   * go through the backend proxy, which reaches the Miniserver locally.
   */
  async getConnection(): Promise<LoxoneConnection> {
    if (!this.config.host) {
      throw new LoxoneConnectionError('Keine Miniserver-Adresse konfiguriert.');
    }
    if (!this.connection) {
      this.connection = { baseURL: buildLoxoneBaseURL(this.config.protocol, this.config.host) };
    }
    return this.connection;
  }

  /**
   * Check that the Miniserver answers at the configured address and accepts
   * the credentials. /jdev/sps/LoxAPPversion3 is small and, unlike
   * /jdev/cfg/apiKey, only served to authenticated users.
   */
  async testConnection(): Promise<LoxoneConnection> {
    const conn = await this.getConnection();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AUTH_HEADER_TIMEOUT_MS);

    try {
      const req = this.buildRequest(conn.baseURL, '/jdev/sps/LoxAPPversion3');
      const response = await fetch(req.url, {
        headers: req.headers,
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new LoxoneAuthError('Benutzername oder Passwort falsch.');
      }
      if (!response.ok) {
        throw new LoxoneConnectionError(`Miniserver nicht erreichbar (Status ${response.status}).`);
      }
      return conn;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new LoxoneConnectionError('Zeitüberschreitung — Miniserver nicht erreichbar.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get Structure File (LoxAPP3.json)
   * Contains all controls, sensors, rooms, categories
   *
   * Note: Structure File can be VERY large (5-20MB) for complex projects
   */
  async getStructureFile(): Promise<LoxoneStructureFile> {
    const conn = await this.getConnection();

    console.log('[Loxone] Fetching Structure File from:', conn.baseURL);
    console.log('[Loxone] This may take 30-60 seconds for large projects...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('[Loxone] Structure File fetch timeout after 90s');
      controller.abort();
    }, STRUCTURE_FILE_TIMEOUT_MS);

    try {
      const startTime = Date.now();

      const req = this.buildRequest(conn.baseURL, '/data/LoxAPP3.json');
      const response = await fetch(req.url, {
        headers: req.headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch Structure File: ${response.status} ${response.statusText}`);
      }

      console.log('[Loxone] Response received, parsing JSON...');
      // Defensive parse: response.json() throws on empty body. We've seen
      // transient 401 / network blips return an empty body — surface a
      // clearer error than "JSON Parse error: Unexpected end of input".
      const rawText = await response.text();
      if (!rawText) {
        throw new Error(
          'Loxone lieferte eine leere Antwort für die Struktur-Datei. ' +
            'Mögliche Ursachen: Zugangsdaten falsch, Miniserver offline, ' +
            'oder Netzwerkproblem. Verbindung prüfen und erneut versuchen.',
        );
      }
      let data: LoxoneStructureFile;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(
          `Loxone lieferte keine gültige JSON-Antwort (Status ${response.status}). ` +
            'Verbindung + Miniserver-Status prüfen.',
        );
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Loxone] Structure File loaded successfully (${elapsed}s)`);

      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(
          'Structure File Download Timeout (90s).\n\n' +
            'Dein Loxone Projekt ist sehr groß oder die Verbindung ist zu langsam.\n\n' +
            'Versuche:\n' +
            '• Miniserver neu starten'
        );
      }

      throw error;
    }
  }

  /**
   * Get all temperature sensors from Structure File
   */
  async getTemperatureSensors(): Promise<LoxoneTemperatureSensor[]> {
    console.log('[Loxone] Getting temperature sensors...');
    const structureFile = await this.getStructureFile();
    const sensors: LoxoneTemperatureSensor[] = [];

    console.log('[Loxone] Parsing controls...');
    console.log('[Loxone] Total controls:', Object.keys(structureFile.controls).length);

    // Filter controls for temperature sensors
    // Types that contain temperature: InfoOnlyAnalog, IRoomControllerV2, etc.
    for (const [uuid, control] of Object.entries(structureFile.controls)) {
      const isTemperatureSensor =
        control.type === 'InfoOnlyAnalog' ||
        control.type === 'IRoomControllerV2' ||
        control.type === 'IRoomController' ||
        (control.states?.temperature !== undefined);

      if (isTemperatureSensor) {
        const room = control.room ? structureFile.rooms[control.room]?.name || 'Unknown' : 'Unknown';
        const category = control.cat ? structureFile.cats[control.cat]?.name || 'Unknown' : 'Unknown';

        sensors.push({
          uuid,
          name: control.name,
          room,
          category,
          type: control.type,
        });
      }
    }

    console.log(`[Loxone] Found ${sensors.length} temperature sensors`);
    return sensors;
  }

  /**
   * Get temperature value from sensor
   */
  async getTemperature(uuid: string): Promise<number> {
    const conn = await this.getConnection();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TEMPERATURE_TIMEOUT_MS);

    try {
      const req = this.buildRequest(conn.baseURL, `/jdev/sps/io/${uuid}`);
      const response = await fetch(req.url, {
        headers: req.headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to read temperature: ${response.status}`);
      }

      const data: LoxoneValueResponse = await parseJsonOrThrow<LoxoneValueResponse>(response, 'Temperatur-Read');
      const temperature = parseFloat(data.LL.value);

      if (isNaN(temperature)) {
        throw new Error(`Invalid temperature value: ${data.LL.value}`);
      }

      return temperature;
    } catch (error: any) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Fetch temperatures for multiple sensors in parallel.
   * Loxone doesn't expose a batched endpoint, so this fans out individual
   * `getTemperature` calls. Order of the result matches the input order.
   * Sensors that fail to fetch are silently dropped — caller should fall
   * back to the cached value for that sensor.
   */
  async getTemperatures(
    uuids: string[],
  ): Promise<Array<{ uuid: string; temperature: number }>> {
    if (uuids.length === 0) return [];
    const settled = await Promise.allSettled(
      uuids.map(async (uuid) => ({
        uuid,
        temperature: await this.getTemperature(uuid),
      })),
    );
    return settled
      .filter((r): r is PromiseFulfilledResult<{ uuid: string; temperature: number }> => r.status === 'fulfilled')
      .map((r) => r.value);
  }

  /**
   * Build URL + headers for an authenticated request.
   *
   * Empirically: the Miniserver accepts HTTP Basic Auth with the raw password
   * for /data/LoxAPP3.json and /jdev/sps/io/{uuid}, but rejects the
   * SHA-256(apiKey+":"+password) hash for those endpoints. So we send the
   * password directly here.
   *
   * All requests are routed through the backend proxy, which forwards them
   * to the Miniserver.
   */
  private buildRequest(baseURL: string, path: string): { url: string; headers: HeadersInit } {
    return this.buildProxyRequest(baseURL, path, this.config.password);
  }

  /**
   * Routes an authenticated request through the backend Loxone proxy.
   * Headers carry the target baseURL + Authorization; the proxy forwards as-is.
   */
  private buildProxyRequest(
    baseURL: string,
    path: string,
    credential: string,
  ): { url: string; headers: HeadersInit } {
    const auth = `Basic ${btoa(`${this.config.username}:${credential}`)}`;
    return {
      url: `${LOXONE_PROXY_BASE}${path}`,
      headers: {
        'X-Loxone-BaseURL': baseURL,
        'X-Loxone-Auth': auth,
      },
    };
  }

  /**
   * Clear cached connection
   */
  resetConnection(): void {
    this.connection = null;
  }
}

/**
 * Loxone API Error types
 */
export class LoxoneConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoxoneConnectionError';
  }
}

export class LoxoneAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoxoneAuthError';
  }
}

export class LoxoneSensorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoxoneSensorError';
  }
}
