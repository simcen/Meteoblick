/**
 * Loxone Miniserver API Client
 *
 * Supports:
 * - Auto-detection of local vs cloud connection
 * - Structure File parsing for sensor discovery
 * - Temperature sensor value reading
 * - Basic HTTP authentication
 *
 * Reference:
 * - /Users/siba5/Development/_projects/Inside-The-Loxone-Miniserver/
 * - sample/CommunicatingWithMiniserver.pdf
 */

export interface LoxoneConfig {
  cloudAddress: string;        // Serial Number (SNR), e.g. "504F94A1874F"
  username: string;
  password: string;
  temperatureSensorUUID?: string; // Selected sensor UUID
  localIP?: string;            // Manual override for local IP
}

export interface LoxoneConnection {
  baseURL: string;
  type: 'local' | 'cloud';
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

export class LoxoneAPI {
  private config: LoxoneConfig;
  private connection: LoxoneConnection | null = null;

  constructor(config: LoxoneConfig) {
    this.config = config;
  }

  /**
   * Get Miniserver connection (auto-detect local vs cloud)
   */
  async getConnection(): Promise<LoxoneConnection> {
    if (this.connection) {
      return this.connection;
    }

    // 1. Query Loxone Cloud DNS Service
    const dnsInfo = await this.queryDNS();

    // 2. Test local connection if localIP available
    if (dnsInfo.localIP) {
      const localURL = `http://${dnsInfo.localIP}:${dnsInfo.localPort || 80}`;
      const isLocalReachable = await this.testConnection(localURL, 2000);

      if (isLocalReachable) {
        this.connection = { baseURL: localURL, type: 'local' };
        console.log('✅ Using local Loxone connection:', localURL);
        return this.connection;
      }
    }

    // 3. Fallback to cloud
    const cloudURL = `https://connect.loxonecloud.com/${this.config.cloudAddress}`;
    this.connection = { baseURL: cloudURL, type: 'cloud' };
    console.log('☁️ Using cloud Loxone connection:', cloudURL);
    return this.connection;
  }

  /**
   * Query Loxone Cloud DNS Service for Miniserver IP
   */
  private async queryDNS(): Promise<LoxoneDNSResponse> {
    const url = `https://dns.loxonecloud.com/?getip&snr=${this.config.cloudAddress}&json=true`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Loxone DNS query failed: ${response.status}`);
    }

    const data: LoxoneDNSResponse = await response.json();

    if (data.Code !== 200) {
      throw new Error(`Loxone DNS returned error code: ${data.Code}`);
    }

    return data;
  }

  /**
   * Test if a connection is reachable (with timeout)
   */
  private async testConnection(baseURL: string, timeout: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Try to reach /jdev/cfg/apiKey (lightweight endpoint)
      await fetch(`${baseURL}/jdev/cfg/apiKey`, {
        signal: controller.signal,
        headers: {
          Authorization: this.getAuthHeader(),
        },
      });

      clearTimeout(timeoutId);
      return true;
    } catch (error) {
      // Timeout or network error = not reachable
      return false;
    }
  }

  /**
   * Get Structure File (LoxAPP3.json)
   * Contains all controls, sensors, rooms, categories
   */
  async getStructureFile(): Promise<LoxoneStructureFile> {
    const conn = await this.getConnection();

    const response = await fetch(`${conn.baseURL}/data/LoxAPP3.json`, {
      headers: {
        Authorization: this.getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Structure File: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get all temperature sensors from Structure File
   */
  async getTemperatureSensors(): Promise<LoxoneTemperatureSensor[]> {
    const structureFile = await this.getStructureFile();
    const sensors: LoxoneTemperatureSensor[] = [];

    // Filter controls for temperature sensors
    // Types that contain temperature: InfoOnlyAnalog, IRoomControllerV2, etc.
    for (const [uuid, control] of Object.entries(structureFile.controls)) {
      const isTemperatureSensor =
        control.type === 'InfoOnlyAnalog' ||
        control.type === 'IRoomControllerV2' ||
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

    return sensors;
  }

  /**
   * Get temperature value from sensor
   */
  async getTemperature(uuid: string): Promise<number> {
    const conn = await this.getConnection();

    const response = await fetch(`${conn.baseURL}/jdev/sps/io/${uuid}`, {
      headers: {
        Authorization: this.getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to read temperature: ${response.status}`);
    }

    const data: LoxoneValueResponse = await response.json();

    const temperature = parseFloat(data.LL.value);

    if (isNaN(temperature)) {
      throw new Error(`Invalid temperature value: ${data.LL.value}`);
    }

    return temperature;
  }

  /**
   * Create Basic Auth header
   */
  private getAuthHeader(): string {
    const credentials = `${this.config.username}:${this.config.password}`;
    const base64 = btoa(credentials);
    return `Basic ${base64}`;
  }

  /**
   * Clear cached connection (force re-detection)
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
