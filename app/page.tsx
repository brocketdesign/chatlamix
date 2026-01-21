"use client";

import { useState, useMemo } from "react";
import ShowcaseGallery from "@/components/ShowcaseGallery";
import FilterBar from "@/components/FilterBar";
import { mockCharacters, categories } from "@/lib/data";

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredCharacters = useMemo(() => {
    if (selectedCategory === "All") {
      return mockCharacters;
    }
    return mockCharacters.filter(
      (character) => character.category === selectedCategory
    );
  }, [selectedCategory]);

  return (
    <main className="min-h-screen bg-black">
      <FilterBar
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />
      <div className="pt-16">
        {filteredCharacters.length > 0 ? (
          <ShowcaseGallery characters={filteredCharacters} />
        ) : (
          <div className="flex items-center justify-center h-screen text-white">
            <p>No characters found in this category</p>
          </div>
        )}
      </div>
    </main>
  );
}
