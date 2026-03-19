# Project Idea List

A shitty list of ideas to consider building. Inspiration to get the juices flowing. The list below are lightweight easy-ish to create apps that could get added to this shared repo. 

These aren't specs — they're starting points. The best version of each one is whatever you make it.

---

## The Constraints

Before you pick one, understand what works here:

**Anon-friendly.** No logins, no accounts, no data sent anywhere. Everything runs on the user's machine or in their browser. Nothing tracked.

**Clone and run.** Someone shouldn't need to understand code to use what you build. They clone the repo, run one command (or just open a file), and it works.

**No shared secrets.** No API keys hardcoded. No server you have to run for other people. If it needs a key, the user brings their own.

**Three tiers:**
- **Tier 1 — Open in browser.** A single HTML file. Double-click it, it works. Zero setup, zero commands.
- **Tier 2 — One command.** Clone the repo, run `python3 app.py` or `npm run dev`. Works locally.
- **Tier 3 — Bring your key.** Needs a Helius or Claude API key. User gets their own (both have free tiers). You never see their key.

---

## Getting Started — Lightweight App Ideas

Start here if this is your first project. These are small, achievable, and immediately useful to the community.

### Tier 1 — Open in browser (pure HTML/CSS/JS)

**Random TB Quote**
Open the file, get a random line from the Testament. Refresh for a new one. One file, zero dependencies, satisfying to build and use.

**TB Manifesto Poster**
The core TB beliefs rendered as a clean typographic poster. Screenshot it, print it, use it as a wallpaper. Static and beautiful.

**Commitment Clock**
Set a goal and a deadline. The clock runs in the browser and saves your progress with localStorage so it persists across sessions. Private to you.

**Jargon Detector**
Paste any piece of writing. It highlights banned words (the ones Jack Butcher never uses) in red and gives you a clean/dirty word count. Pure string matching — no AI needed. Teaches the TB voice by showing what violates it.

**"Is This Worth Building?" Scorecard**
A short checklist: novelty, usefulness, teachability, TB alignment. Score your idea out of 10. Visual output, copyable result.

**9-Word Challenge**
A writing box that counts your words and won't let you submit until you're under 10. Forces compression. One of the most useful writing tools you can build in an afternoon.

**Bear Card Generator**
Enter a bear name and a one-line description. Generates a shareable card styled like the TB aesthetic. Downloadable image.

**Build-a-Bear Personality Quiz**
Answer 8 questions, get matched to a TrillionBears archetype with a description and a bear. Pure HTML, no data leaves the page, shareable result.

**The Builder's Daily Question**
One question a day from a curated list: "What did you ship today?" "Who did you teach something to?" localStorage tracks streaks. Tiny but sticky.

---

### Tier 2 — One command (local app)

**Thread Scaffolder**
Write your points in plain English. The app formats them into a numbered thread with a hook and a close. Handles structure so you focus on substance.

**Vocabulary Checker**
Paste any piece of writing. It highlights words that don't match TB's voice and shows you a score. Like the Jargon Detector but deeper — checks tone, sentence length, word choice.

**Swipe File**
A local, searchable collection of posts, lines, and ideas that hit. Tag by structure (contrast pair, reframe, one-liner). Saves to localStorage. Your personal creative reference, built over time.

**Idea Backlog Board**
A local Kanban board (To Build / Building / Shipped) that saves to localStorage. No account, no sync, no tracking. Your private build board.

**Build Log**
One line per day: what did you ship? Visual streak calendar of outputs, not inputs. Shows you the compounding effect of showing up every day.

**Contrast Pair Generator**
Type one idea. It suggests alliterative contrast pairs in JB style — "Complexity / Clarity. Default / Design." Teaches the core Jack Butcher move by making you do it.

**One-Sentence Pitch**
A structured form: `[what it does] for [who] without [the thing they hate]`. Won't submit until all three fields are under 8 words. Output is a copyable one-liner.

**First Commit Ceremony**
Open after your very first GitHub commit. Enter your username, it fetches your first commit via the public GitHub API and generates a "day one" card. Marks the moment.

**Anon Feedback Drop**
A form that formats anonymous feedback into a GitHub issue template you can copy-paste. Bridges the "I have thoughts but don't want to post publicly" gap.

**Testament Miner**
Surfaces random lines from the 8 Testament books as writing prompts. "Riff on this today." The source material is already in the repo. One click, one line, one direction.

**Content Calendar**
A simple local UI for planning weekly content drops. Who's posting what, which format, who's amplifying. Markdown at its core, wrapped in a clean interface.

**Hook Library**
Every time a post lands well, pull the opening line and save it. A community collection of proven hooks organized by structure (contrast pair, conditional, imperative, observation). The repo's shared swipe file.

**Library Search**
A local search UI over all the markdown files in the repo. Type a keyword, see matching excerpts across the Testament, library, and guides. Pure JS, reads files client-side.

**"Do It Badly" Timer**
25 minutes. Pick something to build. Clock runs. When it hits zero, you post what you have — complete or not. Forces the first version into existence.

---

### Tier 3 — Bring your key (Helius or Claude API)

**Wallet Watcher**
Paste any Solana wallet address. See SOL balance, top tokens, recent activity. Runs locally using the public Helius RPC. Intro to on-chain data — no key needed for basic balance checks.

**Token Holder Scanner**
Paste a mint address and your Helius key. Get a breakdown of holder distribution: whales, dolphins, small holders. Lightweight version of what Belief Live does under the hood.

**Wallet History Viewer**
Paste a wallet and your Helius key. Get a clean timeline of swaps and transfers. Good introduction to what Helius can do and how on-chain data is structured.

**Bear Downloader UI**
A web UI for the Python script already in the repo. Paste your Helius key, click download, watch it run. Wraps existing functionality with a friendlier face. Good "make an existing script better" project.

**Bear Trait Explorer**
Loads TrillionBears NFT metadata locally. Filter and browse by trait. No images needed — just the JSON. Good intro to working with on-chain data without needing a full app.

**Tweet Like TrillionBear** ⭐
The real voice training tool. Scrape and distill [tb-twts.com](https://tb-twts.com/) — TrillionBear's full tweet archive — then use it as the training corpus to generate new tweets in his exact voice. Paste a topic or idea, get back something that sounds like it came from him. Needs Claude API. This one is the most powerful of the bunch because the source material is pure signal — years of actual posts, not summaries. Someone needs to own this.

**Write Like TrillionBear**
Paste any idea or draft. Get it rewritten in TB's voice using the Testament as reference material. User brings their Claude API key. The source material for training it is already in the repo.

**"Jack It" Rewriter**
Paste verbose writing. Strips jargon, compresses sentences, outputs the Jack Butcher version. Before/after view. Needs Claude API. Immediately useful for anyone writing for the community.

**Angle Generator**
One topic in, five angles out. Forces you to see the same idea five ways before you decide which to publish. The content lever that most people skip.

**Content Multiplier**
One idea in, four outputs: a 9-word tweet, a thread hook, a TG message, a one-liner for a visual. Same core, different containers. Teaches the "idea is the asset, format is packaging" principle by showing it.

**"What Should I Build?" Generator**
Answer 6 questions about your skills and interests. Get 3 project ideas matched to where you are. Teaches ideation by example, gets people unstuck fast.

---

## Key Themes

A few patterns across all of these — worth understanding before you pick one.

**Output over input.** The best tools in this list create something: a card, a compressed sentence, a scored idea, a formatted thread. Consumption tools are easy to build but don't compound. Build things that make other people produce.

**Teach by doing.** The Jargon Detector teaches the TB voice better than any guide because it shows you the violation in your own writing. The 9-Word Challenge teaches compression by forcing it. Tools that teach through use are more valuable than tools that explain.

**The repo is the database.** A lot of these don't need an external API. The Testament, the prompt library, the tools list, the guides — it's all in here. Build tools that surface and remix what's already in the repo before you reach for external data.

**Constraints create creativity.** The best first projects in this list have a hard constraint built in: under 10 words, one sentence, 25 minutes. Constraints aren't limitations — they're the design. They're also what makes a project feel finished.

**Small and shippable beats big and abandoned.** Every idea on this list can be shipped in a weekend. Resist the urge to add features before v1 exists. A working Random TB Quote app is worth more to this community than a half-built content platform.

---

## How to Claim One

1. Open a Discussion in the [Ideas category](https://github.com/Trillion-Builders/trillion-library/discussions) with: `[Claiming] [Project Name]`
2. Drop a one-line note on what you'll build and when you'll have a v1
3. Build it — share progress in Telegram
4. When it's done, open a PR to add it to `projects/` with your own folder
5. Update this list to mark it claimed

---

*This list grows. If you have an idea that fits the constraints, add it — open a PR or drop it in Discussions.*
