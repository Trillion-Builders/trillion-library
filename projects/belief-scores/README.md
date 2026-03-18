# Belief Live

> On-chain conviction scoring for Solana tokens. Measures holder behavior, not price.

**Status:** Live at [belief-live.vercel.app](https://belief-live.vercel.app)
**Methodology:** Full math walkthrough at [belief-live.vercel.app/methodology](https://belief-live.vercel.app/methodology)
**Stack:** Next.js 16 · Neon Postgres · Helius API · Vercel · Railway

---

## What It Does

Belief Live scans a token's holder base and produces a **Belief Score** — a composite 0–100 metric that measures how much of the supply is in "believing" hands vs. trading hands.

It answers: *are people holding this because they believe in it, or just waiting to sell?*

The key insight: it's not how many wallets believe — it's **how much value is in believing hands**. All metrics are supply-weighted and balance-weighted, not headcount-weighted.

---

## The Scoring Model — Supply-Conviction Model

```
30% — Supply in Diamond Hands        (normalized: 15% supply in DH = 100)
25% — Weighted Avg Hold Time         (balance-weighted, 365 days = 100)
20% — % Holders Never Sold (6mo)     (already 0–100)
15% — Supply in Super Diamond Hands  (normalized: 10% supply = 100)
10% — Weighted Age %                 (time held relative to token lifespan)
```

**Diamond Hands:** No sells in 6 months AND held for 180+ days.
**Super Diamond Hands:** NEVER sold AND held for 180+ days.

### Why Normalize?
Supply-in-DH raw values range 0–12%. Without rescaling, even a 30% weight contributes <4 points. Normalizing so 15% supply in DH = 100 is defensible — even 10% is exceptional for a meme token.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BELIEF LIVE                          │
│                                                             │
│  FRONTEND (Vercel)                                          │
│  ┌──────────┐     ┌──────────────────┐                      │
│  │ Landing  │────▶│ /api/instant-    │────▶  Helius DAS API  │
│  │ page     │     │ metrics (Tier 1) │                      │
│  │          │     │ ~2–5 seconds     │                      │
│  └──────────┘     └──────────────────┘                      │
│                                                             │
│  ┌──────────────────────────────────────────┐               │
│  │ Results /results/[mint]                  │               │
│  │ ├─ Instant: holders, gini, top 20        │               │
│  │ ├─ Supply Lock Bar (conviction %)        │               │
│  │ ├─ Deep: gauges, metrics, score          │               │
│  │ ├─ Float Breakdown (stacked bar)         │               │
│  │ ├─ DH Accumulation Chart (time series)   │               │
│  │ └─ Retention Cohort Chart                │               │
│  └──────────────────────────────────────────┘               │
│                                                             │
│  DEEP SCAN ENGINE (Railway — no timeout limits)             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Fetch all holders via getTokenAccounts (paginated)│   │
│  │ 2. If >15K holders → stratified sample (1,500)       │   │
│  │    Top 50 always + 1,450 random                      │   │
│  │ 3. For each wallet (15 concurrent, 30ms delay):      │   │
│  │    └─ getWalletSwapHistory (100 credits/wallet)      │   │
│  │ 4. Compute per-wallet metrics                        │   │
│  │ 5. Aggregate → DeepMetrics + Composite Score         │   │
│  │ 6. Compute time series (DH accumulation + cohorts)   │   │
│  │ 7. Save everything to Neon Postgres                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  DATABASE (Neon Postgres)                                   │
│  results · scan_queue · wallet_metrics · swap_history       │
│  time_series · composite_score                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Two-Tier Scanning

### Tier 1 — Instant (~2–5 seconds)
From the holder list only. No per-wallet transaction lookups.

| Metric | What it tells you |
|--------|------------------|
| Holder count | Total unique wallets |
| Top 20 holders + identity | Who the whales are |
| Gini coefficient | Supply concentration |
| Holders above 0.1% supply | Meaningful holder count |

### Tier 2 — Deep Scan
Fetches every wallet's full transaction history. Reveals true conviction.

| Metric | What it tells you |
|--------|------------------|
| % Holders never sold (lifetime + 6mo) | Who's actually holding |
| Diamond Hands % | No sells in 6mo AND held 6mo+ |
| Super Diamond Hands % | Never sold, ever |
| Weighted average hold time | How long supply has been sitting |
| Supply in conviction hands | Balance-weighted DH/SDH supply |
| Retention cohorts | Who bought when, who's still here |
| Composite Belief Score (0–100) | The single number |

### Scan Thresholds

| Token Size | Type | Wallets Scanned | Credits |
|------------|------|-----------------|---------|
| ≤15K holders | Full scan | All | up to 1.5M |
| >15K holders | Sampled | 1,500 (top 50 + 1,450 random) | ~150K |

Sampled tokens get a yellow **Sampled** badge on the scoreboard. Supply-weighted metrics are marked approximate.

---

## Visualizations

After a deep scan, the results page shows four charts:

1. **Supply Lock Bar** — one-glance horizontal bar: conviction hands vs free float
2. **Float Breakdown** — stacked bar segmenting supply into Super DH / DH / Zero-Sell / Free Float
3. **DH Accumulation Chart** — area chart showing *when* diamond hand wallets accumulated their positions
4. **Retention Cohort Chart** — bar chart: buyer cohorts by month, % still holding today

---

## Data Reliability Notes

- **Swap history only** — tracks DEX swaps, not direct transfers or OTC. "Never sold" means never swapped via DEX.
- **Holder-only wallets** — wallets with no DEX history are counted as "never sold." Could be airdrops, migrations, or dead wallets.
- **Weighted metrics reduce noise** — top 50 holders always included in samples and hold significant supply.
- **Three-tier data retention** — every scan stores raw swap history, per-wallet metrics, and aggregates. Allows instant rescoring if the formula changes, zero extra API calls.

---

## The Verify-It-Yourself Script

Don't trust the numbers — check them. A standalone scanner is published on the [/verify page](https://belief-live.vercel.app/verify). Copy the script, run it with your own Helius API key, and compare outputs.

This is the principle the project is built on: **open methodology, checkable outputs.**

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Charts | Recharts |
| Data | Helius DAS API, Enhanced Transactions API, Wallet Identity |
| Database | Neon Postgres (serverless) |
| Hosting | Vercel (frontend) + Railway (deep scan worker) |

---

## How to Contribute

The site is live. Ongoing work:

- **Token coverage** — request scans for tokens you want tracked
- **UI improvements** — charts, filtering, comparison views
- **Methodology feedback** — if you find a flaw in the scoring model, open an issue
- **Code** — source will be published here when ready

→ [Request a scan or suggest an improvement](../../../../issues/new)

---

## Roadmap

### v2 — Next Up
- [ ] Delta scans — only re-fetch wallets whose balance changed since last scan
- [ ] Retry logic with exponential backoff for rate limits
- [ ] Price feed integration (Birdeye/Jupiter) for conviction vs outcome analysis

### v3 — Later
- [ ] Conviction vs outcome scatter plot (Belief Score × 90-day return)
- [ ] Resilience comparison — two tokens through the same sell-off
- [ ] "Before the pump" case study
- [ ] Historical re-scans — track a token's score over time
- [ ] Compare two tokens side-by-side
- [ ] Public API for third-party integrations

---

## Privacy & Keys

If you're building something similar, the required keys are:
- `HELIUS_API_KEY` — get a free key at [dev.helius.xyz](https://dev.helius.xyz)
- `DATABASE_URL` — any Postgres instance works (Neon has a free tier)

**Never commit these to a public repo.** See the [privacy guide](../../library/books/getting-started-git-guides/privacy-and-keys.md) for the full checklist.
