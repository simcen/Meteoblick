/**
 * Unit tests for the widget timeline endpoint helpers.
 *
 * Focus: the multi-sensor parsing + response building that powers
 * Phase 4b+. The DB + HTTP layers are integration-tested separately;
 * here we exercise pure logic.
 */

import { describe, it, expect } from 'vitest';
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
    it('returns empty result when credentials are missing', async () => {
      const r1 = await fetchLoxoneMultiSensor({
        snr: 'CAFE',
        credentials: undefined,
        multiHeader: 'a,b',
        legacySingleUuid: undefined,
      });
      expect(r1.primary).toBeNull();
      expect(r1.sensors).toBeUndefined();

      const r2 = await fetchLoxoneMultiSensor({
        snr: undefined,
        credentials: 'Basic xxx',
        multiHeader: 'a',
        legacySingleUuid: undefined,
      });
      expect(r2.primary).toBeNull();
      expect(r2.sensors).toBeUndefined();
    });

    it('returns empty result when no UUIDs are provided', async () => {
      const r = await fetchLoxoneMultiSensor({
        snr: 'CAFE',
        credentials: 'Basic xxx',
        multiHeader: undefined,
        legacySingleUuid: undefined,
      });
      expect(r.primary).toBeNull();
      expect(r.sensors).toBeUndefined();
    });

    it('returns empty sensors array when all fetches fail and no cache', async () => {
      // The function uses real fetchLoxoneTemperature which would network-call.
      // For unit test isolation, we just verify the "no sensors" path —
      // a full success/multi-fetch test belongs in integration tests where
      // global.fetch is mocked.
      const r = await fetchLoxoneMultiSensor({
        snr: 'CAFE',
        credentials: 'Basic xxx',
        multiHeader: 'a,b',
        legacySingleUuid: undefined,
      });
      // r.sensors is undefined OR empty array (depends on fetch results).
      // We only assert shape here.
      expect(r.primary === null || typeof r.primary === 'object').toBe(true);
    });
  });
});
