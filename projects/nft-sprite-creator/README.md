# NFT Sprite Creator

Character to sprite sheet. Automated.

**Live:** [nft-sprite-creator.vercel.app](https://nft-sprite-creator.vercel.app)

## What It Does

Pick a character (TrillionBears NFT or upload your own). AI converts it to pixel art, generates walk/jump/attack/idle sprite sheets, removes backgrounds, extracts animation frames, and drops everything into a playable sandbox. Five steps.

## Features

- **Character Input** — Select a TrillionBears NFT (327 bears) or upload any image
- **AI Pixel Art Conversion** — Gemini converts characters to 32-bit pixel art style
- **Sprite Sheet Generation** — 4-frame sheets (2x2 grid) for walk, jump, attack, idle
- **Background Removal** — Client-side canvas pixel scanning (white → transparent)
- **Smart Frame Extraction** — Auto-detect dividers, trim-to-content, normalize sizes
- **Animation Preview** — Adjustable FPS, direction controls
- **Parallax Backgrounds** — 3-layer AI-generated backgrounds matching the character's world
- **Sandbox** — Walk, jump, attack in a side-scrolling parallax environment (PixiJS)
- **DIY Guide** — All prompts exposed so you can run the workflow manually with any AI tool
- **Download Everything** — Sprite sheets, individual frames, at every step

## Tech Stack

- Next.js 14 (App Router)
- Google Gemini (`gemini-2.5-flash-image`) via AI SDK (`@ai-sdk/google`)
- HTML Canvas (background removal, frame extraction)
- PixiJS (sandbox)
- Vercel (hosting, env vars)

## Setup

```bash
npm install
```

Create `.env.local`:
```
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
```

```bash
npm run dev
```

## Controls

### Animation Preview
- `D` / `→` — Walk right
- `A` / `←` — Walk left
- `Space` — Stop

### Sandbox
- `A` / `←` — Walk left
- `D` / `→` — Walk right
- `W` / `↑` — Jump
- `J` — Attack

## Learnings

### AI image generation for sprite sheets is 80% prompting, 20% post-processing

Gemini generates sprite sheets as 2x2 grids on white backgrounds, but the frames are never pixel-perfect aligned. The real work is:
1. Background removal via canvas alpha threshold (not an API call — client-side is faster and free)
2. Auto-detecting frame boundaries by scanning for transparent pixel columns/rows
3. Trimming each frame to its content bounds
4. Normalizing all frames to the same dimensions so animations don't jitter

### Image hosting math matters

327 TrillionBears PNGs at 1440x1440 = 935MB. Converted to 256x256 WebP thumbnails = 5.9MB total. `sips` (macOS built-in) handles the resize, `cwebp` handles the format conversion. Lazy loading + small thumbnails = smooth grid even on mobile.

### Client-side data URL conversion solves server-side fetch issues

Server-side API routes can't resolve relative URLs like `/bears/foo.webp`. Instead of complicating the server, convert images to data URLs on the client before sending to the API. `FileReader.readAsDataURL()` on a fetched blob — simple and universal.

### AI SDK v6 type gymnastics

The AI SDK `GeneratedFile` type doesn't cleanly expose `mediaType`/`base64Data` as typed properties. The practical fix: cast through `unknown` to `Record<string, unknown>`, then check multiple property names (`mediaType || mimeType`, `base64Data || uint8ArrayData || data`). Not elegant, but it handles provider inconsistencies.

### Background removal doesn't need an API

White background → transparent is a canvas operation. Scan every pixel, if R/G/B are all above a threshold (240), set alpha to 0. Runs in milliseconds client-side. No API call, no credits, no latency.

### `downlevelIteration` saves you from Set spread errors

If you spread Sets (`[...mySet]`) in TypeScript with a target below ES2015, you need `"downlevelIteration": true` in tsconfig. The error is cryptic. The fix is one line.
