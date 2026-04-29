# MatchDay ⚽

A full-stack football competition & live scores platform — like Livescores, Flashscore, SofaScore.

## Project Structure

```
matchday/
├── frontend/        # Next.js 14 (App Router) + Tailwind CSS
├── backend/         # Node.js + Fastify + PostgreSQL + Redis
├── mobile/          # React Native / PWA scorer app (Phase 2)
└── docs/            # Schema, API reference, deployment guides
```

## Quick Start

### 1. Backend
```bash
cd backend
cp .env.example .env        # fill in your DB + Redis URLs
npm install
npm run db:migrate          # run all SQL migrations
npm run db:seed             # optional sample data
npm run dev                 # starts on http://localhost:4000
```

### 2. Frontend
```bash
cd frontend
cp .env.example .env.local  # set NEXT_PUBLIC_API_URL
npm install
npm run dev                 # starts on http://localhost:3000
```

## Features (Phase 1 — Local Competition MVP)
- Live scores with WebSocket real-time updates
- League standings / tables
- Match detail: lineups, stats, events (goals, cards, subs)
- Player profiles & competition stats
- Competition brackets & fixtures
- Admin panel: manage teams, players, matches, events
- Role-based auth: Admin / Scorer / Viewer

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 14, Tailwind CSS, Socket.io-client, SWR |
| Backend | Node.js, Fastify, Socket.io, Zod (validation) |
| Database | PostgreSQL 15 |
| Cache / Realtime | Redis 7 |
| Auth | JWT + refresh tokens |
| Mobile scorer | PWA (Phase 1) → React Native (Phase 2) |
| 3rd-party data | API-Football / SportRadar (Phase 3) |
