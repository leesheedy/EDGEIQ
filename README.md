# EdgeIQ — AI Sports Betting Analysis Platform

AI-powered Australian sports betting analysis. Scrapes TAB odds via Playwright, runs analysis through Claude AI, surfaces high-value recommendations with full reasoning, and manages bankroll intelligently.

---

## Features

- **TAB Scraper** — Playwright-based server-side scraper for horse racing, NRL, AFL, soccer, NBA, cricket, tennis
- **AI Analysis Engine** — Claude AI returns structured recommendations with confidence score, EV, Kelly stake, and full reasoning
- **Bankroll Management** — Kelly criterion staking, P&L tracking, ROI analysis
- **Bet Confirmation** — CONFIRM opens TAB directly to the specific market; all bets tracked
- **Learning System** — AI calibration chart, performance by sport, learning injection into future prompts
- **SMS Alerts** — Optional Twilio SMS for high-confidence bets
- **Dark UI** — Dense power-user layout with confidence arc gauges, live odds pulse, sparkline charts

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | Zustand |
| Charts | Recharts |
| Backend | Node.js, Express, TypeScript |
| Scraping | Playwright (server-side) |
| AI | Anthropic Claude API |
| Database | Supabase (PostgreSQL) |
| Scheduling | node-cron |
| SMS | Twilio |
| Frontend deploy | Vercel |
| Backend deploy | Railway or Render |

---

## Project Structure

```
edgeiq/
├── frontend/           React + Vite app
│   ├── src/
│   │   ├── components/ Reusable UI (BetCard, ConfidenceGauge, etc.)
│   │   ├── screens/    Page views (Dashboard, PendingBets, Racing, etc.)
│   │   ├── store/      Zustand stores
│   │   ├── lib/        API client, utilities
│   │   └── types/      Shared TypeScript types
│   └── package.json
├── backend/            Express API + scrapers
│   ├── src/
│   │   ├── scrapers/   Playwright TAB scraper + enrichment
│   │   ├── services/   AI engine, bankroll, notifications, scheduler
│   │   ├── routes/     REST API endpoints
│   │   └── types/      Shared TypeScript types
│   └── package.json
├── database/
│   └── schema.sql      Supabase PostgreSQL schema
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier)
- An [Anthropic](https://console.anthropic.com) API key

### 1. Database Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `database/schema.sql`
3. Copy your **Project URL** and **service_role key** from Project Settings → API

### 2. Backend Setup

```bash
cd backend
npm install
npm run install:browsers   # Install Playwright Chromium
cp .env.example .env       # Fill in your env vars
npm run dev
```

**Required environment variables** (`.env`):

```env
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-...

# Optional — for TAB scraping
TAB_USERNAME=your-tab-email@example.com
TAB_PASSWORD=your-tab-password

# Optional — for SMS alerts
TWILIO_ACCOUNT_SID=ACxxxxxx
TWILIO_AUTH_TOKEN=xxxxxx
TWILIO_FROM=+61400000000
TWILIO_TO=+61400000001

# Server config
PORT=3001
FRONTEND_URL=http://localhost:5173
SCRAPE_INTERVAL_MINUTES=3
CONFIDENCE_THRESHOLD=65
SMS_CONFIDENCE_THRESHOLD=80
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/events` | List upcoming events |
| GET | `/api/analyses/pending` | Pending bet recommendations |
| POST | `/api/analyses/analyse/:eventId` | Trigger AI analysis for event |
| GET | `/api/bets` | List all bets |
| POST | `/api/bets` | Confirm a bet |
| PATCH | `/api/bets/:id/settle` | Settle a bet (WON/LOST/VOID) |
| GET | `/api/bankroll/stats` | Bankroll statistics |
| GET | `/api/bankroll/history` | Balance history |
| GET | `/api/settings` | Get app settings |
| PUT | `/api/settings` | Update settings |
| GET | `/api/scraper/status` | Scraper status |
| POST | `/api/scraper/trigger` | Trigger manual scrape |
| GET | `/api/learning/calibration` | AI calibration data |
| GET | `/api/learning/by-sport` | Performance by sport |

---

## Deployment

### Backend → Railway

1. Create account at [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Set environment variables in Railway dashboard
4. Add build command: `npm install && npx playwright install chromium --with-deps && npm run build`
5. Start command: `npm start`

### Backend → Render

1. Create account at [render.com](https://render.com)
2. New Web Service → connect GitHub repo
3. Build command: `cd backend && npm install && npx playwright install chromium --with-deps && npm run build`
4. Start command: `cd backend && npm start`
5. Set environment variables in Render dashboard

### Frontend → Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. From `frontend/` directory: `vercel`
3. Set environment variable: `VITE_API_URL=https://your-railway-or-render-url.com`
4. Update `vite.config.ts` proxy target to your deployed backend URL

---

## Configuration (In-App Settings)

All settings are configurable from the **Settings** screen:

| Setting | Default | Description |
|---------|---------|-------------|
| Confidence Threshold | 65% | Minimum AI confidence to show bets |
| Max Stake % | 5% | Maximum Kelly stake as % of bankroll |
| Staking Mode | Kelly | Kelly or flat staking |
| Scrape Interval | 3 min | How often to scrape TAB |
| SMS Threshold | 80% | Minimum confidence for SMS alert |
| Learning System | On | Inject past performance into AI prompts |

---

## How It Works

1. **Scraping**: Every N minutes, Playwright scrapes tab.com.au for all upcoming markets
2. **Enrichment**: ESPN API and racing sites add form, H2H, injury data
3. **AI Analysis**: Each event is sent to Claude with a structured prompt including all available data
4. **Filtering**: Only events above the confidence threshold appear in Pending Bets
5. **Confirmation**: User reviews the AI reasoning and clicks CONFIRM — TAB opens in a new tab
6. **Settlement**: After the event, mark WON/LOST/VOID to update bankroll and train the learning system
7. **Learning**: Past performance summaries are injected into future AI prompts for continuous improvement

---

## Important Notes

- TAB scraping is for personal use only — respect TAB's terms of service
- Credentials are stored as backend environment variables and never exposed to the browser
- Betting involves risk — always bet responsibly
- The AI confidence score is not a guarantee of outcome

---

## License

MIT
