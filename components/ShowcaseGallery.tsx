"use client";

import { useState, useRef, TouchEvent, useEffect } from "react";
import { Character } from "@/lib/types";
import Link from "next/link";

interface ShowcaseGalleryProps {
  characters: Character[];
}

export default function ShowcaseGallery({ characters }: ShowcaseGalleryProps) {
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentCharacter = characters[currentCharacterIndex];
  const minSwipeDistance = 50;

  useEffect(() => {
    // Reset image index when character changes
    setCurrentImageIndex(0);
  }, [currentCharacterIndex]);

  useEffect(() => {
    // Hide instructions after 3 seconds
    const timer = setTimeout(() => {
      setShowInstructions(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);

    if (isHorizontalSwipe) {
      // Horizontal swipe - navigate between images of the same character
      if (distanceX > minSwipeDistance) {
        // Swipe left - next image
        setCurrentImageIndex((prev) =>
          prev < currentCharacter.images.length - 1 ? prev + 1 : prev
        );
      } else if (distanceX < -minSwipeDistance) {
        // Swipe right - previous image
        setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }
    } else {
      // Vertical swipe - navigate between characters
      if (distanceY > minSwipeDistance) {
        // Swipe up - next character
        setCurrentCharacterIndex((prev) =>
          prev < characters.length - 1 ? prev + 1 : prev
        );
      } else if (distanceY < -minSwipeDistance) {
        // Swipe down - previous character
        setCurrentCharacterIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }
    }
  };

  const goToImage = (index: number) => {
    setCurrentImageIndex(index);
  };

  if (!currentCharacter) {
    return <div className="text-center p-8 text-gray-400">No characters available</div>;
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full overflow-hidden bg-surface-dark touch-none flex items-center justify-center"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Main Image Container - TikTok style: full cover on mobile, contained on desktop */}
      <div className="relative w-full h-full lg:w-auto lg:h-full lg:aspect-[9/16] lg:max-w-[500px]">
        <img
          src={currentCharacter.images[currentImageIndex]}
          alt={`${currentCharacter.name} - Image ${currentImageIndex + 1}`}
          className="w-full h-full object-cover object-top lg:object-contain lg:object-center transition-opacity duration-300"
        />

        {/* Character Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface-dark via-surface-dark/80 to-transparent p-6 pb-24 md:pb-8">
          <div className="flex items-center gap-4">
            <div className="relative flex flex-col items-center">
              {/* Chat Icon Button */}
              <Link
                href={`/chat/${currentCharacter.id}`}
                className="mb-2 w-10 h-10 gradient-primary rounded-full flex items-center justify-center hover:opacity-90 transition-all glow-primary-sm"
                aria-label={`Chat with ${currentCharacter.name}`}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </Link>
              {/* Clickable Avatar */}
              <Link
                href={`/character/${currentCharacter.id}`}
                className="relative block"
                aria-label={`View ${currentCharacter.name}'s profile`}
              >
                <div className="absolute inset-0 rounded-full gradient-primary blur-sm opacity-60" />
                <img
                  src={currentCharacter.thumbnail}
                  alt={currentCharacter.name}
                  className="relative w-16 h-16 rounded-full border-2 border-primary object-cover hover:border-white transition-colors"
                />
              </Link>
            </div>
            <div className="flex-1">
              <h2 className="text-white text-2xl font-bold">
                {currentCharacter.name}
              </h2>
              <p className="text-gray-400 text-sm">
                {currentCharacter.description}
              </p>
            </div>
          </div>
        </div>

        {/* Image Indicators */}
        {currentCharacter.images.length > 1 && (
          <div className="absolute top-4 left-0 right-0 flex justify-center gap-2 px-4">
            {currentCharacter.images.map((_, index) => (
              <button
                key={index}
                onClick={() => goToImage(index)}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentImageIndex
                    ? "gradient-primary w-8 glow-primary-sm"
                    : "bg-white/30 w-1.5 hover:bg-white/50"
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Character Navigation Indicator */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2">
          {characters.map((_, index) => (
            <div
              key={index}
              className={`w-1.5 rounded-full transition-all ${
                index === currentCharacterIndex
                  ? "gradient-primary h-8 glow-primary-sm"
                  : "bg-white/20 h-4"
              }`}
            />
          ))}
        </div>

        {/* Swipe Instructions (shows briefly) */}
        {showInstructions && (
          <div className="absolute top-20 left-0 right-0 text-center transition-opacity duration-500">
            <div className="inline-block glass border border-border text-white px-5 py-3 rounded-2xl text-sm">
              <p className="text-gray-300">↔️ Swipe horizontally for more images</p>
              <p className="text-gray-300">↕️ Swipe vertically to change characters</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
