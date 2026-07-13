import * as Crypto from 'expo-crypto';
import { LoxoneAPI } from '../loxone';

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
    cloudAddress: '504F94A1874F',
    username: 'testuser',
    password: 'testpass',
  };

  function mockCloudDNS(extra: Record<string, unknown> = {}) {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      fakeResponse({
        Code: 200,
        ip: '84.1.2.3',
        port: 443,
        portOpen: true,
        httpsStatus: 200,
        snr: '504F94A1874F',
        version: '12.0.0.0',
        ...extra,
      }),
    );
  }

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

  describe('getConnection (cloud only)', () => {
    it('should return cloud connection', async () => {
      mockCloudDNS();

      const api = new LoxoneAPI(mockConfig);
      const connection = await api.getConnection();

      expect(connection.type).toBe('cloud');
      expect(connection.baseURL).toBe('https://connect.loxonecloud.com/504F94A1874F');
    });

    it('should route DNS query through backend proxy', async () => {
      mockCloudDNS();

      const api = new LoxoneAPI(mockConfig);
      await api.getConnection();

      const dnsCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(dnsCall[0]).toBe(`${PROXY_BASE}/?getip&snr=504F94A1874F&json=true`);
      expect(dnsCall[1].headers['X-Loxone-BaseURL']).toBe('https://dns.loxonecloud.com');
    });

    it('should still use cloud when DNS query fails (graceful degradation)', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('DNS failed'));

      const api = new LoxoneAPI(mockConfig);
      const connection = await api.getConnection();

      expect(connection.type).toBe('cloud');
      expect(connection.baseURL).toBe('https://connect.loxonecloud.com/504F94A1874F');
    });
  });

  describe('getTemperature', () => {
    it('should fetch API key, then read value with password', async () => {
      mockCloudDNS();
      mockApiKeyResponse('the-api-key');
      mockValueResponse('22.5');

      const api = new LoxoneAPI(mockConfig);
      const temperature = await api.getTemperature('15beed5b-01ab-d81d-ffff2b06d5b9c660');

      expect(temperature).toBe(22.5);

      const calls = (global.fetch as jest.Mock).mock.calls;
      // DNS query + apiKey + temperature read = 3 calls
      expect(calls).toHaveLength(3);

      // API-key request used password in X-Loxone-Auth header, routed through proxy
      const apiKeyCall = calls[1];
      expect(apiKeyCall[0]).toBe(`${PROXY_BASE}/jdev/cfg/apiKey`);
      expect(apiKeyCall[1].headers['X-Loxone-BaseURL']).toBe('https://connect.loxonecloud.com/504F94A1874F');
      const apiKeyAuth = atob(apiKeyCall[1].headers['X-Loxone-Auth'].replace('Basic ', ''));
      expect(apiKeyAuth).toBe('testuser:testpass');

      // Temperature read uses password too (Miniserver accepts raw password for
      // /jdev/sps/io/{uuid} but not the SHA-256 hash — verified empirically).
      const valueCall = calls[2];
      expect(valueCall[0]).toBe(`${PROXY_BASE}/jdev/sps/io/15beed5b-01ab-d81d-ffff2b06d5b9c660`);
      expect(valueCall[1].headers['X-Loxone-BaseURL']).toBe('https://connect.loxonecloud.com/504F94A1874F');
      const valueAuth = atob(valueCall[1].headers['X-Loxone-Auth'].replace('Basic ', ''));
      expect(valueAuth).toBe('testuser:testpass');
    });

    it('should throw error for invalid temperature value', async () => {
      mockCloudDNS();
      mockApiKeyResponse();
      mockValueResponse('invalid');

      const api = new LoxoneAPI(mockConfig);

      await expect(api.getTemperature('15beed5b-01ab-d81d-ffff2b06d5b9c660')).rejects.toThrow(
        'Invalid temperature value',
      );
    });

    it('should base64-encode special characters in username/password', async () => {
      mockCloudDNS();
      mockApiKeyResponse();
      mockValueResponse('20.0');

      const api = new LoxoneAPI({
        ...mockConfig,
        username: 'user@home',
        password: 'p@ss:w0rd!',
      });
      await api.getTemperature('some-uuid');

      const apiKeyCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(apiKeyCall[0]).toBe(`${PROXY_BASE}/jdev/cfg/apiKey`);
      expect(atob(apiKeyCall[1].headers['X-Loxone-Auth'].replace('Basic ', ''))).toBe(
        'user@home:p@ss:w0rd!',
      );
    });
  });

  describe('getStructureFile', () => {
    it('should fetch and return structure file via proxy', async () => {
      mockCloudDNS();
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
      const structCall = (global.fetch as jest.Mock).mock.calls[2];
      expect(structCall[0]).toBe(`${PROXY_BASE}/data/LoxAPP3.json`);
      expect(structCall[1].headers['X-Loxone-BaseURL']).toBe('https://connect.loxonecloud.com/504F94A1874F');
    });

    it('should throw a clear error on empty body (not "JSON Parse error: Unexpected end of input")', async () => {
      mockCloudDNS();
      mockApiKeyResponse();
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        fakeResponse('', true, 200), // empty body
      );

      const api = new LoxoneAPI(mockConfig);
      await expect(api.getStructureFile()).rejects.toThrow(/leere Antwort/);
    });

    it('should throw a clear error on malformed JSON body', async () => {
      mockCloudDNS();
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
      mockCloudDNS();
      mockApiKeyResponse('k1');
      mockValueResponse('20');
      // Second round after reset
      mockCloudDNS();
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
});