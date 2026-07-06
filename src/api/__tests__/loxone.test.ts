import { LoxoneAPI } from '../loxone';

// Mock fetch globally
global.fetch = jest.fn();

describe('LoxoneAPI', () => {
  const mockConfig = {
    cloudAddress: '504F94A1874F',
    username: 'testuser',
    password: 'testpass',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConnection', () => {
    it('should use local connection when localIP is reachable', async () => {
      const mockDNSResponse = {
        Code: 200,
        ip: '84.1.2.3',
        port: 443,
        portOpen: true,
        httpsStatus: 200,
        snr: '504F94A1874F',
        version: '12.0.0.0',
        localIP: '192.168.1.47',
        localPort: 80,
      };

      // Mock DNS query
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDNSResponse,
      });

      // Mock local connection test (success)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      const api = new LoxoneAPI(mockConfig);
      const connection = await api.getConnection();

      expect(connection.type).toBe('local');
      expect(connection.baseURL).toBe('http://192.168.1.47:80');
    });

    it('should fallback to cloud when local IP is not reachable', async () => {
      const mockDNSResponse = {
        Code: 200,
        ip: '84.1.2.3',
        port: 443,
        portOpen: true,
        httpsStatus: 200,
        snr: '504F94A1874F',
        version: '12.0.0.0',
        localIP: '192.168.1.47',
        localPort: 80,
      };

      // Mock DNS query
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDNSResponse,
      });

      // Mock local connection test (timeout/fail)
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Timeout'));

      const api = new LoxoneAPI(mockConfig);
      const connection = await api.getConnection();

      expect(connection.type).toBe('cloud');
      expect(connection.baseURL).toBe('https://connect.loxonecloud.com/504F94A1874F');
    });

    it('should use cloud when no localIP in DNS response', async () => {
      const mockDNSResponse = {
        Code: 200,
        ip: '84.1.2.3',
        port: 443,
        portOpen: true,
        httpsStatus: 200,
        snr: '504F94A1874F',
        version: '12.0.0.0',
        // No localIP
      };

      // Mock DNS query
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDNSResponse,
      });

      const api = new LoxoneAPI(mockConfig);
      const connection = await api.getConnection();

      expect(connection.type).toBe('cloud');
      expect(connection.baseURL).toBe('https://connect.loxonecloud.com/504F94A1874F');
    });
  });

  describe('getTemperature', () => {
    it('should parse temperature value correctly', async () => {
      const mockDNSResponse = {
        Code: 200,
        ip: '84.1.2.3',
        port: 443,
        portOpen: true,
        httpsStatus: 200,
        snr: '504F94A1874F',
        version: '12.0.0.0',
      };

      const mockValueResponse = {
        LL: {
          control: '15beed5b-01ab-d81d-ffff2b06d5b9c660',
          value: '22.5',
          Code: '200',
        },
      };

      // Mock DNS query
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDNSResponse,
      });

      // Mock temperature value request
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockValueResponse,
      });

      const api = new LoxoneAPI(mockConfig);
      const temperature = await api.getTemperature('15beed5b-01ab-d81d-ffff2b06d5b9c660');

      expect(temperature).toBe(22.5);
    });

    it('should throw error for invalid temperature value', async () => {
      const mockDNSResponse = {
        Code: 200,
        ip: '84.1.2.3',
        port: 443,
        portOpen: true,
        httpsStatus: 200,
        snr: '504F94A1874F',
        version: '12.0.0.0',
      };

      const mockValueResponse = {
        LL: {
          control: '15beed5b-01ab-d81d-ffff2b06d5b9c660',
          value: 'invalid',
          Code: '200',
        },
      };

      // Mock DNS query
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDNSResponse,
      });

      // Mock temperature value request
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockValueResponse,
      });

      const api = new LoxoneAPI(mockConfig);

      await expect(api.getTemperature('15beed5b-01ab-d81d-ffff2b06d5b9c660')).rejects.toThrow(
        'Invalid temperature value'
      );
    });
  });

  describe('getStructureFile', () => {
    it('should fetch and return structure file', async () => {
      const mockDNSResponse = {
        Code: 200,
        ip: '84.1.2.3',
        port: 443,
        portOpen: true,
        httpsStatus: 200,
        snr: '504F94A1874F',
        version: '12.0.0.0',
      };

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

      // Mock DNS query
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDNSResponse,
      });

      // Mock Structure File request
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStructureFile,
      });

      const api = new LoxoneAPI(mockConfig);
      const structureFile = await api.getStructureFile();

      expect(structureFile.msInfo.serialNr).toBe('504F94A1874F');
      expect(structureFile.controls).toHaveProperty('15beed5b-01ab-d81d-ffff2b06d5b9c660');
    });
  });
});
