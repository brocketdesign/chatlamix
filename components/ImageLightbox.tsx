"use client";

import { useState, useEffect, useCallback, TouchEvent } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import { createClient } from "@/lib/supabase/client";

interface Comment {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface ImageLightboxProps {
  images: string[];
  characterName: string;
  characterId: string;
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageLightbox({
  images,
  characterName,
  characterId,
  initialIndex,
  isOpen,
  onClose,
}: ImageLightboxProps) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingLike, setLoadingLike] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Touch/swipe state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const minSwipeDistance = 50;
  const currentImage = images[currentIndex];
  const imageId = `${characterId}-${currentIndex}`; // Using index as a simple identifier

  // Reset state when image changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Fetch like status and count
  const fetchLikeStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/image-interactions?characterId=${characterId}&imageIndex=${currentIndex}&type=like`
      );
      if (response.ok) {
        const data = await response.json();
        setIsLiked(data.isLiked);
        setLikeCount(data.likeCount);
      }
    } catch (error) {
      console.error("Error fetching like status:", error);
    }
  }, [characterId, currentIndex]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const response = await fetch(
        `/api/image-interactions?characterId=${characterId}&imageIndex=${currentIndex}&type=comments`
      );
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoadingComments(false);
    }
  }, [characterId, currentIndex]);

  // Load data when image changes
  useEffect(() => {
    if (isOpen) {
      fetchLikeStatus();
      if (showComments) {
        fetchComments();
      }
    }
  }, [isOpen, currentIndex, fetchLikeStatus, fetchComments, showComments]);

  // Handle like toggle
  const handleLike = async () => {
    if (!user) {
      // Could show a sign-in prompt here
      return;
    }

    // Optimistic UI update
    const wasLiked = isLiked;
    const prevCount = likeCount;
    setIsLiked(!wasLiked);
    setLikeCount(wasLiked ? prevCount - 1 : prevCount + 1);

    setLoadingLike(true);
    try {
      const response = await fetch("/api/image-interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          imageIndex: currentIndex,
          action: wasLiked ? "unlike" : "like",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Use the actual count from the server for accuracy
        if (typeof data.likeCount === 'number') {
          setLikeCount(data.likeCount);
        }
        if (typeof data.isLiked === 'boolean') {
          setIsLiked(data.isLiked);
        }
      } else {
        // Revert on failure
        setIsLiked(wasLiked);
        setLikeCount(prevCount);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      // Revert on failure
      setIsLiked(wasLiked);
      setLikeCount(prevCount);
    } finally {
      setLoadingLike(false);
    }
  };

  // Handle comment submission
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const response = await fetch("/api/image-interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          imageIndex: currentIndex,
          action: "comment",
          text: newComment.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setComments((prev) => [data.comment, ...prev]);
        setNewComment("");
      }
    } catch (error) {
      console.error("Error submitting comment:", error);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Navigation
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setShowComments(false);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setShowComments(false);
    }
  }, [currentIndex, images.length]);

  // Touch handlers for swipe navigation
  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (showComments) return; // Don't swipe when comments are open
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (showComments || !touchStart) return;
    const currentX = e.targetTouches[0].clientX;
    const currentY = e.targetTouches[0].clientY;
    const diffX = currentX - touchStart.x;
    const diffY = currentY - touchStart.y;
    
    // Only track horizontal swipes
    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Limit the offset at the edges
      if ((currentIndex === 0 && diffX > 0) || (currentIndex === images.length - 1 && diffX < 0)) {
        setSwipeOffset(diffX * 0.3); // Resistance at edges
      } else {
        setSwipeOffset(diffX);
      }
    }
    
    setTouchEnd({
      x: currentX,
      y: currentY,
    });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd || showComments) {
      setSwipeOffset(0);
      return;
    }

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);

    if (isHorizontalSwipe && Math.abs(distanceX) > minSwipeDistance) {
      setIsTransitioning(true);
      if (distanceX > 0) {
        // Swipe left - next image
        goToNext();
      } else {
        // Swipe right - previous image
        goToPrevious();
      }
      setTimeout(() => setIsTransitioning(false), 300);
    }
    
    setSwipeOffset(0);
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Keyboard navigation - disabled when typing in comment input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      // Don't handle keyboard navigation when typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Only allow Escape when in input
        if (e.key === 'Escape') {
          (target as HTMLInputElement).blur();
        }
        return;
      }
      
      switch (e.key) {
        case "Escape":
          if (showComments) {
            setShowComments(false);
          } else {
            onClose();
          }
          break;
        case "ArrowLeft":
          if (!showComments) goToPrevious();
          break;
        case "ArrowRight":
          if (!showComments) goToNext();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, goToPrevious, goToNext, showComments]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center touch-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-3 rounded-full bg-surface-light/80 hover:bg-surface-light text-white transition-all"
        aria-label="Close"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Main image container with swipe */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <div 
          className={`flex items-center justify-center w-full h-full ${isTransitioning ? 'transition-transform duration-300 ease-out' : ''}`}
          style={{ transform: `translateX(${swipeOffset}px)` }}
        >
          <img
            src={currentImage}
            alt={`${characterName} - Image ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg pointer-events-none select-none"
            draggable={false}
          />
        </div>

        {/* Image indicator dots */}
        {images.length > 1 && (
          <div className="absolute top-4 left-0 right-0 flex justify-center gap-1.5 px-4">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  setShowComments(false);
                }}
                className={`h-1 rounded-full transition-all ${
                  index === currentIndex 
                    ? "w-6 bg-white" 
                    : "w-1.5 bg-white/40 hover:bg-white/60"
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Swipe hint for first time users */}
        {images.length > 1 && currentIndex === 0 && (
          <div className="absolute bottom-32 left-0 right-0 flex justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-white/60 text-sm animate-pulse">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              <span>Swipe to browse</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Floating action buttons - Right side */}
      <div className="absolute right-4 md:right-8 bottom-24 flex flex-col gap-4 z-10">
        {/* Like button */}
        <button
          onClick={handleLike}
          disabled={loadingLike || !user}
          className={`group flex flex-col items-center gap-1 p-3 rounded-full transition-all ${
            isLiked 
              ? "text-pink-500" 
              : "text-white hover:text-pink-400"
          } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
          aria-label={isLiked ? "Unlike" : "Like"}
        >
          <div className={`p-3 rounded-full ${isLiked ? "bg-pink-500/20" : "bg-surface-light/80 group-hover:bg-surface-light"} transition-all`}>
            {loadingLike ? (
              <span className="w-7 h-7 block animate-spin border-2 border-current border-t-transparent rounded-full" />
            ) : (
              <svg 
                className="w-7 h-7" 
                fill={isLiked ? "currentColor" : "none"} 
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
            )}
          </div>
          <span className="text-sm font-semibold">{likeCount}</span>
        </button>

        {/* Comment button */}
        <button
          onClick={() => {
            setShowComments(!showComments);
            if (!showComments) fetchComments();
          }}
          className={`group flex flex-col items-center gap-1 p-3 rounded-full transition-all ${
            showComments ? "text-primary" : "text-white hover:text-primary-light"
          }`}
          aria-label="Comments"
        >
          <div className={`p-3 rounded-full ${showComments ? "bg-primary/20" : "bg-surface-light/80 group-hover:bg-surface-light"} transition-all`}>
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
              />
            </svg>
          </div>
          <span className="text-sm font-semibold">{comments.length}</span>
        </button>

        {/* Share button */}
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: `${characterName}'s photo`,
                url: window.location.href,
              });
            } else {
              navigator.clipboard.writeText(window.location.href);
            }
          }}
          className="group flex flex-col items-center gap-1 p-3 rounded-full text-white hover:text-primary-light transition-all"
          aria-label="Share"
        >
          <div className="p-3 rounded-full bg-surface-light/80 group-hover:bg-surface-light transition-all">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" 
              />
            </svg>
          </div>
        </button>
      </div>

      {/* Comments panel */}
      {showComments && (
        <div 
          className="absolute inset-0 md:right-0 md:left-auto md:w-96 bg-surface-dark md:border-l border-border flex flex-col z-50"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Comments header */}
          <div className="flex items-center justify-between p-4 border-b border-border safe-area-top">
            <h3 className="text-lg font-semibold text-white">Comments</h3>
            <button
              onClick={() => setShowComments(false)}
              className="p-2 rounded-full hover:bg-surface-light text-gray-400 hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Comments list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingComments ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No comments yet</p>
                <p className="text-sm mt-1">Be the first to comment!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-light flex items-center justify-center overflow-hidden flex-shrink-0">
                    {comment.profiles?.avatar_url ? (
                      <img 
                        src={comment.profiles.avatar_url} 
                        alt="" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">
                        {comment.profiles?.full_name || "Anonymous"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm mt-1">{comment.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Comment input */}
          {user ? (
            <form onSubmit={handleSubmitComment} className="p-4 pb-24 border-t border-border bg-surface-dark">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onFocus={(e) => e.stopPropagation()}
                  placeholder="Add a comment..."
                  className="flex-1 px-4 py-3 rounded-full bg-surface-light border border-border focus:border-primary focus:outline-none text-white placeholder-gray-500 text-base"
                  disabled={submittingComment}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || submittingComment}
                  className="px-5 py-3 rounded-full gradient-primary text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingComment ? (
                    <span className="w-5 h-5 block animate-spin border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    "Post"
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 pb-24 border-t border-border text-center bg-surface-dark">
              <p className="text-gray-400 text-sm">Sign in to leave a comment</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
