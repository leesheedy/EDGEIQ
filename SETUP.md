# EdgeIQ — Complete Setup Guide

This guide walks through every step from zero to a fully working deployment.

---

## Architecture Overview

```
Browser (Netlify)
    │
    │  /api/* calls
    ▼
Netlify proxy redirect
    │
    ▼
Backend (Railway)  ──► Supabase (database)
    │                      │
    ├──► Anthropic API      └─ events, analyses, bets,
    ├──► TAB scraper           bankroll, settings
    └──► Twilio SMS
```

**All API calls go through Netlify's proxy** — the frontend never talks to the backend domain directly. No CORS issues, no mixed content.

---

## Step 1 — Supabase (Database)

> ✅ Schema already applied. Skip if done.

1. Go to [supabase.com](https://supabase.com) → your project `svsrptowhrbvpaddujjn`
2. **Settings → API** — copy two values you'll need later:
   - **Project URL**: `https://svsrptowhrbvpaddujjn.supabase.co`
   - **service_role** key (under "Project API keys" — use service_role, NOT anon)

---

## Step 2 — Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. **API Keys → Create Key**
3. Copy it — looks like `sk-ant-api03-...`
4. Keep it — you'll paste it into Railway and the in-app Settings screen

---

## Step 3 — Deploy Backend to Railway

Railway is the easiest free-tier backend host that supports Playwright (Chrome).

### 3a. Create Railway project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo**
3. Select `leesheedy/EDGEIQ`
4. When asked for **Root Directory**, type: `backend`
5. Railway will detect Node.js automatically

### 3b. Set environment variables

In Railway → your service → **Variables** tab, add each of these:

| Variable | Value | Required? |
|----------|-------|-----------|
| `SUPABASE_URL` | `https://svsrptowhrbvpaddujjn.supabase.co` | ✅ Yes |
| `SUPABASE_SERVICE_KEY` | Your `service_role` key from Step 1 | ✅ Yes |
| `ANTHROPIC_API_KEY` | Your key from Step 2 | ✅ Yes |
| `FRONTEND_URL` | `https://edgeiqsite.netlify.app` | ✅ Yes |
| `PORT` | `3001` | ✅ Yes |
| `NODE_ENV` | `production` | ✅ Yes |
| `TAB_USERNAME` | Your TAB email | Optional |
| `TAB_PASSWORD` | Your TAB password | Optional |
| `SCRAPE_INTERVAL_MINUTES` | `3` | Optional |
| `CONFIDENCE_THRESHOLD` | `65` | Optional |
| `SMS_CONFIDENCE_THRESHOLD` | `80` | Optional |

### 3c. Set build + start commands

In Railway → **Settings** tab:
- **Build command**: `npm install && npx playwright install chromium --with-deps && npm run build`
- **Start command**: `npm start`

### 3d. Get your backend URL

After Railway deploys (2–3 min), go to **Settings → Networking → Generate Domain**.

You'll get something like:
```
https://edgeiq-backend-production.up.railway.app
```

Copy this — you need it in the next step.

---

## Step 4 — Configure Netlify

### 4a. Set BACKEND_URL

1. Go to [app.netlify.com](https://app.netlify.com) → `edgeiqsite`
2. **Site configuration → Environment variables → Add variable**
3. Add:
   | Key | Value |
   |-----|-------|
   | `BACKEND_URL` | `https://edgeiq-backend-production.up.railway.app` |

### 4b. Trigger redeploy

**Deploys → Trigger deploy → Deploy site**

Netlify will now proxy all `/api/*` calls to your Railway backend.

---

## Step 5 — First Launch (In-App Onboarding)

When you open `https://edgeiqsite.netlify.app` for the first time:

1. **Set bankroll** — enter your starting betting budget (e.g. $1000)
2. **Anthropic API key** — paste your `sk-ant-...` key
3. **SMS alerts** — skip for now, configure later
4. Click **Launch EdgeIQ**

---

## Step 6 — Configure TAB Credentials (for scraping)

Without TAB credentials the scraper runs in public-only mode (limited data). To get full odds and race fields:

1. Go to **Settings** in the app
2. Under **TAB Australia**, enter your TAB email and password
3. Click **Save All**
4. These are sent to the backend and stored as database settings — never exposed to the browser

> The scraper logs into TAB using Playwright (headless Chrome on Railway), exactly like a browser would.

---

## Step 7 — Trigger Your First Scrape

1. From the **Dashboard**, click **Refresh** (top right)
2. Or go to **Settings** and watch the scraper status in the sidebar
3. The scraper runs automatically every 3 minutes once the backend is up

**What happens:**
- Playwright navigates to tab.com.au and scrapes all upcoming markets
- Racing: pulls runner name, barrier, jockey, trainer, weight, odds, form
- Sports: NRL, AFL, Soccer, NBA, Cricket — head-to-head + line markets
- Data is stored in Supabase

---

## Step 8 — AI Analysis

Analysis runs automatically after each scrape. You can also trigger it manually:

1. Go to **Pending Bets** — any event above your confidence threshold (default 65%) appears here
2. Each card shows:
   - The AI's recommendation (BET / WATCH / SKIP)
   - Confidence score (0–100)
   - Expected value (positive = edge over market)
   - Suggested stake (Kelly criterion)
   - Full written reasoning

### Tuning the AI

In **Settings → Bankroll & Staking**:

| Setting | What it does |
|---------|-------------|
| **Confidence Threshold** | Only show bets above this score. Start at 65, raise to 70–75 as you learn what works. |
| **Max Stake %** | Kelly can suggest large stakes — cap it. 3–5% is conservative. |
| **Staking Mode** | Kelly = variable stake based on edge. Flat = same amount every bet. Start with Kelly. |

---

## Step 9 — Placing Bets

1. Review a card in **Pending Bets** — expand it to read the full AI reasoning
2. Click **Confirm & Open TAB** — this:
   - Saves the bet to your history
   - Opens TAB directly to that market in a new tab
   - Deducts the stake from your tracked bankroll
3. Place the bet manually on TAB
4. Come back and click **Mark as Placed**

---

## Step 10 — Settling Bets

After the race/game:

1. Go to **Active Bets**
2. Click **WON**, **LOST**, or **VOID** on each bet
3. Your bankroll updates automatically
4. The result feeds into the AI learning system

---

## Step 11 — SMS Alerts (Optional)

Get a text message when a high-confidence bet is found.

### Setup Twilio

1. Create a free account at [twilio.com](https://twilio.com)
2. Get a free phone number (Australian numbers available)
3. From the Twilio console copy:
   - Account SID
   - Auth Token
   - Your Twilio number (From)
4. In EdgeIQ **Settings → SMS Alerts**:
   - Toggle SMS on
   - Paste Account SID, Auth Token, From number, your mobile (To)
   - Set SMS threshold (e.g. 80 = only very high confidence)
   - Click **Test SMS** to verify it works
   - Click **Save All**

---

## Monitoring & Troubleshooting

### Scraper not finding events

- Check **Settings** sidebar — scraper status shows last run time and any errors
- Verify TAB credentials are saved (Settings → TAB Australia)
- Railway logs: railway.app → your service → **Logs** tab

### AI not analysing events

- Confirm Anthropic API key is set (Settings shows "key set" if saved)
- Check Railway logs for `AI analysis failed` errors
- Verify you have Anthropic credits at console.anthropic.com

### 404 / JSON errors in browser console

- Backend is not running — check Railway dashboard
- `BACKEND_URL` is not set in Netlify environment variables
- Trigger a new Netlify deploy after setting env vars

### Bankroll shows $0

- Complete onboarding (the wizard sets your starting balance)
- Or go to **Settings** and the bankroll init runs on first launch

---

## Cost Estimates (monthly)

| Service | Free tier | When you'll pay |
|---------|-----------|-----------------|
| Supabase | 500MB storage, 2GB transfer | When DB grows large |
| Railway | $5 credit/month free | After credit runs out (~50hrs runtime) |
| Netlify | 100GB bandwidth | Unlikely to hit |
| Anthropic | Pay per use | ~$0.003 per analysis (Sonnet) |
| Twilio | $15 credit on signup | ~$0.08 per SMS |

**Typical cost**: $5–15/month for active daily use.

---

## Quick Reference — All Environment Variables

### Railway (backend)
```env
SUPABASE_URL=https://svsrptowhrbvpaddujjn.supabase.co
SUPABASE_SERVICE_KEY=eyJ...          # service_role key
ANTHROPIC_API_KEY=sk-ant-...
FRONTEND_URL=https://edgeiqsite.netlify.app
PORT=3001
NODE_ENV=production
TAB_USERNAME=you@example.com         # optional
TAB_PASSWORD=yourpassword            # optional
SCRAPE_INTERVAL_MINUTES=3
CONFIDENCE_THRESHOLD=65
SMS_CONFIDENCE_THRESHOLD=80
TWILIO_ACCOUNT_SID=ACxxxx            # optional
TWILIO_AUTH_TOKEN=xxxx               # optional
TWILIO_FROM=+61400000000             # optional
TWILIO_TO=+61400000001               # optional
```

### Netlify (frontend)
```env
BACKEND_URL=https://edgeiq-backend-production.up.railway.app
```
