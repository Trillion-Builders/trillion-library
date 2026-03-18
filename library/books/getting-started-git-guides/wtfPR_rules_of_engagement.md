# GitHub 101 — How This All Works

You don't need to be a developer to contribute here. But you do need to understand a few concepts — not because they're technical, but because they're the rules of the game.

This guide covers everything from zero.

---

## Why Does This Process Exist?

Before we explain *what* anything is, here's *why* it works the way it does.

This repo is a shared library. Multiple people write to it. If anyone could push anything at any time with no review, bad information, broken code, or low-effort content would pile up fast. The whole thing degrades.

Somebody could unknowingly or knowingly put bad code or malicious code on our local computers. 

So we built a gate.

> **Every change to this library gets reviewed by a human before it's accepted.**

That reviewer is protecting you — and the next person who reads this. It's the community's immune system. It means when you find something in this library, someone vouched for it.

That's what GitHub's pull request system enables. Here's how it works.

---

## The Core Concepts

### What is a Repository (Repo)?

A repo is the folder that holds everything — all the files, all the history, all the changes ever made. Think of it as a Google Drive folder, except every edit is tracked forever with a timestamp and a name attached to it.

This repo is: `github.com/Trillion-Builders/trillion-library`

---

### What is `main`?

`main` is the **official, approved version** of the library.

It's the branch that everyone sees when they visit the repo. It only contains things that have been reviewed and approved. Nothing lands in `main` without going through a pull request first.

Think of `main` as the published book. You don't scribble in the published book — you edit a draft first.

---

### What is a Branch?

A branch is your **personal draft copy** of the repo.

When you want to make a change, you create a branch — a separate version of the files that's all yours. You make your edits there. It doesn't affect anyone else until you're ready to share it.

Once you're done, you submit a **pull request** to merge your branch into `main`.

---

### What is a Pull Request (PR)?

A pull request is you saying: **"I made some changes. Will you review them and add them to the library?"**

It's not a push — it's a *request*. You're asking the community to pull your work in.

A maintainer (org owner) looks at what you changed, leaves comments if needed, and either approves it or asks for revisions. Once approved, your changes merge into `main` and you're part of the history permanently.

---

## The Flow — How a Contribution Works

```
              YOU                          THE LIBRARY
              ───                          ───────────

         [main branch]
              │
              │  you create a branch
              ▼
        [your-branch]
              │
              │  you make changes
              │  (edit a file, add a guide, fix a typo)
              │
              ▼
        [your-branch]  ──── Pull Request ────►  REVIEW
                                                   │
                                            owner looks at it
                                            leaves comments
                                            asks questions
                                                   │
                                            ✅ Approved?
                                                   │
                                                   ▼
                                           [main branch] ◄── your changes live here now
                                           your name is in
                                           the commit history
                                           forever
```

---

## What This Means for You

1. **You can't accidentally break anything.** Your work lives on your branch until a human approves it. The library is safe.

2. **Your name is attached to everything you contribute.** GitHub tracks every line. Your handle shows up next to your work in the commit history — permanently.

3. **Small contributions are real contributions.** A typo fix is a PR. A one-line addition is a PR. You don't need to write a book to participate.

4. **If you're stuck, ask.** Open an issue. Comment on the PR. Someone will help you get it merged.

---

## Ready to Make Your First Contribution?

Follow the step-by-step in [CONTRIBUTING.md](../CONTRIBUTING.md) — it walks you through your first PR start to finish, no terminal required.

Want to go deeper on GitHub, AI tools, and building your first agent? Check the full guide library at [4nbt-daily.vercel.app/build](https://4nbt-daily.vercel.app/build).

---

*The community spends time reviewing your work because they care about what's in this library. Return the favor when you're ready.*
