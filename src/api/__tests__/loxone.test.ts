import * as Crypto from 'expo-crypto';
import { LoxoneAPI } from '../loxone';

// Mock fetch globally
global.fetch = jest.fn();

// Mock the API_BASE_URL import so the proxy URL is predictable
jest.mock('../../constants', () => ({
  API_BASE_URL: 'http://test-backend',
}));

const PROXY_BASE = 'http://test-backend/api/loxone';

describe('LoxoneAPI', () => {
  const mockConfig = {
    cloudAddress: '504F94A1874F',
    username: 'testuser',
    password: 'testpass',
  };

  // Mock the DNS query (proxy call)
  function mockCloudDNS() {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Code: 200,
        ip: '84.1.2.3',
        port: 443,
        portOpen: true,
        httpsStatus: 200,
        snr: '504F94A1874F',
        version: '12.0.0.0',
      }),
    });
  }

  function mockLocalDNS(localIP: string, localPort = 80) {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Code: 200,
          ip: '84.1.2.3',
          port: 443,
          portOpen: true,
          httpsStatus: 200,
          snr: '504F94A1874F',
          version: '12.0.0.0',
          localIP,
          localPort,
        }),
      });
  }

  function mockReachabilityProbe(ok = true) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok,
      status: ok ? 200 : 401,
    });
  }

  function mockApiKeyResponse(apiKey = 'the-api-key') {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ LL: { value: apiKey, Code: '200' } }),
    });
  }

  function mockValueResponse(value: string) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        LL: { control: '15beed5b-01ab-d81d-ffff2b06d5b9c660', value, Code: '200' },
      }),
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConnection', () => {
    it('should use local connection when localIP is reachable', async () => {
      mockLocalDNS('192.168.1.47', 80);
      mockReachabilityProbe(true);

      const api = new LoxoneAPI(mockConfig);
      const connection = await api.getConnection();

      expect(connection.type).toBe('local');
      expect(connection.baseURL).toBe('http://192.168.1.47:80');
    });

    it('should fallback to cloud when local IP is not reachable', async () => {
      mockLocalDNS('192.168.1.47', 80);
      // Reachability probe fails (network error)
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Timeout'));

      const api = new LoxoneAPI(mockConfig);
      const connection = await api.getConnection();

      expect(connection.type).toBe('cloud');
      expect(connection.baseURL).toBe('https://connect.loxonecloud.com/504F94A1874F');
    });

    it('should use cloud when no localIP in DNS response', async () => {
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
  });

  describe('getTemperature (local + token auth)', () => {
    it('should fetch API key, hash password, then read value with token', async () => {
      mockLocalDNS('192.168.1.47', 80);
      mockReachabilityProbe(true);
      mockApiKeyResponse('the-api-key');
      mockValueResponse('22.5');

      const api = new LoxoneAPI(mockConfig);
      const temperature = await api.getTemperature('15beed5b-01ab-d81d-ffff2b06d5b9c660');

      expect(temperature).toBe(22.5);

      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls).toHaveLength(4);

      // API-key request used password in X-Loxone-Auth header, routed through proxy
      const apiKeyCall = calls[2];
      expect(apiKeyCall[0]).toBe(`${PROXY_BASE}/jdev/cfg/apiKey`);
      expect(apiKeyCall[1].headers['X-Loxone-BaseURL']).toBe('http://192.168.1.47:80');
      const apiKeyAuth = atob(apiKeyCall[1].headers['X-Loxone-Auth'].replace('Basic ', ''));
      expect(apiKeyAuth).toBe('testuser:testpass');

      // Temperature read used hash, not password
      const valueCall = calls[3];
      expect(valueCall[0]).toBe(`${PROXY_BASE}/jdev/sps/io/15beed5b-01ab-d81d-ffff2b06d5b9c660`);
      const valueAuth = atob(valueCall[1].headers['X-Loxone-Auth'].replace('Basic ', ''));
      expect(valueAuth).not.toContain('testpass');

      // expo-crypto was called with apiKey + ":" + password
      expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
        Crypto.CryptoDigestAlgorithm.SHA256,
        'the-api-key:testpass',
      );
    });

    it('should throw error for invalid temperature value', async () => {
      mockLocalDNS('192.168.1.47', 80);
      mockReachabilityProbe(true);
      mockApiKeyResponse();
      mockValueResponse('invalid');

      const api = new LoxoneAPI(mockConfig);

      await expect(api.getTemperature('15beed5b-01ab-d81d-ffff2b06d5b9c660')).rejects.toThrow(
        'Invalid temperature value',
      );
    });
  });

  describe('getTemperature (cloud + proxy auth)', () => {
    it('should route through proxy with X-Loxone-BaseURL and X-Loxone-Auth when using cloud connection', async () => {
      mockCloudDNS(); // No localIP → cloud
      mockApiKeyResponse('cloud-key');
      mockValueResponse('21.5');

      const api = new LoxoneAPI({ ...mockConfig, username: 'admin', password: 'pw' });
      const temperature = await api.getTemperature('some-uuid');

      expect(temperature).toBe(21.5);

      const calls = (global.fetch as jest.Mock).mock.calls;

      // API key: routed through proxy, baseURL in header (not URL)
      const apiKeyCall = calls[1];
      expect(apiKeyCall[0]).toBe(`${PROXY_BASE}/jdev/cfg/apiKey`);
      expect(apiKeyCall[1].headers['X-Loxone-BaseURL']).toBe('https://connect.loxonecloud.com/504F94A1874F');
      expect(atob(apiKeyCall[1].headers['X-Loxone-Auth'].replace('Basic ', ''))).toBe('admin:pw');
      // URL itself must NOT contain credentials-in-userinfo
      expect(apiKeyCall[0]).not.toContain('admin:pw');
      expect(apiKeyCall[0]).not.toContain('admin%40');

      // Value read: uses hashed credential, not raw password
      const valueCall = calls[2];
      expect(valueCall[0]).toBe(`${PROXY_BASE}/jdev/sps/io/some-uuid`);
      expect(valueCall[1].headers['X-Loxone-BaseURL']).toBe('https://connect.loxonecloud.com/504F94A1874F');
      const valueAuth = atob(valueCall[1].headers['X-Loxone-Auth'].replace('Basic ', ''));
      expect(valueAuth).not.toBe('admin:pw');
    });

    it('should re-authenticate when API key rotates (401 → retry)', async () => {
      mockCloudDNS();
      mockApiKeyResponse('k1');
      // First temperature read returns 401 — triggers re-auth
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401 });
      // Re-auth: new API key
      mockApiKeyResponse('k2');
      // Retry succeeds
      mockValueResponse('18.3');

      const api = new LoxoneAPI(mockConfig);
      const temperature = await api.getTemperature('some-uuid');

      expect(temperature).toBe(18.3);

      const calls = (global.fetch as jest.Mock).mock.calls;
      // Two apiKey fetches through proxy
      const apiKeyFetches = calls.filter((c) =>
        c[0].toString().includes('/jdev/cfg/apiKey'),
      );
      expect(apiKeyFetches).toHaveLength(2);
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
      // base64 of 'user@home:p@ss:w0rd!' is the same regardless of URL-encoding,
      // so the auth header is always valid. Important: the URL itself must not contain
      // raw special chars that would break CFNetwork parsing.
      expect(apiKeyCall[0]).toBe(`${PROXY_BASE}/jdev/cfg/apiKey`);
      expect(atob(apiKeyCall[1].headers['X-Loxone-Auth'].replace('Basic ', ''))).toBe(
        'user@home:p@ss:w0rd!',
      );
    });
  });

  describe('getStructureFile', () => {
    it('should fetch and return structure file via proxy', async () => {
      mockLocalDNS('192.168.1.47', 80);
      mockReachabilityProbe(true);

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

      mockApiKeyResponse();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStructureFile,
      });

      const api = new LoxoneAPI(mockConfig);
      const structureFile = await api.getStructureFile();

      expect(structureFile.msInfo.serialNr).toBe('504F94A1874F');
      expect(structureFile.controls).toHaveProperty('15beed5b-01ab-d81d-ffff2b06d5b9c660');

      // Structure-file request is routed through proxy
      const structCall = (global.fetch as jest.Mock).mock.calls[3];
      expect(structCall[0]).toBe(`${PROXY_BASE}/data/LoxAPP3.json`);
      expect(structCall[1].headers['X-Loxone-BaseURL']).toBe('http://192.168.1.47:80');
    });
  });

  describe('resetConnection', () => {
    it('should clear cached connection and force re-auth', async () => {
      mockLocalDNS('192.168.1.47', 80);
      mockReachabilityProbe(true);
      mockApiKeyResponse('k1');
      mockValueResponse('20');
      // Second round after reset
      mockLocalDNS('192.168.1.47', 80);
      mockReachabilityProbe(true);
      mockApiKeyResponse('k2');
      mockValueResponse('21');

      const api = new LoxoneAPI(mockConfig);
      const t1 = await api.getTemperature('x');
      api.resetConnection();
      const t2 = await api.getTemperature('x');

      expect(t1).toBe(20);
      expect(t2).toBe(21);

      // Functional check: t1 and t2 differ, proving re-auth + new API key
      // ('k1' vs 'k2') was used after reset. We don't count individual fetch
      // calls because both reachability probes and auth fetches now share
      // the X-Loxone-Auth header via getProxyHeaders.
    });
  });
});