/**
 * Unit tests for the widget timeline endpoint helpers.
 *
 * Focus: the multi-sensor parsing + response building that powers
 * Phase 4b+. The DB + HTTP layers are integration-tested separately;
 * here we exercise pure logic.
 */

import { describe, it, expect, vi } from 'vitest';
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
        baseURL: 'http://192.168.1.47',
        credentials: undefined,
        multiHeader: 'a,b',
        legacySingleUuid: undefined,
      });
      expect(r1.primary).toBeNull();
      expect(r1.sensors).toBeUndefined();

      const r2 = await fetchLoxoneMultiSensor({
        baseURL: undefined,
        credentials: 'Basic xxx',
        multiHeader: 'a',
        legacySingleUuid: undefined,
      });
      expect(r2.primary).toBeNull();
      expect(r2.sensors).toBeUndefined();
    });

    it('returns empty result when no UUIDs are provided', async () => {
      const r = await fetchLoxoneMultiSensor({
        baseURL: 'http://192.168.1.47',
        credentials: 'Basic xxx',
        multiHeader: undefined,
        legacySingleUuid: undefined,
      });
      expect(r.primary).toBeNull();
      expect(r.sensors).toBeUndefined();
    });

    it('returns empty result when the base URL is not in the local network', async () => {
      const r = await fetchLoxoneMultiSensor({
        baseURL: 'https://example.com',
        credentials: 'Basic xxx',
        multiHeader: 'a',
        legacySingleUuid: undefined,
      });
      expect(r.primary).toBeNull();
      expect(r.sensors).toBeUndefined();
    });

    it('returns empty sensors array when all fetches fail and no cache', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unreachable')));
      const r = await fetchLoxoneMultiSensor({
        baseURL: 'http://192.168.1.47',
        credentials: 'Basic xxx',
        multiHeader: 'a,b',
        legacySingleUuid: undefined,
      });
      vi.unstubAllGlobals();
      expect(r.primary).toBeNull();
      expect(r.sensors).toEqual([]);
    });
  });
});
