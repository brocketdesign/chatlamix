"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import Navigation from "@/components/Navigation";
import Link from "next/link";
import Image from "next/image";
import { Character } from "@/lib/types";

interface PremiumStatus {
  isPremium: boolean;
  plan?: { display_name: string };
  daysRemaining?: number;
}

interface CoinData {
  balance?: { balance: number };
}

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [premiumStatus, setPremiumStatus] = useState<PremiumStatus | null>(null);
  const [coinBalance, setCoinBalance] = useState<number>(0);

  useEffect(() => {
    if (!isLoading && user) {
      fetchCharacters();
      fetchMonetizationData();
    }
  }, [isLoading, user]);

  const fetchMonetizationData = async () => {
    try {
      const [premiumRes, coinsRes] = await Promise.all([
        fetch("/api/premium"),
        fetch("/api/coins"),
      ]);
      
      if (premiumRes.ok) {
        const data: PremiumStatus = await premiumRes.json();
        setPremiumStatus(data);
      }
      
      if (coinsRes.ok) {
        const data: CoinData = await coinsRes.json();
        setCoinBalance(data.balance?.balance || 0);
      }
    } catch (error) {
      console.error("Error fetching monetization data:", error);
    }
  };

  const fetchCharacters = async () => {
    try {
      const response = await fetch("/api/characters?type=user");
      if (response.ok) {
        const data = await response.json();
        setCharacters(data);
      }
    } catch (error) {
      console.error("Error fetching characters:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCharacter = async (characterId: string) => {
    if (!confirm("Are you sure you want to delete this character?")) return;

    try {
      const response = await fetch(`/api/characters?id=${characterId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setCharacters(characters.filter((c) => c.id !== characterId));
      }
    } catch (error) {
      console.error("Error deleting character:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Creator";

  return (
    <div className="min-h-screen bg-surface-dark text-white">
      <Navigation title="Dashboard" />

      <main className="max-w-7xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {displayName}!
          </h1>
          <p className="text-gray-400">
            Manage your AI influencers and create new characters
          </p>
        </div>

        {/* Monetization Status Bar */}
        <div className="glass border border-border rounded-2xl p-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              {/* Coin Balance */}
              <Link href="/dashboard/coins" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <span className="text-2xl">🪙</span>
                <div>
                  <div className="text-sm text-gray-400">Coins</div>
                  <div className="font-bold text-lg">{coinBalance.toLocaleString()}</div>
                </div>
              </Link>
              
              <div className="w-px h-10 bg-border hidden sm:block" />
              
              {/* Premium Status */}
              <div className="flex items-center gap-2">
                <span className="text-2xl">{premiumStatus?.isPremium ? "👑" : "⭐"}</span>
                <div>
                  <div className="text-sm text-gray-400">Status</div>
                  <div className="font-bold text-lg">
                    {premiumStatus?.isPremium ? (
                      <span className="text-primary">{premiumStatus.plan?.display_name || "Premium"}</span>
                    ) : (
                      <span className="text-gray-300">Free</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {premiumStatus?.isPremium ? (
                <Link
                  href="/dashboard/monetization"
                  className="px-4 py-2 gradient-primary rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  💰 Monetization Dashboard
                </Link>
              ) : (
                <Link
                  href="/dashboard/monetization/upgrade"
                  className="px-4 py-2 gradient-primary rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  👑 Upgrade to Premium
                </Link>
              )}
              <Link
                href="/dashboard/coins"
                className="px-4 py-2 bg-surface-light border border-border rounded-lg text-sm font-semibold hover:border-primary transition-colors"
              >
                + Buy Coins
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link
            href="/dashboard/create"
            className="p-6 glass border border-border rounded-2xl hover:border-primary/50 transition-all group"
          >
            <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-1">Create Character</h3>
            <p className="text-gray-400 text-sm">
              Design a new AI influencer with custom personality
            </p>
          </Link>

          <div className="p-6 glass border border-border rounded-2xl">
            <div className="w-12 h-12 bg-surface-light rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-1">Your Characters</h3>
            <p className="text-3xl font-bold gradient-text">
              {characters.length}
            </p>
          </div>

          <div className="p-6 glass border border-border rounded-2xl">
            <div className="w-12 h-12 bg-surface-light rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-primary"
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
            </div>
            <h3 className="font-semibold text-lg mb-1">Total Images</h3>
            <p className="text-3xl font-bold gradient-text">
              {characters.reduce((acc, c) => acc + (c.images?.length || 0), 0)}
            </p>
          </div>

          <Link
            href="/dashboard/social-settings"
            className="p-6 glass border border-border rounded-2xl hover:border-primary/50 transition-all group"
          >
            <div className="w-12 h-12 bg-surface-light rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-1">Social Media</h3>
            <p className="text-gray-400 text-sm">
              Configure your accounts and posting schedules
            </p>
          </Link>

          <Link
            href="/dashboard/content-automation"
            className="p-6 glass border border-border rounded-2xl hover:border-primary/50 transition-all group"
          >
            <div className="w-12 h-12 bg-surface-light rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-1">Content Automation</h3>
            <p className="text-gray-400 text-sm">
              Generate recurring content with AI
            </p>
          </Link>

          {/* Character Auto-Generation Card */}
          <Link
            href="/dashboard/character-automation"
            className="p-6 glass border border-border rounded-2xl hover:border-primary/50 transition-all group"
          >
            <div className="w-12 h-12 bg-surface-light rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="font-semibold text-lg mb-1">Character Generator</h3>
            <p className="text-gray-400 text-sm">
              Auto-generate diverse AI characters
            </p>
          </Link>

          {/* Monetization Card */}
          <Link
            href={premiumStatus?.isPremium ? "/dashboard/monetization" : "/dashboard/monetization/upgrade"}
            className="p-6 glass border border-border rounded-2xl hover:border-primary/50 transition-all group"
          >
            <div className="w-12 h-12 bg-surface-light rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-1">
              {premiumStatus?.isPremium ? "Monetization" : "Start Earning"}
            </h3>
            <p className="text-gray-400 text-sm">
              {premiumStatus?.isPremium 
                ? "View earnings, tiers & analytics" 
                : "Unlock subscriptions, tips & more"
              }
            </p>
          </Link>

          {/* Discover Card */}
          <Link
            href="/discover"
            className="p-6 glass border border-border rounded-2xl hover:border-primary/50 transition-all group"
          >
            <div className="w-12 h-12 bg-surface-light rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-1">Discover Creators</h3>
            <p className="text-gray-400 text-sm">
              Find and follow AI influencers
            </p>
          </Link>

          {/* Favorites Card */}
          <Link
            href="/dashboard/favorites"
            className="p-6 glass border border-border rounded-2xl hover:border-primary/50 transition-all group"
          >
            <div className="w-12 h-12 bg-surface-light rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6 text-pink-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-1">Your Favorites</h3>
            <p className="text-gray-400 text-sm">
              View liked images and followed creators
            </p>
          </Link>
        </div>

        {/* Characters List */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Characters</h2>
          <Link
            href="/dashboard/create"
            className="text-primary-light hover:text-primary transition-colors text-sm"
          >
            + Create New
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : characters.length === 0 ? (
          <div className="text-center py-12 glass border border-border rounded-2xl">
            <div className="w-16 h-16 rounded-full gradient-primary opacity-50 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No characters yet</h3>
            <p className="text-gray-400 mb-4">
              Create your first AI influencer to get started
            </p>
            <Link
              href="/dashboard/create"
              className="inline-block gradient-primary text-white py-2 px-6 rounded-full font-semibold hover:opacity-90 transition-all"
            >
              Create Character
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map((character) => (
              <div
                key={character.id}
                className="glass border border-border rounded-2xl overflow-hidden hover:border-primary/50 transition-all group"
              >
                <div className="aspect-square relative bg-surface-light">
                  {character.thumbnail ? (
                    <Image
                      src={character.thumbnail}
                      alt={character.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-20 h-20 rounded-full gradient-primary opacity-50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">{character.name}</h3>
                      <p className="text-sm text-primary-light">
                        {character.category}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        character.isPublic
                          ? "bg-green-500/20 text-green-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {character.isPublic ? "Public" : "Private"}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm line-clamp-2 mb-3">
                    {character.description}
                  </p>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {character.tags?.slice(0, 4).map((tag, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary-light"
                      >
                        {tag}
                      </span>
                    ))}
                    {(character.tags?.length || 0) > 4 && (
                      <span className="text-xs px-2 py-0.5 text-gray-400">
                        +{(character.tags?.length || 0) - 4} more
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/character/${character.id}`}
                      className="flex-1 text-center py-2 px-3 gradient-primary rounded-lg text-sm font-medium hover:opacity-90 transition-all"
                    >
                      Manage
                    </Link>
                    <Link
                      href={`/chat/${character.id}`}
                      className="py-2 px-3 bg-surface-light border border-border rounded-lg text-sm hover:border-primary/50 transition-all"
                    >
                      Chat
                    </Link>
                    <button
                      onClick={() => handleDeleteCharacter(character.id)}
                      className="py-2 px-3 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-all"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
