# Privacy & Keys: Before You Publish

A checklist for anyone sharing a project publicly for the first time. Read this before you push.

---

## The One Rule

**Secrets go in `.env` files. `.env` files never get committed.**

That's it. Everything else below is how to make sure that rule holds.

---

## Step 1: Set Up Your `.gitignore` Before Your First Commit

The moment you create a project, create a `.gitignore` and add these lines:

```
# Environment variables — never commit these
.env
.env.local
.env.*
!.env.example

# OS clutter
.DS_Store
Thumbs.db

# Build output
node_modules/
dist/
.next/
```

The `!.env.example` exception lets you commit a template file with placeholder values (no real secrets) so other contributors know what variables they need.

---

## Step 2: Never Put a Real Key in Source Code

Bad — hardcoded directly in a file:
```ts
const API_KEY = "d21a8f3b9c...";  // ← never do this
```

Good — read from environment:
```ts
const API_KEY = process.env.HELIUS_API_KEY;
```

Search your project for your actual key values before pushing. If you find them in source files, remove them and rotate the key immediately.

---

## Step 3: Check What You're Actually Committing

Before any `git push` to a public repo, run:

```bash
git diff --staged
```

Read through it. If you see anything that looks like a real key (long random string, a URL with credentials, a password), stop and remove it before committing.

---

## Step 4: What to Do If You Accidentally Push a Secret

**Act fast. The key is compromised the moment it's pushed — even if you delete it in the next commit. Git history is public and permanent.**

1. **Rotate the key immediately.** Go to the service (Helius, Anthropic, etc.) and generate a new one. The old one is dead regardless.
2. **Remove the secret from the repo.** Delete the file or replace the value with a placeholder.
3. **Rewrite the history** to remove the commit entirely using `git filter-repo` or GitHub's secret scanning tools.
4. **Verify the new key works** before assuming you're clean.

GitHub will often email you when it detects a pushed secret — that's GitHub Secret Scanning. Don't ignore those emails.

---

## Step 5: Identity Checklist for Anon Projects

If you're contributing under a pseudonym:

- [ ] Set local git config to your anon email: `git config user.email "you@anon.com"`
- [ ] Set local git name: `git config user.name "YourHandle"`
- [ ] Check before pushing: `git log --format="%ae %an" -5` — confirm the right identity shows
- [ ] Make sure your anon email is **not** linked to your real GitHub account (GitHub maps commit emails to accounts)

---

## Common Keys and Where They Live

| Key | Where to Get It | Store As |
|-----|----------------|----------|
| Helius API Key | [dev.helius.xyz](https://dev.helius.xyz) | `HELIUS_API_KEY` |
| Anthropic API Key | [console.anthropic.com](https://console.anthropic.com) | `ANTHROPIC_API_KEY` |
| OpenAI API Key | [platform.openai.com](https://platform.openai.com) | `OPENAI_API_KEY` |
| Twitter/X OAuth | [developer.x.com](https://developer.x.com) | `TWITTER_API_KEY`, `TWITTER_API_SECRET_KEY`, etc. |
| Neon / Postgres | [neon.tech](https://neon.tech) | `DATABASE_URL` |

---

## `.env.example` Template

Always include this in your project — it's the "what you need to run this" guide for contributors:

```bash
# Copy this file to .env.local and fill in your own values
# Never commit .env.local

HELIUS_API_KEY=your_helius_key_here
DATABASE_URL=your_postgres_connection_string_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

No real values. Just the shape.
