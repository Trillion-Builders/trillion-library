# Sprite Sheet Pipeline — No APIs, Just Prompts

> Turn any character concept into a playable 2D sprite sheet using tools you already have open.
> Zero code. Zero API keys. Just guided prompts and a free image editor.

---

## What You Need

| Tool | What It Does Here | Free? | Install |
|---|---|---|---|
| **Gemini** (gemini.google.com) | Character gen + sprite sheets | Yes | Browser |
| **ImageMagick** | Slice grids + remove BG in one command | Yes | `brew install imagemagick` |
| **Nano Banana** (or Grok Image) | Parallax backgrounds (optional) | Yes / Yes | Browser |
| **Any BG remover** (remove.bg, Photopea, GIMP) | Strip white backgrounds (if not using ImageMagick) | Yes | Browser |

---

## Step 1: Generate Your Character

### From a text idea

Paste into **Gemini**:

```
Generate a single character only, centered in the frame on a plain white background.

The character should be rendered in detailed 32-bit pixel art style
(like PlayStation 1 / SNES era games).

Include proper shading, highlights, and anti-aliased edges for a polished look.
The character should have well-defined features, expressive details, and rich colors.

Show in a front-facing or 3/4 view pose, standing idle, suitable for sprite
sheet animation.

The character is: [DESCRIBE YOUR CHARACTER HERE]
```

### From an existing image

Upload your image to **Gemini** and paste:

```
Transform this character into detailed 32-bit pixel art style
(like PlayStation 1 / SNES era games).

IMPORTANT: Must be a FULL BODY shot showing the entire character from head to feet.

Keep the character centered in the frame on a plain white background.
Include proper shading, highlights, and anti-aliased edges.
The character should have well-defined features, expressive details, and rich colors.

Show in a front-facing or 3/4 view pose, standing idle, suitable for sprite
sheet animation. Maintain the character's key features, colors, and identity
while converting to pixel art.
```

**Save the result.** You'll attach it to every prompt below.

---

## Step 2: Generate Sprite Sheets (4 animations)

For each animation below, **attach your character image from Step 1** and paste the prompt into Gemini.

### 2A — Walk Cycle

```
Create a 4-frame pixel art walk cycle sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background.
The character is walking to the right.

Top row (frames 1-2):
  Frame 1: Right leg forward, left leg back — stride position
  Frame 2: Legs close together, passing/crossing — transition

Bottom row (frames 3-4):
  Frame 3: Left leg forward, right leg back — opposite stride
  Frame 4: Legs close together, passing/crossing — transition back

Use detailed 32-bit pixel art style with proper shading and highlights.
Same character design in all frames. Character facing right.
```

### 2B — Jump

```
Create a 4-frame pixel art jump animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background.
The character is jumping.

Top row (frames 1-2):
  Frame 1: Crouch/anticipation — slightly crouched, knees bent, preparing to jump
  Frame 2: Rising — in air, legs tucked up, arms up, ascending

Bottom row (frames 3-4):
  Frame 3: Apex/peak — highest point of jump, body stretched or tucked
  Frame 4: Landing — slight crouch to absorb impact

Use detailed 32-bit pixel art style with proper shading and highlights.
Same character design in all frames. Character facing right.
```

### 2C — Attack

```
Create a 4-frame pixel art attack animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background.
The character is performing an attack that fits their design — could be a
sword slash, magic spell, punch, kick, or energy blast.

Top row (frames 1-2):
  Frame 1: Wind-up/anticipation — preparing to attack, pulling back weapon
           or gathering energy
  Frame 2: Attack in motion — the strike or spell being unleashed

Bottom row (frames 3-4):
  Frame 3: Impact/peak — maximum extension of attack, weapon fully swung
           or spell at full power
  Frame 4: Recovery — returning to ready stance

Use detailed 32-bit pixel art style with proper shading and highlights.
Same character design in all frames. Character facing right.
Make the attack visually dynamic and exciting.
```

### 2D — Idle / Breathing

```
Create a 4-frame pixel art idle/breathing animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background.
The character is standing still but with subtle idle animation.

Top row (frames 1-2):
  Frame 1: Neutral standing pose — relaxed stance
  Frame 2: Slight inhale — chest/body rises subtly, maybe slight arm movement

Bottom row (frames 3-4):
  Frame 3: Full breath — slight upward posture
  Frame 4: Exhale — returning to neutral, slight settle

Keep movements SUBTLE — this is a gentle breathing/idle loop, not dramatic motion.
Character should look alive but relaxed.

Use detailed 32-bit pixel art style with proper shading and highlights.
Same character design in all frames. Character facing right.
```

You should now have **4 images**, each a 2x2 grid of frames.

---

## Step 3: Remove Backgrounds

Take each of your 4 sprite sheets and run them through background removal.

**Option A — remove.bg** (easiest)
- Go to remove.bg, upload each sheet, download the PNG with transparency

**Option B — Photopea** (free Photoshop clone, more control)
1. Open the sprite sheet
2. Magic Wand tool (W) → click the white background
3. Select > Similar (to grab all white areas)
4. Delete
5. Export as PNG (preserves transparency)

**Option C — GIMP**
1. Colors > Color to Alpha > pick white
2. Export as PNG

You should now have **4 transparent PNGs**.

---

## Step 4: Slice Into Individual Frames

Each sheet is a 2x2 grid. You need to cut it into 4 equal frames.

### Option A — ImageMagick (recommended, one command per sheet)

**Install (once):**
```bash
brew install imagemagick
```

**Slice a single sheet:**
```bash
magick walk-sheet.png -crop 2x2@ +repage walk-%d.png
# Output: walk-0.png, walk-1.png, walk-2.png, walk-3.png
```

**Batch all 4 animations at once:**
```bash
for anim in walk jump attack idle; do
  magick "${anim}-sheet.png" -crop 2x2@ +repage "${anim}-%d.png"
done
```

**Combo: remove white background + slice in one pass:**
```bash
for anim in walk jump attack idle; do
  magick "${anim}-sheet.png" -fuzz 10% -transparent white -crop 2x2@ +repage "${anim}-%d.png"
done
```
> This replaces Step 3 AND Step 4 in a single command.
> The `-fuzz 10%` catches near-white pixels too (anti-aliased edges).

**What the flags mean:**
- `-crop 2x2@` — split into a 2-column, 2-row grid (4 equal pieces)
- `+repage` — reset each frame's canvas to its own size
- `-fuzz 10% -transparent white` — treat white (and near-white) as transparent
- `%d` — auto-number the output files (0, 1, 2, 3)

### Option B — Photopea / Photoshop (GUI)
1. Open transparent sprite sheet
2. Image > Canvas Size — note the dimensions (e.g., 1024x1024)
3. Use Crop tool or Slice tool to cut into 4 equal quadrants:
   - Frame 1: top-left (0,0 to 512,512)
   - Frame 2: top-right (512,0 to 1024,512)
   - Frame 3: bottom-left (0,512 to 512,1024)
   - Frame 4: bottom-right (512,512 to 1024,1024)
4. Export each frame as a separate PNG

### Option C — Figma (if you're already in it)
1. Place the sprite sheet
2. Use Slice tool to define 4 equal regions
3. Export each slice

**Expected output:**
```
walk-0.png, walk-1.png, walk-2.png, walk-3.png
jump-0.png, jump-1.png, jump-2.png, jump-3.png
attack-0.png, attack-1.png, attack-2.png, attack-3.png
idle-0.png, idle-1.png, idle-2.png, idle-3.png
```

You now have **16 individual transparent frames**.

---

## Step 5: Preview Your Animation

**Option A — EZGif (browser, instant)**
1. Go to ezgif.com/maker
2. Upload the 4 frames for one animation (e.g., walk 1-4)
3. Set delay (100ms = 10 FPS game feel, 67ms = 15 FPS smooth)
4. Generate GIF to preview the loop
5. Repeat for each animation

**Option B — Piskel (browser sprite editor)**
1. Go to piskelapp.com
2. Import frames in order
3. Plays back automatically with FPS control
4. Can also export as sprite sheet or GIF

**Option C — Aseprite** (paid, gold standard)
1. Import frames as layers/cels
2. Full animation timeline with onion skinning
3. Export final sprite sheets in any format

---

## Step 6 (Optional): Parallax Backgrounds

If you want the full sandbox experience with scrolling backgrounds.

### Layer 1 — Sky / Distant Backdrop

Prompt for **Nano Banana** or **Grok Image**:

```
Create the SKY/BACKDROP layer for a side-scrolling pixel art game.

This is for a [YOUR CHARACTER DESCRIPTION] game.
Create an environment that fits this character's world.

This is the FURTHEST layer — only sky and very distant elements
(distant mountains, clouds, horizon).

Style: Pixel art, 32-bit retro game aesthetic.
Wide panoramic scene, 21:9 aspect ratio.
```

### Layer 2 — Midground / Iconic Location

Attach Layer 1 + your character image:

```
Create the MIDDLE layer of a 3-layer parallax background for a
side-scrolling pixel art game.

Create the character's ICONIC location from their story.
Use their most recognizable setting.

Elements should fill the frame from middle down to bottom.
Style: Pixel art matching the sky layer.

IMPORTANT: Use a transparent background so this layer can overlay the sky.
```

### Layer 3 — Foreground / Ground

Attach Layers 1 & 2 + your character:

```
Create the FOREGROUND layer of a 3-layer parallax background.

Create the closest foreground elements — ground, grass, rocks, platforms,
whatever fits the character's world.

Style: Pixel art matching the other layers.

IMPORTANT: Use a transparent background so this layer can overlay the others.
```

Run Layers 2 & 3 through background removal (Step 3 methods).

---

## Final Output Checklist

```
your-character/
├── character.png              ← Original character (Step 1)
├── walk/
│   ├── walk-1.png             ← 4 transparent frames
│   ├── walk-2.png
│   ├── walk-3.png
│   └── walk-4.png
├── jump/
│   ├── jump-1.png
│   ├── jump-2.png
│   ├── jump-3.png
│   └── jump-4.png
├── attack/
│   ├── attack-1.png
│   ├── attack-2.png
│   ├── attack-3.png
│   └── attack-4.png
├── idle/
│   ├── idle-1.png
│   ├── idle-2.png
│   ├── idle-3.png
│   └── idle-4.png
└── backgrounds/ (optional)
    ├── layer-1-sky.png
    ├── layer-2-mid.png
    └── layer-3-foreground.png
```

---

## Tips for Better Results

**Character consistency across sheets:**
- Always attach the Step 1 character image when generating sprite sheets
- If Gemini drifts on design, add: "Match this exact character design precisely — same outfit, colors, proportions, and features"

**If the 2x2 grid comes out messy:**
- Add: "Each frame should be clearly separated with equal spacing. No overlapping."
- Try: "Draw clear thin lines between the 4 frames to separate them"

**For more frames (smoother animation):**
- Change "4-frame" to "6-frame" or "8-frame" and adjust the grid to 3x2 or 4x2
- Update the frame descriptions accordingly

**Style variations:**
- Replace "32-bit pixel art" with "16-bit SNES style" or "8-bit NES style" for different aesthetics
- Add "with dark outlines" or "cel-shaded" for different rendering styles

---

## What This Replaces

| Original Repo (API-driven) | This Guide (manual) |
|---|---|
| `FAL_KEY` env variable | Nothing needed |
| `fal-ai/bria/background/remove` API | ImageMagick `-transparent white` (one command) |
| `fal-ai/nano-banana-pro` API | Nano Banana web UI or Grok Image |
| `google/gemini-3.1-flash` via AI SDK | Gemini web UI (gemini.google.com) |
| Next.js app with Canvas rendering | EZGif / Piskel / Aseprite for preview |
| Automated 2x2 grid extraction | ImageMagick `-crop 2x2@` (one command) |

The prompts are identical. The pipeline is identical. You're just the orchestrator instead of code.
