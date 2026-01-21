"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";

interface UserButtonProps {
  afterSignOutUrl?: string;
}

export function UserButton({ afterSignOutUrl = "/" }: UserButtonProps) {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push(afterSignOutUrl);
  };

  if (!user) return null;

  const initials = user.email?.charAt(0).toUpperCase() || "U";
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-semibold hover:opacity-90 transition-opacity"
      >
        {user.user_metadata?.avatar_url ? (
          <img
            src={user.user_metadata.avatar_url}
            alt="Avatar"
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 glass border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-4 border-b border-border">
            <p className="font-medium text-white truncate">{displayName}</p>
            <p className="text-sm text-gray-400 truncate">{user.email}</p>
          </div>
          <div className="p-2">
            <Link
              href="/dashboard"
              className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Dashboard
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-red-400 hover:text-red-300 hover:bg-white/5 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface SignInButtonProps {
  children: React.ReactNode;
  mode?: "modal" | "redirect";
}

export function SignInButton({ children }: SignInButtonProps) {
  return (
    <Link href="/sign-in">
      {children}
    </Link>
  );
}
