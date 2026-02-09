/**
 * Tests for content signal detection functions.
 */

import { describe, it, expect } from 'vitest';
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
} from '../signals';

describe('detectQuestion', () => {
  it('detects direct question marks', () => {
    expect(detectQuestion('What do you think?')).toBe(true);
    expect(detectQuestion('Is this correct?')).toBe(true);
  });

  it('detects question words at sentence start', () => {
    expect(detectQuestion('Why does this happen')).toBe(true);
    expect(detectQuestion('How can we improve')).toBe(true);
    expect(detectQuestion('What if everything changed')).toBe(true);
    expect(detectQuestion('When will this end')).toBe(true);
    expect(detectQuestion('Where do we go from here')).toBe(true);
    expect(detectQuestion('Who knew about this')).toBe(true);
  });

  it('detects auxiliary question patterns', () => {
    expect(detectQuestion('Do you agree with this')).toBe(true);
    expect(detectQuestion('Would you like to know more')).toBe(true);
    expect(detectQuestion('Could this be better')).toBe(true);
    expect(detectQuestion('Should we change direction')).toBe(true);
    expect(detectQuestion('Have you seen this')).toBe(true);
    expect(detectQuestion('Are you ready')).toBe(true);
  });

  it('returns false for statements', () => {
    expect(detectQuestion('This is a statement.')).toBe(false);
    expect(detectQuestion('I think this is great')).toBe(false);
    expect(detectQuestion('Check out this amazing thing')).toBe(false);
  });
});

describe('detectHookType', () => {
  it('detects problem-solution hooks', () => {
    expect(detectHookType("Most people waste time on X. Here's the fix:")).toBe('problem-solution');
    expect(detectHookType('The problem with current approaches is...')).toBe('problem-solution');
    expect(detectHookType("Stop doing X. Here's what to do instead.")).toBe('problem-solution');
  });

  it('detects contrarian hooks', () => {
    expect(detectHookType("Everyone says X. They're wrong.")).toBe('contrarian');
    expect(detectHookType("Popular opinion: Y is best. Here's why that's false.")).toBe(
      'contrarian',
    );
    expect(detectHookType("Unpopular take: Z doesn't matter.")).toBe('contrarian');
    expect(detectHookType('Hot take: this changes everything')).toBe('contrarian');
  });

  it('detects number-driven hooks', () => {
    expect(detectHookType('I analyzed 10,000 tweets. Here are 7 patterns.')).toBe('number-driven');
    expect(detectHookType('I spent 3 years studying this.')).toBe('number-driven');
    expect(detectHookType('5 things you need to know about X')).toBe('number-driven');
    expect(detectHookType('10 lessons from building a startup')).toBe('number-driven');
  });

  it('detects story hooks', () => {
    expect(detectHookType('In 2023, I lost everything. Then I discovered...')).toBe('story');
    expect(detectHookType('3 years ago, everything changed.')).toBe('story');
    expect(detectHookType('When I was starting out, I made these mistakes.')).toBe('story');
    expect(detectHookType('I used to think X. Now I know Y.')).toBe('story');
  });

  it('detects question hooks', () => {
    expect(detectHookType('What if everything you knew about X was wrong?')).toBe('question');
    expect(detectHookType('Imagine a world where...')).toBe('question');
    expect(detectHookType('Ever wonder why this happens?')).toBe('question');
  });

  it('detects bold claim hooks', () => {
    expect(detectHookType('This is the only way to succeed at X.')).toBe('bold-claim');
    expect(detectHookType('The secret to viral content:')).toBe('bold-claim');
    expect(detectHookType('One simple trick changed my life.')).toBe('bold-claim');
  });

  it('returns null for generic openings', () => {
    expect(detectHookType('Here are some thoughts on X')).toBeNull();
    expect(detectHookType('Today I want to talk about Y')).toBeNull();
  });
});

describe('detectCTA', () => {
  it('detects engagement CTAs', () => {
    expect(detectCTA('Retweet if you agree')).toBe(true);
    expect(detectCTA('Like if you found this helpful')).toBe(true);
    expect(detectCTA('Reply with your thoughts')).toBe(true);
    expect(detectCTA('Drop a comment below')).toBe(true);
    expect(detectCTA('Share this with someone')).toBe(true);
  });

  it('detects follow/save CTAs', () => {
    expect(detectCTA('Follow me for more tips')).toBe(true);
    expect(detectCTA('Bookmark this for later')).toBe(true);
    expect(detectCTA('Save this thread')).toBe(true);
  });

  it('detects question CTAs', () => {
    expect(detectCTA('What do you think?')).toBe(true);
    expect(detectCTA('Agree? Let me know')).toBe(true);
    expect(detectCTA('Thoughts?')).toBe(true);
  });

  it('returns false for content without CTA', () => {
    expect(detectCTA('This is just a regular statement.')).toBe(false);
    expect(detectCTA('I built something cool today')).toBe(false);
  });
});

describe('detectExternalLink', () => {
  it('detects HTTP/HTTPS URLs', () => {
    expect(detectExternalLink('Check out https://example.com')).toBe(true);
    expect(detectExternalLink('Visit http://mysite.io for more')).toBe(true);
  });

  it('detects URLs without protocol', () => {
    expect(detectExternalLink('Find me at example.com')).toBe(true);
    expect(detectExternalLink('Learn more at mysite.io')).toBe(true);
    expect(detectExternalLink('Get the app: myapp.app')).toBe(true);
  });

  it('returns false for text without links', () => {
    expect(detectExternalLink('This is a regular tweet')).toBe(false);
    expect(detectExternalLink('No links here at all')).toBe(false);
  });
});

describe('detectHashtags', () => {
  it('detects single hashtag', () => {
    const result = detectHashtags('Great post #coding');
    expect(result.has).toBe(true);
    expect(result.count).toBe(1);
  });

  it('detects multiple hashtags', () => {
    const result = detectHashtags('Love #javascript #typescript #react');
    expect(result.has).toBe(true);
    expect(result.count).toBe(3);
  });

  it('returns false for text without hashtags', () => {
    const result = detectHashtags('No hashtags in this tweet');
    expect(result.has).toBe(false);
    expect(result.count).toBe(0);
  });
});

describe('detectEmoji', () => {
  it('detects emoji', () => {
    const result = detectEmoji('Great post! 🚀');
    expect(result.has).toBe(true);
    expect(result.count).toBeGreaterThan(0);
  });

  it('counts multiple emoji', () => {
    const result = detectEmoji('🔥 Amazing 🚀 Love it ❤️');
    expect(result.has).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(3); // Unicode emoji can have variant selectors
  });

  it('returns false for text without emoji', () => {
    const result = detectEmoji('No emoji here');
    expect(result.has).toBe(false);
    expect(result.count).toBe(0);
  });
});

describe('detectMentions', () => {
  it('detects single mention', () => {
    const result = detectMentions('Thanks @user for the tip');
    expect(result.has).toBe(true);
    expect(result.count).toBe(1);
  });

  it('detects multiple mentions', () => {
    const result = detectMentions('Shoutout to @alice @bob @charlie');
    expect(result.has).toBe(true);
    expect(result.count).toBe(3);
  });

  it('returns false for text without mentions', () => {
    const result = detectMentions('No mentions in this tweet');
    expect(result.has).toBe(false);
    expect(result.count).toBe(0);
  });
});

describe('detectListFormat', () => {
  it('detects numbered lists', () => {
    expect(detectListFormat('Here are tips:\n1. First tip\n2. Second tip')).toBe(true);
    expect(detectListFormat('Steps:\n1) Do this\n2) Then that')).toBe(true);
  });

  it('detects bullet lists', () => {
    expect(detectListFormat('Features:\n- Feature A\n- Feature B')).toBe(true);
    expect(detectListFormat('Items:\n• Item 1\n• Item 2')).toBe(true);
    expect(detectListFormat('List:\n* Thing one\n* Thing two')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(detectListFormat('Just a regular paragraph')).toBe(false);
    expect(detectListFormat('No lists here at all')).toBe(false);
  });
});

describe('detectPoll', () => {
  it('detects poll keywords', () => {
    expect(detectPoll('Quick poll: which one do you prefer?')).toBe(true);
    expect(detectPoll('Vote below for your favorite')).toBe(true);
    expect(detectPoll('Option A or Option B?')).toBe(true);
    expect(detectPoll('Which one: Option 1 or Option 2')).toBe(true);
  });

  it('returns false for non-poll text', () => {
    expect(detectPoll('This is just a statement')).toBe(false);
    expect(detectPoll('No voting here')).toBe(false);
  });
});

describe('classifyLength', () => {
  it('classifies too-short', () => {
    expect(classifyLength(10)).toBe('too-short');
    expect(classifyLength(29)).toBe('too-short');
  });

  it('classifies short', () => {
    expect(classifyLength(30)).toBe('short');
    expect(classifyLength(50)).toBe('short');
    expect(classifyLength(70)).toBe('short');
  });

  it('classifies optimal (sweet spot)', () => {
    expect(classifyLength(71)).toBe('optimal');
    expect(classifyLength(85)).toBe('optimal');
    expect(classifyLength(100)).toBe('optimal');
  });

  it('classifies medium', () => {
    expect(classifyLength(101)).toBe('medium');
    expect(classifyLength(150)).toBe('medium');
    expect(classifyLength(200)).toBe('medium');
  });

  it('classifies long', () => {
    expect(classifyLength(201)).toBe('long');
    expect(classifyLength(250)).toBe('long');
    expect(classifyLength(280)).toBe('long');
  });

  it('classifies thread-needed', () => {
    expect(classifyLength(281)).toBe('thread-needed');
    expect(classifyLength(500)).toBe('thread-needed');
  });
});
