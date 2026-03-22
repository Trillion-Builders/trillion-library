# X Bookmark Synthesis — Claude Code Guide

When a user opens this project in Claude Code, guide them through the following workflow.

## First-Time Setup

If no `.env` file exists, walk the user through setup:

1. **Create an X Developer App**
   - Go to console.x.com → Apps → create a new app (or select existing)
   - Go to Settings → User authentication settings → Set up
   - Set App permissions to `Read`
   - Set Type of App to `Native App` (this enables PKCE — no client secret needed)
   - Set Callback URL to `http://localhost:8080/callback`
   - Set Website URL to anything (e.g. `https://example.com`)
   - Save and copy the **Client ID**

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and paste the Client ID.

3. **First fetch**
   ```bash
   node fetch-bookmarks.mjs --full
   ```
   This opens the browser for OAuth consent (one-time). After authorizing, it fetches up to 200 bookmarks and saves them to `pulls/YYYY-MM-DD/raw-bookmarks.json`.

## Synthesizing Bookmarks

After a fetch completes, read the raw bookmarks file and:

1. Scan all bookmarks and identify 6-10 topic clusters based on content
2. Propose the categories to the user for approval
3. Once approved, create markdown digest files in `pulls/YYYY-MM-DD/digests/`:
   - One file per category (e.g. `01-ai-tools.md`, `02-crypto.md`)
   - Each entry should include: tweet text, author (@handle), link to tweet, and any expanded URLs
   - Sort by engagement (bookmark_count + like_count) within each category
4. Create a `README.md` index in the digests folder listing all categories with counts

## Incremental Pulls

For subsequent runs, just use:
```bash
node fetch-bookmarks.mjs
```
This only fetches bookmarks added since the last pull. Same synthesis workflow applies.

## Important Notes

- **All personal data stays local.** The `.gitignore` excludes `.env`, `tokens.json`, `fetch-state.json`, `pulls/`, `digests/`, and `raw-bookmarks.json`. Never commit these files.
- **Costs:** ~$0.05 per 100 bookmarks fetched via X API pay-per-use. Token refreshes are free.
- **Node 18+ required** for native `fetch` support.
- **Zero dependencies** — only Node built-ins are used.
