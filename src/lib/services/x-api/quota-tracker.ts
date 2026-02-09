/**
 * ViralQuill — Quota Tracker
 * Tracks X API monthly consumption cap (per-app shared) and
 * per-user fair share allocation.
 *
 * Critical constraint: Basic tier = 15K reads/month shared across ALL users.
 * This tracker ensures fair distribution and graceful degradation.
 */

import type { QuotaState, QuotaLevel } from './types';

export interface QuotaTrackerConfig {
  monthlyReadCap: number; // 15,000 for Basic
  monthlyWriteCap: number; // 50,000 for Basic
  reservePercent: number; // 10% reserved for system/background jobs
  warningThreshold: number; // 0.7 = warning at 70%
  criticalThreshold: number; // 0.9 = critical at 90%
}

export const DEFAULT_QUOTA_CONFIG: QuotaTrackerConfig = {
  monthlyReadCap: 15_000,
  monthlyWriteCap: 50_000,
  reservePercent: 0.1,
  warningThreshold: 0.7,
  criticalThreshold: 0.9,
};

export class QuotaTracker {
  private readsUsed: number = 0;
  private writesUsed: number = 0;
  private cacheHits: number = 0;
  private totalRequests: number = 0;
  private activeUsers: number = 1;
  private readonly config: QuotaTrackerConfig;
  private resetDate: Date;

  constructor(config: Partial<QuotaTrackerConfig> = {}) {
    this.config = { ...DEFAULT_QUOTA_CONFIG, ...config };
    this.resetDate = this.getNextResetDate();
  }

  // ─── Read/Write Tracking ────────────────────────────────────────

  /**
   * Record API reads consumed.
   * @param count - Number of reads consumed (e.g., 1 for batch of 100 tweets)
   */
  recordReads(count: number): void {
    this.readsUsed += count;
    this.totalRequests += count;
  }

  /**
   * Record API writes consumed.
   * @param count - Number of writes consumed
   */
  recordWrites(count: number): void {
    this.writesUsed += count;
    this.totalRequests += count;
  }

  /**
   * Record a cache hit (no API call needed).
   */
  recordCacheHit(): void {
    this.cacheHits++;
    this.totalRequests++;
  }

  // ─── Quota State ────────────────────────────────────────────────

  /**
   * Get current quota state.
   */
  getState(): QuotaState {
    return {
      monthlyReadsUsed: this.readsUsed,
      monthlyReadsLimit: this.config.monthlyReadCap,
      monthlyWritesUsed: this.writesUsed,
      monthlyWritesLimit: this.config.monthlyWriteCap,
      resetsAt: this.resetDate.toISOString(),
      cacheHitRate: this.getCacheHitRate(),
    };
  }

  /**
   * Get current quota level for degradation decisions.
   */
  getLevel(): QuotaLevel {
    const readUsage = this.readsUsed / this.config.monthlyReadCap;

    if (readUsage >= 1.0) return 'exhausted';
    if (readUsage >= this.config.criticalThreshold) return 'critical';
    if (readUsage >= this.config.warningThreshold) return 'warning';
    return 'normal';
  }

  /**
   * Check if a read operation is allowed.
   * Considers reserve budget for system operations.
   */
  canRead(count: number = 1): boolean {
    const effectiveCap = this.config.monthlyReadCap * (1 - this.config.reservePercent);
    return this.readsUsed + count <= effectiveCap;
  }

  /**
   * Check if a write operation is allowed.
   */
  canWrite(count: number = 1): boolean {
    return this.writesUsed + count <= this.config.monthlyWriteCap;
  }

  /**
   * Check if a system/background read is allowed (uses reserve budget).
   */
  canSystemRead(count: number = 1): boolean {
    return this.readsUsed + count <= this.config.monthlyReadCap;
  }

  // ─── Fair Share ─────────────────────────────────────────────────

  /**
   * Set the number of active users for fair share calculation.
   */
  setActiveUsers(count: number): void {
    this.activeUsers = Math.max(1, count);
  }

  /**
   * Calculate fair share of reads per user per month.
   * Includes 20% buffer for power users.
   */
  getFairShareReads(): number {
    const userBudget = this.config.monthlyReadCap * (1 - this.config.reservePercent);
    const fairShare = userBudget / this.activeUsers;
    return Math.floor(fairShare * 1.2); // 20% power user buffer
  }

  /**
   * Get remaining reads available.
   */
  getRemainingReads(): number {
    return Math.max(0, this.config.monthlyReadCap - this.readsUsed);
  }

  /**
   * Get remaining writes available.
   */
  getRemainingWrites(): number {
    return Math.max(0, this.config.monthlyWriteCap - this.writesUsed);
  }

  // ─── Cache Performance ──────────────────────────────────────────

  /**
   * Get cache hit rate. Target: >= 0.80 (80%).
   */
  getCacheHitRate(): number {
    if (this.totalRequests === 0) return 0;
    return Number((this.cacheHits / this.totalRequests).toFixed(4));
  }

  // ─── Degradation Recommendations ────────────────────────────────

  /**
   * Get recommended polling interval multiplier based on quota level.
   * Normal = 1x, Warning = 2x, Critical = 4x, Exhausted = Infinity (no polling)
   */
  getPollingMultiplier(): number {
    switch (this.getLevel()) {
      case 'normal':
        return 1;
      case 'warning':
        return 2; // reduce frequency by 50%
      case 'critical':
        return 4; // reduce frequency by 75%
      case 'exhausted':
        return Infinity; // stop polling
    }
  }

  /**
   * Get human-readable quota status for user dashboard.
   */
  getStatusMessage(): string {
    const state = this.getState();
    const level = this.getLevel();
    const pct = Math.round((state.monthlyReadsUsed / state.monthlyReadsLimit) * 100);

    switch (level) {
      case 'normal':
        return `${state.monthlyReadsLimit - state.monthlyReadsUsed} reads remaining this month (${pct}% used)`;
      case 'warning':
        return `⚠️ ${state.monthlyReadsLimit - state.monthlyReadsUsed} reads remaining. Data refresh frequency reduced.`;
      case 'critical':
        return `🔴 Only ${state.monthlyReadsLimit - state.monthlyReadsUsed} reads left. Showing cached data. Resets ${state.resetsAt}.`;
      case 'exhausted':
        return `🛑 Monthly read limit reached. All data is cached. Resets ${state.resetsAt}.`;
    }
  }

  // ─── Reset ──────────────────────────────────────────────────────

  /**
   * Reset counters (called at the start of each month).
   */
  reset(): void {
    this.readsUsed = 0;
    this.writesUsed = 0;
    this.cacheHits = 0;
    this.totalRequests = 0;
    this.resetDate = this.getNextResetDate();
  }

  /**
   * Check if current period has expired and auto-reset if needed.
   */
  checkAndReset(): boolean {
    if (new Date() >= this.resetDate) {
      this.reset();
      return true;
    }
    return false;
  }

  /**
   * Load state from persistent storage (e.g., Redis or Supabase).
   */
  loadState(state: Partial<QuotaState>): void {
    if (state.monthlyReadsUsed !== undefined) this.readsUsed = state.monthlyReadsUsed;
    if (state.monthlyWritesUsed !== undefined) this.writesUsed = state.monthlyWritesUsed;
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private getNextResetDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
}
