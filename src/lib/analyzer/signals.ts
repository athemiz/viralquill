/**
 * ViralQuill — Content Signal Detector
 * Analyzes draft text for engagement signals based on X algorithm research.
 *
 * Key algorithm insights:
 * - Reply engaged by author = 150x more powerful than a like (+75)
 * - Questions drive replies → highest algorithm weight
 * - External links penalized 30-50%
 * - Text-only posts get 30% more engagement rate than video
 * - Hook in first 2 lines is critical (50% score decay every 6h)
 * - Optimal tweet length: 71-100 chars
 * - Threads: 3-6 tweets optimal
 */

// ─── Signal Types ───────────────────────────────────────────────────

export interface ContentSignals {
  // Structure
  charCount: number;
  wordCount: number;
  lineCount: number;
  isThread: boolean;
  threadLength: number; // 1 for single tweet

  // Engagement boosters
  hasHook: boolean; // strong opening line
  hookType: HookType | null;
  hasQuestion: boolean; // drives replies (+13.5 to +75 weight)
  hasCTA: boolean; // call to action (reply, RT, like)
  hasPoll: boolean; // polls generate high reply counts

  // Penalties
  hasExternalLink: boolean; // penalized 30-50%
  hasHashtags: boolean; // discovery signal, not ranking
  hashtagCount: number;

  // Formatting
  hasEmoji: boolean;
  emojiCount: number;
  hasLineBreaks: boolean; // scannable formatting
  hasListFormat: boolean; // numbered/bulleted lists

  // Media
  hasMention: boolean;
  mentionCount: number;

  // Length classification
  lengthCategory: LengthCategory;

  // Overall pre-optimization score (0-100)
  preOptimizationScore: number;
  suggestions: Suggestion[];
}

export type HookType =
  | 'problem-solution' // "Most [people] waste [X]. Here's the fix:"
  | 'contrarian' // "Everyone says X. They're wrong."
  | 'number-driven' // "I analyzed 10,000 tweets. Here are 7 patterns."
  | 'story' // "In 2023, I lost everything. Then I discovered..."
  | 'question' // "What if everything you knew about X was wrong?"
  | 'bold-claim' // "This one trick..."
  | null;

export type LengthCategory =
  | 'too-short' // < 30 chars
  | 'short' // 30-70 chars
  | 'optimal' // 71-100 chars (sweet spot)
  | 'medium' // 101-200 chars
  | 'long' // 201-280 chars
  | 'thread-needed'; // > 280 chars

export interface Suggestion {
  type: 'boost' | 'warning' | 'info';
  signal: string;
  message: string;
  impact: 'high' | 'medium' | 'low';
}

// ─── Detection Functions ────────────────────────────────────────────

/**
 * Detect if text contains a question (drives replies — highest algo signal).
 */
export function detectQuestion(text: string): boolean {
  // Direct question marks
  if (text.includes('?')) return true;

  // Question words at start of sentences
  const questionPatterns =
    /\b(what|why|how|when|where|who|which|would|could|should|do you|have you|are you|is there|can you|did you)\b/i;
  return questionPatterns.test(text);
}

/**
 * Detect hook type from the first line of text.
 */
export function detectHookType(text: string): HookType {
  const firstLine = text.split('\n')[0].trim().toLowerCase();

  // Story: "In 20XX...", "X years ago..." (check BEFORE number-driven)
  if (
    /^(in \d{4}|\d+ (years?|months?|days?|weeks?) ago|when i (was|first|started)|i used to|i remember|true story)\b/.test(
      firstLine,
    )
  ) {
    return 'story';
  }

  // Contrarian: "Everyone says...", "Popular opinion:..." (check BEFORE problem-solution to catch "here's why" in context)
  if (
    /^(everyone|nobody|no one|popular opinion|unpopular|controversial|hot take|contrary)\b/.test(
      firstLine,
    ) ||
    /they'?re wrong/.test(firstLine)
  ) {
    return 'contrarian';
  }

  // Number-driven: "I analyzed..." or "X things/ways/tips..."
  if (
    /^i (analyzed|studied|reviewed|looked at|read|spent)\b/.test(firstLine) ||
    /\b\d+\s+(things|ways|tips|lessons|mistakes|patterns|rules|steps|reasons)\b/.test(firstLine)
  ) {
    return 'number-driven';
  }

  // Problem-solution: "Most people...", "The problem with...", "Stop doing X"
  if (
    /^(most|the problem|the issue|the mistake|stop|quit|don't|never)\b/.test(firstLine) ||
    /here'?s (the|how|why|what)/.test(firstLine)
  ) {
    return 'problem-solution';
  }

  // Question hook
  if (firstLine.includes('?') || /^(what if|imagine|ever wonder|did you know)\b/.test(firstLine)) {
    return 'question';
  }

  // Bold claim: "This is the...", "The secret...", "One simple..."
  if (
    /^(this is the|the (secret|key|truth|real reason)|one (simple|thing)|the only|the biggest)\b/.test(
      firstLine,
    )
  ) {
    return 'bold-claim';
  }

  return null;
}

/**
 * Detect if text contains a call to action.
 */
export function detectCTA(text: string): boolean {
  const ctaPatterns =
    /\b(retweet|rt if|like if|reply with|drop a|comment|share this|follow me|bookmark this|save this|tag someone|let me know|agree\??|thoughts\??|what do you think)\b/i;
  return ctaPatterns.test(text);
}

/**
 * Detect external links (penalized 30-50% by algorithm).
 */
export function detectExternalLink(text: string): boolean {
  // URLs
  if (/https?:\/\/\S+/.test(text)) return true;
  // Common URL patterns without protocol
  if (/\b\w+\.(com|io|co|org|net|dev|app)\b/i.test(text)) return true;
  return false;
}

/**
 * Detect hashtags.
 */
export function detectHashtags(text: string): { has: boolean; count: number } {
  const matches = text.match(/#\w+/g);
  return {
    has: matches !== null && matches.length > 0,
    count: matches?.length ?? 0,
  };
}

/**
 * Detect emoji usage.
 */
export function detectEmoji(text: string): { has: boolean; count: number } {
  // Unicode emoji ranges
  const emojiRegex =
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;
  const matches = text.match(emojiRegex);
  return {
    has: matches !== null && matches.length > 0,
    count: matches?.length ?? 0,
  };
}

/**
 * Detect @mentions.
 */
export function detectMentions(text: string): { has: boolean; count: number } {
  const matches = text.match(/@\w+/g);
  return {
    has: matches !== null && matches.length > 0,
    count: matches?.length ?? 0,
  };
}

/**
 * Detect if text has list formatting (numbered or bulleted).
 */
export function detectListFormat(text: string): boolean {
  // Numbered lists: "1.", "2.", etc.
  if (/^\s*\d+[.)]/m.test(text)) return true;
  // Bullet lists: "- ", "• ", "* "
  if (/^\s*[-•*]\s/m.test(text)) return true;
  return false;
}

/**
 * Detect if text has a poll structure.
 */
export function detectPoll(text: string): boolean {
  return /\b(poll|vote|option [a-d1-4]|which one)\b/i.test(text);
}

/**
 * Classify text length into categories.
 */
export function classifyLength(charCount: number): LengthCategory {
  if (charCount < 30) return 'too-short';
  if (charCount <= 70) return 'short';
  if (charCount <= 100) return 'optimal';
  if (charCount <= 200) return 'medium';
  if (charCount <= 280) return 'long';
  return 'thread-needed';
}
