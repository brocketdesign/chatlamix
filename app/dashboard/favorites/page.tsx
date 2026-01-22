"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import Navigation, { MobileBottomNav } from "@/components/Navigation";
import Link from "next/link";
import Image from "next/image";
import { ImageLightbox } from "@/components/ImageLightbox";

export const dynamic = 'force-dynamic';

interface LikedImage {
  id: string;
  imageIdentifier: string;
  characterId: string;
  imageIndex: number;
  imageUrl: string;
  likedAt: string;
  character: {
    id: string;
    name: string;
    thumbnail: string;
    description: string;
    category: string;
    isPublic: boolean;
  };
}

interface FollowedCharacter {
  id: string;
  character_id: string;
  created_at: string;
  characters: {
    id: string;
    name: string;
    thumbnail: string;
    description: string;
    category: string;
    images: string[];
  };
}

type TabType = 'images' | 'creators';

export default function FavoritesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('images');
  const [likedImages, setLikedImages] = useState<LikedImage[]>([]);
  const [followedCharacters, setFollowedCharacters] = useState<FollowedCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  
  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedCharacterName, setSelectedCharacterName] = useState('');

  const fetchLikedImages = useCallback(async (isLoadMore = false) => {
    if (!user) return;
    
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    
    try {
      const currentOffset = isLoadMore ? offset : 0;
      const response = await fetch(`/api/image-interactions/liked?limit=24&offset=${currentOffset}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (isLoadMore) {
          setLikedImages(prev => [...prev, ...data.likedImages]);
        } else {
          setLikedImages(data.likedImages);
        }
        
        setHasMore(data.hasMore);
        setOffset(currentOffset + data.likedImages.length);
      }
    } catch (error) {
      console.error("Error fetching liked images:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, offset]);

  const fetchFollowedCharacters = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/follows');
      
      if (response.ok) {
        const data = await response.json();
        setFollowedCharacters(data);
      }
    } catch (error) {
      console.error("Error fetching followed characters:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      if (activeTab === 'images') {
        setOffset(0);
        fetchLikedImages(false);
      } else {
        fetchFollowedCharacters();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, activeTab]);

  const handleImageClick = (image: LikedImage) => {
    // Find the character and get all their images
    const response = fetch(`/api/characters?id=${image.characterId}`);
    response.then(res => res.json()).then(character => {
      if (character && character.images) {
        setSelectedCharacterId(image.characterId);
        setSelectedImages(character.images);
        setSelectedImageIndex(image.imageIndex);
        setSelectedCharacterName(image.character.name);
        setLightboxOpen(true);
      }
    });
  };

  const handleUnfollow = async (characterId: string) => {
    try {
      const response = await fetch('/api/follows', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId }),
      });
      
      if (response.ok) {
        setFollowedCharacters(prev => 
          prev.filter(f => f.character_id !== characterId)
        );
      }
    } catch (error) {
      console.error("Error unfollowing:", error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-surface-dark text-white">
        <Navigation title="Favorites" />
        <main className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-surface-light flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-4">Sign in to see your favorites</h1>
          <p className="text-gray-400 mb-8">Keep track of the images and creators you love</p>
          <Link
            href="/sign-in"
            className="inline-block px-6 py-3 gradient-primary rounded-full font-semibold hover:opacity-90 transition-opacity"
          >
            Sign In
          </Link>
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark text-white">
      <Navigation title="Favorites" />
      
      <main className="max-w-7xl mx-auto px-4 py-6 pb-28 md:pb-8">
        {/* Tab Switcher - Native App Style */}
        <div className="sticky top-14 md:top-16 z-30 -mx-4 px-4 py-3 glass border-b border-border mb-6 -mt-6">
          <div className="flex gap-1 p-1 bg-surface-light rounded-xl max-w-md mx-auto">
            <button
              onClick={() => setActiveTab('images')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                activeTab === 'images'
                  ? 'gradient-primary text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-5 h-5" fill={activeTab === 'images' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span>Liked</span>
            </button>
            <button
              onClick={() => setActiveTab('creators')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                activeTab === 'creators'
                  ? 'gradient-primary text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-5 h-5" fill={activeTab === 'creators' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Following</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'images' && (
          <>
            {/* Stats */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="w-5 h-5 text-pink-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span className="font-medium text-white">{likedImages.length}</span>
                <span>liked images</span>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : likedImages.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-surface-light flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2">No liked images yet</h2>
                <p className="text-gray-400 mb-6">Like images from your favorite characters to see them here</p>
                <Link
                  href="/discover"
                  className="inline-flex items-center gap-2 px-6 py-3 gradient-primary rounded-full font-semibold hover:opacity-90 transition-opacity"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Discover Characters
                </Link>
              </div>
            ) : (
              <>
                {/* Image Grid - Instagram/Pinterest Style */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1 md:gap-2">
                  {likedImages.map((image) => (
                    <div
                      key={image.id}
                      onClick={() => handleImageClick(image)}
                      className="relative aspect-square bg-surface-light rounded-lg overflow-hidden cursor-pointer group"
                    >
                      <Image
                        src={image.imageUrl}
                        alt={`Liked image from ${image.character.name}`}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex items-center gap-4 text-white">
                          <div className="flex items-center gap-1">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      {/* Character Avatar - Bottom Left */}
                      <Link
                        href={`/character/${image.characterId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-2 left-2 z-10"
                      >
                        <div className="w-8 h-8 rounded-full border-2 border-white overflow-hidden shadow-lg hover:scale-110 transition-transform">
                          <img
                            src={image.character.thumbnail}
                            alt={image.character.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>

                {/* Load More */}
                {hasMore && (
                  <div className="mt-8 text-center">
                    <button
                      onClick={() => fetchLikedImages(true)}
                      disabled={loadingMore}
                      className="px-8 py-3 gradient-primary rounded-full font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {loadingMore ? (
                        <span className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Loading...
                        </span>
                      ) : (
                        'Load More'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'creators' && (
          <>
            {/* Stats */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="font-medium text-white">{followedCharacters.length}</span>
                <span>creators followed</span>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : followedCharacters.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-surface-light flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2">Not following anyone yet</h2>
                <p className="text-gray-400 mb-6">Follow your favorite creators to stay updated</p>
                <Link
                  href="/discover"
                  className="inline-flex items-center gap-2 px-6 py-3 gradient-primary rounded-full font-semibold hover:opacity-90 transition-opacity"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Discover Characters
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {followedCharacters.map((follow) => {
                  const character = follow.characters;
                  if (!character) return null;
                  
                  return (
                    <div
                      key={follow.id}
                      className="glass border border-border rounded-2xl overflow-hidden hover:border-primary/50 transition-all"
                    >
                      {/* Cover Image - Gradient Background or First Image */}
                      <div className="h-24 relative bg-gradient-to-r from-primary/30 to-primary-light/30">
                        {character.images?.[0] && (
                          <img
                            src={character.images[0]}
                            alt=""
                            className="w-full h-full object-cover opacity-50"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-surface-dark to-transparent" />
                      </div>
                      
                      {/* Profile Info */}
                      <div className="px-4 pb-4 -mt-10 relative">
                        <Link href={`/character/${character.id}`}>
                          <div className="w-20 h-20 rounded-full border-4 border-surface-dark overflow-hidden mb-3 hover:scale-105 transition-transform">
                            <img
                              src={character.thumbnail}
                              alt={character.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </Link>
                        
                        <Link href={`/character/${character.id}`}>
                          <h3 className="font-bold text-lg hover:text-primary transition-colors">
                            {character.name}
                          </h3>
                        </Link>
                        <p className="text-sm text-primary-light mb-2">{character.category}</p>
                        <p className="text-sm text-gray-400 line-clamp-2 mb-4">
                          {character.description}
                        </p>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <Link
                            href={`/character/${character.id}`}
                            className="flex-1 py-2 text-center gradient-primary rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                          >
                            View Profile
                          </Link>
                          <Link
                            href={`/chat/${character.id}`}
                            className="flex-1 py-2 text-center bg-surface-light border border-border rounded-lg text-sm font-semibold hover:border-primary/50 transition-colors"
                          >
                            Chat
                          </Link>
                          <button
                            onClick={() => handleUnfollow(character.id)}
                            className="p-2 bg-surface-light border border-border rounded-lg text-gray-400 hover:text-red-400 hover:border-red-400/50 transition-all"
                            title="Unfollow"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                            </svg>
                          </button>
                        </div>
                        
                        {/* Follow Date */}
                        <p className="text-xs text-gray-500 mt-3">
                          Following since {new Date(follow.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Lightbox */}
      <ImageLightbox
        images={selectedImages}
        characterName={selectedCharacterName}
        characterId={selectedCharacterId}
        initialIndex={selectedImageIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      <MobileBottomNav />
    </div>
  );
}
