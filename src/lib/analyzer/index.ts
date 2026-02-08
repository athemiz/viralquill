/**
 * ViralQuill — Content Analyzer
 * Public API surface for content signal detection.
 */

export { analyzeContent } from './analyzer';

export type {
  ContentSignals,
  HookType,
  LengthCategory,
  Suggestion,
} from './signals';

export {
  detectQuestion,
  detectHookType,
  detectCTA,
  detectExternalLink,
  detectHashtags,
  detectEmoji,
  detectMentions,
  detectListFormat,
  detectPoll,
  classifyLength,
} from './signals';
