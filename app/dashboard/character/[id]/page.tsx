"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";
import Link from "next/link";
import Image from "next/image";
import { Character, CharacterImage, GalleryStatus } from "@/lib/types";
import ShareToSocialMedia from "@/components/ShareToSocialMedia";
import { MobileBottomNav } from "@/components/Navigation";

// Aspect ratio configurations with HD resolutions
const ASPECT_RATIOS = {
  square: { width: 1024, height: 1024, label: 'Square', ratio: '1:1', icon: '◼️' },
  landscape: { width: 1280, height: 720, label: 'Landscape', ratio: '16:9', icon: '▬' },
  portrait: { width: 720, height: 1280, label: 'Portrait', ratio: '9:16', icon: '▮' },
} as const;

type AspectRatioKey = keyof typeof ASPECT_RATIOS;

// Calculate coin cost based on image dimensions (matches backend logic)
function getImageCoinCost(aspectRatio: AspectRatioKey): number {
  const { width, height } = ASPECT_RATIOS[aspectRatio];
  const pixels = width * height;
  if (pixels <= 512 * 512) return 5;
  if (pixels <= 1024 * 1024) return 10;
  return 15;
}

export default function CharacterManagePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const characterId = params.id as string;

  const [character, setCharacter] = useState<Character | null>(null);
  const [images, setImages] = useState<CharacterImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<'idle' | 'generating' | 'face-swapping' | 'finalizing'>('idle');
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"gallery" | "settings">("gallery");

  // Gallery management tabs
  const [galleryTab, setGalleryTab] = useState<GalleryStatus>('unposted');

  // Image generation form
  const [scenePrompt, setScenePrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioKey>('square');

  // Social media sharing
  const [imageToShare, setImageToShare] = useState<CharacterImage | null>(null);

  // Coin balance
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const [insufficientCoins, setInsufficientCoins] = useState(false);

  // Custom base face upload
  const [customBaseFace, setCustomBaseFace] = useState<string | null>(null);
  const [uploadingFace, setUploadingFace] = useState(false);
  const [faceUploadError, setFaceUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile picture selection
  const [showProfilePictureModal, setShowProfilePictureModal] = useState(false);
  const [updatingProfilePicture, setUpdatingProfilePicture] = useState(false);
  const profilePictureInputRef = useRef<HTMLInputElement>(null);

  // Calculate current cost
  const currentCoinCost = getImageCoinCost(aspectRatio);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      const loadData = async () => {
        try {
          const [charResponse, imgResponse, coinsResponse] = await Promise.all([
            fetch(`/api/characters?id=${characterId}`),
            fetch(`/api/generate-image?characterId=${characterId}`),
            fetch('/api/coins')
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

          if (coinsResponse.ok) {
            const coinsData = await coinsResponse.json();
            setCoinBalance(coinsData.balance?.balance ?? 0);
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
    setInsufficientCoins(false);
    setGenerationPhase('generating');
    setElapsedTime(0);

    // Start the timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    console.log("[handleGenerateImage] Starting generation with:", {
      characterId,
      hasCustomBaseFace: !!customBaseFace,
      customBaseFaceLength: customBaseFace?.length,
      characterMainFaceImage: character?.mainFaceImage?.length,
    });

    try {
      const { width, height } = ASPECT_RATIOS[aspectRatio];
      console.log("[handleGenerateImage] Sending request with aspectRatio:", aspectRatio, "width:", width, "height:", height);
      
      // Simulate phase changes based on typical timing
      // Image generation typically takes 10-20 seconds, then face swap another 5-10 seconds
      const hasFaceToSwap = !!(customBaseFace || character?.mainFaceImage);
      if (hasFaceToSwap) {
        setTimeout(() => {
          if (generating) setGenerationPhase('face-swapping');
        }, 12000); // Switch to face-swapping after ~12 seconds
        setTimeout(() => {
          if (generating) setGenerationPhase('finalizing');
        }, 20000); // Switch to finalizing after ~20 seconds
      } else {
        setTimeout(() => {
          if (generating) setGenerationPhase('finalizing');
        }, 15000); // Switch to finalizing after ~15 seconds
      }

      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          scenePrompt,
          aspectRatio,
          width: Number(width),
          height: Number(height),
          // Include custom base face if uploaded
          customBaseFace: customBaseFace || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        
        // Handle insufficient coins
        if (response.status === 402) {
          setInsufficientCoins(true);
          throw new Error(data.error || "Insufficient coins");
        }
        
        throw new Error(data.error || "Failed to generate image");
      }

      const result = await response.json();
      console.log("[handleGenerateImage] Generation result:", {
        success: result.success,
        faceSwapped: result.faceSwapped,
        faceSwapAttempted: result.faceSwapAttempted,
      });
      
      setImages((prev) => [result.image, ...prev]);
      setScenePrompt("");

      // Refresh coin balance after successful generation
      const coinsResponse = await fetch('/api/coins');
      if (coinsResponse.ok) {
        const coinsData = await coinsResponse.json();
        setCoinBalance(coinsData.balance?.balance ?? 0);
      }

      // Refresh character to get updated thumbnail
      const charResponse = await fetch(`/api/characters?id=${characterId}`);
      if (charResponse.ok) {
        const charData = await charResponse.json();
        console.log("[handleGenerateImage] Refreshed character mainFaceImage length:", charData.mainFaceImage?.length);
        setCharacter(charData);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      // Stop the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setGenerating(false);
      setGenerationPhase('idle');
      setElapsedTime(0);
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

  // Handle custom base face upload
  const handleFaceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setFaceUploadError("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFaceUploadError("Image must be less than 5MB");
      return;
    }

    setUploadingFace(true);
    setFaceUploadError("");

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;

        // Validate face using OpenAI
        const validateResponse = await fetch("/api/validate-face", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64 }),
        });

        const validateResult = await validateResponse.json();

        if (!validateResponse.ok || !validateResult.valid) {
          setFaceUploadError(validateResult.error || "Invalid face image");
          setUploadingFace(false);
          return;
        }

        // Face is valid, set it as the custom base face
        setCustomBaseFace(base64);
        setUploadingFace(false);
      };
      reader.onerror = () => {
        setFaceUploadError("Failed to read image file");
        setUploadingFace(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setFaceUploadError(err.message || "Failed to upload face");
      setUploadingFace(false);
    }
  };

  // Set uploaded face as the character's main face
  const handleSetUploadedAsMainFace = async () => {
    if (!customBaseFace) return;

    console.log("[handleSetUploadedAsMainFace] Setting main face, length:", customBaseFace.length);

    try {
      const response = await fetch("/api/characters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: characterId,
          mainFaceImage: customBaseFace,
        }),
      });

      console.log("[handleSetUploadedAsMainFace] Response status:", response.status);

      if (response.ok) {
        const updatedChar = await response.json();
        console.log("[handleSetUploadedAsMainFace] Updated character mainFaceImage length:", updatedChar.mainFaceImage?.length);
        
        // Directly set the updated character instead of re-fetching
        setCharacter(updatedChar);
        // Clear the uploaded face since it's now the main face
        setCustomBaseFace(null);
      } else {
        const errorData = await response.json();
        console.error("[handleSetUploadedAsMainFace] Error:", errorData);
      }
    } catch (err) {
      console.error("Failed to set uploaded face as main:", err);
    }
  };

  const clearCustomBaseFace = () => {
    setCustomBaseFace(null);
    setFaceUploadError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle setting profile picture from gallery image
  const handleSetProfilePicture = async (imageUrl: string) => {
    setUpdatingProfilePicture(true);
    try {
      const response = await fetch("/api/characters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: characterId,
          thumbnail: imageUrl,
        }),
      });

      if (response.ok) {
        const updatedChar = await response.json();
        setCharacter(updatedChar);
        setShowProfilePictureModal(false);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update profile picture");
      }
    } catch (err) {
      console.error("Failed to set profile picture:", err);
      setError("Failed to update profile picture");
    } finally {
      setUpdatingProfilePicture(false);
    }
  };

  // Handle uploading a new profile picture
  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    setUpdatingProfilePicture(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        await handleSetProfilePicture(base64);
      };
      reader.onerror = () => {
        setError("Failed to read image file");
        setUpdatingProfilePicture(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Failed to upload profile picture");
      setUpdatingProfilePicture(false);
    }
  };

  // Handle gallery status change
  const handleGalleryStatusChange = async (imageId: string, newStatus: GalleryStatus) => {
    try {
      const response = await fetch("/api/generate-image", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId,
          galleryStatus: newStatus,
        }),
      });

      if (response.ok) {
        setImages((prev) =>
          prev.map((img) =>
            img.id === imageId ? { ...img, galleryStatus: newStatus } : img
          )
        );
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update image status");
      }
    } catch (err) {
      console.error("Failed to update image status:", err);
      setError("Failed to update image status");
    }
  };

  // Handle image deletion
  const handleDeleteImage = async (imageId: string) => {
    if (!confirm("Are you sure you want to permanently delete this image? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/generate-image?imageId=${imageId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setImages((prev) => prev.filter((img) => img.id !== imageId));
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete image");
      }
    } catch (err) {
      console.error("Failed to delete image:", err);
      setError("Failed to delete image");
    }
  };

  // Bulk actions for selected images
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleImageSelection = (imageId: string) => {
    setSelectedImages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  const handleBulkStatusChange = async (newStatus: GalleryStatus) => {
    const imageIds = Array.from(selectedImages);
    for (const imageId of imageIds) {
      await handleGalleryStatusChange(imageId, newStatus);
    }
    setSelectedImages(new Set());
    setIsSelectionMode(false);
  };

  // Get images filtered by gallery status
  const getFilteredImages = (status: GalleryStatus) => {
    return images.filter((img) => img.galleryStatus === status);
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
                <Image
                  src={character.thumbnail}
                  alt={character.name}
                  width={40}
                  height={40}
                  className="rounded-full object-cover object-top border-2 border-primary"
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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Generate Image</h2>
                  {coinBalance !== null && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full">
                      <span className="text-yellow-400">🪙</span>
                      <span className="text-sm font-medium text-yellow-400">{coinBalance}</span>
                    </div>
                  )}
                </div>

                {/* Insufficient coins warning */}
                {insufficientCoins && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-400 mb-2">
                      ⚠️ Not enough coins! You need {currentCoinCost} coins.
                    </p>
                    <Link
                      href="/dashboard/coins"
                      className="text-xs text-primary-light hover:text-primary underline"
                    >
                      Buy more coins →
                    </Link>
                  </div>
                )}

                {/* Custom Base Face Upload Section */}
                <div className="mb-4 p-3 bg-surface-light border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-400 font-medium">
                      Base Face for Generation <span className="text-gray-600">(optional)</span>
                    </label>
                    {(customBaseFace || character.mainFaceImage) && (
                      <span className="text-xs text-green-400">✓ Active</span>
                    )}
                  </div>
                  
                  {/* Show current base face status */}
                  {customBaseFace ? (
                    <div className="flex items-start gap-3">
                      <Image
                        src={customBaseFace}
                        alt="Uploaded base face"
                        width={64}
                        height={64}
                        className="rounded-lg object-cover border-2 border-primary"
                      />
                      <div className="flex-1">
                        <p className="text-xs text-primary-light mb-2">
                          Custom face uploaded - will be used for this generation
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSetUploadedAsMainFace}
                            className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-all"
                          >
                            Set as Main
                          </button>
                          <button
                            onClick={clearCustomBaseFace}
                            className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-all"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : character.mainFaceImage ? (
                    <div className="flex items-start gap-3">
                      <Image
                        src={character.mainFaceImage}
                        alt="Main face"
                        width={64}
                        height={64}
                        className="rounded-lg object-cover border border-green-500/50"
                      />
                      <div className="flex-1">
                        <p className="text-xs text-green-400 mb-2">
                          Main face set - Face swap will be applied automatically
                        </p>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingFace}
                          className="text-xs px-2 py-1 bg-surface border border-border rounded hover:border-primary/50 transition-all"
                        >
                          Upload different face
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-3">
                      <p className="text-xs text-gray-500 mb-2">
                        Optional: Upload a face photo to use as the base for consistent face swap
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingFace}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary-light rounded-lg text-sm hover:bg-primary/30 transition-all disabled:opacity-50"
                      >
                        {uploadingFace ? (
                          <>
                            <div className="animate-spin w-4 h-4 border-2 border-primary-light border-t-transparent rounded-full" />
                            Validating...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Upload Base Face
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFaceUpload}
                    className="hidden"
                  />
                  
                  {/* Face upload error */}
                  {faceUploadError && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                      {faceUploadError}
                      <button
                        onClick={() => setFaceUploadError("")}
                        className="ml-2 text-red-300 hover:text-white"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  
                  <p className="mt-2 text-xs text-gray-600">
                    Optional: Upload a clear photo of a single face. AI will verify it&apos;s a valid face image.
                  </p>
                </div>

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

                  {/* Aspect Ratio Selector */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">
                      Image Format
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.entries(ASPECT_RATIOS) as [AspectRatioKey, typeof ASPECT_RATIOS[AspectRatioKey]][]).map(([key, config]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setAspectRatio(key)}
                          className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 group ${
                            aspectRatio === key
                              ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                              : 'border-border bg-surface-light hover:border-primary/50 hover:bg-surface'
                          }`}
                        >
                          {/* Aspect ratio visual representation */}
                          <div className={`relative flex items-center justify-center mb-2 ${
                            aspectRatio === key ? 'text-primary' : 'text-gray-500 group-hover:text-gray-400'
                          }`}>
                            {key === 'square' && (
                              <div className={`w-8 h-8 rounded border-2 ${
                                aspectRatio === key ? 'border-primary bg-primary/20' : 'border-current'
                              }`} />
                            )}
                            {key === 'landscape' && (
                              <div className={`w-10 h-6 rounded border-2 ${
                                aspectRatio === key ? 'border-primary bg-primary/20' : 'border-current'
                              }`} />
                            )}
                            {key === 'portrait' && (
                              <div className={`w-6 h-10 rounded border-2 ${
                                aspectRatio === key ? 'border-primary bg-primary/20' : 'border-current'
                              }`} />
                            )}
                          </div>
                          
                          {/* Label */}
                          <span className={`text-xs font-medium ${
                            aspectRatio === key ? 'text-primary-light' : 'text-gray-400'
                          }`}>
                            {config.label}
                          </span>
                          
                          {/* Ratio badge */}
                          <span className={`text-[10px] mt-0.5 ${
                            aspectRatio === key ? 'text-primary/80' : 'text-gray-500'
                          }`}>
                            {config.ratio}
                          </span>
                          
                          {/* Selected indicator */}
                          {aspectRatio === key && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    
                    {/* Resolution display */}
                    <div className="mt-2 text-center">
                      <span className="text-[10px] text-gray-500 bg-surface px-2 py-1 rounded-full">
                        HD {ASPECT_RATIOS[aspectRatio].width} × {ASPECT_RATIOS[aspectRatio].height}px
                      </span>
                    </div>
                  </div>

                  {/* Coin cost indicator */}
                  <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                    <span>Image cost:</span>
                    <span className="text-yellow-400 font-medium">🪙 {currentCoinCost} coins</span>
                  </div>

                  <button
                    onClick={handleGenerateImage}
                    disabled={generating || !scenePrompt.trim() || (coinBalance !== null && coinBalance < currentCoinCost)}
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
                        Generate ({currentCoinCost} 🪙)
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-500 text-center">
                    Character attributes will be automatically included in the
                    prompt
                  </p>

                  {/* Buy coins link */}
                  {coinBalance !== null && coinBalance < 50 && (
                    <Link
                      href="/dashboard/coins"
                      className="block text-center text-xs text-primary-light hover:text-primary transition-colors"
                    >
                      Running low on coins? Buy more →
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Image Gallery */}
            <div className="lg:col-span-2">
              {/* Gallery Management Header */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">Image Management</h2>
                  <div className="flex items-center gap-2">
                    {isSelectionMode ? (
                      <>
                        <span className="text-xs text-gray-400">
                          {selectedImages.size} selected
                        </span>
                        <button
                          onClick={() => {
                            setIsSelectionMode(false);
                            setSelectedImages(new Set());
                          }}
                          className="px-3 py-1.5 text-xs bg-surface-light border border-border rounded-lg hover:border-primary/50 transition-all"
                        >
                          Cancel
                        </button>
                        {selectedImages.size > 0 && (
                          <>
                            {galleryTab === 'unposted' && (
                              <button
                                onClick={() => handleBulkStatusChange('posted')}
                                className="px-3 py-1.5 text-xs bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all"
                              >
                                Post Selected
                              </button>
                            )}
                            {galleryTab === 'posted' && (
                              <button
                                onClick={() => handleBulkStatusChange('archived')}
                                className="px-3 py-1.5 text-xs bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-all"
                              >
                                Archive Selected
                              </button>
                            )}
                            {galleryTab === 'archived' && (
                              <button
                                onClick={() => handleBulkStatusChange('posted')}
                                className="px-3 py-1.5 text-xs bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all"
                              >
                                Restore Selected
                              </button>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => setIsSelectionMode(true)}
                        className="px-3 py-1.5 text-xs bg-surface-light border border-border rounded-lg hover:border-primary/50 transition-all"
                      >
                        Select Multiple
                      </button>
                    )}
                  </div>
                </div>

                {/* Gallery Status Tabs */}
                <div className="flex gap-1 p-1 bg-surface-light border border-border rounded-xl">
                  <button
                    onClick={() => setGalleryTab('unposted')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                      galleryTab === 'unposted'
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-surface'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Pending Review</span>
                    {getFilteredImages('unposted').length > 0 && (
                      <span className="px-1.5 py-0.5 text-xs bg-yellow-500/30 rounded-full">
                        {getFilteredImages('unposted').length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setGalleryTab('posted')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                      galleryTab === 'posted'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-surface'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Gallery</span>
                    {getFilteredImages('posted').length > 0 && (
                      <span className="px-1.5 py-0.5 text-xs bg-green-500/30 rounded-full">
                        {getFilteredImages('posted').length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setGalleryTab('archived')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                      galleryTab === 'archived'
                        ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-surface'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    <span>Archive</span>
                    {getFilteredImages('archived').length > 0 && (
                      <span className="px-1.5 py-0.5 text-xs bg-gray-500/30 rounded-full">
                        {getFilteredImages('archived').length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Tab Description */}
                <div className="mt-3 p-3 bg-surface-light/50 border border-border rounded-lg">
                  {galleryTab === 'unposted' && (
                    <p className="text-xs text-gray-400">
                      <span className="text-yellow-400 font-medium">Pending Review:</span> Newly generated images that haven&apos;t been added to your public gallery yet. Review and choose which ones to post.
                    </p>
                  )}
                  {galleryTab === 'posted' && (
                    <p className="text-xs text-gray-400">
                      <span className="text-green-400 font-medium">Gallery:</span> These images are visible on your character&apos;s public profile. Viewers can see them when visiting your character.
                    </p>
                  )}
                  {galleryTab === 'archived' && (
                    <p className="text-xs text-gray-400">
                      <span className="text-gray-300 font-medium">Archive:</span> Hidden images that are not visible to others. You can restore them to the gallery anytime.
                    </p>
                  )}
                </div>
              </div>

              {/* Generation Progress Placeholder - Show only when generating */}
              {generating && (
                <div className="mb-4">
                  <div className="relative aspect-video max-w-sm rounded-xl overflow-hidden bg-surface border-2 border-primary/50 animate-pulse">
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-surface to-purple-500/20 animate-gradient" />
                      <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="relative mb-4">
                          {generationPhase === 'generating' && (
                            <div className="w-16 h-16 relative">
                              <div className="absolute inset-0 rounded-full border-4 border-primary/30" />
                              <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                              <svg className="absolute inset-3 w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          {generationPhase === 'face-swapping' && (
                            <div className="w-16 h-16 relative">
                              <div className="absolute inset-0 rounded-full border-4 border-purple-500/30" />
                              <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                              <svg className="absolute inset-3 w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          )}
                          {generationPhase === 'finalizing' && (
                            <div className="w-16 h-16 relative">
                              <div className="absolute inset-0 rounded-full border-4 border-green-500/30" />
                              <div className="absolute inset-0 rounded-full border-4 border-t-green-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: '0.8s' }} />
                              <svg className="absolute inset-3 w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="mb-2">
                          <span className={`text-sm font-semibold ${
                            generationPhase === 'generating' ? 'text-primary-light' :
                            generationPhase === 'face-swapping' ? 'text-purple-400' :
                            'text-green-400'
                          }`}>
                            {generationPhase === 'generating' && '🎨 Generating Image...'}
                            {generationPhase === 'face-swapping' && '👤 Face Swapping...'}
                            {generationPhase === 'finalizing' && '✨ Finalizing...'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-light/80 backdrop-blur rounded-full border border-border">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-mono text-gray-300">
                            {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:{(elapsedTime % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Image Grid */}
              {getFilteredImages(galleryTab).length === 0 && !generating ? (
                <div className="text-center py-12 glass border border-border rounded-2xl">
                  <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                    galleryTab === 'unposted' ? 'bg-yellow-500/20' :
                    galleryTab === 'posted' ? 'bg-green-500/20' : 'bg-gray-500/20'
                  }`}>
                    {galleryTab === 'unposted' && (
                      <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {galleryTab === 'posted' && (
                      <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                    {galleryTab === 'archived' && (
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {galleryTab === 'unposted' && 'No pending images'}
                    {galleryTab === 'posted' && 'No images in gallery'}
                    {galleryTab === 'archived' && 'No archived images'}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {galleryTab === 'unposted' && 'Generate new images and they will appear here for review'}
                    {galleryTab === 'posted' && 'Post images from the Pending Review section to show them here'}
                    {galleryTab === 'archived' && 'Archived images will appear here'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {getFilteredImages(galleryTab).map((image) => (
                    <div
                      key={image.id}
                      className={`group relative aspect-square rounded-xl overflow-hidden bg-surface border-2 transition-all ${
                        isSelectionMode && selectedImages.has(image.id)
                          ? 'border-primary shadow-lg shadow-primary/20'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={isSelectionMode ? () => toggleImageSelection(image.id) : undefined}
                    >
                      <Image
                        src={image.imageUrl}
                        alt="Generated"
                        fill
                        className="object-cover"
                      />
                      
                      {/* Selection checkbox */}
                      {isSelectionMode && (
                        <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          selectedImages.has(image.id)
                            ? 'bg-primary border-primary'
                            : 'bg-black/50 border-white/50'
                        }`}>
                          {selectedImages.has(image.id) && (
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      )}

                      {/* Status badge */}
                      {!isSelectionMode && (
                        <div className={`absolute top-2 left-2 px-2 py-1 text-xs rounded-full ${
                          image.galleryStatus === 'unposted' ? 'bg-yellow-500/80 text-yellow-100' :
                          image.galleryStatus === 'posted' ? 'bg-green-500/80 text-white' :
                          'bg-gray-500/80 text-gray-100'
                        }`}>
                          {image.galleryStatus === 'unposted' && '⏳ Pending'}
                          {image.galleryStatus === 'posted' && '✓ Posted'}
                          {image.galleryStatus === 'archived' && '📦 Archived'}
                        </div>
                      )}

                      {image.isMainFace && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-purple-500/80 text-white text-xs rounded-full">
                          Main Face
                        </div>
                      )}

                      {/* Hover actions */}
                      {!isSelectionMode && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            {/* Quick actions based on status */}
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {galleryTab === 'unposted' && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGalleryStatusChange(image.id, 'posted');
                                    }}
                                    className="flex-1 py-1.5 px-2 bg-green-500/80 backdrop-blur rounded-lg text-xs font-medium hover:bg-green-500 transition-all flex items-center justify-center gap-1"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Post to Gallery
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGalleryStatusChange(image.id, 'archived');
                                    }}
                                    className="py-1.5 px-2 bg-gray-500/80 backdrop-blur rounded-lg text-xs hover:bg-gray-500 transition-all"
                                    title="Archive"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                    </svg>
                                  </button>
                                </>
                              )}
                              {galleryTab === 'posted' && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGalleryStatusChange(image.id, 'archived');
                                    }}
                                    className="flex-1 py-1.5 px-2 bg-orange-500/80 backdrop-blur rounded-lg text-xs font-medium hover:bg-orange-500 transition-all flex items-center justify-center gap-1"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                    </svg>
                                    Archive
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setImageToShare(image);
                                    }}
                                    className="py-1.5 px-2 bg-primary/80 backdrop-blur rounded-lg text-xs hover:bg-primary transition-all"
                                    title="Share"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                  </button>
                                </>
                              )}
                              {galleryTab === 'archived' && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGalleryStatusChange(image.id, 'posted');
                                    }}
                                    className="flex-1 py-1.5 px-2 bg-green-500/80 backdrop-blur rounded-lg text-xs font-medium hover:bg-green-500 transition-all flex items-center justify-center gap-1"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Restore
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteImage(image.id);
                                    }}
                                    className="py-1.5 px-2 bg-red-500/80 backdrop-blur rounded-lg text-xs hover:bg-red-500 transition-all"
                                    title="Delete permanently"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </>
                              )}
                            </div>

                            {/* Secondary actions */}
                            <div className="flex gap-1.5">
                              {!image.isMainFace && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetMainFace(image.id);
                                  }}
                                  className="flex-1 py-1.5 bg-white/20 backdrop-blur rounded-lg text-xs hover:bg-white/30 transition-all"
                                >
                                  Set as Main Face
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetProfilePicture(image.imageUrl);
                                }}
                                className="flex-1 py-1.5 bg-blue-500/30 backdrop-blur rounded-lg text-xs hover:bg-blue-500/50 transition-all flex items-center justify-center gap-1"
                                title="Set as Profile Picture"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Profile
                              </button>
                              {galleryTab !== 'archived' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteImage(image.id);
                                  }}
                                  className="py-1.5 px-2 bg-red-500/50 backdrop-blur rounded-lg text-xs hover:bg-red-500/70 transition-all"
                                  title="Delete"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>

                            {/* Prompt preview */}
                            <p className="text-xs text-gray-300 line-clamp-2 mt-2">
                              {image.prompt}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profile Picture Section */}
            <div className="glass border border-border rounded-2xl p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold mb-4">Profile Picture</h2>
              <div className="flex flex-col sm:flex-row items-start gap-6">
                {/* Current Profile Picture */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    {character.thumbnail ? (
                      <Image
                        src={character.thumbnail}
                        alt={`${character.name} profile`}
                        width={128}
                        height={128}
                        className="rounded-full object-cover object-top border-4 border-primary shadow-lg shadow-primary/20"
                      />
                    ) : (
                      <div className="w-32 h-32 rounded-full gradient-primary flex items-center justify-center">
                        <svg className="w-16 h-16 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                    {updatingProfilePicture && (
                      <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-gray-400">
                    {character.thumbnail ? "Current profile picture" : "No profile picture"}
                  </span>
                </div>

                {/* Change Profile Picture Options */}
                <div className="flex-1">
                  <p className="text-sm text-gray-400 mb-4">
                    Select a profile picture for your character. This will be displayed in the discovery page and character lists.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setShowProfilePictureModal(true)}
                      disabled={updatingProfilePicture || images.length === 0}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary-light rounded-lg text-sm hover:bg-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Select from Gallery
                    </button>
                    <button
                      onClick={() => profilePictureInputRef.current?.click()}
                      disabled={updatingProfilePicture}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-surface-light border border-border rounded-lg text-sm hover:border-primary/50 transition-all disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload New Image
                    </button>
                    {character.thumbnail && (
                      <button
                        onClick={() => handleSetProfilePicture("")}
                        disabled={updatingProfilePicture}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-all disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove
                      </button>
                    )}
                  </div>
                  {images.length === 0 && (
                    <p className="mt-3 text-xs text-yellow-400">
                      💡 Tip: Generate some images first to select one as your profile picture.
                    </p>
                  )}
                  
                  {/* Hidden file input for profile picture upload */}
                  <input
                    ref={profilePictureInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

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

      {/* Profile Picture Selection Modal */}
      {showProfilePictureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowProfilePictureModal(false)}
          />
          
          {/* Modal */}
          <div className="relative w-full max-w-3xl max-h-[80vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-surface border-b border-border">
              <h2 className="text-lg font-semibold">Select Profile Picture</h2>
              <button
                onClick={() => setShowProfilePictureModal(false)}
                className="p-2 hover:bg-surface-light rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              {images.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-gray-500/20 mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No images available</h3>
                  <p className="text-gray-400 text-sm">
                    Generate some images first to select one as your profile picture.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {images.map((image) => (
                    <button
                      key={image.id}
                      onClick={() => handleSetProfilePicture(image.imageUrl)}
                      disabled={updatingProfilePicture}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105 hover:shadow-lg ${
                        character.thumbnail === image.imageUrl
                          ? 'border-primary shadow-lg shadow-primary/20'
                          : 'border-border hover:border-primary/50'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Image
                        src={image.imageUrl}
                        alt="Gallery image"
                        fill
                        className="object-cover"
                      />
                      {character.thumbnail === image.imageUrl && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      )}
                      {updatingProfilePicture && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
