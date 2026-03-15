# Belief Live

> On-chain conviction scoring for Solana tokens. Measures holder behavior, not price.

**Status:** Live at [belief-live.vercel.app](https://belief-live.vercel.app)
**Stack:** Next.js · Neon Postgres · Helius API · Vercel
**Source:** Private for now — code will be published here when ready.

---

## What It Does

Belief Live scans a token's holder base and produces a **Belief Score** — a composite 0–100 metric that measures how much of the supply is in "believing" hands vs. trading hands.

It answers: *are people holding this because they believe in it, or just waiting to sell?*

---

## The Scoring Model (Supply-Conviction Model)

| Component | Weight | What it measures |
|-----------|--------|-----------------|
| Supply in Diamond Hands | 30% | % of supply held by wallets that haven't sold in 6mo+ and held 180+ days |
| Weighted Avg Hold Time | 25% | Balance-weighted average days held across all scanned wallets |
| % Never Sold 6mo | 20% | % of holders with zero sells in the last 6 months |
| Supply in Super Diamond Hands | 14.25% | % of supply held by wallets that have NEVER sold and held 180+ days |
| Weighted Age % | 9.5% | How long holders have held relative to the token's full lifespan |
| Distribution Bonus | 5% | Penalizes top-heavy supply concentration |

**Diamond Hands:** No sells in 6 months AND held for 180+ days.
**Super Diamond Hands:** NEVER sold AND held for 180+ days.

---

## The Verify-It-Yourself Script

Don't trust the numbers — check them. The standalone scanner is published on the [/verify page](https://belief-live.vercel.app/verify). Copy the script, run it with your own Helius API key, and compare results.

This is the principle the project is built on: **open methodology, checkable outputs.**

---

## How to Contribute

The site is live but there's ongoing work:
- **Token coverage** — request scans for tokens you want tracked
- **UI improvements** — charts, filtering, comparison views
- **Methodology feedback** — if you find a flaw in the scoring model, open an issue

→ [Request a scan or suggest an improvement](../../../../issues/new)

---

## Technical Notes

- Tokens with >15K holders use stratified sampling (top 50 + 1,450 random wallets)
- Swap history only — "never sold" means never swapped via DEX, not direct transfers
- Full scan of a 2K-holder token uses ~2,500 Helius credits
- Runs on Vercel (frontend + API routes) + Neon Postgres (scan results storage)

---

## Privacy & Keys

If you're building something similar, the required keys are:
- `HELIUS_API_KEY` — get a free key at [dev.helius.xyz](https://dev.helius.xyz)
- `DATABASE_URL` — any Postgres instance works (Neon has a free tier)

**Never commit these to a public repo.** Store them in `.env.local` and make sure `.env*` is in your `.gitignore`. See the [privacy guide](../../guides/privacy-and-keys.md) for the full checklist.
