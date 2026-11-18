/**
 * Unit tests for the Loxone Miniserver client and the /loxone endpoints.
 * The Miniserver is replaced by a stubbed global fetch.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { getTemperature, getTemperatureSensors, isLoxoneUuid } from '../services/loxone.js';
import { loxoneRouter } from '../loxone.js';

const UUID = '15beed5b-01ab-d81d-ffff2b06d5b9c660';
const UUID_2 = '1b4bd480-0352-6c00-ffff0fb3607cf0ae';

function stubMiniserver(...responses: Response[]) {
  const fetchMock = vi.fn();
  for (const r of responses) fetchMock.mockResolvedValueOnce(r);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const valueResponse = (value: string) =>
  new Response(JSON.stringify({ LL: { control: 'dev/sps/io', value, Code: '200' } }));

beforeEach(() => {
  vi.stubEnv('LOXONE_BASE_URL', 'http://192.168.1.47/');
  vi.stubEnv('LOXONE_USERNAME', 'user@home');
  vi.stubEnv('LOXONE_PASSWORD', 'p@ss:w0rd!');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('isLoxoneUuid', () => {
  it('accepts Loxone UUIDs and rejects anything that could alter the request path', () => {
    expect(isLoxoneUuid(UUID)).toBe(true);
    expect(isLoxoneUuid('../../jdev/sys/reboot')).toBe(false);
    expect(isLoxoneUuid(`${UUID}/../x`)).toBe(false);
    expect(isLoxoneUuid('')).toBe(false);
  });
});

describe('getTemperature', () => {
  it('reads the value from the configured Miniserver with Basic auth', async () => {
    const fetchMock = stubMiniserver(valueResponse('22.5'));

    expect(await getTemperature(UUID)).toBe(22.5);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`http://192.168.1.47/jdev/sps/io/${UUID}`);
    const auth = Buffer.from(init.headers.Authorization.replace('Basic ', ''), 'base64').toString();
    expect(auth).toBe('user@home:p@ss:w0rd!');
  });

  it('refuses UUIDs that are not Loxone UUIDs without calling the Miniserver', async () => {
    const fetchMock = stubMiniserver();

    await expect(getTemperature('../../jdev/sys/reboot')).rejects.toThrow('Invalid sensor UUID');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails when Loxone is not configured', async () => {
    vi.stubEnv('LOXONE_PASSWORD', '');
    const fetchMock = stubMiniserver();

    await expect(getTemperature(UUID)).rejects.toThrow('LOXONE_BASE_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails on a non-numeric value and on an error status', async () => {
    stubMiniserver(valueResponse('invalid'), new Response('', { status: 401 }));

    await expect(getTemperature(UUID)).rejects.toThrow('Invalid temperature value');
    await expect(getTemperature(UUID)).rejects.toThrow('Miniserver responded with 401');
  });

  it('follows a redirect on the same host with the credentials', async () => {
    const fetchMock = stubMiniserver(
      new Response(null, { status: 307, headers: { location: `https://192.168.1.47/jdev/sps/io/${UUID}` } }),
      valueResponse('21.5'),
    );

    expect(await getTemperature(UUID)).toBe(21.5);
    expect(fetchMock.mock.calls[1][0]).toBe(`https://192.168.1.47/jdev/sps/io/${UUID}`);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toMatch(/^Basic /);
  });

  it('never sends the credentials to another host', async () => {
    const fetchMock = stubMiniserver(
      new Response(null, { status: 302, headers: { location: 'https://example.com/steal' } }),
    );

    await expect(getTemperature(UUID)).rejects.toThrow('redirected to another host');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('getTemperatureSensors', () => {
  it('extracts temperature sensors with room and category names from the structure file', async () => {
    const fetchMock = stubMiniserver(
      new Response(
        JSON.stringify({
          controls: {
            [UUID]: { name: 'Aussentemperatur', type: 'InfoOnlyAnalog', room: 'r1', cat: 'c1' },
            [UUID_2]: { name: 'Wohnzimmer', type: 'IRoomControllerV2' },
            'aaaaaaaa-0000-0000-0000000000000000': { name: 'Licht', type: 'Switch' },
          },
          rooms: { r1: { name: 'Garten' } },
          cats: { c1: { name: 'Klima' } },
        }),
      ),
    );

    expect(await getTemperatureSensors()).toEqual([
      { uuid: UUID, name: 'Aussentemperatur', room: 'Garten', category: 'Klima', type: 'InfoOnlyAnalog' },
      { uuid: UUID_2, name: 'Wohnzimmer', room: 'Unknown', category: 'Unknown', type: 'IRoomControllerV2' },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe('http://192.168.1.47/data/LoxAPP3.json');
  });
});

describe('GET /loxone/sensors', () => {
  it('returns 503 when Loxone is not configured', async () => {
    vi.stubEnv('LOXONE_BASE_URL', '');

    const res = await loxoneRouter.request('/loxone/sensors');

    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toBe('LOXONE_NOT_CONFIGURED');
  });

  it('returns 502 when the Miniserver cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));

    const res = await loxoneRouter.request('/loxone/sensors');

    expect(res.status).toBe(502);
  });
});

describe('GET /loxone/temperatures', () => {
  it('returns the readings and leaves out sensors that cannot be read', async () => {
    stubMiniserver(valueResponse('22.5'), new Response('', { status: 500 }));

    const res = await loxoneRouter.request(`/loxone/temperatures?uuids=${UUID},${UUID_2}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { readings: { uuid: string; temperature: number }[] };
    expect(body.readings).toHaveLength(1);
    expect(body.readings[0]).toMatchObject({ uuid: UUID, temperature: 22.5 });
  });

  it('rejects invalid UUIDs', async () => {
    const fetchMock = stubMiniserver();

    const res = await loxoneRouter.request('/loxone/temperatures?uuids=..%2F..%2Fjdev');

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 503 when Loxone is not configured', async () => {
    vi.stubEnv('LOXONE_USERNAME', '');

    const res = await loxoneRouter.request(`/loxone/temperatures?uuids=${UUID}`);

    expect(res.status).toBe(503);
  });
});
