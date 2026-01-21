import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SEGMIND_API_KEY = process.env.SEGMIND_API_KEY;
const SEGMIND_FACESWAP_API = "https://api.segmind.com/v1/faceswap-v5";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!SEGMIND_API_KEY) {
      return NextResponse.json(
        { error: "Face swap API not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      sourceImage, // The main face image (character's reference face)
      targetImage, // The generated image to swap face into
      additionalPrompt = "",
      imageFormat = "png",
      quality = 95,
      seed,
    } = body;

    if (!sourceImage || !targetImage) {
      return NextResponse.json(
        { error: "Source and target images are required" },
        { status: 400 }
      );
    }

    // Handle base64 images - convert to URL or use as-is
    // The Segmind API expects URLs, so we need to handle base64 specially
    let sourceImageUrl = sourceImage;
    let targetImageUrl = targetImage;

    // If images are base64, we need to either:
    // 1. Upload them to a temporary storage and get URLs
    // 2. Or use base64 directly if the API supports it

    // For now, we'll assume URLs are passed or handle base64 conversion
    // In production, you'd upload to S3/Cloudinary and get URLs

    // Make request to Segmind Face Swap API
    const response = await fetch(SEGMIND_FACESWAP_API, {
      method: "POST",
      headers: {
        "x-api-key": SEGMIND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_image: sourceImageUrl,
        target_image: targetImageUrl,
        additional_prompt: additionalPrompt,
        image_format: imageFormat,
        quality,
        seed: seed || Math.floor(Math.random() * 1000000000000000),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Face swap API error:", errorText);
      return NextResponse.json(
        { error: "Face swap failed", details: errorText },
        { status: response.status }
      );
    }

    // The response is an image
    const imageBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    const imageUrl = `data:image/${imageFormat};base64,${base64Image}`;

    return NextResponse.json({
      success: true,
      imageUrl,
      format: imageFormat,
    });
  } catch (error) {
    console.error("Error in face swap:", error);
    return NextResponse.json(
      { error: "Failed to process face swap" },
      { status: 500 }
    );
  }
}
