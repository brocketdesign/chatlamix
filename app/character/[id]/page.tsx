"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Character } from "@/lib/types";
import { ImageLightbox } from "@/components/ImageLightbox";
import { FollowButton, FollowStats } from "@/components/monetization";
import { useAuth } from "@/lib/supabase/auth-context";
import { MobileBottomNav } from "@/components/Navigation";

export default function CharacterProfile() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const characterId = params.id as string;
  
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [subscriberCount, setSubscriberCount] = useState(0);

  // Fetch character data
  useEffect(() => {
    const loadCharacter = async () => {
      try {
        const response = await fetch(`/api/characters?id=${characterId}`);
        if (response.ok) {
          const data = await response.json();
          setCharacter(data);
        }
      } catch (error) {
        console.error("Error fetching character:", error);
      } finally {
        setLoading(false);
      }
    };
    loadCharacter();
  }, [characterId]);

  // Fetch follow status and stats
  useEffect(() => {
    const fetchFollowData = async () => {
      try {
        // Fetch follow status for logged-in user
        if (user) {
          const followResponse = await fetch(`/api/follows?characterId=${characterId}`);
          if (followResponse.ok) {
            const followData = await followResponse.json();
            setIsFollowing(followData.isFollowing);
          }
        }
        
        // Fetch follower/subscriber counts
        const statsResponse = await fetch(`/api/follows?characterId=${characterId}&stats=true`);
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setFollowerCount(statsData.followerCount || 0);
          setSubscriberCount(statsData.subscriberCount || 0);
        }
      } catch (error) {
        console.error("Error fetching follow data:", error);
      }
    };
    
    if (characterId) {
      fetchFollowData();
    }
  }, [characterId, user]);

  // Handle image click to open lightbox
  const handleImageClick = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Follow/unfollow handlers
  const handleFollow = useCallback(async (charId: string) => {
    const response = await fetch("/api/follows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: charId }),
    });
    if (response.ok) {
      setIsFollowing(true);
      setFollowerCount((prev) => prev + 1);
    }
  }, []);

  const handleUnfollow = useCallback(async (charId: string) => {
    const response = await fetch("/api/follows", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: charId }),
    });
    if (response.ok) {
      setIsFollowing(false);
      setFollowerCount((prev) => Math.max(0, prev - 1));
    }
  }, []);



  if (loading) {
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
          <Link href="/" className="text-primary-light hover:text-primary transition-colors">
            Back to Gallery
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b border-border">
        <div className="flex items-center gap-4 p-4 max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="text-2xl hover:text-primary-light transition-colors p-2 rounded-full hover:bg-surface-light"
            aria-label="Go back"
          >
            ←
          </button>
          <h1 className="text-xl font-bold gradient-text">Character Profile</h1>
        </div>
      </div>

      {/* Profile Content */}
      <div className="max-w-4xl mx-auto p-6">
        {/* Character Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-full gradient-primary blur-md opacity-60" />
            <img
              src={character.thumbnail}
              alt={character.name}
              className="relative w-32 h-32 rounded-full border-4 border-primary object-cover"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2 flex-wrap">
              <h2 className="text-3xl font-bold">{character.name}</h2>
              {user && (
                <FollowButton
                  characterId={character.id}
                  isFollowing={isFollowing}
                  onFollow={handleFollow}
                  onUnfollow={handleUnfollow}
                  size="md"
                />
              )}
            </div>
            <p className="text-gray-400 mb-3">{character.description}</p>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="inline-block gradient-primary px-4 py-1.5 rounded-full text-sm font-medium glow-primary-sm">
                {character.category}
              </span>
              <FollowStats
                followerCount={followerCount}
                subscriberCount={subscriberCount}
                className="text-sm"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          {user ? (
            <Link
              href={`/chat/${character.id}`}
              className="flex-1 gradient-primary text-white py-3 px-6 rounded-full font-semibold text-center hover:opacity-90 transition-all glow-primary"
            >
              Start Chat
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className="flex-1 gradient-primary text-white py-3 px-6 rounded-full font-semibold text-center hover:opacity-90 transition-all glow-primary"
            >
              Sign in to Chat
            </Link>
          )}
          <Link
            href="/"
            className="flex-1 bg-surface-light border border-border text-white py-3 px-6 rounded-full font-semibold text-center hover:bg-surface hover:border-primary/50 transition-all"
          >
            Back to Gallery
          </Link>
        </div>

        {/* Image Gallery */}
        <div>
          <h3 className="text-2xl font-bold mb-4 gradient-text">Image Gallery</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {character.images.map((image, index) => (
              <div
                key={index}
                onClick={() => handleImageClick(index)}
                className="aspect-[3/4] rounded-xl overflow-hidden bg-surface border border-border hover:border-primary/50 transition-all group cursor-pointer"
              >
                <img
                  src={image}
                  alt={`${character.name} - Image ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Image Lightbox */}
      <ImageLightbox
        images={character.images}
        characterName={character.name}
        characterId={character.id}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
      
      {/* Mobile Bottom Navigation - Hidden when lightbox is open */}
      {!lightboxOpen && <MobileBottomNav />}
    </div>
  );
}
