"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";
import Link from "next/link";
import { Character, CharacterImage } from "@/lib/types";
import ShareToSocialMedia from "@/components/ShareToSocialMedia";

export default function CharacterManagePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const characterId = params.id as string;

  const [character, setCharacter] = useState<Character | null>(null);
  const [images, setImages] = useState<CharacterImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"gallery" | "settings">("gallery");

  // Image generation form
  const [scenePrompt, setScenePrompt] = useState("");
  const [imageWidth, setImageWidth] = useState(1024);
  const [imageHeight, setImageHeight] = useState(1024);

  // Social media sharing
  const [imageToShare, setImageToShare] = useState<CharacterImage | null>(null);

  useEffect(() => {
    if (!isLoading && user) {
      const loadData = async () => {
        try {
          const [charResponse, imgResponse] = await Promise.all([
            fetch(`/api/characters?id=${characterId}`),
            fetch(`/api/generate-image?characterId=${characterId}`)
          ]);
          
          if (charResponse.ok) {
            const charData = await charResponse.json();
            setCharacter(charData);
          } else {
            setError("Character not found");
          }
          
          if (imgResponse.ok) {
            const imgData = await imgResponse.json();
            setImages(imgData);
          }
        } catch (err) {
          setError("Failed to load character");
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [isLoading, user, characterId]);

  const handleGenerateImage = async () => {
    if (!scenePrompt.trim()) {
      setError("Please describe the scene for the image");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          scenePrompt,
          width: imageWidth,
          height: imageHeight,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate image");
      }

      const result = await response.json();
      setImages((prev) => [result.image, ...prev]);
      setScenePrompt("");

      // Refresh character to get updated thumbnail
      const charResponse = await fetch(`/api/characters?id=${characterId}`);
      if (charResponse.ok) {
        const charData = await charResponse.json();
        setCharacter(charData);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSetMainFace = async (imageId: string) => {
    try {
      const response = await fetch("/api/characters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: characterId,
          mainFaceImage: images.find((img) => img.id === imageId)?.imageUrl,
        }),
      });

      if (response.ok) {
        setImages((prev) =>
          prev.map((img) => ({
            ...img,
            isMainFace: img.id === imageId,
          }))
        );
        // Refresh character
        const charResponse = await fetch(`/api/characters?id=${characterId}`);
        if (charResponse.ok) {
          const charData = await charResponse.json();
          setCharacter(charData);
        }
      }
    } catch (err) {
      console.error("Failed to set main face:", err);
    }
  };

  const handleTogglePublic = async () => {
    if (!character) return;

    try {
      const response = await fetch("/api/characters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: characterId,
          isPublic: !character.isPublic,
        }),
      });

      if (response.ok) {
        setCharacter((prev) =>
          prev ? { ...prev, isPublic: !prev.isPublic } : null
        );
      }
    } catch (err) {
      console.error("Failed to update visibility:", err);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-surface-dark text-white flex items-center justify-center">
        <div className="text-center glass border border-border rounded-2xl p-8">
          <h1 className="text-2xl font-bold mb-4">Character not found</h1>
          <Link
            href="/dashboard"
            className="text-primary-light hover:text-primary transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-2xl hover:text-primary-light transition-colors"
            >
              ←
            </Link>
            <div className="flex items-center gap-3">
              {character.thumbnail ? (
                <img
                  src={character.thumbnail}
                  alt={character.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-primary"
                />
              ) : (
                <div className="w-10 h-10 rounded-full gradient-primary" />
              )}
              <div>
                <h1 className="font-bold">{character.name}</h1>
                <p className="text-xs text-primary-light">{character.category}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/chat/${characterId}`}
              className="py-2 px-4 bg-surface-light border border-border rounded-lg hover:border-primary/50 transition-all"
            >
              Chat
            </Link>
            <button
              onClick={handleTogglePublic}
              className={`py-2 px-4 rounded-lg text-sm transition-all ${
                character.isPublic
                  ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                  : "bg-surface-light border border-border hover:border-primary/50"
              }`}
            >
              {character.isPublic ? "Public" : "Private"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400">
            {error}
            <button
              onClick={() => setError("")}
              className="ml-2 text-red-300 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("gallery")}
            className={`py-2 px-4 rounded-lg transition-all ${
              activeTab === "gallery"
                ? "gradient-primary text-white"
                : "bg-surface-light border border-border hover:border-primary/50"
            }`}
          >
            Gallery & Generate
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`py-2 px-4 rounded-lg transition-all ${
              activeTab === "settings"
                ? "gradient-primary text-white"
                : "bg-surface-light border border-border hover:border-primary/50"
            }`}
          >
            Character Info
          </button>
        </div>

        {activeTab === "gallery" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Image Generation Panel */}
            <div className="lg:col-span-1">
              <div className="glass border border-border rounded-2xl p-6 sticky top-24">
                <h2 className="text-lg font-semibold mb-4">Generate Image</h2>

                {character.mainFaceImage && (
                  <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-xs text-green-400 mb-2">
                      ✓ Main face set - Face swap will be applied automatically
                    </p>
                    <img
                      src={character.mainFaceImage}
                      alt="Main face"
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Scene Description
                    </label>
                    <textarea
                      value={scenePrompt}
                      onChange={(e) => setScenePrompt(e.target.value)}
                      placeholder="Describe the scene, outfit, pose, background..."
                      rows={4}
                      className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none transition-colors resize-none text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Width
                      </label>
                      <select
                        value={imageWidth}
                        onChange={(e) => setImageWidth(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-sm focus:border-primary focus:outline-none"
                      >
                        <option value={512}>512px</option>
                        <option value={768}>768px</option>
                        <option value={1024}>1024px</option>
                        <option value={1280}>1280px</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Height
                      </label>
                      <select
                        value={imageHeight}
                        onChange={(e) => setImageHeight(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-sm focus:border-primary focus:outline-none"
                      >
                        <option value={512}>512px</option>
                        <option value={768}>768px</option>
                        <option value={1024}>1024px</option>
                        <option value={1280}>1280px</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateImage}
                    disabled={generating || !scenePrompt.trim()}
                    className="w-full gradient-primary text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <>
                        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        Generate Image
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-500 text-center">
                    Character attributes will be automatically included in the
                    prompt
                  </p>
                </div>
              </div>
            </div>

            {/* Image Gallery */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  Gallery ({images.length} images)
                </h2>
              </div>

              {images.length === 0 ? (
                <div className="text-center py-12 glass border border-border rounded-2xl">
                  <div className="w-16 h-16 rounded-full gradient-primary opacity-50 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No images yet</h3>
                  <p className="text-gray-400 text-sm">
                    Generate your first image to establish your character look
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="group relative aspect-square rounded-xl overflow-hidden bg-surface border border-border hover:border-primary/50 transition-all"
                    >
                      <img
                        src={image.imageUrl}
                        alt="Generated"
                        className="w-full h-full object-cover"
                      />
                      {image.isMainFace && (
                        <div className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                          Main Face
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <div className="flex gap-2 mb-2">
                            {!image.isMainFace && (
                              <button
                                onClick={() => handleSetMainFace(image.id)}
                                className="flex-1 py-2 bg-white/20 backdrop-blur rounded-lg text-sm hover:bg-white/30 transition-all"
                              >
                                Set as Main Face
                              </button>
                            )}
                            <button
                              onClick={() => setImageToShare(image)}
                              className="py-2 px-3 bg-primary/80 backdrop-blur rounded-lg text-sm hover:bg-primary transition-all flex items-center gap-1"
                              title="Partager sur les réseaux sociaux"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                              </svg>
                              Share
                            </button>
                          </div>
                          <p className="text-xs text-gray-300 line-clamp-2">
                            {image.prompt}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Character Info */}
            <div className="glass border border-border rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Name</label>
                  <p className="font-medium">{character.name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Description</label>
                  <p>{character.description}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Category</label>
                  <p>{character.category}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Tags</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {character.tags?.map((tag, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary-light"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Physical Attributes */}
            {character.physicalAttributes && (
              <div className="glass border border-border rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-4">
                  Physical Attributes
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-gray-400">Gender</label>
                    <p>{character.physicalAttributes.gender}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">Age</label>
                    <p>{character.physicalAttributes.age}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">Ethnicity</label>
                    <p>{character.physicalAttributes.ethnicity}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">Skin Tone</label>
                    <p>{character.physicalAttributes.skinTone}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">Hair</label>
                    <p>
                      {character.physicalAttributes.hairColor}{" "}
                      {character.physicalAttributes.hairLength}{" "}
                      {character.physicalAttributes.hairStyle}
                    </p>
                  </div>
                  <div>
                    <label className="text-gray-400">Eyes</label>
                    <p>
                      {character.physicalAttributes.eyeColor}{" "}
                      {character.physicalAttributes.eyeShape}
                    </p>
                  </div>
                  <div>
                    <label className="text-gray-400">Body Type</label>
                    <p>{character.physicalAttributes.bodyType}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">Fashion Style</label>
                    <p>{character.physicalAttributes.fashionStyle}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Personality */}
            {character.personality && (
              <div className="glass border border-border rounded-2xl p-6 lg:col-span-2">
                <h2 className="text-lg font-semibold mb-4">Personality</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div>
                    <label className="text-gray-400">Traits</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {character.personality.traits.map((trait, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full bg-primary/20 text-primary-light"
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-400">Mood</label>
                    <p>{character.personality.mood}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">Speaking Style</label>
                    <p>{character.personality.speakingStyle}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">Relationship Style</label>
                    <p>{character.personality.relationshipStyle}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">Occupation</label>
                    <p>{character.personality.occupation || "Not specified"}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">Flirt Level</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-surface-light rounded-full overflow-hidden">
                        <div
                          className="h-full gradient-primary"
                          style={{
                            width: `${character.personality.flirtLevel * 10}%`,
                          }}
                        />
                      </div>
                      <span>{character.personality.flirtLevel}/10</span>
                    </div>
                  </div>
                  {character.personality.backstory && (
                    <div className="md:col-span-2">
                      <label className="text-gray-400">Backstory</label>
                      <p>{character.personality.backstory}</p>
                    </div>
                  )}
                  {character.personality.interests.length > 0 && (
                    <div>
                      <label className="text-gray-400">Interests</label>
                      <p>{character.personality.interests.join(", ")}</p>
                    </div>
                  )}
                  {character.personality.hobbies.length > 0 && (
                    <div>
                      <label className="text-gray-400">Hobbies</label>
                      <p>{character.personality.hobbies.join(", ")}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Social Media Share Modal */}
      {imageToShare && character && (
        <ShareToSocialMedia
          characterId={characterId}
          characterName={character.name}
          image={imageToShare}
          onClose={() => setImageToShare(null)}
          onSuccess={() => {
            // Optionally refresh or show a notification
          }}
        />
      )}
    </div>
  );
}
