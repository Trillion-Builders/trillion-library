# X Bookmark Synthesis

> Pull your X bookmarks, cluster them by topic, synthesize into organized digests. Incremental — only fetches what's new.

**Status:** Live
**Stack:** Node.js (zero dependencies) · X API v2 · OAuth 2.0 PKCE
**Cost:** ~$0.05 per 100 bookmarks (X API pay-per-use)

---

## What

A lightweight tool that fetches your X/Twitter bookmarks via the API, dumps them to JSON, and then Claude Code reads through them, clusters by topic, and writes organized markdown digests you approve before saving.

Each pull lands in a dated folder. Future pulls are incremental — they only grab bookmarks added since your last fetch, so you're not re-processing or re-paying for old ones.

## Why

Bookmarks pile up. You save things with intent, then never go back. This tool turns that graveyard into organized reference material — categorized by theme, with every link and author preserved.

It's also a clean example of: find a resource, fork it, tweak it for your use case, share it back. The entire thing was built in one Claude Code session.

## Who

**Lead:** [@monke_kov](https://x.com/monke_kov)
**Skills needed:** Node.js basics, X API account (pay-per-use)
**Contribute:** Better categorization prompts, multi-user support, alternative export formats

## How to Get Started

### Prerequisites
- Node.js 18+
- An X Developer account with pay-per-use credits ([console.x.com](https://console.x.com))

### 1. Set Up Your X API App

1. Go to [console.x.com](https://console.x.com) → **Apps** → create a new app (or use existing)
2. Go to **Settings** → **User authentication settings** → **Set up**
3. Configure:
   - **App permissions:** `Read`
   - **Type of App:** `Native App` (enables PKCE — no client secret needed)
   - **Callback URL:** `http://localhost:8080/callback`
   - **Website URL:** anything (e.g. `https://example.com`)
4. Save — copy your **Client ID**

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env` and paste your Client ID:
```
X_CLIENT_ID=your-client-id-here
```

### 3. First Run (Full Fetch)

```bash
node fetch-bookmarks.mjs --full
```

This will:
1. Open your browser for OAuth consent (one-time)
2. You click "Authorize app"
3. Fetches up to 200 of your most recent bookmarks
4. Saves to `pulls/YYYY-MM-DD/raw-bookmarks.json`
5. Tokens are cached — you won't need to re-authorize unless they expire

### 4. Synthesize with Claude Code

Open this folder in Claude Code and ask:
```
Read the raw bookmarks in pulls/YYYY-MM-DD/raw-bookmarks.json,
cluster them by topic, and write categorized digest MDs in
pulls/YYYY-MM-DD/digests/
```

Claude will propose categories, you approve, then it writes the digests.

### 5. Future Pulls (Incremental)

```bash
node fetch-bookmarks.mjs
```

Only fetches bookmarks added since your last pull. Same dated folder pattern.

## How It Works

```
node fetch-bookmarks.mjs
        │
        ▼
┌───────────────┐     OAuth 2.0 PKCE      ┌──────────┐
│  tokens.json  │◄────(auto-refresh)──────▶│  X API   │
└───────────────┘                          └────┬─────┘
                                                │
┌────────────────┐    stop at last known ID     │
│ fetch-state.json│◄────(incremental)───────────┘
└────────────────┘
        │
        ▼
  pulls/YYYY-MM-DD/
  └── raw-bookmarks.json     ← Full tweet data
  └── digests/               ← Claude-generated MDs
      ├── 01-category.md
      ├── 02-category.md
      └── README.md          ← Index + top signal
```

## Costs

| Action | Cost |
|--------|------|
| 100 bookmarks | $0.05 |
| User lookup | $0.01 |
| Token refresh | Free |
| **Typical pull (50 new bookmarks)** | **~$0.04** |

You need an X API account with pay-per-use credits. No monthly subscription required. Check your balance at [console.x.com](https://console.x.com) → Credits.

## How to Contribute

- Better categorization — fork and improve the CLAUDE.md prompts
- Export formats — add HTML, RSS, or Obsidian vault export
- Multi-user support — let multiple people share one instance
- Template digests — pre-built templates for specific niches (crypto, dev tools, marketing)
- Cross-platform browser open — support `xdg-open` (Linux) and `start` (Windows) alongside macOS `open`
- Digest merge — combine multiple dated pulls into a single "best of" digest
- Configurable categories — let users define their own topic clusters in a config file
- Bookmark search — grep across all historical pulls for a keyword or author

---

*Built during a single Claude Code session. Zero dependencies. MIT licensed.*
