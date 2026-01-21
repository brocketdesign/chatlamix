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
            content: `Tu es un expert en création de contenu pour les réseaux sociaux. 
Tu crées des textes engageants, accrocheurs et adaptés aux plateformes sociales.
Le texte doit être court (2-3 phrases max), percutant et inciter à l'engagement.
N'inclus PAS de hashtags dans ta réponse (ils seront ajoutés séparément).
Utilise des emojis de manière modérée pour rendre le texte plus vivant.
Réponds uniquement avec le texte de publication, sans introduction ni explication.`,
          },
          {
            role: "user",
            content: `Génère un texte de publication pour les réseaux sociaux (${platformNames}) pour partager une image d'un personnage nommé "${characterName}".
${imagePrompt ? `Description de l'image : ${imagePrompt}` : ""}

Le texte doit être engageant et donner envie aux gens d'interagir avec la publication.`,
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
            content: `Tu es un expert en marketing sur les réseaux sociaux.
Tu génères des hashtags pertinents et populaires pour maximiser la visibilité des publications.
Génère entre 5 et 10 hashtags.
Réponds UNIQUEMENT avec les hashtags séparés par des espaces, sans le symbole #.
Par exemple: "art digital character illustration creative"
Ne mets pas de # devant les mots, juste les mots séparés par des espaces.`,
          },
          {
            role: "user",
            content: `Génère des hashtags pertinents pour une publication sur les réseaux sociaux présentant une image d'un personnage nommé "${characterName}".
${imagePrompt ? `Description de l'image : ${imagePrompt}` : ""}

Les hashtags doivent être un mélange de tags populaires et de tags spécifiques pour maximiser la portée.`,
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
