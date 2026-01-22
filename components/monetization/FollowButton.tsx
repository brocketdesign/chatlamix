"use client";

import { useState } from "react";

interface FollowButtonProps {
  characterId: string;
  isFollowing: boolean;
  followerCount?: number;
  onFollow: (characterId: string) => Promise<void>;
  onUnfollow: (characterId: string) => Promise<void>;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  className?: string;
}

export function FollowButton({
  characterId,
  isFollowing,
  followerCount = 0,
  onFollow,
  onUnfollow,
  size = "md",
  showCount = false,
  className = "",
}: FollowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [hovering, setHovering] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      if (isFollowing) {
        await onUnfollow(characterId);
      } else {
        await onFollow(characterId);
      }
    } finally {
      setLoading(false);
    }
  }

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      disabled={loading}
      className={`
        ${sizeClasses[size]}
        flex items-center gap-2 rounded-lg font-semibold transition-all
        ${isFollowing 
          ? hovering
            ? "bg-red-500/20 text-red-400 border border-red-500/50"
            : "bg-pink-500/20 text-pink-400 border border-pink-500/50"
          : "bg-surface-light border border-border hover:border-primary hover:text-primary"
        }
        disabled:opacity-50
        ${className}
      `}
    >
      {loading ? (
        <span className={`animate-spin border-2 border-current border-t-transparent rounded-full ${iconSizes[size]}`} />
      ) : (
        <>
          {isFollowing ? (
            hovering ? (
              <>
                <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Unfollow</span>
              </>
            ) : (
              <>
                <svg className={iconSizes[size]} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                <span>Following</span>
              </>
            )
          ) : (
            <>
              <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span>Follow</span>
            </>
          )}
        </>
      )}
      
      {showCount && (
        <span className="text-gray-400 font-normal">
          {formatNumber(followerCount)}
        </span>
      )}
    </button>
  );
}

interface FollowStatsProps {
  followerCount: number;
  subscriberCount: number;
  className?: string;
}

export function FollowStats({
  followerCount,
  subscriberCount,
  className = "",
}: FollowStatsProps) {
  return (
    <div className={`flex items-center gap-6 ${className}`}>
      <div className="text-center">
        <div className="text-2xl font-bold">{formatNumber(followerCount)}</div>
        <div className="text-sm text-gray-400">Followers</div>
      </div>
      <div className="w-px h-10 bg-border" />
      <div className="text-center">
        <div className="text-2xl font-bold">{formatNumber(subscriberCount)}</div>
        <div className="text-sm text-gray-400">Subscribers</div>
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}
