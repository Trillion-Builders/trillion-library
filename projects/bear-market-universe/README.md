# Bear Market Universe

> A living media franchise powered by autonomous AI agents, on-chain data, and 255 NFT bears.

**Status:** Building — core agent (The Archivist) is live on X. Additional bears in design.
**Stack:** ElizaOS · Railway · Anthropic API · X/Twitter API · on-chain data feeds
**Live:** [@TheArchivist_Bear](https://x.com) (X)

---

## The Premise

We have 255 unique 3D bear NFTs. We're turning a select cast into autonomous social media characters — each with their own X account, personality, data feed, and audience.

These aren't bots that tweet price alerts. They're characters who live on-chain. They react to real market events, argue with each other publicly, and build ongoing narratives that audiences follow like a show.

**The blockchain writes the script. The bears perform it.**

---

## The Core Rule

**Every bear must justify its existence with a unique content niche or data feed.**

A bear isn't just a personality — it's a personality paired with a data source that gives it something nobody else has to say. The personality makes people follow. The data makes people stay.

---

## The Cast

| Bear | Role | Data Feed | Status |
|------|------|-----------|--------|
| The Archivist | Pattern-matching historian | Wikipedia "On This Day" API | ✅ Live |
| The Degen | Memecoin trader | Real trade bot data | 🔨 Designing |
| The Oracle | Macro analyst | DeFiLlama, CoinGecko, Dune | 🔨 Designing |
| The Shaman | Chaos/culture commentator | CT trending topics | 🔨 Designing |
| The Diamond Hand | Conviction analyst | BeliefScore API | 📋 Spec'd |

---

## Architecture

Each bear is an independent [ElizaOS](https://elizaos.ai) agent instance with its own character file, plugins, and data feed. They run on Railway and share infrastructure but are otherwise fully autonomous.

```
Your Bear
├── character.json        ← personality, voice, style
├── plugins/
│   └── data-feed.ts      ← what the bear knows (real-time)
├── X client              ← where it posts
└── Telegram client       ← where it chats
```

→ Full architecture docs: [docs/architecture.md](./docs/architecture.md)

---

## How to Contribute

- **Propose a new bear** — what data feed + personality? Use the issue template.
- **Improve bear docs** — character files, voice guides, content strategy
- **Build data plugins** — new API integrations for existing bears
- **Create content** — visual templates, data card designs, meme formats
- **Run your own bear** — spin up a character under the Trillion Builders umbrella

→ [Open a project proposal](../../../../issues/new?template=propose-a-project.md)

---

## Want to Build Your Own Agent?

Start with the guides:
- [Your First Agent](../../guides/your-first-agent.md) — beginner walkthrough (coming soon)
- [ElizaOS Docs](https://elizaos.ai) — the framework everything runs on
