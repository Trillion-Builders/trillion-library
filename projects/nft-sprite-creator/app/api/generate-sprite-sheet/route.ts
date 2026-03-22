import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { NextRequest, NextResponse } from "next/server";

const WALK_SPRITE_PROMPT = `Create a 4-frame pixel art walk cycle sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is walking to the right.

Top row (frames 1-2):
Frame 1 (top-left): Right leg forward, left leg back - stride position
Frame 2 (top-right): Legs close together, passing/crossing - transition

Bottom row (frames 3-4):
Frame 3 (bottom-left): Left leg forward, right leg back - opposite stride
Frame 4 (bottom-right): Legs close together, passing/crossing - transition back

Each frame shows a different phase of the walking motion. This creates a smooth looping walk cycle.

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right.`;

const JUMP_SPRITE_PROMPT = `Create a 4-frame pixel art jump animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is jumping.

Top row (frames 1-2):
Frame 1 (top-left): Crouch/anticipation - character slightly crouched, knees bent, preparing to jump
Frame 2 (top-right): Rising - character in air, legs tucked up, arms up, ascending

Bottom row (frames 3-4):
Frame 3 (bottom-left): Apex/peak - character at highest point of jump, body stretched or tucked
Frame 4 (bottom-right): Landing - character landing, slight crouch to absorb impact

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right.`;

const ATTACK_SPRITE_PROMPT = `Create a 4-frame pixel art attack animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is performing an attack that fits their design - could be a sword slash, magic spell, punch, kick, or energy blast depending on what suits the character best.

Top row (frames 1-2):
Frame 1 (top-left): Wind-up/anticipation - character preparing to attack, pulling back weapon or gathering energy
Frame 2 (top-right): Attack in motion - the strike or spell being unleashed

Bottom row (frames 3-4):
Frame 3 (bottom-left): Impact/peak - maximum extension of attack, weapon fully swung or spell at full power
Frame 4 (bottom-right): Recovery - returning to ready stance

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right. Make the attack visually dynamic and exciting.`;

const IDLE_SPRITE_PROMPT = `Create a 4-frame pixel art idle/breathing animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is standing still but with subtle idle animation.

Top row (frames 1-2):
Frame 1 (top-left): Neutral standing pose - relaxed stance
Frame 2 (top-right): Slight inhale - chest/body rises subtly, maybe slight arm movement

Bottom row (frames 3-4):
Frame 3 (bottom-left): Full breath - slight upward posture
Frame 4 (bottom-right): Exhale - returning to neutral, slight settle

Keep movements SUBTLE - this is a gentle breathing/idle loop, not dramatic motion. Character should look alive but relaxed.

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right.`;

type SpriteType = "walk" | "jump" | "attack" | "idle";

const PROMPTS: Record<SpriteType, string> = {
  walk: WALK_SPRITE_PROMPT,
  jump: JUMP_SPRITE_PROMPT,
  attack: ATTACK_SPRITE_PROMPT,
  idle: IDLE_SPRITE_PROMPT,
};

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  // Handle data URLs directly
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { base64: match[2], mimeType: match[1] };
    }
  }
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const contentType = response.headers.get("content-type") || "image/png";
  return { base64, mimeType: contentType };
}

export async function POST(request: NextRequest) {
  try {
    const { characterImageUrl, type = "walk", customPrompt } = await request.json();

    if (!characterImageUrl) {
      return NextResponse.json(
        { error: "Character image URL is required" },
        { status: 400 }
      );
    }

    const spriteType = (type as SpriteType) || "walk";
    const prompt = customPrompt || PROMPTS[spriteType] || PROMPTS.walk;

    const { base64, mimeType } = await fetchImageAsBase64(characterImageUrl);

    const result = await generateText({
      model: google("gemini-2.5-flash-image"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: Buffer.from(base64, "base64"),
              mediaType: mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
            },
            { type: "text", text: prompt },
          ],
        },
      ],
      providerOptions: {
        google: { responseModalities: ["TEXT", "IMAGE"] },
      },
    });

    const imageFile = result.files?.find(// eslint-disable-next-line @typescript-eslint/no-explicit-any
      (f: any) =>
      ((f.mediaType as string) || (f.mimeType as string) || "").startsWith("image/")
    );

    if (!imageFile) {
      return NextResponse.json(
        { error: "No sprite sheet generated" },
        { status: 500 }
      );
    }

    const fileMime = (imageFile as unknown as Record<string, unknown>).mediaType || (imageFile as unknown as Record<string, unknown>).mimeType || "image/png";
    const fileData = (imageFile as unknown as Record<string, unknown>).base64Data || (imageFile as unknown as Record<string, unknown>).uint8ArrayData || (imageFile as unknown as Record<string, unknown>).data;
    const fileB64 = typeof fileData === "string" ? fileData : Buffer.from(fileData as ArrayBuffer).toString("base64");
    const dataUrl = `data:${fileMime};base64,${fileB64}`;
    return NextResponse.json({
      imageUrl: dataUrl,
      width: 1024,
      height: 1024,
      type: spriteType,
    });
  } catch (error) {
    console.error("Error generating sprite sheet:", error);
    return NextResponse.json(
      { error: "Failed to generate sprite sheet" },
      { status: 500 }
    );
  }
}
