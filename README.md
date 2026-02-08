# ViralQuill 🪶

Viral content optimizer for X (Twitter). Uses the X Heavy Ranker algorithm weights to score, rewrite, and optimize posts for maximum engagement.

## Tech Stack

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Backend**: Supabase (Phase 2)
- **AI**: OpenAI GPT-4o / GPT-4o-mini + text-embedding-3-small
- **Hosting**: Vercel (Phase 2)
- **Testing**: Vitest + Testing Library

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+

### Setup

```bash
# Clone the repo
git clone https://github.com/athemiz/viralquill.git
cd viralquill

# Install dependencies
npm install

# Copy environment config
cp .env.example .env.local

# Run dev server
npm run dev

# Run tests
npm test
```

### Available Scripts

| Script                  | Description          |
| ----------------------- | -------------------- |
| `npm run dev`           | Start dev server     |
| `npm run build`         | Production build     |
| `npm run lint`          | Run ESLint           |
| `npm run format`        | Format with Prettier |
| `npm test`              | Run tests (Vitest)   |
| `npm run test:watch`    | Tests in watch mode  |
| `npm run test:coverage` | Tests with coverage  |

## Project Structure

```
src/
├── app/              # Next.js App Router pages
├── components/       # React components
│   ├── ui/           # Generic UI components
│   ├── editor/       # Draft editor (Phase 2)
│   ├── scoring/      # Score display components
│   ├── analytics/    # Analytics dashboard (Phase 3)
│   └── layout/       # Layout components
├── config/           # App configuration
├── hooks/            # Custom React hooks
├── lib/              # Core business logic
│   ├── scoring/      # Algorithm scoring engine
│   ├── services/     # External service integrations
│   │   └── llm/      # LLM provider abstraction
│   ├── types/        # TypeScript interfaces
│   └── utils/        # Utility functions
├── services/         # API route services
└── test/             # Test setup and helpers
```

## Algorithm Scoring

Based on X's open-source Heavy Ranker weights:

| Signal                 | Weight | Relative to Like |
| ---------------------- | ------ | ---------------- |
| Reply (author engaged) | 75     | 150x             |
| Reply                  | 13.5   | 27x              |
| Profile click + engage | 12     | 24x              |
| Conversation click     | 11     | 22x              |
| Dwell time (2+ min)    | 10     | 20x              |
| Bookmark               | 10     | 20x              |
| Retweet                | 1      | 2x               |
| Like                   | 0.5    | 1x (baseline)    |

## Phases

- **Phase 1** (current): Foundation — scaffolding, scoring engine, types, LLM abstraction (mock mode)
- **Phase 2**: Core features — Supabase, auth, draft editor, AI rewriter, score display
- **Phase 3**: Scheduling, analytics dashboard, content format advisor

## License

Private — All rights reserved.
