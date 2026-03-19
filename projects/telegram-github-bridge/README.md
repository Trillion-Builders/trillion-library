# Project: Telegram ↔ GitHub Bridge

**Status: Open — looking for a builder**
**Difficulty: Beginner–Intermediate**
**Estimated build time: 1–2 weekends**

---

## What This Is

A bot that connects the Trillion Builders Telegram group to the GitHub repo — so active builders in TG stay in sync with what's happening in the repo without having to check GitHub manually.

The goal: **Telegram stays the pulse. GitHub stays the record.** The bridge makes them talk to each other.

---

## The Problem It Solves

Right now, things get built and discussed in Telegram, and separately tracked in GitHub. These two worlds don't talk. People miss new Discussions, good ideas get lost, and momentum that starts in a Telegram thread doesn't make it into the repo.

This bridge closes that gap.

---

## What It Does (MVP)

**GitHub → Telegram (notifications)**

- New GitHub Discussion opened → post in TG with link
- New "Show and Tell" submission → post in TG with title + link
- New project proposal (Issue) → post in TG

**Telegram → GitHub (weekly digest, manual trigger)**

- Someone types `/digest` in TG → bot posts a summary of open Discussions, active projects, and unresolved Q&As from the past week
- Bonus: `/ideas` to list open Ideas category discussions

**That's it for v1.** Simple. Useful. Shippable.

---

## What It's NOT (keep out of scope for v1)

- Two-way sync (don't try to mirror TG messages to GitHub)
- AI summarization (nice to have later, not now)
- Complex slash commands

---

## How It Works (Technical Overview)

```
GitHub Webhooks
    ↓
A small server (Node.js or Python, hosted on Railway or Vercel)
    ↓
Telegram Bot API
    ↓
Posts messages to the TB Telegram group
```

**The key pieces:**
1. **GitHub Webhook** — GitHub sends a POST request to your server whenever a Discussion or Issue is created
2. **Your server** — receives the webhook, formats a message, sends it to Telegram
3. **Telegram Bot** — a bot you create via [@BotFather](https://t.me/botfather) that can post to the group

All three pieces are well-documented and free to set up.

---

## Resources to Get Started

| What | Link |
|------|------|
| GitHub Webhooks docs | https://docs.github.com/en/webhooks |
| Telegram Bot API | https://core.telegram.org/bots/api |
| node-telegram-bot-api (npm) | https://github.com/yagop/node-telegram-bot-api |
| python-telegram-bot | https://python-telegram-bot.org |
| Railway (free hosting) | https://railway.app |
| Vercel (free hosting) | https://vercel.com |

---

## Prompts to Build It With Claude Code

Use these to get started — you don't need to know how any of this works before you begin.

**Kickoff prompt:**
```
I want to build a Telegram bot that listens to GitHub webhooks.
When a new GitHub Discussion is created in the repo
"Trillion-Builders/trillion-library", it should post a message
to a Telegram group with the Discussion title and link.

Use Node.js. I'll deploy to Railway.
Walk me through building this step by step.
```

**Adding more events:**
```
The bot already posts when a new Discussion is created.
Now add support for posting when a new Issue is opened
with the label "project-proposal".
Format the message to look like:
"New project idea: [title] → [link]"
```

**Adding the /digest command:**
```
Add a /digest command to the bot.
When someone types /digest in the Telegram group,
the bot should fetch all open GitHub Discussions
from the past 7 days using the GitHub API
and post a formatted summary.
```

---

## What You'll Learn Building This

- How webhooks work (a foundational concept for almost everything)
- How to build and deploy a simple server
- How bots work on Telegram
- How to use the GitHub API
- How to deploy a backend to Railway or Vercel

These are skills that transfer to dozens of other projects.

---

## How to Claim This Project

1. Open a Discussion in the [Ideas category](https://github.com/Trillion-Builders/trillion-library/discussions) with the title: `[Claiming] Telegram ↔ GitHub Bridge`
2. Drop a quick note on what you'll build and your timeline
3. Start building — share progress in Telegram and in the Discussion thread
4. When it's live, open a PR to update this README with the deployed link and what you learned

---

## Future Ideas (v2+)

- Daily digest posted automatically at a set time (cron job)
- AI-generated summary of the week's top Discussions
- `/build` command to look up a specific project's status
- Notification when a Discussion gets marked as "Answered"
- Pull in Belief Live data for context (tokenomics pulse alongside community updates)

---

*First builder to ship this gets permanent credit in this file and the main README.*
