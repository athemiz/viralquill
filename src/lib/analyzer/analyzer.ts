/**
 * ViralQuill — Content Analyzer
 * Analyzes draft text and produces a complete signal profile
 * with pre-optimization score and actionable suggestions.
 *
 * Pure functions, zero API calls, 100% testable.
 */

import type { ContentSignals, Suggestion } from './signals';
import {
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

/**
 * Analyze a piece of content and extract all engagement signals.
 *
 * @param text - Raw draft text to analyze
 * @returns Complete signal analysis with score and suggestions
 */
export function analyzeContent(text: string): ContentSignals {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const isThread = charCount > 280;
  const threadLength = isThread ? Math.ceil(charCount / 260) : 1; // ~260 usable chars per tweet

  const hookType = detectHookType(text);
  const hasQuestion = detectQuestion(text);
  const hasCTA = detectCTA(text);
  const hasExternalLink = detectExternalLink(text);
  const hashtags = detectHashtags(text);
  const emoji = detectEmoji(text);
  const mentions = detectMentions(text);
  const hasListFormat = detectListFormat(text);
  const hasPoll = detectPoll(text);
  const lengthCategory = classifyLength(charCount);
  const hasLineBreaks = lines.length > 1;

  const signals: Omit<ContentSignals, 'preOptimizationScore' | 'suggestions'> = {
    charCount,
    wordCount,
    lineCount: lines.length,
    isThread,
    threadLength,
    hasHook: hookType !== null,
    hookType,
    hasQuestion,
    hasCTA,
    hasPoll,
    hasExternalLink,
    hasHashtags: hashtags.has,
    hashtagCount: hashtags.count,
    hasEmoji: emoji.has,
    emojiCount: emoji.count,
    hasLineBreaks,
    hasListFormat,
    hasMention: mentions.has,
    mentionCount: mentions.count,
    lengthCategory,
  };

  const suggestions = generateSuggestions(signals);
  const preOptimizationScore = calculatePreScore(signals);

  return {
    ...signals,
    preOptimizationScore,
    suggestions,
  };
}

/**
 * Calculate a pre-optimization score (0-100) based on detected signals.
 * Higher = more algorithm-friendly before any AI rewriting.
 */
function calculatePreScore(
  signals: Omit<ContentSignals, 'preOptimizationScore' | 'suggestions'>,
): number {
  let score = 50; // baseline

  // Hook (high impact)
  if (signals.hasHook) score += 15;

  // Question (highest algo signal — drives replies)
  if (signals.hasQuestion) score += 15;

  // CTA (drives engagement actions)
  if (signals.hasCTA) score += 8;

  // Length in optimal range
  if (signals.lengthCategory === 'optimal') score += 10;
  else if (signals.lengthCategory === 'medium') score += 5;
  else if (signals.lengthCategory === 'too-short') score -= 10;

  // Line breaks (scannable = better)
  if (signals.hasLineBreaks) score += 5;

  // External link penalty
  if (signals.hasExternalLink) score -= 20;

  // Excessive hashtags (looks spammy)
  if (signals.hashtagCount > 3) score -= 10;
  else if (signals.hashtagCount >= 1 && signals.hashtagCount <= 2) score += 3;

  // Thread structure
  if (signals.isThread) {
    if (signals.threadLength >= 3 && signals.threadLength <= 6) score += 5; // optimal thread length
    else if (signals.threadLength > 10) score -= 5; // too long
  }

  // Poll (high reply signal)
  if (signals.hasPoll) score += 8;

  // Strategic emoji (1-3 = good, too many = spammy)
  if (signals.emojiCount >= 1 && signals.emojiCount <= 3) score += 3;
  else if (signals.emojiCount > 5) score -= 5;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, score));
}

/**
 * Generate actionable suggestions based on detected signals.
 */
function generateSuggestions(
  signals: Omit<ContentSignals, 'preOptimizationScore' | 'suggestions'>,
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // ─── High Impact ──────────────────────────────────────────

  if (!signals.hasHook) {
    suggestions.push({
      type: 'boost',
      signal: 'hook',
      message: 'Add a strong hook in the first line. Try: a contrarian take, a number-driven claim, or a question.',
      impact: 'high',
    });
  }

  if (!signals.hasQuestion) {
    suggestions.push({
      type: 'boost',
      signal: 'question',
      message: 'Add a question to drive replies. Replies are 150x more valuable than likes in the algorithm.',
      impact: 'high',
    });
  }

  if (signals.hasExternalLink) {
    suggestions.push({
      type: 'warning',
      signal: 'external-link',
      message: 'External links are penalized 30-50% by the algorithm. Consider moving the link to a reply instead.',
      impact: 'high',
    });
  }

  // ─── Medium Impact ────────────────────────────────────────

  if (!signals.hasCTA) {
    suggestions.push({
      type: 'boost',
      signal: 'cta',
      message: 'Add a call to action (e.g., "What do you think?", "RT if you agree", "Bookmark this").',
      impact: 'medium',
    });
  }

  if (signals.lengthCategory === 'too-short') {
    suggestions.push({
      type: 'warning',
      signal: 'length',
      message: 'Post is very short (<30 chars). Optimal tweet length is 71-100 characters.',
      impact: 'medium',
    });
  }

  if (signals.lengthCategory === 'thread-needed' && !signals.isThread) {
    suggestions.push({
      type: 'info',
      signal: 'thread',
      message: 'Content exceeds 280 chars. Consider formatting as a thread (3-6 tweets optimal).',
      impact: 'medium',
    });
  }

  if (signals.isThread && signals.threadLength > 6) {
    suggestions.push({
      type: 'info',
      signal: 'thread-length',
      message: `Thread is ${signals.threadLength} tweets. Optimal is 3-6. Longer threads see 45% lower completion rate.`,
      impact: 'medium',
    });
  }

  if (!signals.hasLineBreaks && signals.charCount > 100) {
    suggestions.push({
      type: 'boost',
      signal: 'formatting',
      message: 'Add line breaks for scannability. Whitespace boosts readability and dwell time.',
      impact: 'medium',
    });
  }

  // ─── Low Impact ───────────────────────────────────────────

  if (signals.hashtagCount > 3) {
    suggestions.push({
      type: 'warning',
      signal: 'hashtags',
      message: `${signals.hashtagCount} hashtags detected. Keep to 1-2 max — excessive hashtags look spammy.`,
      impact: 'low',
    });
  }

  if (signals.emojiCount > 5) {
    suggestions.push({
      type: 'warning',
      signal: 'emoji',
      message: 'Too many emojis. 1-3 strategic emojis is optimal.',
      impact: 'low',
    });
  }

  if (!signals.hasEmoji && signals.charCount > 50) {
    suggestions.push({
      type: 'info',
      signal: 'emoji',
      message: 'Consider adding 1-2 strategic emojis for visual breaks.',
      impact: 'low',
    });
  }

  return suggestions;
}
