'use client';

import { useState, useCallback, useEffect } from 'react';
import type { AlgoScore } from '@/lib/types';
import type { ContentSignals, Suggestion } from '@/lib/analyzer/signals';

interface AnalysisResult {
  signals: ContentSignals;
  algoScore: AlgoScore;
}

interface RewriteResult {
  rewrittenText: string;
  predictedScore: AlgoScore;
  changes: string[];
  tone: string;
  hookUsed?: string;
}

interface ExampleTweet {
  id: string;
  text: string;
  algoScore: AlgoScore;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
  };
}

const TONE_OPTIONS = [
  'professional',
  'casual',
  'authoritative',
  'humorous',
  'provocative',
  'educational',
] as const;

function ScoreBadge({ score }: { score: AlgoScore }) {
  const colors: Record<string, string> = {
    viral: 'bg-purple-600 text-white',
    high: 'bg-green-600 text-white',
    medium: 'bg-yellow-500 text-black',
    low: 'bg-red-500 text-white',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${colors[score.bucket]}`}
    >
      {score.normalized}/100 · {score.bucket.toUpperCase()}
    </span>
  );
}

function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const icons: Record<string, string> = {
    boost: '🚀',
    warning: '⚠️',
    info: 'ℹ️',
  };
  const borders: Record<string, string> = {
    high: 'border-red-400',
    medium: 'border-yellow-400',
    low: 'border-gray-300',
  };
  return (
    <div
      className={`rounded-lg border-l-4 p-3 bg-white dark:bg-zinc-900 ${borders[suggestion.impact]}`}
    >
      <div className="flex items-start gap-2">
        <span>{icons[suggestion.type]}</span>
        <div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{suggestion.message}</p>
          <p className="text-xs text-zinc-400 mt-1">Impact: {suggestion.impact}</p>
        </div>
      </div>
    </div>
  );
}

function ScoreBreakdownView({ score }: { score: AlgoScore }) {
  const items = [
    { label: 'Replies', value: score.breakdown.replyScore, weight: '×13.5' },
    { label: 'Retweets', value: score.breakdown.retweetScore, weight: '×1' },
    { label: 'Likes', value: score.breakdown.likeScore, weight: '×0.5' },
    { label: 'Bookmarks', value: score.breakdown.bookmarkScore, weight: '×10' },
    { label: 'Profile Clicks', value: score.breakdown.profileClickScore, weight: '×12' },
    { label: 'Dwell Time', value: score.breakdown.dwellScore, weight: '×10' },
  ];
  const maxValue = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Score Breakdown</h3>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-sm">
          <span className="w-28 text-zinc-600 dark:text-zinc-400">{item.label}</span>
          <span className="text-xs text-zinc-400 w-10">{item.weight}</span>
          <div className="flex-1 h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 w-12 text-right">{item.value.toFixed(1)}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 text-sm pt-1 border-t border-zinc-200 dark:border-zinc-700">
        <span className="w-28 font-semibold text-zinc-700 dark:text-zinc-300">Confidence</span>
        <span className="text-xs text-zinc-500">{(score.confidence * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [rewrite, setRewrite] = useState<RewriteResult | null>(null);
  const [examples, setExamples] = useState<ExampleTweet[]>([]);
  const [selectedTone, setSelectedTone] = useState<string>('professional');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'examples'>('editor');

  // Load examples on mount
  useEffect(() => {
    fetch('/api/examples')
      .then((r) => r.json())
      .then((d) => setExamples(d.examples || []))
      .catch(() => {});
  }, []);

  // Analyze on text change (debounced)
  const analyzeText = useCallback(async (value: string) => {
    if (!value.trim()) {
      setAnalysis(null);
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value }),
      });
      const data = await res.json();
      setAnalysis(data);
    } catch {
      /* ignore */
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => analyzeText(text), 300);
    return () => clearTimeout(timer);
  }, [text, analyzeText]);

  const handleRewrite = async () => {
    if (!text.trim()) return;
    setIsRewriting(true);
    try {
      const res = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, tone: selectedTone, includeHook: true }),
      });
      const data = await res.json();
      setRewrite(data);
    } catch {
      /* ignore */
    } finally {
      setIsRewriting(false);
    }
  };

  const applyRewrite = () => {
    if (rewrite) {
      setText(rewrite.rewrittenText);
      setRewrite(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🪶</span>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">ViralQuill</h1>
            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
              LOCAL DEV
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'editor'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              ✏️ Editor
            </button>
            <button
              onClick={() => setActiveTab('examples')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'examples'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              📊 Examples
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'editor' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Draft Editor */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Draft Editor
                  </h2>
                  <span className="text-sm text-zinc-400">
                    {text.length}/280 chars
                    {text.length > 280 && (
                      <span className="text-blue-500 ml-1">
                        · Thread ({Math.ceil(text.length / 260)} tweets)
                      </span>
                    )}
                  </span>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write your post here... Try adding a hook, a question, or a call to action."
                  className="w-full h-40 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                />

                {/* Tone selector + Rewrite button */}
                <div className="flex items-center gap-3 mt-4">
                  <select
                    value={selectedTone}
                    onChange={(e) => setSelectedTone(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    {TONE_OPTIONS.map((tone) => (
                      <option key={tone} value={tone}>
                        {tone.charAt(0).toUpperCase() + tone.slice(1)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleRewrite}
                    disabled={!text.trim() || isRewriting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {isRewriting ? '✨ Rewriting...' : '✨ AI Rewrite'}
                  </button>
                </div>
              </div>

              {/* Rewrite Result */}
              {rewrite && (
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      ✨ AI Rewrite Suggestion
                    </h3>
                    <ScoreBadge score={rewrite.predictedScore} />
                  </div>
                  <p className="text-zinc-800 dark:text-zinc-200 mb-3 whitespace-pre-wrap">
                    {rewrite.rewrittenText}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {rewrite.changes.map((change, i) => (
                      <span
                        key={i}
                        className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded"
                      >
                        {change}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={applyRewrite}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    ✅ Apply Rewrite
                  </button>
                </div>
              )}

              {/* Suggestions */}
              {analysis && analysis.signals.suggestions.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3">
                    💡 Optimization Suggestions
                  </h3>
                  <div className="space-y-2">
                    {analysis.signals.suggestions.map((s, i) => (
                      <SuggestionCard key={i} suggestion={s} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Score Panel */}
            <div className="space-y-4">
              {/* Live Score */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-4">
                  Algorithm Score
                </h2>
                {analysis ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-5xl font-bold text-zinc-900 dark:text-zinc-100">
                        {analysis.algoScore.normalized}
                      </div>
                      <div className="mt-2">
                        <ScoreBadge score={analysis.algoScore} />
                      </div>
                    </div>
                    <ScoreBreakdownView score={analysis.algoScore} />
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-400">
                    {isAnalyzing ? 'Analyzing...' : 'Start typing to see your score'}
                  </div>
                )}
              </div>

              {/* Content Signals */}
              {analysis && (
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3">
                    Content Signals
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Signal
                      label="Hook"
                      active={analysis.signals.hasHook}
                      detail={analysis.signals.hookType}
                    />
                    <Signal label="Question" active={analysis.signals.hasQuestion} />
                    <Signal label="CTA" active={analysis.signals.hasCTA} />
                    <Signal label="Ext. Link" active={analysis.signals.hasExternalLink} bad />
                    <Signal
                      label="Emoji"
                      active={analysis.signals.hasEmoji}
                      detail={`${analysis.signals.emojiCount}`}
                    />
                    <Signal
                      label="Hashtags"
                      active={analysis.signals.hasHashtags}
                      detail={`${analysis.signals.hashtagCount}`}
                    />
                    <Signal label="Line Breaks" active={analysis.signals.hasLineBreaks} />
                    <Signal label="List Format" active={analysis.signals.hasListFormat} />
                  </div>
                  <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Length</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {analysis.signals.lengthCategory.replace('-', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-zinc-500">Pre-opt Score</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {analysis.signals.preOptimizationScore}/100
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Examples Tab */
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              📊 Example Tweets — Scored by Algorithm
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Mock tweets showing how the scoring engine works. Click any to load into editor.
            </p>
            <div className="grid gap-4">
              {examples.map((tweet) => (
                <div
                  key={tweet.id}
                  onClick={() => {
                    setText(tweet.text);
                    setActiveTab('editor');
                  }}
                  className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 cursor-pointer hover:border-blue-400 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap flex-1">
                      {tweet.text}
                    </p>
                    <ScoreBadge score={tweet.algoScore} />
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-zinc-400">
                    <span>❤️ {tweet.metrics.likes.toLocaleString()}</span>
                    <span>🔁 {tweet.metrics.retweets.toLocaleString()}</span>
                    <span>💬 {tweet.metrics.replies.toLocaleString()}</span>
                    <span>👁️ {tweet.metrics.impressions.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-4 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-zinc-400">
          ViralQuill v0.1.0 · 100% Local Dev Mode · No external API calls · Scoring based on X Heavy
          Ranker weights
        </div>
      </footer>
    </div>
  );
}

function Signal({
  label,
  active,
  detail,
  bad,
}: {
  label: string;
  active: boolean;
  detail?: string | null;
  bad?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded ${
        active
          ? bad
            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
          : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400'
      }`}
    >
      <span>{active ? (bad ? '✗' : '✓') : '○'}</span>
      <span>{label}</span>
      {detail && active && <span className="text-xs opacity-70">({detail})</span>}
    </div>
  );
}
