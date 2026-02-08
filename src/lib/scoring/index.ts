/**
 * ViralQuill — Scoring Engine
 * Public API for the scoring module.
 */

export {
  calculateRawScore,
  calculateBreakdown,
  estimateDwellSignal,
  normalizeScore,
  classifyBucket,
  calculateConfidence,
  calculateAlgoScore,
} from './calculator';

export {
  DEFAULT_WEIGHTS,
  DEFAULT_BUCKET_THRESHOLDS,
  MIN_POSTS_FOR_CREATOR_PERCENTILES,
  GLOBAL_PERCENTILES,
} from './weights';
