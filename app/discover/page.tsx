"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import Navigation from "@/components/Navigation";
import Link from "next/link";
import Image from "next/image";
import type { DiscoveryFilters } from "@/lib/monetization-types";

interface DiscoveryCharacter {
  id: string;
  name: string;
  tagline?: string;
  thumbnail?: string;
  total_followers: number;
  total_subscribers: number;
  is_monetized: boolean;
  subscription_price_min?: number;
  tip_minimum?: number;
  owner_name?: string;
  created_at: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function DiscoverPage() {
  const { user, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<DiscoveryCharacter[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [filters, setFilters] = useState<DiscoveryFilters>({
    sortBy: "trending",
    limit: 20,
    page: 1,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  const loadCharacters = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.sortBy) params.set("sortBy", filters.sortBy);
      if (filters.search) params.set("search", filters.search);
      if (filters.monetizedOnly) params.set("monetizedOnly", "true");
      if (filters.minPrice) params.set("minPrice", filters.minPrice.toString());
      if (filters.maxPrice) params.set("maxPrice", filters.maxPrice.toString());
      if (filters.limit) params.set("limit", filters.limit.toString());
      if (filters.page) params.set("page", filters.page.toString());

      const res = await fetch(`/api/discovery?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCharacters(data.characters || []);
        setPagination(data.pagination || null);
      }
    } catch (error) {
      console.error("Error loading characters:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  useEffect(() => {
    if (!isLoading && user) {
      loadFollows();
    }
  }, [isLoading, user]);

  async function loadFollows() {
    try {
      const res = await fetch("/api/follows");
      if (res.ok) {
        const data = await res.json();
        const ids = new Set<string>(data.follows?.map((f: { character_id: string }) => f.character_id) || []);
        setFollowedIds(ids);
      }
    } catch (error) {
      console.error("Error loading follows:", error);
    }
  }

  async function handleFollow(characterId: string) {
    if (!user) {
      alert("Please sign in to follow creators");
      return;
    }

    const isFollowing = followedIds.has(characterId);
    
    try {
      if (isFollowing) {
        const res = await fetch(`/api/follows?characterId=${characterId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setFollowedIds((prev) => {
            const next = new Set(prev);
            next.delete(characterId);
            return next;
          });
        }
      } else {
        const res = await fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId }),
        });
        if (res.ok) {
          setFollowedIds((prev) => new Set(prev).add(characterId));
        }
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters({ ...filters, search: searchQuery, page: 1 });
  }

  function handleSortChange(sortBy: DiscoveryFilters["sortBy"]) {
    setFilters({ ...filters, sortBy, page: 1 });
  }

  function handlePageChange(page: number) {
    setFilters({ ...filters, page });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-surface-dark text-white">
      <Navigation title="Discover" />
      
      <main className="max-w-7xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Discover Creators</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Find and support your favorite AI influencers. Subscribe for exclusive content or send tips to show your appreciation.
          </p>
        </div>

        {/* Search & Filters */}
        <div className="glass border border-border rounded-2xl p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search creators..."
                  className="w-full px-4 py-3 pl-12 bg-surface-light border border-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                />
                <svg className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </form>

            {/* Sort */}
            <div className="flex gap-2 p-1 bg-surface-light rounded-xl">
              {[
                { value: "trending", label: "🔥 Trending" },
                { value: "newest", label: "✨ Newest" },
                { value: "most_followers", label: "👥 Popular" },
                { value: "top_earners", label: "💰 Top Earners" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSortChange(option.value as DiscoveryFilters["sortBy"])}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    filters.sortBy === option.value
                      ? "gradient-primary"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Additional Filters */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.monetizedOnly || false}
                onChange={(e) => setFilters({ ...filters, monetizedOnly: e.target.checked, page: 1 })}
                className="w-4 h-4 rounded border-border bg-surface-light accent-primary"
              />
              <span className="text-sm text-gray-300">Monetized only</span>
            </label>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Price:</span>
              <input
                type="number"
                value={filters.minPrice || ""}
                onChange={(e) => setFilters({ ...filters, minPrice: e.target.value ? parseFloat(e.target.value) : undefined, page: 1 })}
                placeholder="Min"
                className="w-20 px-2 py-1 bg-surface-light border border-border rounded-lg text-white text-sm"
              />
              <span className="text-gray-500">-</span>
              <input
                type="number"
                value={filters.maxPrice || ""}
                onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value ? parseFloat(e.target.value) : undefined, page: 1 })}
                placeholder="Max"
                className="w-20 px-2 py-1 bg-surface-light border border-border rounded-lg text-white text-sm"
              />
            </div>
            
            {(filters.search || filters.monetizedOnly || filters.minPrice || filters.maxPrice) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setFilters({ sortBy: "trending", limit: 20, page: 1 });
                }}
                className="text-sm text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : characters.length === 0 ? (
          <div className="glass border border-border rounded-2xl p-16 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2">No Creators Found</h3>
            <p className="text-gray-400">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {characters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  isFollowing={followedIds.has(character.id)}
                  onFollow={() => handleFollow(character.id)}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-4 py-2 bg-surface-light border border-border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary transition-colors"
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let page: number;
                    if (pagination.totalPages <= 5) {
                      page = i + 1;
                    } else if (pagination.page <= 3) {
                      page = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      page = pagination.totalPages - 4 + i;
                    } else {
                      page = pagination.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                          pagination.page === page
                            ? "gradient-primary"
                            : "bg-surface-light border border-border hover:border-primary"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-4 py-2 bg-surface-light border border-border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function CharacterCard({
  character,
  isFollowing,
  onFollow,
}: {
  character: DiscoveryCharacter;
  isFollowing: boolean;
  onFollow: () => void;
}) {
  return (
    <div className="glass border border-border rounded-2xl overflow-hidden hover:border-primary/50 transition-colors group">
      {/* Thumbnail */}
      <div className="aspect-square relative bg-surface-light">
        {character.thumbnail ? (
          <Image
            src={character.thumbnail}
            alt={character.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">
            👤
          </div>
        )}
        
        {character.is_monetized && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-primary/90 rounded-full text-xs font-semibold">
            💎 Premium
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="p-4">
        <Link href={`/character/${character.id}`} className="block">
          <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
            {character.name}
          </h3>
        </Link>
        
        {character.tagline && (
          <p className="text-gray-400 text-sm mb-3 line-clamp-2">{character.tagline}</p>
        )}
        
        <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
          <span className="flex items-center gap-1">
            <span>❤️</span>
            <span>{formatNumber(character.total_followers)}</span>
          </span>
          <span className="flex items-center gap-1">
            <span>⭐</span>
            <span>{formatNumber(character.total_subscribers)}</span>
          </span>
        </div>
        
        {character.is_monetized && character.subscription_price_min && (
          <div className="text-sm text-gray-300 mb-4">
            From <span className="font-semibold text-primary">${character.subscription_price_min.toFixed(2)}</span>/mo
          </div>
        )}
        
        <div className="flex gap-2">
          <Link
            href={`/character/${character.id}`}
            className="flex-1 px-4 py-2 gradient-primary rounded-lg text-sm font-semibold text-center hover:opacity-90 transition-opacity"
          >
            View Profile
          </Link>
          <button
            onClick={onFollow}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              isFollowing
                ? "bg-pink-500/20 text-pink-400 hover:bg-pink-500/30"
                : "bg-surface-light border border-border hover:border-primary"
            }`}
          >
            {isFollowing ? "❤️" : "🤍"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatNumber(num: number | null | undefined): string {
  if (num == null) {
    return "0";
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}
