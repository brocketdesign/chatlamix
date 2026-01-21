"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import { SignInButton, UserButton } from "@/components/auth/UserButton";
import ShowcaseGallery from "@/components/ShowcaseGallery";
import FilterBar from "@/components/FilterBar";
import Link from "next/link";
import { Character } from "@/lib/types";
import { categories } from "@/lib/data";

export default function Home() {
  const { user, isLoading } = useAuth();
  const isSignedIn = !!user;
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCharacters();
  }, []);

  const fetchCharacters = async () => {
    try {
      const response = await fetch("/api/characters?type=public");
      if (response.ok) {
        const data = await response.json();
        // Only show characters that have at least one image
        const charactersWithImages = data.filter(
          (char: Character) => char.images && char.images.length > 0
        );
        setCharacters(charactersWithImages);
      }
    } catch (error) {
      console.error("Error fetching characters:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCharacters = useMemo(() => {
    if (selectedCategory === "All") {
      return characters;
    }
    return characters.filter(
      (character) => character.category === selectedCategory
    );
  }, [selectedCategory, characters]);

  return (
    <main className="min-h-screen bg-surface-dark relative">
      {/* Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-20 glass border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold gradient-text">
            Chatlamix
          </Link>
          <div className="flex items-center gap-4">
            {!isLoading && (
              <>
                {isSignedIn ? (
                  <>
                    <Link
                      href="/dashboard"
                      className="text-gray-300 hover:text-white transition-colors"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard/create"
                      className="gradient-primary text-white py-2 px-4 rounded-full text-sm font-semibold hover:opacity-90 transition-all"
                    >
                      Create Character
                    </Link>
                    <UserButton afterSignOutUrl="/" />
                  </>
                ) : (
                  <>
                    <SignInButton>
                      <button className="text-gray-300 hover:text-white transition-colors">
                        Sign In
                      </button>
                    </SignInButton>
                    <Link
                      href="/sign-up"
                      className="gradient-primary text-white py-2 px-4 rounded-full text-sm font-semibold hover:opacity-90 transition-all"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <FilterBar
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />
      <div className="pt-28">
        {loading ? (
          <div className="flex items-center justify-center h-[50vh]">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredCharacters.length > 0 ? (
          <ShowcaseGallery characters={filteredCharacters} />
        ) : (
          <div className="flex flex-col items-center justify-center h-[70vh] text-white gap-6 px-4">
            <div className="w-24 h-24 rounded-full gradient-primary opacity-30 flex items-center justify-center">
              <svg className="w-12 h-12 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">No AI Influencers Yet</h3>
              <p className="text-gray-400 mb-6 max-w-md">
                {selectedCategory === "All" 
                  ? "Create your first AI influencer character and generate images to see them here!"
                  : `No characters found in the "${selectedCategory}" category`}
              </p>
              {isSignedIn && (
                <Link
                  href="/dashboard/create"
                  className="gradient-primary text-white py-3 px-8 rounded-full font-semibold hover:opacity-90 transition-all inline-block"
                >
                  Create Your First Character
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
