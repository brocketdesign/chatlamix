import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

// Extend timeout for face swap processing (120 seconds)
export const maxDuration = 120;

const SEGMIND_API_KEY = process.env.SEGMIND_API_KEY;
const SEGMIND_FACESWAP_API = "https://api.segmind.com/v1/faceswap-v5";

// Generate a short hash from image data for caching purposes
function generateImageHash(imageData: string): string {
  // Use first 1000 chars + length as a quick fingerprint (faster than hashing entire image)
  const fingerprint = imageData.substring(0, 1000) + imageData.length.toString();
  return crypto.createHash("md5").update(fingerprint).digest("hex").substring(0, 12);
}

// Helper function to upload base64/data URL image to Supabase and get public URL
// Uses hash-based caching to avoid re-uploading the same image
async function uploadImageToStorage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  imageData: string,
  prefix: string,
  useCache: boolean = false
): Promise<string | null> {
  try {
    // If it's already an HTTP URL, return as-is
    if (imageData.startsWith("http://") || imageData.startsWith("https://")) {
      console.log(`[face-swap] ${prefix} image is already a URL, using directly`);
      return imageData;
    }

    // Extract base64 and mime type from data URL
    let base64Data: string;
    let mimeType = "image/jpeg";
    let extension = "jpg";

    if (imageData.startsWith("data:")) {
      const match = imageData.match(/^data:(image\/([^;]+));base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        extension = match[2] === "jpeg" ? "jpg" : match[2];
        base64Data = match[3];
      } else {
        console.error("[face-swap] Invalid data URL format");
        return null;
      }
    } else {
      // Raw base64 - detect format from magic bytes
      base64Data = imageData;
      if (imageData.startsWith("/9j/")) {
        mimeType = "image/jpeg";
        extension = "jpg";
      } else if (imageData.startsWith("iVBORw")) {
        mimeType = "image/png";
        extension = "png";
      } else if (imageData.startsWith("UklGR")) {
        mimeType = "image/webp";
        extension = "webp";
      }
    }

    // Generate hash for caching (used for source/base face images)
    const imageHash = generateImageHash(base64Data);
    
    // For cached images (like base face), use hash-based filename
    // For non-cached images (like target), use timestamp-based filename
    const fileName = useCache
      ? `faceswap_${prefix}_${imageHash}.${extension}`
      : `faceswap_${prefix}_${Date.now()}.${extension}`;

    // If using cache, check if file already exists
    if (useCache) {
      const { data: existingFiles } = await supabase.storage
        .from("character-images")
        .list("", { search: fileName });

      if (existingFiles && existingFiles.length > 0) {
        const { data: { publicUrl } } = supabase.storage
          .from("character-images")
          .getPublicUrl(fileName);
        console.log(`[face-swap] Using cached ${prefix} image: ${publicUrl}`);
        return publicUrl;
      }
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, "base64");
    console.log(`[face-swap] Uploading ${prefix} image (${buffer.length} bytes, hash: ${imageHash})...`);

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("character-images")
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: useCache, // Allow overwrite for cached files (in case of hash collision)
      });

    if (uploadError) {
      // If file exists error and we're caching, try to get existing URL
      if (useCache && uploadError.message?.includes("already exists")) {
        const { data: { publicUrl } } = supabase.storage
          .from("character-images")
          .getPublicUrl(fileName);
        console.log(`[face-swap] File already exists, using cached ${prefix} image: ${publicUrl}`);
        return publicUrl;
      }
      console.error("[face-swap] Storage upload failed:", uploadError.message);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("character-images")
      .getPublicUrl(fileName);

    console.log(`[face-swap] Uploaded ${prefix} image: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error("[face-swap] Error uploading image:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  console.log("[face-swap] ========== POST request started ==========");
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log("[face-swap] Authentication required - no user");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!SEGMIND_API_KEY) {
      console.log("[face-swap] SEGMIND_API_KEY not configured");
      return NextResponse.json(
        { error: "Face swap API not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      sourceImage, // The main face image (character's reference face) - will be source_image in API
      targetImage, // The generated image to swap face into - will be target_image in API
      additionalPrompt = "",
      imageFormat = "png",
      quality = 95,
      seed,
    } = body;

    console.log("[face-swap] Request params:", {
      hasSourceImage: !!sourceImage,
      sourceImageLength: sourceImage?.length || 0,
      sourceImageType: sourceImage?.startsWith("http") ? "URL" : sourceImage?.startsWith("data:") ? "DataURL" : "Base64",
      hasTargetImage: !!targetImage,
      targetImageLength: targetImage?.length || 0,
      targetImageType: targetImage?.startsWith("http") ? "URL" : targetImage?.startsWith("data:") ? "DataURL" : "Base64",
    });

    if (!sourceImage || !targetImage) {
      console.log("[face-swap] Missing source or target image");
      return NextResponse.json(
        { error: "Source and target images are required" },
        { status: 400 }
      );
    }

    // The Segmind API requires actual HTTP URLs, not data URLs or base64
    // Upload images to Supabase storage and get public URLs
    // Note: We don't cache source images because:
    // 1. The hash-based caching uses only first 1000 chars which can cause collisions
    // 2. The Supabase list() search is a partial match which can return wrong files
    // 3. Source face images are small, so re-uploading is not expensive
    console.log("[face-swap] Uploading images to storage for API compatibility...");
    
    const [sourceImageUrl, targetImageUrl] = await Promise.all([
      uploadImageToStorage(supabase, sourceImage, "source", false),  // Don't cache source to ensure correct face is always used
      uploadImageToStorage(supabase, targetImage, "target", false), // Don't cache target
    ]);

    if (!sourceImageUrl) {
      console.error("[face-swap] Failed to upload source image");
      return NextResponse.json(
        { error: "Failed to process source image" },
        { status: 500 }
      );
    }

    if (!targetImageUrl) {
      console.error("[face-swap] Failed to upload target image");
      return NextResponse.json(
        { error: "Failed to process target image" },
        { status: 500 }
      );
    }

    // Log FULL URLs for debugging
    console.log("[face-swap] ===== IMAGE URLs FOR API =====");
    console.log("[face-swap] source_image (base face):", sourceImageUrl);
    console.log("[face-swap] target_image (generated scene):", targetImageUrl);
    console.log("[face-swap] ===============================");

    // Make request to Segmind Face Swap API with timeout
    console.log("[face-swap] Calling Segmind API...");
    const startTime = Date.now();
    
    const requestBody = {
      source_image: sourceImageUrl,  // The base face (character's reference face to extract)
      target_image: targetImageUrl,  // The generated scene (destination image to apply face onto)
      additional_prompt: additionalPrompt,
      image_format: imageFormat,
      quality,
      seed: seed || Math.floor(Math.random() * 1000000000000000),
    };
    
    console.log("[face-swap] API Request body:", JSON.stringify(requestBody, null, 2));
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 115000); // 115 second timeout
    
    let response: Response;
    try {
      response = await fetch(SEGMIND_FACESWAP_API, {
        method: "POST",
        headers: {
          "x-api-key": SEGMIND_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    
    console.log(`[face-swap] Segmind API responded in ${Date.now() - startTime}ms, status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[face-swap] ===== API ERROR =====");
      console.error("[face-swap] Status:", response.status);
      console.error("[face-swap] Error:", errorText);
      console.error("[face-swap] ====================");
      return NextResponse.json(
        { error: "Face swap failed", details: errorText },
        { status: response.status }
      );
    }

    // The response is an image
    const imageBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    const imageUrl = `data:image/${imageFormat};base64,${base64Image}`;

    console.log("[face-swap] ===== SUCCESS =====");
    console.log("[face-swap] Result image size:", imageBuffer.byteLength, "bytes");
    console.log("[face-swap] ===================");

    return NextResponse.json({
      success: true,
      imageUrl,
      format: imageFormat,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error("[face-swap] Request timed out");
      return NextResponse.json(
        { error: "Face swap request timed out" },
        { status: 504 }
      );
    }
    console.error("[face-swap] Error in face swap:", error);
    return NextResponse.json(
      { error: "Failed to process face swap" },
      { status: 500 }
    );
  }
}
