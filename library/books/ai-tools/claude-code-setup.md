# Claude Code Setup

**Go from zero to shipping your first project.**

Claude Code is an AI agent that lives in your terminal and builds software from plain English instructions. You describe what you want. It writes the code, fixes the bugs, and tells you how to deploy it.

This guide gets you set up and building on day one.

---

## What You Need

- A Mac or Windows computer
- A Claude Pro subscription ($20/month at [claude.ai](https://claude.ai))
- 30 minutes

That's it. No coding experience required.

---

## Step 1: Install Node.js

Claude Code requires Node.js to run.

1. Go to [nodejs.org](https://nodejs.org)
2. Download the **LTS** version (the one that says "Recommended For Most Users")
3. Run the installer
4. When it's done, open your terminal and type:

```bash
node --version
```

If you see a version number (like `v20.x.x`), you're good.

**How to open your terminal:**
- Mac: press `Cmd + Space`, type "Terminal", hit enter
- Windows: search for "Command Prompt" or "PowerShell" in the Start menu

---

## Step 2: Install Claude Code

In your terminal, run:

```bash
npm install -g @anthropic-ai/claude-code
```

Wait for it to finish, then verify it worked:

```bash
claude --version
```

---

## Step 3: Log In

```bash
claude
```

The first time you run this, it'll open a browser window and ask you to log in with your Claude account. Do that, approve the permissions, and come back to the terminal.

You're in.

---

## Step 4: Build Something

Create a folder for your project and open it:

```bash
mkdir my-first-project
cd my-first-project
claude
```

Now just tell it what you want to build. Examples to try:

```
Build me a simple personal homepage with my name, a short bio, and links to Twitter and GitHub. Use HTML and Tailwind CSS.
```

```
Build a countdown timer to [date]. Make it look clean and modern.
```

```
Build a page that shows the current price of SOL and BTC, updated every 30 seconds.
```

Watch it work. When it's done, it'll tell you how to run it.

---

## Step 5: Run Your Project

Claude Code will give you a command to run your project locally — usually something like:

```bash
npm run dev
```

Open your browser and go to `http://localhost:3000`. That's your project running on your computer.

---

## Step 6: Deploy It Live

Once it works locally, tell Claude Code to deploy it:

```
Walk me through deploying this to Vercel so it has a real URL I can share.
```

It'll guide you through the whole thing. You'll need a free [Vercel account](https://vercel.com).

When it's done, you'll have a live URL. That's a real thing you built and shipped.

---

## Tips

**It's a conversation.** Don't try to describe your whole project in one message. Start simple, see what it builds, then ask for changes. "Make the background darker." "Add a button that copies the link." "Fix the spacing on mobile."

**When something breaks, paste the error.** Just copy the error message and paste it in. Claude Code will fix it.

**Save your prompts.** When you find a prompt that produces something good, write it down. The [Prompt Library](../claude-code-prompts/README.md) is a good place to add it.

**You don't need to understand the code.** Not at first. The goal is to ship something. Understanding comes from doing it repeatedly, not from studying before you start.

---

## What's Next

- Browse the [Prompt Library](../claude-code-prompts/README.md) for prompts that work
- Join the community in Telegram and share what you built
- Check out [active projects](../../../projects/) if you want to contribute to something already in progress
