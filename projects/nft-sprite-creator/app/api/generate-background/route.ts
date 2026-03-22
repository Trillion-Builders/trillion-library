import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { NextRequest, NextResponse } from "next/server";

const LAYER1_PROMPT = (characterPrompt: string) =>
  `Create the SKY/BACKDROP layer for a side-scrolling pixel art game parallax background.

This is for a character: "${characterPrompt}"

Create an environment that fits this character's world. This is the FURTHEST layer - only sky and very distant elements (distant mountains, clouds, horizon).

Style: Pixel art, 32-bit retro game aesthetic, matching the character's style.
This is a wide panoramic scene.`;

const LAYER2_PROMPT = `Create the MIDDLE layer of a 3-layer parallax background for a side-scrolling pixel art game.

I've sent you images of: 1) the character, 2) the background/sky layer already created.

Create the character's ICONIC/CANONICAL location from their story. Use their most recognizable setting - home village, famous landmarks, signature battlegrounds.

Elements should fill the frame from middle down to bottom.

Style: Pixel art matching the other images.
IMPORTANT: Use a transparent background (checkerboard pattern) so this layer can overlay the others.`;

const LAYER3_PROMPT = `Create the FOREGROUND layer of a 3-layer parallax background for a side-scrolling pixel art game.

I've sent you images of: 1) the character, 2) the background/sky layer, 3) the middle layer.

Create the closest foreground elements (ground, grass, rocks, platforms - whatever fits the character's world) that complete the scene.

Style: Pixel art matching the other images.
IMPORTANT: Use a transparent background (checkerboard pattern) so this layer can overlay the others.`;

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
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

async function generateLayer(
  prompt: string,
  imageUrls: string[]
): Promise<string> {
  const imageContent = await Promise.all(
    imageUrls.map(async (url) => {
      const { base64, mimeType } = await fetchImageAsBase64(url);
      return {
        type: "image" as const,
        image: Buffer.from(base64, "base64"),
        mediaType: mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
      };
    })
  );

  const result = await generateText({
    model: google("gemini-2.5-flash-image"),
    messages: [
      {
        role: "user",
        content: [
          ...imageContent,
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
    throw new Error("No image generated");
  }

  const fileMime = (imageFile as unknown as Record<string, unknown>).mediaType || (imageFile as unknown as Record<string, unknown>).mimeType || "image/png";
  const fileData = (imageFile as unknown as Record<string, unknown>).base64Data || (imageFile as unknown as Record<string, unknown>).uint8ArrayData || (imageFile as unknown as Record<string, unknown>).data;
  const fileB64 = typeof fileData === "string" ? fileData : Buffer.from(fileData as ArrayBuffer).toString("base64");
  return `data:${fileMime};base64,${fileB64}`;
}

export async function POST(request: NextRequest) {
  try {
    const {
      characterImageUrl,
      characterPrompt,
      regenerateLayer,
      existingLayers,
    } = await request.json();

    if (!characterImageUrl || !characterPrompt) {
      return NextResponse.json(
        { error: "Character image URL and prompt are required" },
        { status: 400 }
      );
    }

    // Single layer regeneration
    if (regenerateLayer && existingLayers) {
      if (regenerateLayer === 1) {
        const layer1Url = await generateLayer(
          LAYER1_PROMPT(characterPrompt),
          [characterImageUrl]
        );
        return NextResponse.json({
          layer1Url,
          layer2Url: existingLayers.layer2Url,
          layer3Url: existingLayers.layer3Url,
          width: 1024,
          height: 1024,
        });
      } else if (regenerateLayer === 2) {
        const layer2Url = await generateLayer(
          LAYER2_PROMPT,
          [characterImageUrl, existingLayers.layer1Url]
        );
        return NextResponse.json({
          layer1Url: existingLayers.layer1Url,
          layer2Url,
          layer3Url: existingLayers.layer3Url,
          width: 1024,
          height: 1024,
        });
      } else if (regenerateLayer === 3) {
        const layer3Url = await generateLayer(
          LAYER3_PROMPT,
          [characterImageUrl, existingLayers.layer1Url, existingLayers.layer2Url]
        );
        return NextResponse.json({
          layer1Url: existingLayers.layer1Url,
          layer2Url: existingLayers.layer2Url,
          layer3Url,
          width: 1024,
          height: 1024,
        });
      }
    }

    // Generate all layers sequentially (each depends on the previous)
    console.log("Generating layer 1 (sky/background)...");
    const layer1Url = await generateLayer(
      LAYER1_PROMPT(characterPrompt),
      [characterImageUrl]
    );

    console.log("Generating layer 2 (midground)...");
    const layer2Url = await generateLayer(
      LAYER2_PROMPT,
      [characterImageUrl, layer1Url]
    );

    console.log("Generating layer 3 (foreground)...");
    const layer3Url = await generateLayer(
      LAYER3_PROMPT,
      [characterImageUrl, layer1Url, layer2Url]
    );

    return NextResponse.json({
      layer1Url,
      layer2Url,
      layer3Url,
      width: 1024,
      height: 1024,
    });
  } catch (error) {
    console.error("Error generating background layers:", error);
    return NextResponse.json(
      { error: "Failed to generate background layers" },
      { status: 500 }
    );
  }
}
