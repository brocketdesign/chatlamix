"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";
import Link from "next/link";
import { MobileBottomNav } from "@/components/Navigation";
import {
  CharacterPersonality,
  PhysicalAttributes,
  CreateCharacterData,
} from "@/lib/types";

const defaultPersonality: CharacterPersonality = {
  traits: [],
  mood: "cheerful",
  speakingStyle: "casual",
  tone: "warm",
  backstory: "",
  interests: [],
  hobbies: [],
  occupation: "",
  relationshipStyle: "friend",
  flirtLevel: 3,
  affectionLevel: 5,
  likes: [],
  dislikes: [],
  favoriteTopics: [],
  avoidTopics: [],
};

const defaultPhysicalAttributes: PhysicalAttributes = {
  gender: "female",
  age: "20s",
  ethnicity: "",
  faceShape: "oval",
  eyeColor: "brown",
  eyeShape: "almond",
  noseType: "straight",
  lipShape: "full",
  skinTone: "fair",
  hairColor: "brunette",
  hairLength: "long",
  hairStyle: "straight",
  hairTexture: "silky",
  bodyType: "slim",
  height: "average",
  distinctiveFeatures: [],
  fashionStyle: "casual",
  makeup: "natural",
};

// Preset options for form fields
const presetOptions = {
  genders: ["female", "male", "non-binary"],
  ages: ["teens", "early 20s", "mid 20s", "late 20s", "early 30s", "mid 30s", "late 30s", "40s"],
  ethnicities: [
    "Caucasian",
    "Asian",
    "African",
    "Hispanic/Latina",
    "Middle Eastern",
    "South Asian",
    "Mixed",
    "Other",
  ],
  faceShapes: ["oval", "round", "heart", "square", "oblong", "diamond"],
  eyeColors: ["brown", "blue", "green", "hazel", "gray", "amber", "black"],
  eyeShapes: ["almond", "round", "hooded", "monolid", "upturned", "downturned"],
  skinTones: [
    "porcelain",
    "fair",
    "light",
    "medium",
    "olive",
    "tan",
    "brown",
    "dark",
  ],
  hairColors: [
    "blonde",
    "brunette",
    "black",
    "red",
    "auburn",
    "gray",
    "platinum",
    "pink",
    "blue",
    "purple",
  ],
  hairLengths: ["pixie", "short", "medium", "long", "very long"],
  hairStyles: [
    "straight",
    "wavy",
    "curly",
    "braided",
    "ponytail",
    "bun",
    "bob",
    "layers",
  ],
  hairTextures: ["silky", "fine", "thick", "coarse", "wavy", "curly", "kinky"],
  bodyTypes: ["slim", "athletic", "curvy", "petite", "average", "plus-size"],
  heights: ["petite", "short", "average", "tall", "very tall"],
  fashionStyles: [
    "casual",
    "elegant",
    "sporty",
    "bohemian",
    "streetwear",
    "vintage",
    "minimalist",
    "glamorous",
  ],
  makeupStyles: [
    "natural",
    "minimal",
    "glamorous",
    "bold",
    "artistic",
    "none",
  ],
  moods: [
    "cheerful",
    "mysterious",
    "playful",
    "serious",
    "dreamy",
    "energetic",
    "calm",
  ],
  speakingStyles: [
    "casual",
    "formal",
    "flirty",
    "intellectual",
    "bubbly",
    "sarcastic",
    "sweet",
  ],
  tones: [
    "warm",
    "enthusiastic",
    "sarcastic",
    "caring",
    "confident",
    "shy",
    "playful",
  ],
  relationshipStyles: [
    "friend",
    "best friend",
    "girlfriend",
    "mentor",
    "companion",
    "admirer",
  ],
  personalityTraits: [
    "friendly",
    "witty",
    "caring",
    "adventurous",
    "creative",
    "intelligent",
    "confident",
    "shy",
    "mysterious",
    "playful",
    "romantic",
    "ambitious",
    "loyal",
    "spontaneous",
    "empathetic",
  ],
  categories: [
    "Girlfriend",
    "Boyfriend",
    "Anime",
    "Realistic",
    "Fantasy",
    "Celebrity",
    "Cosplay",
    "Professional",
    "Casual",
  ],
};

export default function CreateCharacterPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [characterLimits, setCharacterLimits] = useState<{
    limit: number;
    current: number;
    remaining: number;
    isPremium: boolean;
    canCreate: boolean;
  } | null>(null);
  const [limitsLoading, setLimitsLoading] = useState(true);

  // Check character limits on mount
  useEffect(() => {
    const checkLimits = async () => {
      try {
        const response = await fetch("/api/characters?type=limits");
        if (response.ok) {
          const data = await response.json();
          setCharacterLimits(data);
        }
      } catch (err) {
        console.error("Failed to check character limits:", err);
      } finally {
        setLimitsLoading(false);
      }
    };
    if (user) {
      checkLimits();
    } else {
      setLimitsLoading(false);
    }
  }, [user]);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Girlfriend");
  const [personality, setPersonality] =
    useState<CharacterPersonality>(defaultPersonality);
  const [physicalAttributes, setPhysicalAttributes] =
    useState<PhysicalAttributes>(defaultPhysicalAttributes);

  // Helper for array inputs
  const handleArrayInput = (
    field: keyof CharacterPersonality,
    value: string
  ) => {
    const items = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setPersonality((prev) => ({ ...prev, [field]: items }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const characterData: CreateCharacterData = {
        name,
        description,
        category,
        personality,
        physicalAttributes,
      };

      const response = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(characterData),
      });

      const data = await response.json();
      
      if (!response.ok) {
        // Handle character limit error specifically
        if (response.status === 403 && data.error === "Character limit reached") {
          setError(data.message || "Character limit reached");
          setCharacterLimits({
            limit: data.limit,
            current: data.current,
            remaining: 0,
            isPremium: data.isPremium,
            canCreate: false,
          });
          return;
        }
        throw new Error(data.error || "Failed to create character");
      }

      router.push(`/dashboard/character/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Show limit reached screen
  if (!limitsLoading && characterLimits && !characterLimits.canCreate) {
    return (
      <div className="min-h-screen bg-surface-dark text-white">
        <header className="sticky top-0 z-10 glass border-b border-border">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-2xl hover:text-primary-light transition-colors"
            >
              ←
            </Link>
            <h1 className="text-xl font-bold gradient-text">Create Character</h1>
          </div>
        </header>
        
        <main className="max-w-2xl mx-auto px-4 py-12">
          <div className="glass rounded-2xl p-8 text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold mb-4">Character Limit Reached</h2>
            <p className="text-text-secondary mb-6">
              {characterLimits.isPremium 
                ? `You've reached the maximum of ${characterLimits.limit} characters for Premium users.`
                : `Free users can only create ${characterLimits.limit} character. Upgrade to Premium to create up to 10 characters!`
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/dashboard"
                className="px-6 py-3 rounded-full bg-surface-light border border-border hover:border-primary transition-all"
              >
                Back to Dashboard
              </Link>
              {!characterLimits.isPremium && (
                <Link
                  href="/dashboard/monetization/upgrade"
                  className="px-6 py-3 rounded-full gradient-primary hover:opacity-90 transition-all font-semibold"
                >
                  ✨ Upgrade to Premium
                </Link>
              )}
            </div>
          </div>
        </main>
        
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-2xl hover:text-primary-light transition-colors"
            >
              ←
            </Link>
            <h1 className="text-xl font-bold gradient-text">Create Character</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= s
                    ? "gradient-primary"
                    : "bg-surface-light border border-border"
                }`}
              >
                {s}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400">
            {error}
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="glass border border-border rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Character Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Luna, Aria, Zara"
                    className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your character's persona and role..."
                    rows={3}
                    className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {presetOptions.categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`px-4 py-2 rounded-full text-sm transition-all ${
                          category === cat
                            ? "gradient-primary text-white"
                            : "bg-surface-light border border-border hover:border-primary/50"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!name || !description}
                className="gradient-primary text-white py-3 px-8 rounded-full font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Physical Attributes
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Physical Attributes */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="glass border border-border rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-4">Physical Attributes</h2>
              <p className="text-gray-400 text-sm mb-6">
                Define your character appearance for consistent image
                generation
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Gender */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Gender
                  </label>
                  <div className="flex gap-2">
                    {presetOptions.genders.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() =>
                          setPhysicalAttributes((prev) => ({
                            ...prev,
                            gender: g as any,
                          }))
                        }
                        className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${
                          physicalAttributes.gender === g
                            ? "gradient-primary text-white"
                            : "bg-surface-light border border-border hover:border-primary/50"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Age */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Age</label>
                  <select
                    value={physicalAttributes.age}
                    onChange={(e) =>
                      setPhysicalAttributes((prev) => ({
                        ...prev,
                        age: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                  >
                    {presetOptions.ages.map((age) => (
                      <option key={age} value={age}>
                        {age}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ethnicity */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Ethnicity
                  </label>
                  <select
                    value={physicalAttributes.ethnicity}
                    onChange={(e) =>
                      setPhysicalAttributes((prev) => ({
                        ...prev,
                        ethnicity: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                  >
                    <option value="">Select...</option>
                    {presetOptions.ethnicities.map((eth) => (
                      <option key={eth} value={eth}>
                        {eth}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Skin Tone */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Skin Tone
                  </label>
                  <select
                    value={physicalAttributes.skinTone}
                    onChange={(e) =>
                      setPhysicalAttributes((prev) => ({
                        ...prev,
                        skinTone: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                  >
                    {presetOptions.skinTones.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Face Shape */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Face Shape
                  </label>
                  <select
                    value={physicalAttributes.faceShape}
                    onChange={(e) =>
                      setPhysicalAttributes((prev) => ({
                        ...prev,
                        faceShape: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                  >
                    {presetOptions.faceShapes.map((fs) => (
                      <option key={fs} value={fs}>
                        {fs}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Eye Color */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Eye Color
                  </label>
                  <select
                    value={physicalAttributes.eyeColor}
                    onChange={(e) =>
                      setPhysicalAttributes((prev) => ({
                        ...prev,
                        eyeColor: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                  >
                    {presetOptions.eyeColors.map((ec) => (
                      <option key={ec} value={ec}>
                        {ec}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Eye Shape */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Eye Shape
                  </label>
                  <select
                    value={physicalAttributes.eyeShape}
                    onChange={(e) =>
                      setPhysicalAttributes((prev) => ({
                        ...prev,
                        eyeShape: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                  >
                    {presetOptions.eyeShapes.map((es) => (
                      <option key={es} value={es}>
                        {es}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Hair Color */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Hair Color
                  </label>
                  <select
                    value={physicalAttributes.hairColor}
                    onChange={(e) =>
                      setPhysicalAttributes((prev) => ({
                        ...prev,
                        hairColor: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                  >
                    {presetOptions.hairColors.map((hc) => (
                      <option key={hc} value={hc}>
                        {hc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Hair Length */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Hair Length
                  </label>
                  <select
                    value={physicalAttributes.hairLength}
                    onChange={(e) =>
                      setPhysicalAttributes((prev) => ({
                        ...prev,
                        hairLength: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                  >
                    {presetOptions.hairLengths.map((hl) => (
                      <option key={hl} value={hl}>
                        {hl}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Hair Style */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Hair Style
                  </label>
                  <select
                    value={physicalAttributes.hairStyle}
                    onChange={(e) =>
                      setPhysicalAttributes((prev) => ({
                        ...prev,
                        hairStyle: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                  >
                    {presetOptions.hairStyles.map((hs) => (
                      <option key={hs} value={hs}>
                        {hs}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Body Type */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Body Type
                  </label>
                  <select
                    value={physicalAttributes.bodyType}
                    onChange={(e) =>
                      setPhysicalAttributes((prev) => ({
                        ...prev,
                        bodyType: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                  >
                    {presetOptions.bodyTypes.map((bt) => (
                      <option key={bt} value={bt}>
                        {bt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Height */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Height
                  </label>
                  <select
                    value={physicalAttributes.height}
                    onChange={(e) =>
                      setPhysicalAttributes((prev) => ({
                        ...prev,
                        height: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                  >
                    {presetOptions.heights.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fashion Style */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Fashion Style
                  </label>
                  <select
                    value={physicalAttributes.fashionStyle}
                    onChange={(e) =>
                      setPhysicalAttributes((prev) => ({
                        ...prev,
                        fashionStyle: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                  >
                    {presetOptions.fashionStyles.map((fs) => (
                      <option key={fs} value={fs}>
                        {fs}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Makeup */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Makeup Style
                  </label>
                  <select
                    value={physicalAttributes.makeup}
                    onChange={(e) =>
                      setPhysicalAttributes((prev) => ({
                        ...prev,
                        makeup: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                  >
                    {presetOptions.makeupStyles.map((ms) => (
                      <option key={ms} value={ms}>
                        {ms}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Distinctive Features */}
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-400 mb-2">
                    Distinctive Features (comma separated)
                  </label>
                  <input
                    type="text"
                    value={physicalAttributes.distinctiveFeatures?.join(", ")}
                    onChange={(e) =>
                      setPhysicalAttributes((prev) => ({
                        ...prev,
                        distinctiveFeatures: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }))
                    }
                    placeholder="e.g., dimples, freckles, beauty mark, piercing"
                    className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="bg-surface-light border border-border text-white py-3 px-8 rounded-full font-semibold hover:border-primary/50 transition-all"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="gradient-primary text-white py-3 px-8 rounded-full font-semibold hover:opacity-90 transition-all"
              >
                Next: Personality
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Personality */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="glass border border-border rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-4">Personality & Chat</h2>
              <p className="text-gray-400 text-sm mb-6">
                Define your character personality for engaging conversations
              </p>

              <div className="space-y-6">
                {/* Personality Traits */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Personality Traits (select up to 5)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {presetOptions.personalityTraits.map((trait) => (
                      <button
                        key={trait}
                        type="button"
                        onClick={() => {
                          const current = personality.traits;
                          if (current.includes(trait)) {
                            setPersonality((prev) => ({
                              ...prev,
                              traits: current.filter((t) => t !== trait),
                            }));
                          } else if (current.length < 5) {
                            setPersonality((prev) => ({
                              ...prev,
                              traits: [...current, trait],
                            }));
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                          personality.traits.includes(trait)
                            ? "gradient-primary text-white"
                            : "bg-surface-light border border-border hover:border-primary/50"
                        }`}
                      >
                        {trait}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Mood */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Default Mood
                    </label>
                    <select
                      value={personality.mood}
                      onChange={(e) =>
                        setPersonality((prev) => ({
                          ...prev,
                          mood: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                    >
                      {presetOptions.moods.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Speaking Style */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Speaking Style
                    </label>
                    <select
                      value={personality.speakingStyle}
                      onChange={(e) =>
                        setPersonality((prev) => ({
                          ...prev,
                          speakingStyle: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                    >
                      {presetOptions.speakingStyles.map((ss) => (
                        <option key={ss} value={ss}>
                          {ss}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tone */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Tone
                    </label>
                    <select
                      value={personality.tone}
                      onChange={(e) =>
                        setPersonality((prev) => ({
                          ...prev,
                          tone: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                    >
                      {presetOptions.tones.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Relationship Style */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Relationship Style
                    </label>
                    <select
                      value={personality.relationshipStyle}
                      onChange={(e) =>
                        setPersonality((prev) => ({
                          ...prev,
                          relationshipStyle: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                    >
                      {presetOptions.relationshipStyles.map((rs) => (
                        <option key={rs} value={rs}>
                          {rs}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Occupation */}
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-400 mb-2">
                      Occupation
                    </label>
                    <input
                      type="text"
                      value={personality.occupation}
                      onChange={(e) =>
                        setPersonality((prev) => ({
                          ...prev,
                          occupation: e.target.value,
                        }))
                      }
                      placeholder="e.g., Fashion model, Tech influencer, Fitness trainer"
                      className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Flirt & Affection Levels */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Flirtiness Level: {personality.flirtLevel}/10
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={personality.flirtLevel}
                      onChange={(e) =>
                        setPersonality((prev) => ({
                          ...prev,
                          flirtLevel: parseInt(e.target.value),
                        }))
                      }
                      className="w-full accent-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Affection Level: {personality.affectionLevel}/10
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={personality.affectionLevel}
                      onChange={(e) =>
                        setPersonality((prev) => ({
                          ...prev,
                          affectionLevel: parseInt(e.target.value),
                        }))
                      }
                      className="w-full accent-primary"
                    />
                  </div>
                </div>

                {/* Backstory */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Backstory
                  </label>
                  <textarea
                    value={personality.backstory}
                    onChange={(e) =>
                      setPersonality((prev) => ({
                        ...prev,
                        backstory: e.target.value,
                      }))
                    }
                    placeholder="Write a brief backstory for your character..."
                    rows={3}
                    className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none transition-colors resize-none"
                  />
                </div>

                {/* Interests */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Interests (comma separated)
                  </label>
                  <input
                    type="text"
                    value={personality.interests.join(", ")}
                    onChange={(e) => handleArrayInput("interests", e.target.value)}
                    placeholder="e.g., fashion, photography, travel"
                    className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none transition-colors"
                  />
                </div>

                {/* Hobbies */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Hobbies (comma separated)
                  </label>
                  <input
                    type="text"
                    value={personality.hobbies.join(", ")}
                    onChange={(e) => handleArrayInput("hobbies", e.target.value)}
                    placeholder="e.g., yoga, reading, painting, gaming"
                    className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none transition-colors"
                  />
                </div>

                {/* Likes & Dislikes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Likes (comma separated)
                    </label>
                    <input
                      type="text"
                      value={personality.likes.join(", ")}
                      onChange={(e) => handleArrayInput("likes", e.target.value)}
                      placeholder="e.g., sunny days, good music, deep talks"
                      className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Dislikes (comma separated)
                    </label>
                    <input
                      type="text"
                      value={personality.dislikes.join(", ")}
                      onChange={(e) =>
                        handleArrayInput("dislikes", e.target.value)
                      }
                      placeholder="e.g., negativity, being late, cold weather"
                      className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Favorite Topics */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Favorite Conversation Topics (comma separated)
                  </label>
                  <input
                    type="text"
                    value={personality.favoriteTopics.join(", ")}
                    onChange={(e) =>
                      handleArrayInput("favoriteTopics", e.target.value)
                    }
                    placeholder="e.g., movies, relationships, dreams"
                    className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="bg-surface-light border border-border text-white py-3 px-8 rounded-full font-semibold hover:border-primary/50 transition-all"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || personality.traits.length === 0}
                className="gradient-primary text-white py-3 px-8 rounded-full font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    Creating...
                  </>
                ) : (
                  "Create Character"
                )}
              </button>
            </div>
          </div>
        )}
      </main>
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
