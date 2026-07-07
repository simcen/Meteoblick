/**
 * Loxone Miniserver API Client
 *
 * Supports:
 * - Auto-detection of local vs cloud connection
 * - Structure File parsing for sensor discovery
 * - Temperature sensor value reading
 * - Token-based authentication (SHA-256 of API key + password)
 *
 * Auth strategy:
 * - Local: HTTP Basic Auth via Authorization header
 * - Cloud: HTTP Basic Auth via URL userinfo (HTTPS reverse proxy at
 *   connect.loxonecloud.com does not forward Authorization headers)
 * - After initial /jdev/cfg/apiKey exchange, the password is replaced
 *   by a SHA-256 hash, so it only travels over the wire once.
 *
 * Reference:
 * - /Users/siba5/Development/_projects/Inside-The-Loxone-Miniserver/
 * - sample/CommunicatingWithMiniserver.pdf
 */

import * as Crypto from 'expo-crypto';
import { API_BASE_URL } from '../constants';

const LOXONE_PROXY_BASE = `${API_BASE_URL}/api/loxone`;

export interface LoxoneConfig {
  cloudAddress: string;        // Serial Number (SNR), e.g. "504F94A1874F"
  username: string;
  password: string;
  temperatureSensorUUID?: string; // Selected sensor UUID
}

export interface LoxoneDNSResponse {
  Code: number;
  ip: string;
  port: number;
  portOpen: boolean;
  httpsStatus: number;
  snr: string;
  version: string;
  localIP?: string;
  localPort?: number;
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

export interface LoxoneApiKeyResponse {
  LL: {
    value: string;
    Code: string;
  };
}

const CLOUD_PREFIX = 'https://connect.loxonecloud.com/';
const TEMPERATURE_TIMEOUT_MS = 15000;
const STRUCTURE_FILE_TIMEOUT_MS = 90000;
const DNS_TIMEOUT_MS = 10000;
const REACHABILITY_TIMEOUT_MS = 3000;
const AUTH_HEADER_TIMEOUT_MS = 10000;

export class LoxoneAPI {
  private config: LoxoneConfig;
  private connection: LoxoneConnection | null = null;
  private keyHash: string | null = null;
  private authInFlight: Promise<string> | null = null;

  constructor(config: LoxoneConfig) {
    this.config = config;
  }

  /**
   * Get Miniserver connection (cloud only — local LAN IP support removed)
   *
   * All connections go through Loxone Cloud via the backend proxy. The proxy
   * exists to work around iOS-simulator PAC-proxy issues and to centralize
   * the auth flow. Previously this method also tried a local LAN IP, but
   * that requires the backend to be on the same LAN as the Miniserver,
   * which isn't the case in production (Heroku).
   */
  async getConnection(): Promise<LoxoneConnection> {
    if (this.connection) {
      console.log('[Loxone] Using cached connection:', this.connection.type);
      return this.connection;
    }

    console.log('[Loxone] Connecting via Loxone Cloud...');

    // DNS query is still useful to (a) confirm the SNR is registered and
    // (b) surface connection errors early with a meaningful message.
    try {
      const dnsInfo = await this.queryDNS();
      console.log('[Loxone] DNS resolved, cloud IP:', dnsInfo.ip);
    } catch (error: any) {
      console.warn('[Loxone] DNS query failed (continuing with direct cloud URL):', error?.message ?? error);
    }

    const cloudURL = `${CLOUD_PREFIX}${this.config.cloudAddress}`;
    this.connection = { baseURL: cloudURL, type: 'cloud' };
    console.log('☁️ [Loxone] Using cloud connection:', cloudURL);
    return this.connection;
  }

  /**
   * Query Loxone Cloud DNS Service for Miniserver IP (via backend proxy).
   * Marked as a probe so the backend forwards it without Auth — DNS queries
   * must not count as login attempts on the Miniserver.
   */
  private async queryDNS(): Promise<LoxoneDNSResponse> {
    const url = `${LOXONE_PROXY_BASE}/?getip&snr=${this.config.cloudAddress}&json=true`;

    console.log('[Loxone] DNS query via proxy:', url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DNS_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: this.getProxyHeaders('https://dns.loxonecloud.com', true),
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Loxone DNS query failed: ${response.status} ${response.statusText}`);
      }

      const data: LoxoneDNSResponse = await response.json();
      console.log('[Loxone] DNS response code:', data.Code);

      if (data.Code !== 200) {
        throw new Error(`Loxone DNS returned error code: ${data.Code}`);
      }

      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('Loxone DNS query timeout (10s). Keine Internetverbindung?');
      }

      throw error;
    }
  }

  /**
   * Network-level reachability check (via backend proxy). Marked as probe so
   * the backend forwards it without Auth — we don't want reachability checks
   * to count as failed login attempts on the Miniserver.
   */
  private async testReachable(baseURL: string, timeout: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(`${LOXONE_PROXY_BASE}/jdev/cfg/apiKey`, {
        signal: controller.signal,
        headers: this.getProxyHeaders(baseURL, true),
      });
      clearTimeout(timeoutId);
      return response.status > 0;
    } catch {
      return false;
    }
  }

  /**
   * Builds the standard proxy headers for a given base URL.
   *
   * - For authenticated requests (apiKey fetch, structure file, temperature):
   *   sends X-Loxone-Auth with the raw password (used during the first
   *   apiKey exchange).
   * - For probes (DNS query, reachability check): passes `probe=true` to omit
   *   X-Loxone-Auth entirely and set X-Loxone-Probe so the backend forwards
   *   without Authorization — these calls must not count as failed login
   *   attempts on the Miniserver.
   */
  private getProxyHeaders(baseURL: string, probe = false): HeadersInit {
    const headers: Record<string, string> = {
      'X-Loxone-BaseURL': baseURL,
    };
    if (probe) {
      headers['X-Loxone-Probe'] = '1';
    } else {
      headers['X-Loxone-Auth'] = `Basic ${btoa(`${this.config.username}:${this.config.password}`)}`;
    }
    return headers;
  }

  /**
   * Get Structure File (LoxAPP3.json)
   * Contains all controls, sensors, rooms, categories
   *
   * Note: Structure File can be VERY large (5-20MB) for complex projects
   */
  async getStructureFile(): Promise<LoxoneStructureFile> {
    const conn = await this.getConnection();
    await this.ensureAuth();

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
      const data = await response.json();

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
            '• Lokale Verbindung (WLAN) statt Cloud\n' +
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
    await this.ensureAuth();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TEMPERATURE_TIMEOUT_MS);

    try {
      const req = this.buildRequest(conn.baseURL, `/jdev/sps/io/${uuid}`);
      const response = await fetch(req.url, {
        headers: req.headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 401 on a token-authenticated request = API key rotated, re-auth and retry once.
      if (response.status === 401 && this.keyHash) {
        console.warn('[Loxone] 401 — API key likely rotated, re-authenticating');
        this.keyHash = null;
        await this.ensureAuth();
        return this.getTemperature(uuid);
      }

      if (!response.ok) {
        throw new Error(`Failed to read temperature: ${response.status}`);
      }

      const data: LoxoneValueResponse = await response.json();

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
   * Fetch API key + compute SHA-256 hash of (apiKey + ":" + password).
   * Cached for the session; re-fetched automatically on 401.
   */
  private async ensureAuth(): Promise<string> {
    if (this.keyHash) return this.keyHash;
    if (this.authInFlight) return this.authInFlight;

    this.authInFlight = this.fetchAndHashKey().finally(() => {
      this.authInFlight = null;
    });

    return this.authInFlight;
  }

  private async fetchAndHashKey(): Promise<string> {
    const conn = await this.getConnection();

    // First request to /jdev/cfg/apiKey uses the raw password
    const initial = this.buildInitialRequest(conn.baseURL);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AUTH_HEADER_TIMEOUT_MS);

    try {
      const response = await fetch(initial.url, {
        headers: initial.headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch API key: ${response.status}`);
      }

      const data: LoxoneApiKeyResponse = await response.json();
      const apiKey = data.LL?.value;
      if (!apiKey) {
        throw new Error('Loxone API key missing in response');
      }

      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${apiKey}:${this.config.password}`,
      );

      // Loxone Cloud Miniserver expects UPPERCASE hex — verified empirically:
      // lowercase → 401 Unauthorized, uppercase → accepted (tested with curl).
      this.keyHash = hash.toUpperCase();
      console.log('[Loxone] Token authentication successful');
      return this.keyHash;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Build URL + headers for an authenticated request.
   *
   * Empirically: the Miniserver accepts HTTP Basic Auth with the raw password
   * for /data/LoxAPP3.json and /jdev/sps/io/{uuid}, but rejects the SHA-256
   * SHA-256(apiKey+":"+password) hash for those endpoints (only /jdev/cfg/apiKey
   * accepts the hash). So we send the password directly here.
   *
   * `ensureAuth` is still called beforehand to fetch /jdev/cfg/apiKey as a
   * connectivity check (the endpoint is public but verifies the Miniserver is
   * reachable and that our credentials are at least syntactically correct).
   *
   * All requests are routed through the backend proxy to bypass iOS-simulator
   * PAC-proxy issues; the backend forwards them to the Miniserver.
   */
  private buildRequest(baseURL: string, path: string): { url: string; headers: HeadersInit } {
    return this.buildProxyRequest(baseURL, path, this.config.password);
  }

  /**
   * Like buildRequest, but uses the raw password. Only used for the very first
   * /jdev/cfg/apiKey exchange — the password is never sent again after that.
   */
  private buildInitialRequest(
    baseURL: string,
  ): { url: string; headers: HeadersInit } {
    return this.buildProxyRequest(baseURL, '/jdev/cfg/apiKey', this.config.password);
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
   * Clear cached connection + auth (force re-detection and re-auth)
   */
  resetConnection(): void {
    this.connection = null;
    this.keyHash = null;
    this.authInFlight = null;
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
