import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import {
  CharacterProfileType,
  PhysicalAttributes,
  CharacterPersonality,
  CreateCharacterData,
} from "@/lib/types";
import { generateImage, buildCharacterPrompt } from "@/lib/content-generation";

// Extend timeout for character generation (5 minutes)
export const maxDuration = 300;

// Profile type descriptions for AI generation
const PROFILE_TYPE_DESCRIPTIONS: Record<CharacterProfileType, {
  description: string;
  occupations: string[];
  interests: string[];
  traits: string[];
  fashionStyles: string[];
}> = {
  influencer: {
    description: "Social media influencer with a curated lifestyle",
    occupations: ["Content Creator", "Social Media Influencer", "Brand Ambassador", "Lifestyle Blogger"],
    interests: ["fashion", "beauty", "travel", "photography", "social media", "networking"],
    traits: ["charismatic", "trendy", "outgoing", "creative", "ambitious"],
    fashionStyles: ["trendy", "glamorous", "casual chic", "streetwear"],
  },
  gamer: {
    description: "Professional or enthusiast gamer",
    occupations: ["Esports Pro", "Streamer", "Game Developer", "Gaming Content Creator"],
    interests: ["video games", "technology", "anime", "streaming", "competitive gaming"],
    traits: ["competitive", "focused", "tech-savvy", "witty", "dedicated"],
    fashionStyles: ["casual", "streetwear", "gamer aesthetic", "comfortable"],
  },
  yoga_instructor: {
    description: "Wellness and mindfulness practitioner",
    occupations: ["Yoga Instructor", "Wellness Coach", "Meditation Guide", "Holistic Therapist"],
    interests: ["yoga", "meditation", "wellness", "nature", "healthy eating", "mindfulness"],
    traits: ["calm", "peaceful", "nurturing", "spiritual", "patient"],
    fashionStyles: ["athleisure", "bohemian", "natural", "comfortable"],
  },
  tech: {
    description: "Technology enthusiast or professional",
    occupations: ["Software Engineer", "Tech Entrepreneur", "AI Researcher", "Product Manager"],
    interests: ["technology", "AI", "startups", "coding", "innovation", "gadgets"],
    traits: ["analytical", "innovative", "curious", "logical", "ambitious"],
    fashionStyles: ["smart casual", "minimalist", "tech-forward", "professional"],
  },
  billionaire: {
    description: "Wealthy entrepreneur or business magnate",
    occupations: ["CEO", "Investor", "Entrepreneur", "Business Mogul", "Venture Capitalist"],
    interests: ["business", "investing", "luxury", "travel", "philanthropy", "art collecting"],
    traits: ["confident", "decisive", "ambitious", "sophisticated", "strategic"],
    fashionStyles: ["luxury", "elegant", "designer", "classic"],
  },
  philosopher: {
    description: "Deep thinker and intellectual",
    occupations: ["Professor", "Author", "Philosopher", "Thought Leader", "Academic"],
    interests: ["philosophy", "reading", "writing", "debate", "history", "ethics"],
    traits: ["thoughtful", "intellectual", "curious", "wise", "articulate"],
    fashionStyles: ["classic", "academic", "sophisticated", "minimalist"],
  },
  fitness: {
    description: "Fitness enthusiast or professional",
    occupations: ["Personal Trainer", "Fitness Coach", "Athlete", "Gym Owner"],
    interests: ["fitness", "nutrition", "sports", "health", "outdoor activities"],
    traits: ["disciplined", "energetic", "motivating", "determined", "positive"],
    fashionStyles: ["athletic", "sporty", "activewear", "casual"],
  },
  artist: {
    description: "Creative artist or designer",
    occupations: ["Artist", "Graphic Designer", "Photographer", "Illustrator", "Creative Director"],
    interests: ["art", "design", "creativity", "museums", "culture", "expression"],
    traits: ["creative", "expressive", "unique", "passionate", "intuitive"],
    fashionStyles: ["artistic", "eclectic", "avant-garde", "expressive"],
  },
  musician: {
    description: "Music professional or enthusiast",
    occupations: ["Singer", "Musician", "Producer", "DJ", "Composer"],
    interests: ["music", "concerts", "instruments", "songwriting", "performance"],
    traits: ["passionate", "creative", "emotional", "talented", "expressive"],
    fashionStyles: ["edgy", "rockstar", "artistic", "unique"],
  },
  chef: {
    description: "Culinary professional or food enthusiast",
    occupations: ["Chef", "Restaurant Owner", "Food Blogger", "Culinary Instructor"],
    interests: ["cooking", "food", "restaurants", "travel", "culture", "wine"],
    traits: ["creative", "passionate", "detail-oriented", "adventurous", "nurturing"],
    fashionStyles: ["chef attire", "casual elegant", "professional", "classic"],
  },
  entrepreneur: {
    description: "Business founder or startup leader",
    occupations: ["Founder", "CEO", "Startup Advisor", "Business Coach"],
    interests: ["business", "innovation", "networking", "leadership", "growth"],
    traits: ["ambitious", "resilient", "innovative", "driven", "visionary"],
    fashionStyles: ["professional", "smart casual", "modern", "polished"],
  },
  model: {
    description: "Fashion or commercial model",
    occupations: ["Fashion Model", "Commercial Model", "Brand Ambassador", "Influencer"],
    interests: ["fashion", "photography", "travel", "fitness", "beauty"],
    traits: ["confident", "photogenic", "charismatic", "professional", "stylish"],
    fashionStyles: ["high fashion", "trendy", "elegant", "versatile"],
  },
  scientist: {
    description: "Research scientist or academic",
    occupations: ["Researcher", "Scientist", "Professor", "Lab Director"],
    interests: ["science", "research", "discovery", "innovation", "education"],
    traits: ["analytical", "curious", "methodical", "intelligent", "dedicated"],
    fashionStyles: ["professional", "smart casual", "practical", "classic"],
  },
  traveler: {
    description: "Travel content creator or adventurer",
    occupations: ["Travel Blogger", "Photographer", "Adventure Guide", "Digital Nomad"],
    interests: ["travel", "adventure", "photography", "cultures", "nature"],
    traits: ["adventurous", "curious", "open-minded", "spontaneous", "storyteller"],
    fashionStyles: ["travel-ready", "casual", "practical", "bohemian"],
  },
  wellness: {
    description: "Wellness and self-care advocate",
    occupations: ["Life Coach", "Wellness Influencer", "Therapist", "Spa Owner"],
    interests: ["wellness", "self-care", "mental health", "nutrition", "relaxation"],
    traits: ["caring", "empathetic", "balanced", "positive", "supportive"],
    fashionStyles: ["comfortable", "natural", "soft", "elegant casual"],
  },
};

// Physical attribute options
const PHYSICAL_ATTRIBUTES = {
  ethnicities: {
    male: ["Caucasian", "Asian", "African", "Hispanic", "Middle Eastern", "South Asian", "Mixed"],
    female: ["Caucasian", "Asian", "African", "Hispanic/Latina", "Middle Eastern", "South Asian", "Mixed"],
    "non-binary": ["Caucasian", "Asian", "African", "Hispanic", "Middle Eastern", "South Asian", "Mixed"],
  },
  ages: ["early 20s", "mid 20s", "late 20s", "early 30s", "mid 30s", "late 30s"],
  faceShapes: ["oval", "round", "heart", "square", "oblong", "diamond"],
  eyeColors: ["brown", "blue", "green", "hazel", "gray", "amber", "black"],
  eyeShapes: ["almond", "round", "hooded", "monolid", "upturned"],
  skinTones: ["porcelain", "fair", "light", "medium", "olive", "tan", "brown", "dark"],
  hairColors: ["blonde", "brunette", "black", "red", "auburn", "gray", "platinum"],
  hairLengths: {
    male: ["short", "medium", "buzz cut", "slicked back"],
    female: ["pixie", "short", "medium", "long", "very long"],
    "non-binary": ["pixie", "short", "medium", "long"],
  },
  hairStyles: {
    male: ["straight", "wavy", "curly", "buzz cut", "slicked back", "messy"],
    female: ["straight", "wavy", "curly", "braided", "ponytail", "bun", "bob"],
    "non-binary": ["straight", "wavy", "curly", "bob", "undercut", "natural"],
  },
  hairTextures: ["straight", "wavy", "curly", "coily"],
  bodyTypes: {
    male: ["athletic", "slim", "muscular", "average", "tall and lean"],
    female: ["slim", "athletic", "curvy", "petite", "average"],
    "non-binary": ["slim", "athletic", "average", "petite", "lean"],
  },
  heights: ["tall", "average", "petite"],
  distinctiveFeatures: ["dimples", "freckles", "beauty mark", "strong jawline", "high cheekbones"],
};

// Helper to pick random item from array
function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper to pick multiple random items
function randomPickMultiple<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Generate character using OpenAI
async function generateCharacterProfile(
  profileType: CharacterProfileType,
  gender: "male" | "female" | "non-binary",
  openai: OpenAI
): Promise<CreateCharacterData> {
  const profileInfo = PROFILE_TYPE_DESCRIPTIONS[profileType];
  
  const systemPrompt = `You are an AI character designer creating realistic, diverse virtual influencer profiles.
Generate a unique, authentic character profile that feels like a real person with depth and personality.
The character should be interesting, relatable, and have a compelling backstory.
Return the response in valid JSON format.`;

  const userPrompt = `Create a ${gender} ${profileType} character profile with these guidelines:
- Profile type: ${profileInfo.description}
- Typical occupations: ${profileInfo.occupations.join(", ")}
- Common interests: ${profileInfo.interests.join(", ")}
- Personality traits: ${profileInfo.traits.join(", ")}
- Fashion style: ${profileInfo.fashionStyles.join(", ")}

Generate a complete character with:
1. A realistic first and last name appropriate for their background
2. A brief but engaging description (2-3 sentences about who they are)
3. Detailed personality traits
4. A compelling backstory (2-3 sentences)
5. Their speaking style and communication preferences

Return as JSON:
{
  "name": "Full Name",
  "description": "Brief engaging description",
  "category": "appropriate category",
  "personality": {
    "traits": ["trait1", "trait2", "trait3", "trait4", "trait5"],
    "mood": "default mood",
    "speakingStyle": "how they communicate",
    "tone": "their tone of voice",
    "backstory": "their background story",
    "interests": ["interest1", "interest2", "interest3"],
    "hobbies": ["hobby1", "hobby2", "hobby3"],
    "occupation": "their job title",
    "relationshipStyle": "friend|mentor|companion",
    "flirtLevel": number 1-5,
    "affectionLevel": number 5-8,
    "likes": ["like1", "like2"],
    "dislikes": ["dislike1", "dislike2"],
    "favoriteTopics": ["topic1", "topic2"],
    "avoidTopics": ["topic1"]
  }
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.9,
  });

  const responseContent = completion.choices[0]?.message?.content;
  if (!responseContent) {
    throw new Error("Failed to generate character profile");
  }

  const generatedProfile = JSON.parse(responseContent);

  // Generate physical attributes
  const physicalAttributes: PhysicalAttributes = {
    gender,
    age: randomPick(PHYSICAL_ATTRIBUTES.ages),
    ethnicity: randomPick(PHYSICAL_ATTRIBUTES.ethnicities[gender]),
    faceShape: randomPick(PHYSICAL_ATTRIBUTES.faceShapes),
    eyeColor: randomPick(PHYSICAL_ATTRIBUTES.eyeColors),
    eyeShape: randomPick(PHYSICAL_ATTRIBUTES.eyeShapes),
    noseType: "straight",
    lipShape: "full",
    skinTone: randomPick(PHYSICAL_ATTRIBUTES.skinTones),
    hairColor: randomPick(PHYSICAL_ATTRIBUTES.hairColors),
    hairLength: randomPick(PHYSICAL_ATTRIBUTES.hairLengths[gender]),
    hairStyle: randomPick(PHYSICAL_ATTRIBUTES.hairStyles[gender]),
    hairTexture: randomPick(PHYSICAL_ATTRIBUTES.hairTextures),
    bodyType: randomPick(PHYSICAL_ATTRIBUTES.bodyTypes[gender]),
    height: randomPick(PHYSICAL_ATTRIBUTES.heights),
    distinctiveFeatures: randomPickMultiple(PHYSICAL_ATTRIBUTES.distinctiveFeatures, Math.floor(Math.random() * 2) + 1),
    fashionStyle: randomPick(profileInfo.fashionStyles),
    makeup: gender === "female" ? randomPick(["natural", "glamorous", "minimal", "soft glam"]) : "none",
  };

  const personality: CharacterPersonality = {
    traits: generatedProfile.personality.traits || [],
    mood: generatedProfile.personality.mood || "cheerful",
    speakingStyle: generatedProfile.personality.speakingStyle || "casual",
    tone: generatedProfile.personality.tone || "friendly",
    backstory: generatedProfile.personality.backstory || "",
    interests: generatedProfile.personality.interests || [],
    hobbies: generatedProfile.personality.hobbies || [],
    occupation: generatedProfile.personality.occupation || "",
    relationshipStyle: generatedProfile.personality.relationshipStyle || "friend",
    flirtLevel: generatedProfile.personality.flirtLevel || 3,
    affectionLevel: generatedProfile.personality.affectionLevel || 6,
    likes: generatedProfile.personality.likes || [],
    dislikes: generatedProfile.personality.dislikes || [],
    favoriteTopics: generatedProfile.personality.favoriteTopics || [],
    avoidTopics: generatedProfile.personality.avoidTopics || [],
  };

  return {
    name: generatedProfile.name,
    description: generatedProfile.description,
    category: generatedProfile.category || profileType,
    personality,
    physicalAttributes,
  };
}

// Generate image prompts for character
function generateImagePrompts(
  character: CreateCharacterData,
  profileType: CharacterProfileType,
  count: number
): string[] {
  const profileInfo = PROFILE_TYPE_DESCRIPTIONS[profileType];
  
  const sceneTemplates: Record<CharacterProfileType, string[]> = {
    influencer: [
      "taking a mirror selfie in a trendy cafe",
      "posing in front of colorful street art mural",
      "sitting at a rooftop bar with city skyline view",
      "casual pose in a cozy home setting with plants",
      "outdoor golden hour photoshoot in urban setting",
      "walking down a fashion district street",
      "sitting at a beach club with ocean view",
    ],
    gamer: [
      "sitting at a high-end gaming setup with RGB lighting",
      "wearing headphones with gaming gear visible",
      "casual pose with gaming controller",
      "at a gaming convention or esports event",
      "relaxed pose in a modern gaming room",
      "streaming setup with microphone and webcam visible",
    ],
    yoga_instructor: [
      "peaceful meditation pose in natural setting",
      "standing in a serene yoga studio",
      "outdoor yoga pose at sunrise or sunset",
      "relaxed pose in a wellness retreat setting",
      "teaching position in a bright studio",
      "sitting peacefully in a zen garden",
    ],
    tech: [
      "in a modern tech office with computers",
      "casual pose at a startup workspace",
      "speaking at a tech conference podium",
      "working on a laptop in a minimalist setting",
      "standing in a server room or data center",
      "brainstorming at a whiteboard",
    ],
    billionaire: [
      "in a luxury penthouse with city views",
      "sitting in a private jet cabin",
      "walking through a high-end gallery",
      "at a luxury yacht deck",
      "in a designer office with art pieces",
      "at an exclusive gala event",
    ],
    philosopher: [
      "in a classic library surrounded by books",
      "thoughtful pose at a wooden desk",
      "walking through a historic university campus",
      "in a cozy study with fireplace",
      "giving a lecture at a university",
      "contemplative pose in a garden",
    ],
    fitness: [
      "at a modern gym with equipment",
      "outdoor running or jogging scene",
      "stretching before workout",
      "confident pose showing athletic physique",
      "at a sports facility",
      "post-workout with water bottle",
    ],
    artist: [
      "in an art studio with canvases",
      "holding paintbrushes with colorful background",
      "at an art gallery opening",
      "creative workspace with art supplies",
      "standing in front of their artwork",
      "working on a creative project",
    ],
    musician: [
      "on stage with musical instruments",
      "in a recording studio",
      "casual pose with guitar or instrument",
      "backstage at a concert venue",
      "in a music practice room",
      "performing at an intimate venue",
    ],
    chef: [
      "in a professional kitchen",
      "preparing food with beautiful plating",
      "at a restaurant with elegant ambiance",
      "at a farmer's market with fresh ingredients",
      "teaching a cooking class",
      "casual pose in a home kitchen",
    ],
    entrepreneur: [
      "in a modern startup office",
      "speaking at a business conference",
      "casual meeting in a co-working space",
      "standing confidently in front of company logo",
      "working late on laptop with city views",
      "networking at a business event",
    ],
    model: [
      "professional fashion photoshoot",
      "runway-style pose in designer clothing",
      "editorial style portrait",
      "casual street style photography",
      "elegant evening wear photoshoot",
      "natural beauty outdoor shoot",
    ],
    scientist: [
      "in a laboratory with equipment",
      "at a research presentation",
      "working with scientific instruments",
      "at a university campus",
      "casual pose in an office with books",
      "teaching or mentoring students",
    ],
    traveler: [
      "at an exotic travel destination",
      "standing at a scenic viewpoint",
      "exploring a historic city center",
      "at an airport with luggage",
      "adventure activity like hiking or diving",
      "at a beautiful beach or mountain",
    ],
    wellness: [
      "in a peaceful spa setting",
      "surrounded by plants and natural elements",
      "practicing self-care rituals",
      "at a wellness retreat",
      "calm pose in a meditation space",
      "in a bright, positive environment",
    ],
  };

  const scenes = sceneTemplates[profileType] || sceneTemplates.influencer;
  const selectedScenes = randomPickMultiple(scenes, count);
  
  return selectedScenes.map(scene => {
    const lighting = randomPick(["natural lighting", "golden hour", "soft studio lighting", "dramatic lighting"]);
    return `${scene}, ${lighting}, professional photography, high quality`;
  });
}

// POST - Generate a single character with images
export async function POST(request: NextRequest) {
  console.log("[character-automation/generate] POST request started");
  
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
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const body = await request.json();
    const {
      profileType,
      gender,
      imagesPerCharacter = 5,
      settingsId,
      queueItemId,
    } = body;

    if (!profileType || !gender) {
      return NextResponse.json(
        { error: "Profile type and gender are required" },
        { status: 400 }
      );
    }

    console.log(`[character-automation/generate] Generating ${gender} ${profileType} with ${imagesPerCharacter} images`);

    // Update queue item status if provided
    if (queueItemId) {
      await supabase
        .from("character_generation_queue")
        .update({ status: "generating", started_at: new Date().toISOString() })
        .eq("id", queueItemId);
    }

    // Step 1: Generate character profile using AI
    console.log("[character-automation/generate] Step 1: Generating character profile...");
    const characterData = await generateCharacterProfile(profileType, gender, openai);
    console.log(`[character-automation/generate] Generated profile for: ${characterData.name}`);

    // Step 2: Generate tags for the character
    let tags = [
      profileType.replace("_", " "),
      gender,
      characterData.physicalAttributes.ethnicity,
      characterData.physicalAttributes.hairColor,
      ...characterData.personality.traits.slice(0, 3),
    ];

    // Step 3: Create the character in database
    console.log("[character-automation/generate] Step 2: Creating character in database...");
    const { data: character, error: charError } = await supabase
      .from("characters")
      .insert({
        user_id: user.id,
        name: characterData.name,
        description: characterData.description,
        category: characterData.category,
        personality: characterData.personality,
        physical_attributes: characterData.physicalAttributes,
        tags,
        is_public: false, // Will be set based on user preference later
      })
      .select()
      .single();

    if (charError || !character) {
      console.error("[character-automation/generate] Error creating character:", charError);
      if (queueItemId) {
        await supabase
          .from("character_generation_queue")
          .update({ status: "failed", error_message: charError?.message })
          .eq("id", queueItemId);
      }
      return NextResponse.json(
        { error: "Failed to create character" },
        { status: 500 }
      );
    }

    console.log(`[character-automation/generate] Character created with ID: ${character.id}`);

    // Step 4: Generate image prompts
    const imagePrompts = generateImagePrompts(characterData, profileType, imagesPerCharacter);
    console.log(`[character-automation/generate] Generated ${imagePrompts.length} image prompts`);

    // Step 5: Generate images
    const generatedImages: any[] = [];
    const generationErrors: string[] = [];

    for (let i = 0; i < imagePrompts.length; i++) {
      console.log(`[character-automation/generate] Generating image ${i + 1}/${imagePrompts.length}...`);
      
      try {
        const imageResult = await generateImage({
          supabase,
          userId: user.id,
          characterId: character.id,
          character: {
            main_face_image: i === 0 ? null : character.main_face_image,
            physical_attributes: characterData.physicalAttributes,
            thumbnail: character.thumbnail,
          },
          scenePrompt: imagePrompts[i],
          width: 1024,
          height: 1024,
          faceSwapBaseUrl: request.nextUrl.origin,
        });

        if (imageResult.success && imageResult.image) {
          generatedImages.push(imageResult.image);
          
          // After first image, update character with main face
          if (i === 0) {
            // Refresh character data to get updated main_face_image
            const { data: updatedChar } = await supabase
              .from("characters")
              .select("main_face_image, thumbnail")
              .eq("id", character.id)
              .single();
            
            if (updatedChar) {
              character.main_face_image = updatedChar.main_face_image;
              character.thumbnail = updatedChar.thumbnail;
            }
          }
          
          // Update queue progress
          if (queueItemId) {
            await supabase
              .from("character_generation_queue")
              .update({ images_generated: i + 1 })
              .eq("id", queueItemId);
          }
        } else {
          generationErrors.push(`Image ${i + 1}: ${imageResult.error || "Unknown error"}`);
        }
      } catch (imageError: any) {
        console.error(`[character-automation/generate] Error generating image ${i + 1}:`, imageError);
        generationErrors.push(`Image ${i + 1}: ${imageError.message}`);
      }
    }

    // Step 6: Record auto-generated character
    if (settingsId) {
      await supabase
        .from("auto_generated_characters")
        .insert({
          user_id: user.id,
          settings_id: settingsId,
          character_id: character.id,
          profile_type: profileType,
          images_generated: generatedImages.length,
          is_complete: generatedImages.length >= imagesPerCharacter,
          generation_prompts: imagePrompts,
          generation_errors: generationErrors.length > 0 ? generationErrors : null,
        });

      // Update settings totals
      await supabase.rpc("increment_auto_generation_stats", {
        p_settings_id: settingsId,
        p_characters: 1,
        p_images: generatedImages.length,
      });
    }

    // Update queue item to completed
    if (queueItemId) {
      await supabase
        .from("character_generation_queue")
        .update({
          status: "completed",
          character_id: character.id,
          images_generated: generatedImages.length,
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueItemId);
    }

    console.log(`[character-automation/generate] Completed! Generated ${generatedImages.length}/${imagesPerCharacter} images`);

    return NextResponse.json({
      success: true,
      character: {
        id: character.id,
        name: character.name,
        description: character.description,
        category: character.category,
        thumbnail: character.thumbnail,
        profileType,
        gender,
      },
      images: generatedImages,
      imagesGenerated: generatedImages.length,
      totalImages: imagesPerCharacter,
      errors: generationErrors.length > 0 ? generationErrors : undefined,
    });
  } catch (error: any) {
    console.error("[character-automation/generate] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate character" },
      { status: 500 }
    );
  }
}
