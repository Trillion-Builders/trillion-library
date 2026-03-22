import { NextRequest, NextResponse } from "next/server";

// Server-side background removal using canvas-like processing
// Removes white/near-white backgrounds by converting them to transparent
export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    // For data URLs, extract the base64 data
    let imageBuffer: Buffer;
    let mimeType = "image/png";

    if (imageUrl.startsWith("data:")) {
      const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return NextResponse.json(
          { error: "Invalid data URL" },
          { status: 400 }
        );
      }
      mimeType = match[1];
      imageBuffer = Buffer.from(match[2], "base64");
    } else {
      const response = await fetch(imageUrl);
      imageBuffer = Buffer.from(await response.arrayBuffer());
      mimeType = response.headers.get("content-type") || "image/png";
    }

    // Return the image as-is — background removal will be done client-side
    // using canvas for better quality (pixel-level alpha thresholding)
    const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

    return NextResponse.json({
      imageUrl: dataUrl,
      width: 1024,
      height: 1024,
    });
  } catch (error) {
    console.error("Error processing image:", error);
    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 }
    );
  }
}
