# IMPL-007: Supabase Migration + Auth — Design Doc

**Author:** Coder - Otavio  
**Date:** 2026-02-08  
**Status:** Design Doc (implementation blocked on external accounts)

---

## 1. Overview

This document defines the Supabase database schema, authentication flow, and Row Level Security (RLS) policies for ViralQuill MVP.

**Dependencies:**

- Supabase project (pending — requested via #human-action)
- X API OAuth 2.0 credentials (pending)
- OpenAI API key (pending — for embeddings)

---

## 2. Authentication

### OAuth 2.0 Flow (X / Twitter)

ViralQuill uses **Supabase Auth** with X (Twitter) as the OAuth provider.

```
User → "Login with X" → Supabase Auth → X OAuth 2.0 (PKCE) → Callback → Session
```

**Scopes requested:**

- `tweet.read` — Read user's tweets and timeline
- `tweet.write` — Post tweets on behalf of user
- `users.read` — Read user profile
- `offline.access` — Refresh tokens for background scheduling

**Token storage:**

- Access token + refresh token stored in `user_tokens` table (encrypted)
- Supabase Auth manages session/JWT
- Tokens refreshed automatically via `offline.access` scope

### User Session

- Supabase JWT with custom claims: `x_user_id`, `x_username`
- RLS policies enforce per-user data isolation
- 30-day session expiry with refresh

---

## 3. Database Schema

### 3.1 `profiles` — User profiles (synced from X)

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  x_user_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  tweet_count INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT FALSE,
  tweep_cred SMALLINT,  -- 0-100, algorithm signal
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Users can only read/update their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
```

### 3.2 `user_tokens` — Encrypted X API tokens

```sql
CREATE TABLE user_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  x_access_token TEXT NOT NULL,   -- encrypted at rest
  x_refresh_token TEXT NOT NULL,  -- encrypted at rest
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Only server-side access (service role key)
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
-- No client-side policies — accessed only via server functions
```

### 3.3 `drafts` — User content drafts

```sql
CREATE TABLE drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  rewritten_text TEXT,
  target_tone TEXT DEFAULT 'professional',
  is_thread BOOLEAN DEFAULT FALSE,
  thread_position SMALLINT,
  parent_draft_id UUID REFERENCES drafts(id) ON DELETE SET NULL,
  algo_score_raw REAL,
  algo_score_normalized SMALLINT,  -- 0-100
  algo_score_bucket TEXT,          -- low/medium/high/viral
  algo_score_breakdown JSONB,
  judge_result JSONB,              -- {grammar, fluency, tone, overall, feedback}
  media JSONB DEFAULT '[]',        -- [{type, url, altText}]
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'posted', 'failed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_drafts_user_id ON drafts(user_id);
CREATE INDEX idx_drafts_status ON drafts(user_id, status);

ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own drafts" ON drafts FOR ALL USING (auth.uid() = user_id);
```

### 3.4 `scheduled_posts` — Post scheduling queue

```sql
CREATE TABLE scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_id UUID NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  posted_at TIMESTAMPTZ,
  x_tweet_id TEXT,                 -- populated after posting
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'posting', 'posted', 'failed', 'cancelled')),
  error_message TEXT,
  retry_count SMALLINT DEFAULT 0,
  media JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_pending ON scheduled_posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_scheduled_user ON scheduled_posts(user_id, status);

ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own scheduled posts" ON scheduled_posts FOR ALL USING (auth.uid() = user_id);
```

### 3.5 `post_analytics` — Engagement tracking

```sql
CREATE TABLE post_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  x_tweet_id TEXT NOT NULL,
  draft_id UUID REFERENCES drafts(id) ON DELETE SET NULL,
  predicted_score JSONB,           -- AlgoScore snapshot at post time
  actual_metrics JSONB,            -- {likes, retweets, replies, impressions, bookmarks, profileClicks}
  accuracy REAL,                   -- predicted vs actual deviation
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_analytics_tweet ON post_analytics(x_tweet_id);
CREATE INDEX idx_analytics_user ON post_analytics(user_id);

ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own analytics" ON post_analytics FOR SELECT USING (auth.uid() = user_id);
```

### 3.6 `viral_tweets` — Reference dataset (Kaggle seed + API enrichment)

```sql
CREATE TABLE viral_tweets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  x_tweet_id TEXT UNIQUE,
  text TEXT NOT NULL,
  author_id TEXT,
  author_followers INTEGER,
  author_is_premium BOOLEAN,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  link_clicks INTEGER DEFAULT 0,
  media_type TEXT,                 -- image/video/gif/none
  has_external_link BOOLEAN DEFAULT FALSE,
  is_thread BOOLEAN DEFAULT FALSE,
  thread_length SMALLINT,
  char_count SMALLINT,
  word_count SMALLINT,
  hashtag_count SMALLINT,
  posted_at TIMESTAMPTZ,
  algo_score_raw REAL,
  algo_score_bucket TEXT,
  source TEXT DEFAULT 'kaggle',    -- kaggle/api/user-contributed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_viral_tweets_bucket ON viral_tweets(algo_score_bucket);
CREATE INDEX idx_viral_tweets_score ON viral_tweets(algo_score_raw DESC);

-- No RLS — public read for scoring reference
ALTER TABLE viral_tweets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read" ON viral_tweets FOR SELECT USING (auth.role() = 'authenticated');
```

### 3.7 `engagement_percentiles` — Bucket calibration

```sql
CREATE TABLE engagement_percentiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL DEFAULT 'global',  -- 'global' or x_user_id
  metric TEXT NOT NULL,                   -- 'algo_score_raw'
  p25 REAL NOT NULL,
  p50 REAL NOT NULL,
  p75 REAL NOT NULL,
  p95 REAL NOT NULL,
  p99 REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scope, metric)
);

ALTER TABLE engagement_percentiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read" ON engagement_percentiles FOR SELECT USING (auth.role() = 'authenticated');
```

### 3.8 `content_embeddings` — Originality / dedup corpus

```sql
-- Requires pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE content_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE,
  source TEXT NOT NULL,             -- 'draft' | 'viral_tweet' | 'user_post'
  source_id TEXT,                   -- reference ID
  text_preview TEXT,                -- first 100 chars
  embedding vector(1536) NOT NULL,  -- text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast similarity search
CREATE INDEX idx_embeddings_hnsw ON content_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_embeddings_user ON content_embeddings(user_id);

ALTER TABLE content_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own embeddings" ON content_embeddings FOR ALL USING (auth.uid() = user_id);
```

### 3.9 `user_quota` — X API rate limit tracking

```sql
CREATE TABLE user_quota (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reads_used INTEGER DEFAULT 0,
  writes_used INTEGER DEFAULT 0,
  period_start TIMESTAMPTZ DEFAULT date_trunc('month', NOW()),
  last_read_at TIMESTAMPTZ,
  last_write_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_quota ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own quota" ON user_quota FOR SELECT USING (auth.uid() = user_id);
```

---

## 4. Key Design Decisions

### 4.1 Rate Limit Strategy

**App-level monthly cap (Basic: 15K reads / 50K writes) shared across ALL users.**

This is the critical constraint:

- 10 users = 1,500 reads/user/month
- 100 users = 150 reads/user/month → unsustainable on Basic

**Mitigation patterns:**

1. **Redis/edge caching** (Upstash) — cache popular tweets, timelines, search results
2. **Stale-while-revalidate** — serve cached data while refreshing in background
3. **Batch reads** — `/2/tweets` batch endpoint (100 IDs per request)
4. **User-level quota tracking** — `user_quota` table + graceful degradation
5. **Shared enrichment** — viral_tweets table serves all users

### 4.2 Token Security

- X API tokens stored encrypted in `user_tokens`
- Only accessible via Supabase server functions (service role key)
- Never exposed to client-side JavaScript
- Refresh token flow for long-lived sessions

### 4.3 Embedding Strategy

- Model: `text-embedding-3-small` @ 1536 dimensions (FINAL)
- Storage: pgvector `vector(1536)`
- Index: HNSW for fast cosine similarity
- Similarity threshold: 0.7 for originality/dedup check
- Recalibrate threshold if model ever changes

### 4.4 Engagement Percentiles

- Global percentiles computed from `viral_tweets` dataset
- Per-creator percentiles when user has >= 50 posts
- Recomputed weekly via Supabase cron/edge function

---

## 5. Migration Plan

### Migration 001: Initial Schema

All tables above in a single initial migration.

### Migration 002: Seed Data

Populate `viral_tweets` from Kaggle dataset (top 3 datasets identified by Researcher).
Compute initial `engagement_percentiles`.

### Migration 003: pgvector + Embeddings

Enable pgvector extension, create `content_embeddings` table + HNSW index.

---

## 6. Supabase Functions (Edge Functions)

| Function                | Trigger              | Purpose                                        |
| ----------------------- | -------------------- | ---------------------------------------------- |
| `refresh-x-token`       | Scheduled (hourly)   | Refresh expiring X API tokens                  |
| `post-scheduled`        | Cron (every minute)  | Post scheduled tweets                          |
| `collect-analytics`     | Cron (every 6 hours) | Fetch metrics for posted tweets                |
| `recompute-percentiles` | Cron (weekly)        | Recalculate engagement percentiles             |
| `check-originality`     | On draft save        | Compare embedding vs corpus (< 0.7 similarity) |

---

## 7. Implementation Checklist

- [ ] Create Supabase project (blocked on account)
- [ ] Run Migration 001 (initial schema)
- [ ] Configure X OAuth 2.0 provider in Supabase Auth
- [ ] Implement token encryption/decryption
- [ ] Test RLS policies
- [ ] Seed viral_tweets from Kaggle
- [ ] Deploy edge functions
- [ ] Configure Upstash Redis for caching layer

---

## 8. Tech Stack Integration

```
Client (Next.js) → Supabase Client SDK → Supabase (Postgres + Auth + Edge Functions)
                                        → pgvector (embeddings)
                                        → Upstash Redis (caching)
                 → OpenAI API (rewrite, judge, embed)
                 → X API v2 (read/write tweets)
```
