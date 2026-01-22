"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import { FloatingNavigation, MobileBottomNav } from "@/components/Navigation";
import ShowcaseGallery from "@/components/ShowcaseGallery";
import Link from "next/link";
import { Character } from "@/lib/types";

export default function Home() {
  const { user, isLoading } = useAuth();
  const isSignedIn = !!user;
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

  return (
    <main className="h-screen w-screen overflow-hidden bg-surface-dark relative">
      {/* Floating Navigation Icons - Desktop only */}
      <div className="hidden md:flex fixed top-4 right-4 z-50 items-center gap-3">
        <FloatingNavigation />
      </div>

      {/* Full Screen Content */}
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : characters.length > 0 ? (
        <ShowcaseGallery characters={characters} />
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-white gap-6 px-4 pb-20 md:pb-0">
          <div className="w-24 h-24 rounded-full gradient-primary opacity-30 flex items-center justify-center">
            <svg className="w-12 h-12 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">No AI Influencers Yet</h3>
            <p className="text-gray-400 mb-6 max-w-md">
              Create your first AI influencer character and generate images to see them here!
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
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </main>
  );
}
