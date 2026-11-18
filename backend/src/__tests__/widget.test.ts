/**
 * Unit tests for the widget timeline endpoint helpers.
 *
 * Focus: the multi-sensor parsing + response building that powers
 * Phase 4b+. The DB + HTTP layers are integration-tested separately;
 * here we exercise pure logic.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { parseSensorUuids, fetchLoxoneMultiSensor } from '../widget.js';

describe('widget timeline helpers', () => {
  describe('parseSensorUuids', () => {
    it('parses comma-separated multi-uuid header', () => {
      expect(parseSensorUuids('a,b,c', undefined)).toEqual(['a', 'b', 'c']);
    });

    it('trims whitespace and drops empty entries', () => {
      expect(parseSensorUuids('  a , , b ,,  c  ', undefined)).toEqual(['a', 'b', 'c']);
    });

    it('falls back to legacy single-uuid header when multi is empty/undefined', () => {
      expect(parseSensorUuids(undefined, 'legacy-uuid')).toEqual(['legacy-uuid']);
      expect(parseSensorUuids('', 'legacy-uuid')).toEqual(['legacy-uuid']);
    });

    it('prefers multi-uuid over legacy single-uuid', () => {
      expect(parseSensorUuids('a,b', 'legacy')).toEqual(['a', 'b']);
    });

    it('returns empty array when both headers are empty/missing', () => {
      expect(parseSensorUuids(undefined, undefined)).toEqual([]);
      expect(parseSensorUuids('', '')).toEqual([]);
      expect(parseSensorUuids('  , ,  ', undefined)).toEqual([]);
    });
  });

  describe('fetchLoxoneMultiSensor', () => {
    const UUID = '15beed5b-01ab-d81d-ffff2b06d5b9c660';

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it('returns empty result when no valid UUIDs are provided', async () => {
      const r1 = await fetchLoxoneMultiSensor({ multiHeader: undefined, legacySingleUuid: undefined });
      expect(r1.primary).toBeNull();
      expect(r1.sensors).toBeUndefined();

      const r2 = await fetchLoxoneMultiSensor({ multiHeader: '../../jdev,not-a-uuid', legacySingleUuid: undefined });
      expect(r2.primary).toBeNull();
      expect(r2.sensors).toBeUndefined();
    });

    it('returns empty sensors array when Loxone is not configured', async () => {
      vi.stubEnv('LOXONE_BASE_URL', '');
      const r = await fetchLoxoneMultiSensor({ multiHeader: UUID, legacySingleUuid: undefined });
      expect(r.primary).toBeNull();
      expect(r.sensors).toEqual([]);
    });

    it('reads the sensors from the configured Miniserver', async () => {
      vi.stubEnv('LOXONE_BASE_URL', 'http://192.168.1.47');
      vi.stubEnv('LOXONE_USERNAME', 'u');
      vi.stubEnv('LOXONE_PASSWORD', 'p');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(JSON.stringify({ LL: { value: '19.4' } }))),
      );

      const r = await fetchLoxoneMultiSensor({ multiHeader: UUID, legacySingleUuid: undefined });

      expect(r.primary?.temperature).toBe(19.4);
      expect(r.sensors).toHaveLength(1);
      expect(r.sensors?.[0]).toMatchObject({ uuid: UUID, temperature: 19.4 });
    });
  });
});
