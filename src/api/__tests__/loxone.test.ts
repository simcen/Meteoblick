import { LoxoneAPI, parseLoxoneAddress } from '../loxone';

// Mock fetch globally
global.fetch = jest.fn();

// Mock the API_BASE_URL import so the proxy URL is predictable
jest.mock('../../constants', () => ({
  API_BASE_URL: 'http://test-backend',
}));

/**
 * Build a fake fetch Response. The loxone client reads `response.text()`
 * first (defensive parse), so the mock must expose `text` returning the
 * raw response body. For object bodies, we JSON-serialize; for string
 * bodies we pass through as-is (so empty string remains empty).
 */
function fakeResponse(body: unknown, ok = true, status = 200): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => (typeof body === 'string' ? JSON.parse(body || 'null') : body),
    text: async () => text,
  } as unknown as Response;
}

const PROXY_BASE = 'http://test-backend/api/loxone';

describe('LoxoneAPI', () => {
  const mockConfig = {
    host: '192.168.1.47',
    protocol: 'http' as const,
    username: 'testuser',
    password: 'testpass',
  };

  function mockValueResponse(value: string) {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      fakeResponse({
        LL: {
          control: '15beed5b-01ab-d81d-ffff2b06d5b9c660',
          value,
          Code: '200',
        },
      }),
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConnection', () => {
    it('should build the base URL from protocol and host without any request', async () => {
      const api = new LoxoneAPI(mockConfig);
      const connection = await api.getConnection();

      expect(connection.baseURL).toBe('http://192.168.1.47');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should support https and DNS names with port', async () => {
      const api = new LoxoneAPI({ ...mockConfig, host: 'miniserver.lan:8443', protocol: 'https' });
      const connection = await api.getConnection();

      expect(connection.baseURL).toBe('https://miniserver.lan:8443');
    });

    it('should throw when no address is configured', async () => {
      const api = new LoxoneAPI({ ...mockConfig, host: '' });

      await expect(api.getConnection()).rejects.toThrow('Keine Miniserver-Adresse');
    });
  });

  describe('testConnection', () => {
    it('should check an authenticated endpoint through the proxy', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        fakeResponse({ LL: { control: 'dev/sps/LoxAPPversion3', value: '2026-01-01 12:00:00', Code: '200' } }),
      );

      const api = new LoxoneAPI(mockConfig);
      const connection = await api.testConnection();

      expect(connection.baseURL).toBe('http://192.168.1.47');
      const call = (global.fetch as jest.Mock).mock.calls[0];
      expect(call[0]).toBe(`${PROXY_BASE}/jdev/sps/LoxAPPversion3`);
      expect(call[1].headers['X-Loxone-BaseURL']).toBe('http://192.168.1.47');
      expect(atob(call[1].headers['X-Loxone-Auth'].replace('Basic ', ''))).toBe('testuser:testpass');
    });

    it('should report wrong credentials', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(fakeResponse('', false, 401));

      const api = new LoxoneAPI(mockConfig);
      await expect(api.testConnection()).rejects.toThrow('Benutzername oder Passwort falsch.');
    });

    it('should fail when the Miniserver is not reachable', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(fakeResponse('', false, 502));

      const api = new LoxoneAPI(mockConfig);
      await expect(api.testConnection()).rejects.toThrow('Miniserver nicht erreichbar (Status 502).');
    });
  });

  describe('getTemperature', () => {
    it('should read the value with the password through the proxy', async () => {
      mockValueResponse('22.5');

      const api = new LoxoneAPI(mockConfig);
      const temperature = await api.getTemperature('15beed5b-01ab-d81d-ffff2b06d5b9c660');

      expect(temperature).toBe(22.5);

      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls).toHaveLength(1);

      // Temperature read uses password too (Miniserver accepts raw password for
      // /jdev/sps/io/{uuid} but not the SHA-256 hash — verified empirically).
      const valueCall = calls[0];
      expect(valueCall[0]).toBe(`${PROXY_BASE}/jdev/sps/io/15beed5b-01ab-d81d-ffff2b06d5b9c660`);
      expect(valueCall[1].headers['X-Loxone-BaseURL']).toBe('http://192.168.1.47');
      const valueAuth = atob(valueCall[1].headers['X-Loxone-Auth'].replace('Basic ', ''));
      expect(valueAuth).toBe('testuser:testpass');
    });

    it('should throw error for invalid temperature value', async () => {
      mockValueResponse('invalid');

      const api = new LoxoneAPI(mockConfig);

      await expect(api.getTemperature('15beed5b-01ab-d81d-ffff2b06d5b9c660')).rejects.toThrow(
        'Invalid temperature value',
      );
    });

    it('should base64-encode special characters in username/password', async () => {
      mockValueResponse('20.0');

      const api = new LoxoneAPI({
        ...mockConfig,
        username: 'user@home',
        password: 'p@ss:w0rd!',
      });
      await api.getTemperature('some-uuid');

      const valueCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(atob(valueCall[1].headers['X-Loxone-Auth'].replace('Basic ', ''))).toBe(
        'user@home:p@ss:w0rd!',
      );
    });
  });

  describe('getStructureFile', () => {
    it('should fetch and return structure file via proxy', async () => {

      const mockStructureFile = {
        lastModified: '2026-01-01 12:00:00',
        msInfo: {
          serialNr: '504F94A1874F',
          msName: 'TestMiniserver',
          projectName: 'TestProject',
          localUrl: 'http://192.168.1.47',
          remoteUrl: 'https://connect.loxonecloud.com/504F94A1874F',
          tempUnit: 0,
          currency: 'CHF',
          location: 'Bern',
        },
        controls: {
          '15beed5b-01ab-d81d-ffff2b06d5b9c660': {
            name: 'Außentemperatur',
            type: 'InfoOnlyAnalog',
            uuidAction: '15beed5b-01ab-d81d-ffff2b06d5b9c660',
          },
        },
        rooms: {},
        cats: {},
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        fakeResponse(mockStructureFile),
      );

      const api = new LoxoneAPI(mockConfig);
      const structureFile = await api.getStructureFile();

      expect(structureFile.msInfo.serialNr).toBe('504F94A1874F');
      expect(structureFile.controls).toHaveProperty('15beed5b-01ab-d81d-ffff2b06d5b9c660');

      // Structure-file request is routed through proxy
      const structCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(structCall[0]).toBe(`${PROXY_BASE}/data/LoxAPP3.json`);
      expect(structCall[1].headers['X-Loxone-BaseURL']).toBe('http://192.168.1.47');
    });

    it('should throw a clear error on empty body (not "JSON Parse error: Unexpected end of input")', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        fakeResponse('', true, 200), // empty body
      );

      const api = new LoxoneAPI(mockConfig);
      await expect(api.getStructureFile()).rejects.toThrow(/leere Antwort/);
    });

    it('should throw a clear error on malformed JSON body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        fakeResponse('not json at all', true, 200),
      );

      const api = new LoxoneAPI(mockConfig);
      await expect(api.getStructureFile()).rejects.toThrow(/keine gültige JSON-Antwort/);
    });
  });

  describe('resetConnection', () => {
    it('should clear the cached connection', async () => {
      const api = new LoxoneAPI(mockConfig);
      const first = await api.getConnection();
      api.resetConnection();
      const second = await api.getConnection();

      expect(second).toEqual(first);
      expect(second).not.toBe(first);
    });
  });

  describe('parseLoxoneAddress', () => {
    it('accepts IPs and DNS names, with optional port', () => {
      expect(parseLoxoneAddress('192.168.1.47')).toEqual({ host: '192.168.1.47' });
      expect(parseLoxoneAddress(' miniserver.lan:8080 ')).toEqual({ host: 'miniserver.lan:8080' });
    });

    it('takes the protocol from a pasted URL and drops the path', () => {
      expect(parseLoxoneAddress('https://miniserver.lan/')).toEqual({
        host: 'miniserver.lan',
        protocol: 'https',
      });
      expect(parseLoxoneAddress('HTTP://192.168.1.47/jdev/cfg/apiKey')).toEqual({
        host: '192.168.1.47',
        protocol: 'http',
      });
    });

    it('rejects empty and malformed input', () => {
      expect(parseLoxoneAddress('')).toBeNull();
      expect(parseLoxoneAddress('   ')).toBeNull();
      expect(parseLoxoneAddress('mini server')).toBeNull();
      expect(parseLoxoneAddress('user@host')).toBeNull();
      expect(parseLoxoneAddress('host:port')).toBeNull();
      expect(parseLoxoneAddress('ftp://host')).toBeNull();
    });
  });
});
