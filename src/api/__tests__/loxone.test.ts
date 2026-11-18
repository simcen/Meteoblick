import * as Crypto from 'expo-crypto';
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

  function mockApiKeyResponse(apiKey = 'the-api-key') {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      fakeResponse({ LL: { value: apiKey, Code: '200' } }),
    );
  }

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
    it('should reach the Miniserver through the proxy', async () => {
      mockApiKeyResponse();

      const api = new LoxoneAPI(mockConfig);
      const connection = await api.testConnection();

      expect(connection.baseURL).toBe('http://192.168.1.47');
      const call = (global.fetch as jest.Mock).mock.calls[0];
      expect(call[0]).toBe(`${PROXY_BASE}/jdev/cfg/apiKey`);
      expect(call[1].headers['X-Loxone-BaseURL']).toBe('http://192.168.1.47');
    });

    it('should fail when the Miniserver is not reachable', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(fakeResponse('', false, 502));

      const api = new LoxoneAPI(mockConfig);
      await expect(api.testConnection()).rejects.toThrow('Failed to fetch API key: 502');
    });
  });

  describe('getTemperature', () => {
    it('should fetch API key, then read value with password', async () => {
      mockApiKeyResponse('the-api-key');
      mockValueResponse('22.5');

      const api = new LoxoneAPI(mockConfig);
      const temperature = await api.getTemperature('15beed5b-01ab-d81d-ffff2b06d5b9c660');

      expect(temperature).toBe(22.5);

      const calls = (global.fetch as jest.Mock).mock.calls;
      // apiKey + temperature read = 2 calls
      expect(calls).toHaveLength(2);

      // API-key request used password in X-Loxone-Auth header, routed through proxy
      const apiKeyCall = calls[0];
      expect(apiKeyCall[0]).toBe(`${PROXY_BASE}/jdev/cfg/apiKey`);
      expect(apiKeyCall[1].headers['X-Loxone-BaseURL']).toBe('http://192.168.1.47');
      const apiKeyAuth = atob(apiKeyCall[1].headers['X-Loxone-Auth'].replace('Basic ', ''));
      expect(apiKeyAuth).toBe('testuser:testpass');

      // Temperature read uses password too (Miniserver accepts raw password for
      // /jdev/sps/io/{uuid} but not the SHA-256 hash — verified empirically).
      const valueCall = calls[1];
      expect(valueCall[0]).toBe(`${PROXY_BASE}/jdev/sps/io/15beed5b-01ab-d81d-ffff2b06d5b9c660`);
      expect(valueCall[1].headers['X-Loxone-BaseURL']).toBe('http://192.168.1.47');
      const valueAuth = atob(valueCall[1].headers['X-Loxone-Auth'].replace('Basic ', ''));
      expect(valueAuth).toBe('testuser:testpass');
    });

    it('should throw error for invalid temperature value', async () => {
      mockApiKeyResponse();
      mockValueResponse('invalid');

      const api = new LoxoneAPI(mockConfig);

      await expect(api.getTemperature('15beed5b-01ab-d81d-ffff2b06d5b9c660')).rejects.toThrow(
        'Invalid temperature value',
      );
    });

    it('should base64-encode special characters in username/password', async () => {
      mockApiKeyResponse();
      mockValueResponse('20.0');

      const api = new LoxoneAPI({
        ...mockConfig,
        username: 'user@home',
        password: 'p@ss:w0rd!',
      });
      await api.getTemperature('some-uuid');

      const apiKeyCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(apiKeyCall[0]).toBe(`${PROXY_BASE}/jdev/cfg/apiKey`);
      expect(atob(apiKeyCall[1].headers['X-Loxone-Auth'].replace('Basic ', ''))).toBe(
        'user@home:p@ss:w0rd!',
      );
    });
  });

  describe('getStructureFile', () => {
    it('should fetch and return structure file via proxy', async () => {
      mockApiKeyResponse();

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
      const structCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(structCall[0]).toBe(`${PROXY_BASE}/data/LoxAPP3.json`);
      expect(structCall[1].headers['X-Loxone-BaseURL']).toBe('http://192.168.1.47');
    });

    it('should throw a clear error on empty body (not "JSON Parse error: Unexpected end of input")', async () => {
      mockApiKeyResponse();
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        fakeResponse('', true, 200), // empty body
      );

      const api = new LoxoneAPI(mockConfig);
      await expect(api.getStructureFile()).rejects.toThrow(/leere Antwort/);
    });

    it('should throw a clear error on malformed JSON body', async () => {
      mockApiKeyResponse();
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        fakeResponse('not json at all', true, 200),
      );

      const api = new LoxoneAPI(mockConfig);
      await expect(api.getStructureFile()).rejects.toThrow(/keine gültige JSON-Antwort/);
    });
  });

  describe('resetConnection', () => {
    it('should clear cached connection and force re-auth', async () => {
      mockApiKeyResponse('k1');
      mockValueResponse('20');
      // Second round after reset
      mockApiKeyResponse('k2');
      mockValueResponse('21');

      const api = new LoxoneAPI(mockConfig);
      const t1 = await api.getTemperature('x');
      api.resetConnection();
      const t2 = await api.getTemperature('x');

      expect(t1).toBe(20);
      expect(t2).toBe(21);

      // Functional check: t1 and t2 differ, proving re-auth + new API key
      // ('k1' vs 'k2') was used after reset.
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
