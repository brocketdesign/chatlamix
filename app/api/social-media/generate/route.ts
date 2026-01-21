import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST - Generate social media content using OpenAI
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { type, characterName, imagePrompt, platforms } = await request.json();

    if (!type || !characterName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (type === "content") {
      // Generate publication text
      const platformNames = platforms?.join(", ") || "social media";
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert in creating content for social media. 
You create engaging, catchy texts adapted to social platforms.
The text should be short (2-3 sentences max), impactful and encourage engagement.
Do NOT include hashtags in your response (they will be added separately).
Use emojis moderately to make the text more lively.
Respond only with the publication text, without introduction or explanation.`,
          },
          {
            role: "user",
            content: `Generate a social media post text (${platformNames}) to share an image of a character named "${characterName}".
${imagePrompt ? `Image description: ${imagePrompt}` : ""}

The text should be engaging and make people want to interact with the post.`,
          },
        ],
        max_tokens: 200,
        temperature: 0.8,
      });

      const content = completion.choices[0]?.message?.content?.trim() || "";

      return NextResponse.json({ content });
    }

    if (type === "hashtags") {
      // Generate hashtags
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a social media marketing expert.
You generate relevant and popular hashtags to maximize post visibility.
Generate between 5 and 10 hashtags.
Respond ONLY with hashtags separated by spaces, without the # symbol.
For example: "art digital character illustration creative"
Do not put # in front of the words, just the words separated by spaces.`,
          },
          {
            role: "user",
            content: `Generate relevant hashtags for a social media post featuring an image of a character named "${characterName}".
${imagePrompt ? `Image description: ${imagePrompt}` : ""}

The hashtags should be a mix of popular tags and specific tags to maximize reach.`,
          },
        ],
        max_tokens: 100,
        temperature: 0.7,
      });

      const hashtagsText = completion.choices[0]?.message?.content?.trim() || "";
      // Parse hashtags: remove any # symbols and split by spaces or commas
      const hashtags = hashtagsText
        .replace(/#/g, "")
        .split(/[\s,]+/)
        .filter((tag) => tag.length > 0)
        .slice(0, 10); // Limit to 10 hashtags

      return NextResponse.json({ hashtags });
    }

    return NextResponse.json(
      { error: "Invalid type. Use 'content' or 'hashtags'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error generating social media content:", error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}
