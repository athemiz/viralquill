/**
 * Tests for X API Quota Tracker.
 * Critical: 15K reads/month shared across ALL users.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QuotaTracker } from '../quota-tracker';
import type { QuotaTrackerConfig } from '../quota-tracker';

const testConfig: QuotaTrackerConfig = {
  monthlyReadCap: 15_000,
  monthlyWriteCap: 50_000,
  reservePercent: 0.1,
  warningThreshold: 0.7,
  criticalThreshold: 0.9,
};

describe('QuotaTracker', () => {
  let tracker: QuotaTracker;

  beforeEach(() => {
    tracker = new QuotaTracker(testConfig);
  });

  // ─── Initial State ──────────────────────────────────────────

  describe('initial state', () => {
    it('starts with zero usage', () => {
      const state = tracker.getState();
      expect(state.monthlyReadsUsed).toBe(0);
      expect(state.monthlyWritesUsed).toBe(0);
      expect(state.monthlyReadsLimit).toBe(15_000);
      expect(state.monthlyWritesLimit).toBe(50_000);
    });

    it('starts at normal level', () => {
      expect(tracker.getLevel()).toBe('normal');
    });

    it('cache hit rate is 0 with no requests', () => {
      expect(tracker.getCacheHitRate()).toBe(0);
    });
  });

  // ─── Read/Write Tracking ────────────────────────────────────

  describe('read/write tracking', () => {
    it('tracks reads consumed', () => {
      tracker.recordReads(5);
      expect(tracker.getState().monthlyReadsUsed).toBe(5);

      tracker.recordReads(10);
      expect(tracker.getState().monthlyReadsUsed).toBe(15);
    });

    it('tracks writes consumed', () => {
      tracker.recordWrites(3);
      expect(tracker.getState().monthlyWritesUsed).toBe(3);
    });

    it('tracks cache hits', () => {
      tracker.recordCacheHit();
      tracker.recordCacheHit();
      tracker.recordReads(1);

      // 2 cache hits out of 3 total requests
      expect(tracker.getCacheHitRate()).toBeCloseTo(0.6667, 3);
    });
  });

  // ─── Quota Levels ───────────────────────────────────────────

  describe('quota levels', () => {
    it('normal when under 70%', () => {
      tracker.recordReads(10_000); // 66.7%
      expect(tracker.getLevel()).toBe('normal');
    });

    it('warning at 70-90%', () => {
      tracker.recordReads(10_500); // 70%
      expect(tracker.getLevel()).toBe('warning');

      tracker.recordReads(2_999); // 89.99%
      expect(tracker.getLevel()).toBe('warning');
    });

    it('critical at 90-100%', () => {
      tracker.recordReads(13_500); // 90%
      expect(tracker.getLevel()).toBe('critical');
    });

    it('exhausted at 100%', () => {
      tracker.recordReads(15_000); // 100%
      expect(tracker.getLevel()).toBe('exhausted');
    });
  });

  // ─── Quota Guards ───────────────────────────────────────────

  describe('quota guards', () => {
    it('allows reads within user budget (90% of cap)', () => {
      expect(tracker.canRead(1)).toBe(true);
      expect(tracker.canRead(13_500)).toBe(true); // exactly 90%
    });

    it('blocks reads when user budget exhausted (reserves 10% for system)', () => {
      tracker.recordReads(13_500); // 90% = user budget limit
      expect(tracker.canRead(1)).toBe(false);
    });

    it('allows system reads from reserve budget', () => {
      tracker.recordReads(13_500); // 90%
      // canRead blocks (user budget), but canSystemRead allows (full cap)
      expect(tracker.canRead(1)).toBe(false);
      expect(tracker.canSystemRead(1)).toBe(true);
    });

    it('blocks system reads at absolute cap', () => {
      tracker.recordReads(15_000);
      expect(tracker.canSystemRead(1)).toBe(false);
    });

    it('allows writes within cap', () => {
      expect(tracker.canWrite(1)).toBe(true);
      expect(tracker.canWrite(50_000)).toBe(true);
    });

    it('blocks writes over cap', () => {
      tracker.recordWrites(50_000);
      expect(tracker.canWrite(1)).toBe(false);
    });
  });

  // ─── Fair Share ─────────────────────────────────────────────

  describe('fair share calculation', () => {
    it('gives full budget to single user', () => {
      tracker.setActiveUsers(1);
      // 15K * 0.9 (reserve) / 1 user * 1.2 (power buffer) = 16,200
      expect(tracker.getFairShareReads()).toBe(16_200);
    });

    it('splits budget among 10 users', () => {
      tracker.setActiveUsers(10);
      // 15K * 0.9 / 10 * 1.2 = 1,620
      expect(tracker.getFairShareReads()).toBe(1_620);
    });

    it('splits budget among 50 users', () => {
      tracker.setActiveUsers(50);
      // 15K * 0.9 / 50 * 1.2 = 324
      expect(tracker.getFairShareReads()).toBe(324);
    });

    it('splits budget among 100 users — very tight', () => {
      tracker.setActiveUsers(100);
      // 15K * 0.9 / 100 * 1.2 = 162
      expect(tracker.getFairShareReads()).toBe(162);
    });

    it('handles 0 users gracefully (min 1)', () => {
      tracker.setActiveUsers(0);
      expect(tracker.getFairShareReads()).toBe(16_200); // same as 1 user
    });
  });

  // ─── Remaining Budget ───────────────────────────────────────

  describe('remaining budget', () => {
    it('calculates remaining reads', () => {
      tracker.recordReads(5_000);
      expect(tracker.getRemainingReads()).toBe(10_000);
    });

    it('remaining never goes negative', () => {
      tracker.recordReads(20_000); // over cap
      expect(tracker.getRemainingReads()).toBe(0);
    });
  });

  // ─── Polling Multiplier ─────────────────────────────────────

  describe('polling multiplier', () => {
    it('1x at normal', () => {
      expect(tracker.getPollingMultiplier()).toBe(1);
    });

    it('2x at warning', () => {
      tracker.recordReads(10_500);
      expect(tracker.getPollingMultiplier()).toBe(2);
    });

    it('4x at critical', () => {
      tracker.recordReads(13_500);
      expect(tracker.getPollingMultiplier()).toBe(4);
    });

    it('Infinity at exhausted', () => {
      tracker.recordReads(15_000);
      expect(tracker.getPollingMultiplier()).toBe(Infinity);
    });
  });

  // ─── Status Messages ────────────────────────────────────────

  describe('status messages', () => {
    it('shows remaining at normal', () => {
      tracker.recordReads(3_000);
      expect(tracker.getStatusMessage()).toContain('12000 reads remaining');
    });

    it('shows warning emoji at warning level', () => {
      tracker.recordReads(11_000);
      expect(tracker.getStatusMessage()).toContain('⚠️');
    });

    it('shows red circle at critical level', () => {
      tracker.recordReads(14_000);
      expect(tracker.getStatusMessage()).toContain('🔴');
    });

    it('shows stop sign at exhausted', () => {
      tracker.recordReads(15_000);
      expect(tracker.getStatusMessage()).toContain('🛑');
    });
  });

  // ─── Reset ──────────────────────────────────────────────────

  describe('reset', () => {
    it('resets all counters', () => {
      tracker.recordReads(10_000);
      tracker.recordWrites(5_000);
      tracker.recordCacheHit();

      tracker.reset();

      const state = tracker.getState();
      expect(state.monthlyReadsUsed).toBe(0);
      expect(state.monthlyWritesUsed).toBe(0);
      expect(tracker.getCacheHitRate()).toBe(0);
    });
  });

  // ─── Load State ─────────────────────────────────────────────

  describe('loadState', () => {
    it('restores persisted state', () => {
      tracker.loadState({
        monthlyReadsUsed: 7_500,
        monthlyWritesUsed: 2_000,
      });

      const state = tracker.getState();
      expect(state.monthlyReadsUsed).toBe(7_500);
      expect(state.monthlyWritesUsed).toBe(2_000);
    });
  });
});
