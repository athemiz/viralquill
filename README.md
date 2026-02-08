# ViralQuill

AI-powered viral content optimizer for X (Twitter). Rewrite and optimize your posts to match what the platform algorithm rewards.

## Vision

Help content creators post viral content on X (Twitter) by analyzing algorithm signals, rewriting posts for maximum engagement, and predicting performance before publishing.

## Core Features (planned)

- **Algorithm-Aware Scoring** - Pre-publish engagement prediction using open-sourced algorithm weights
- **AI Content Rewriting** - Optimize tone, hooks, formatting, and thread structure
- **Engagement Prediction** - Score posts before publishing with confidence intervals
- **Optimal Timing** - Recommend best posting windows based on audience data
- **Thread Optimizer** - Structure multi-post threads for maximum completion rates

## Tech Stack (recommended by research)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 15 + React + TypeScript | Industry standard SaaS 2026 |
| UI | Tailwind + shadcn/ui | Fast dev, consistent design |
| Backend | Next.js API + Supabase | Unified TS codebase |
| Database | Supabase (PostgreSQL) | Auth, realtime, RLS |
| AI Primary | OpenAI GPT-4o | Best creative writing quality |
| Embeddings | text-embedding-3-small | Viral tweet similarity search |
| Vector DB | Supabase pgvector | Same Postgres instance |
| Auth | Supabase Auth + X OAuth | Built-in + social login |
| Hosting | Vercel | Seamless Next.js deployment |
| Payments | Stripe | Subscription management |

## Key Differentiator

No competitor uses the open-sourced X algorithm weights to score posts before publishing. This is our primary technical moat.

## Status

**Phase**: Research complete, backlog structuring in progress.

## Team

Built by [Athemiz](https://github.com/athemiz) with an AI agent team.

## License

TBD
