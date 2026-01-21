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
  const containerRef = useRef<HTMLDivElement>(null);

  const currentCharacter = characters[currentCharacterIndex];
  const minSwipeDistance = 50;

  useEffect(() => {
    // Reset image index when character changes
    setCurrentImageIndex(0);
  }, [currentCharacterIndex]);

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
      className="relative w-full h-screen overflow-hidden bg-surface-dark touch-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Main Image */}
      <div className="relative w-full h-full flex items-center justify-center">
        <img
          src={currentCharacter.images[currentImageIndex]}
          alt={`${currentCharacter.name} - Image ${currentImageIndex + 1}`}
          className="max-w-full max-h-full object-contain transition-opacity duration-300"
        />

        {/* Character Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface-dark via-surface-dark/80 to-transparent p-6 pb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full gradient-primary blur-sm opacity-60" />
              <img
                src={currentCharacter.thumbnail}
                alt={currentCharacter.name}
                className="relative w-16 h-16 rounded-full border-2 border-primary object-cover"
              />
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

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Link
              href={`/character/${currentCharacter.id}`}
              className="flex-1 bg-surface-light border border-border text-white py-3 px-6 rounded-full font-semibold text-center hover:bg-surface hover:border-primary/50 transition-all"
            >
              View Profile
            </Link>
            <Link
              href={`/chat/${currentCharacter.id}`}
              className="flex-1 gradient-primary text-white py-3 px-6 rounded-full font-semibold text-center hover:opacity-90 transition-all glow-primary-sm"
            >
              Chat Now
            </Link>
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
        <div className="absolute top-20 left-0 right-0 text-center">
          <div className="inline-block glass border border-border text-white px-5 py-3 rounded-2xl text-sm">
            <p className="text-gray-300">↔️ Swipe horizontally for more images</p>
            <p className="text-gray-300">↕️ Swipe vertically to change characters</p>
          </div>
        </div>
      </div>
    </div>
  );
}
