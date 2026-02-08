/**
 * Tests for the main content analyzer.
 */

import { describe, it, expect } from 'vitest';
import { analyzeContent } from '../analyzer';

describe('analyzeContent', () => {
  // ─── Basic Structure ────────────────────────────────────────

  it('analyzes a simple tweet', () => {
    const result = analyzeContent('This is a simple tweet about coding.');
    expect(result.charCount).toBe(36);
    expect(result.wordCount).toBe(7);
    expect(result.isThread).toBe(false);
    expect(result.threadLength).toBe(1);
    expect(result.preOptimizationScore).toBeGreaterThan(0);
    expect(result.suggestions).toBeDefined();
  });

  it('detects thread content', () => {
    const longText = 'A'.repeat(300);
    const result = analyzeContent(longText);
    expect(result.isThread).toBe(true);
    expect(result.threadLength).toBeGreaterThan(1);
  });

  // ─── Hook Detection ─────────────────────────────────────────

  it('detects problem-solution hook', () => {
    const result = analyzeContent('Most people waste time on X. Here\'s the fix: do Y instead.');
    expect(result.hasHook).toBe(true);
    expect(result.hookType).toBe('problem-solution');
    expect(result.preOptimizationScore).toBeGreaterThan(50);
  });

  it('detects contrarian hook', () => {
    const result = analyzeContent('Everyone says X is best. They\'re wrong. Here\'s why Y wins.');
    expect(result.hasHook).toBe(true);
    expect(result.hookType).toBe('contrarian');
  });

  it('detects number-driven hook', () => {
    const result = analyzeContent('I analyzed 10,000 tweets. Here are the 7 patterns I found.');
    expect(result.hasHook).toBe(true);
    expect(result.hookType).toBe('number-driven');
  });

  // ─── Question Detection ─────────────────────────────────────

  it('detects questions and boosts score', () => {
    const withQuestion = analyzeContent('What do you think about this approach?');
    const withoutQuestion = analyzeContent('This is my approach.');
    expect(withQuestion.hasQuestion).toBe(true);
    expect(withoutQuestion.hasQuestion).toBe(false);
    expect(withQuestion.preOptimizationScore).toBeGreaterThan(withoutQuestion.preOptimizationScore);
  });

  // ─── CTA Detection ──────────────────────────────────────────

  it('detects call to action', () => {
    const result = analyzeContent('Great post! What do you think? Reply below.');
    expect(result.hasCTA).toBe(true);
  });

  // ─── External Link Penalty ──────────────────────────────────

  it('penalizes external links', () => {
    const withLink = analyzeContent('Check out my blog at https://example.com for more tips.');
    const withoutLink = analyzeContent('Check out my thread below for more tips.');
    expect(withLink.hasExternalLink).toBe(true);
    expect(withoutLink.hasExternalLink).toBe(false);
    expect(withLink.preOptimizationScore).toBeLessThan(withoutLink.preOptimizationScore);
  });

  // ─── Length Optimization ────────────────────────────────────

  it('classifies optimal length correctly', () => {
    const optimal = analyzeContent('A'.repeat(85)); // 85 chars = optimal
    const tooShort = analyzeContent('Hi'); // 2 chars = too short
    expect(optimal.lengthCategory).toBe('optimal');
    expect(tooShort.lengthCategory).toBe('too-short');
    expect(optimal.preOptimizationScore).toBeGreaterThan(tooShort.preOptimizationScore);
  });

  // ─── Formatting Signals ─────────────────────────────────────

  it('detects line breaks for scannability', () => {
    const withBreaks = analyzeContent('This is an important point\nHere is another key insight\nAnd a final takeaway');
    const noBreaks = analyzeContent('This is an important point and here is another key insight and also a final takeaway');
    expect(withBreaks.hasLineBreaks).toBe(true);
    expect(withBreaks.lineCount).toBe(3);
    expect(noBreaks.hasLineBreaks).toBe(false);
    // Both should be in similar length category (medium), so line breaks should boost score
    expect(withBreaks.preOptimizationScore).toBeGreaterThan(noBreaks.preOptimizationScore);
  });

  it('detects list formatting', () => {
    const result = analyzeContent('My tips:\n1. First tip\n2. Second tip\n3. Third tip');
    expect(result.hasListFormat).toBe(true);
  });

  // ─── Hashtags ───────────────────────────────────────────────

  it('handles hashtags appropriately', () => {
    const optimal = analyzeContent('Great post #coding #tech');
    const excessive = analyzeContent('Post #1 #2 #3 #4 #5 #6');
    expect(optimal.hashtagCount).toBe(2);
    expect(excessive.hashtagCount).toBe(6);
    expect(optimal.preOptimizationScore).toBeGreaterThan(excessive.preOptimizationScore);
  });

  // ─── Emoji ──────────────────────────────────────────────────

  it('handles emoji strategically', () => {
    const optimal = analyzeContent('Great post! 🚀💡');
    const excessive = analyzeContent('😀😃😄😁😆😅🤣😂');
    expect(optimal.emojiCount).toBe(2);
    expect(excessive.emojiCount).toBeGreaterThan(5);
    expect(optimal.preOptimizationScore).toBeGreaterThan(excessive.preOptimizationScore);
  });

  // ─── Mentions ───────────────────────────────────────────────

  it('detects mentions', () => {
    const result = analyzeContent('Thanks @alice and @bob for the insights!');
    expect(result.hasMention).toBe(true);
    expect(result.mentionCount).toBe(2);
  });

  // ─── Suggestions ────────────────────────────────────────────

  it('generates suggestions for missing hook', () => {
    const result = analyzeContent('Just a regular tweet without a hook.');
    const hookSuggestion = result.suggestions.find(s => s.signal === 'hook');
    expect(hookSuggestion).toBeDefined();
    expect(hookSuggestion?.impact).toBe('high');
  });

  it('generates suggestions for missing question', () => {
    const result = analyzeContent('This is a statement.');
    const questionSuggestion = result.suggestions.find(s => s.signal === 'question');
    expect(questionSuggestion).toBeDefined();
    expect(questionSuggestion?.message).toContain('150x');
  });

  it('warns about external links', () => {
    const result = analyzeContent('Check this out: https://example.com');
    const linkWarning = result.suggestions.find(s => s.signal === 'external-link');
    expect(linkWarning).toBeDefined();
    expect(linkWarning?.type).toBe('warning');
    expect(linkWarning?.impact).toBe('high');
  });

  it('suggests adding CTA', () => {
    const result = analyzeContent('This is just a fact.');
    const ctaSuggestion = result.suggestions.find(s => s.signal === 'cta');
    expect(ctaSuggestion).toBeDefined();
    expect(ctaSuggestion?.impact).toBe('medium');
  });

  // ─── Complex Examples ───────────────────────────────────────

  it('analyzes a well-optimized tweet', () => {
    const result = analyzeContent(
      'What if I told you most people get this wrong?\n\n' +
      'Here are 3 proven strategies:\n' +
      '1. Start with a hook\n' +
      '2. Ask a question\n' +
      '3. End with a CTA\n\n' +
      'What do you think? 🚀'
    );
    expect(result.hasHook).toBe(true);
    expect(result.hasQuestion).toBe(true);
    expect(result.hasCTA).toBe(true);
    expect(result.hasListFormat).toBe(true);
    expect(result.hasLineBreaks).toBe(true);
    expect(result.preOptimizationScore).toBeGreaterThan(70);
    // Should have fewer suggestions since it's already well-optimized
    expect(result.suggestions.length).toBeLessThan(5);
  });

  it('analyzes a poorly optimized tweet', () => {
    const result = analyzeContent(
      'hi check out my blog at mysite.com and also follow me at instagram.com/user ' +
      'and facebook.com/page #please #follow #me #now #viral #content #growth #tips'
    );
    expect(result.hasExternalLink).toBe(true);
    expect(result.hasHook).toBe(false);
    expect(result.hasQuestion).toBe(false);
    expect(result.hashtagCount).toBeGreaterThan(3);
    expect(result.preOptimizationScore).toBeLessThan(50);
    // Should have many suggestions for improvement
    expect(result.suggestions.length).toBeGreaterThan(5);
  });

  // ─── Edge Cases ─────────────────────────────────────────────

  it('handles empty string', () => {
    const result = analyzeContent('');
    expect(result.charCount).toBe(0);
    expect(result.wordCount).toBe(0);
    expect(result.preOptimizationScore).toBeGreaterThanOrEqual(0);
  });

  it('handles single character', () => {
    const result = analyzeContent('a');
    expect(result.charCount).toBe(1);
    expect(result.lengthCategory).toBe('too-short');
  });

  it('handles exactly 280 characters', () => {
    const result = analyzeContent('A'.repeat(280));
    expect(result.charCount).toBe(280);
    expect(result.isThread).toBe(false);
    expect(result.lengthCategory).toBe('long');
  });

  it('handles exactly 281 characters (thread threshold)', () => {
    const result = analyzeContent('A'.repeat(281));
    expect(result.charCount).toBe(281);
    expect(result.isThread).toBe(true);
    expect(result.lengthCategory).toBe('thread-needed');
  });
});
