import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Validate that an uploaded image is a face using OpenAI's Vision API
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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Face validation API not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { imageBase64 } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { error: "Image is required" },
        { status: 400 }
      );
    }

    // First, check content moderation for inappropriate content
    try {
      const moderationResponse = await openai.moderations.create({
        model: "omni-moderation-latest",
        input: [
          {
            type: "image_url",
            image_url: {
              url: imageBase64.startsWith("data:") 
                ? imageBase64 
                : `data:image/jpeg;base64,${imageBase64}`,
            },
          },
        ],
      });

      const result = moderationResponse.results[0];
      
      if (result.flagged) {
        // Find which categories were flagged
        const flaggedCategories = Object.entries(result.categories)
          .filter(([_, flagged]) => flagged)
          .map(([category]) => category);

        return NextResponse.json({
          valid: false,
          error: "Image contains inappropriate content",
          flaggedCategories,
        }, { status: 400 });
      }
    } catch (modError) {
      console.error("Moderation check failed:", modError);
      // Continue with face detection even if moderation fails
    }

    // Use OpenAI Vision to verify this is a face image
    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image and determine if it contains a clear, visible human face suitable for use as a reference face image. 
              
Requirements for a valid face image:
1. Must contain exactly one clearly visible human face
2. Face should be the main subject (not a small face in a group photo)
3. Face should be reasonably clear and not heavily obscured
4. Should not be a cartoon, anime, or illustrated face (must be a real photo)
5. Should not be an adult/NSFW image

Respond in JSON format only:
{
  "isFace": true/false,
  "faceCount": number,
  "faceQuality": "good" | "acceptable" | "poor",
  "isRealPhoto": true/false,
  "reason": "brief explanation"
}`,
            },
            {
              type: "image_url",
              image_url: {
                url: imageBase64.startsWith("data:") 
                  ? imageBase64 
                  : `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    });

    const analysisText = visionResponse.choices[0]?.message?.content || "";
    
    // Parse the JSON response
    let analysis;
    try {
      // Extract JSON from the response (handle potential markdown code blocks)
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse vision response:", analysisText);
      return NextResponse.json({
        valid: false,
        error: "Failed to analyze image",
        details: analysisText,
      }, { status: 500 });
    }

    // Determine if the image is valid
    const isValid = 
      analysis.isFace === true && 
      analysis.faceCount === 1 && 
      analysis.isRealPhoto === true &&
      (analysis.faceQuality === "good" || analysis.faceQuality === "acceptable");

    if (!isValid) {
      let errorMessage = "Invalid face image";
      
      if (!analysis.isFace) {
        errorMessage = "No face detected in the image";
      } else if (analysis.faceCount > 1) {
        errorMessage = "Image contains multiple faces. Please upload an image with a single face.";
      } else if (analysis.faceCount === 0) {
        errorMessage = "No face detected in the image";
      } else if (!analysis.isRealPhoto) {
        errorMessage = "Please upload a real photo, not an illustration or AI-generated image";
      } else if (analysis.faceQuality === "poor") {
        errorMessage = "Face quality is too low. Please upload a clearer image.";
      }

      return NextResponse.json({
        valid: false,
        error: errorMessage,
        analysis,
      }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      analysis,
      message: "Face image validated successfully",
    });
  } catch (error) {
    console.error("Error validating face:", error);
    return NextResponse.json(
      { error: "Failed to validate face image" },
      { status: 500 }
    );
  }
}
