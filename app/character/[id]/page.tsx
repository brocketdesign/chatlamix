"use client";

import { useParams, useRouter } from "next/navigation";
import { mockCharacters } from "@/lib/data";
import Link from "next/link";

export default function CharacterProfile() {
  const params = useParams();
  const router = useRouter();
  const characterId = params.id as string;
  
  const character = mockCharacters.find((c) => c.id === characterId);

  if (!character) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Character not found</h1>
          <Link href="/" className="text-blue-500 hover:underline">
            Back to Gallery
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center gap-4 p-4">
          <button
            onClick={() => router.back()}
            className="text-2xl hover:text-gray-400"
            aria-label="Go back"
          >
            ←
          </button>
          <h1 className="text-xl font-bold">Character Profile</h1>
        </div>
      </div>

      {/* Profile Content */}
      <div className="max-w-4xl mx-auto p-6">
        {/* Character Header */}
        <div className="flex items-center gap-6 mb-8">
          <img
            src={character.thumbnail}
            alt={character.name}
            className="w-32 h-32 rounded-full border-4 border-blue-600 object-cover"
          />
          <div>
            <h2 className="text-3xl font-bold mb-2">{character.name}</h2>
            <p className="text-gray-400 mb-3">{character.description}</p>
            <span className="inline-block bg-blue-600 px-3 py-1 rounded-full text-sm">
              {character.category}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <Link
            href={`/chat/${character.id}`}
            className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-full font-semibold text-center hover:bg-blue-700 transition-colors"
          >
            Start Chat
          </Link>
          <Link
            href="/"
            className="flex-1 bg-gray-800 text-white py-3 px-6 rounded-full font-semibold text-center hover:bg-gray-700 transition-colors"
          >
            Back to Gallery
          </Link>
        </div>

        {/* Image Gallery */}
        <div>
          <h3 className="text-2xl font-bold mb-4">Image Gallery</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {character.images.map((image, index) => (
              <div
                key={index}
                className="aspect-[3/4] rounded-lg overflow-hidden bg-gray-900"
              >
                <img
                  src={image}
                  alt={`${character.name} - Image ${index + 1}`}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
