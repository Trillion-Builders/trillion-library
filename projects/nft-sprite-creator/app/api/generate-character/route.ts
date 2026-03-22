import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { NextRequest, NextResponse } from "next/server";

const CHARACTER_STYLE_PROMPT = `Generate a single character only, centered in the frame on a plain white background.
The character should be rendered in detailed 32-bit pixel art style (like PlayStation 1 / SNES era games).
Include proper shading, highlights, and anti-aliased edges for a polished look.
The character should have well-defined features, expressive details, and rich colors.
Show in a front-facing or 3/4 view pose, standing idle, suitable for sprite sheet animation.`;

const IMAGE_TO_PIXEL_PROMPT = `Transform this character into detailed 32-bit pixel art style (like PlayStation 1 / SNES era games).
IMPORTANT: Must be a FULL BODY shot showing the entire character from head to feet.
Keep the character centered in the frame on a plain white background.
Include proper shading, highlights, and anti-aliased edges for a polished look.
The character should have well-defined features, expressive details, and rich colors.
Show in a front-facing or 3/4 view pose, standing idle, suitable for sprite sheet animation.
Maintain the character's key features, colors, and identity while converting to pixel art.`;

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const contentType = response.headers.get("content-type") || "image/png";
  return { base64, mimeType: contentType };
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, imageUrl } = await request.json();

    if (imageUrl) {
      // Image-to-image mode: convert uploaded image to pixel art
      const fullPrompt = prompt
        ? `${prompt}. ${IMAGE_TO_PIXEL_PROMPT}`
        : IMAGE_TO_PIXEL_PROMPT;

      const { base64, mimeType } = await fetchImageAsBase64(imageUrl);

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
              { type: "text", text: fullPrompt },
            ],
          },
        ],
        providerOptions: {
          google: { responseModalities: ["TEXT", "IMAGE"] },
        },
      });

      // AI SDK Google provider uses mediaType + uint8ArrayData (not mimeType + data)
      const imageFile = result.files?.find(// eslint-disable-next-line @typescript-eslint/no-explicit-any
        (f: any) =>
        ((f.mediaType as string) || (f.mimeType as string) || "").startsWith("image/")
      );

      if (!imageFile) {
        return NextResponse.json(
          { error: "No image generated" },
          { status: 500 }
        );
      }

      const mime = (imageFile as unknown as Record<string, unknown>).mediaType || (imageFile as unknown as Record<string, unknown>).mimeType || "image/png";
      const imgData = (imageFile as unknown as Record<string, unknown>).base64Data || (imageFile as unknown as Record<string, unknown>).uint8ArrayData || (imageFile as unknown as Record<string, unknown>).data;
      const b64 = typeof imgData === "string" ? imgData : Buffer.from(imgData as ArrayBuffer).toString("base64");
      const dataUrl = `data:${mime};base64,${b64}`;
      return NextResponse.json({
        imageUrl: dataUrl,
        width: 1024,
        height: 1024,
      });
    }

    // Text-to-image mode
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt or image URL is required" },
        { status: 400 }
      );
    }

    const fullPrompt = `${prompt}. ${CHARACTER_STYLE_PROMPT}`;

    const result = await generateText({
      model: google("gemini-2.5-flash-image"),
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: fullPrompt }],
        },
      ],
      providerOptions: {
        google: { responseModalities: ["TEXT", "IMAGE"] },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imageFile2 = result.files?.find((f: any) =>
      ((f.mediaType as string) || (f.mimeType as string) || "").startsWith("image/")
    );

    if (!imageFile2) {
      return NextResponse.json(
        { error: "No image generated" },
        { status: 500 }
      );
    }

    const mime2 = (imageFile2 as unknown as Record<string, unknown>).mediaType || (imageFile2 as unknown as Record<string, unknown>).mimeType || "image/png";
    const imgData2 = (imageFile2 as unknown as Record<string, unknown>).base64Data || (imageFile2 as unknown as Record<string, unknown>).uint8ArrayData || (imageFile2 as unknown as Record<string, unknown>).data;
    const b642 = typeof imgData2 === "string" ? imgData2 : Buffer.from(imgData2 as ArrayBuffer).toString("base64");
    const dataUrl2 = `data:${mime2};base64,${b642}`;
    return NextResponse.json({
      imageUrl: dataUrl2,
      width: 1024,
      height: 1024,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Error generating character:", errMsg, error);
    return NextResponse.json(
      { error: `Failed to generate character: ${errMsg}` },
      { status: 500 }
    );
  }
}
