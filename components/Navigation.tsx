"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";
import { SignInButton, UserButton } from "@/components/auth/UserButton";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  requiresAuth?: boolean;
}

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/discover",
    label: "Discover",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/create",
    label: "Create",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
      </svg>
    ),
    requiresAuth: true,
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    requiresAuth: true,
  },
];

interface NavigationProps {
  showLogo?: boolean;
  title?: string;
  transparent?: boolean;
}

export default function Navigation({ showLogo = true, title, transparent = false }: NavigationProps) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Close mobile menu when pathname changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const filteredItems = navItems.filter(item => !item.requiresAuth || user);

  return (
    <>
      {/* Desktop Header Navigation */}
      <header className={`sticky top-0 z-40 hidden md:block ${transparent ? 'bg-transparent' : 'glass border-b border-border'}`}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {showLogo && (
              <Link href="/" className="text-2xl font-bold gradient-text">
                Chatlamix
              </Link>
            )}
            {title && (
              <>
                {showLogo && <span className="text-gray-400">|</span>}
                <span className="text-gray-300 font-medium">{title}</span>
              </>
            )}
          </div>
          
          <nav className="flex items-center gap-6">
            {filteredItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-colors ${
                  isActive(item.href)
                    ? "text-primary font-semibold"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
            
            {!isLoading && (
              user ? (
                <UserButton afterSignOutUrl="/" />
              ) : (
                <SignInButton>
                  <button className="px-4 py-2 gradient-primary rounded-full text-sm font-semibold hover:opacity-90 transition-opacity">
                    Sign In
                  </button>
                </SignInButton>
              )
            )}
          </nav>
        </div>
      </header>

      {/* Mobile Top Bar */}
      <header className={`sticky top-0 z-40 md:hidden ${transparent ? 'bg-transparent' : 'glass border-b border-border'}`}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showLogo && (
              <Link href="/" className="text-xl font-bold gradient-text">
                Chatlamix
              </Link>
            )}
            {title && !showLogo && (
              <span className="text-white font-semibold">{title}</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {!isLoading && (
              user ? (
                <div className="flex items-center gap-2">
                  {/* More menu button */}
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="w-10 h-10 rounded-full glass border border-border flex items-center justify-center text-white hover:border-primary/50 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                  <div className="w-10 h-10 rounded-full glass border border-border flex items-center justify-center hover:border-primary/50 transition-all">
                    <UserButton afterSignOutUrl="/" />
                  </div>
                </div>
              ) : (
                <SignInButton>
                  <button className="px-4 py-2 gradient-primary rounded-full text-sm font-semibold hover:opacity-90 transition-opacity">
                    Sign In
                  </button>
                </SignInButton>
              )
            )}
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 glass border-b border-border animate-in slide-in-from-top-2 duration-200">
            <nav className="px-4 py-3 space-y-1">
              {filteredItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive(item.href)
                      ? "bg-primary/20 text-primary"
                      : "text-gray-300 hover:bg-surface-light hover:text-white"
                  }`}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Mobile Bottom Navigation Bar - TikTok Style */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass border-t border-border safe-area-bottom safe-area-x">
        <div className="flex items-center justify-around px-2 py-2">
          {filteredItems.map((item) => {
            const active = isActive(item.href);
            const isCreate = item.href === "/dashboard/create";
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center min-w-[60px] py-1 ${
                  isCreate ? "relative -mt-4" : ""
                }`}
              >
                {isCreate ? (
                  // Special "Create" button - Professional app style
                  <div className="w-11 h-11 relative flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full gradient-primary glow-primary-sm" />
                    <div className="relative w-full h-full rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className={`p-2 rounded-xl transition-all ${
                    active ? "text-primary" : "text-gray-400"
                  }`}>
                    {item.icon}
                  </div>
                )}
                
                {!isCreate && (
                  <span className={`text-[10px] mt-0.5 transition-colors ${
                    active ? "text-primary font-semibold" : "text-gray-400"
                  }`}>
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
          
          {/* Profile tab for bottom nav */}
          {!isLoading && user && (
            <div className="flex flex-col items-center justify-center min-w-[60px] py-1">
              <div className="p-1">
                <div className={`w-7 h-7 rounded-full overflow-hidden border-2 ${
                  pathname.includes('/profile') ? 'border-primary' : 'border-transparent'
                }`}>
                  <UserButton afterSignOutUrl="/" />
                </div>
              </div>
              <span className="text-[10px] mt-0.5 text-gray-400">Me</span>
            </div>
          )}
        </div>
      </nav>

      {/* Spacer for bottom navigation on mobile */}
      <div className="h-16 md:hidden" />
    </>
  );
}

// Export a simple floating navigation for pages that need minimal UI (like home gallery)
export function FloatingNavigation() {
  const { user, isLoading } = useAuth();
  
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
      {!isLoading && (
        <>
          {user ? (
            <>
              {/* Discover */}
              <Link
                href="/discover"
                className="w-12 h-12 rounded-full glass border border-border flex items-center justify-center text-white hover:border-primary/50 hover:bg-surface transition-all shadow-lg"
                title="Discover"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </Link>
              {/* Dashboard */}
              <Link
                href="/dashboard"
                className="w-12 h-12 rounded-full glass border border-border flex items-center justify-center text-white hover:border-primary/50 hover:bg-surface transition-all shadow-lg"
                title="Dashboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </Link>
              {/* User Menu */}
              <div className="w-12 h-12 rounded-full glass border border-border flex items-center justify-center hover:border-primary/50 transition-all shadow-lg">
                <UserButton afterSignOutUrl="/" />
              </div>
            </>
          ) : (
            <SignInButton>
              <button className="w-12 h-12 rounded-full glass border border-border flex items-center justify-center text-white hover:border-primary/50 hover:bg-surface transition-all shadow-lg" title="Sign In">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
            </SignInButton>
          )}
        </>
      )}
    </div>
  );
}

// Mobile-only bottom navigation that can be added to any page
export function MobileBottomNav() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const filteredItems = navItems.filter(item => !item.requiresAuth || user);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass border-t border-border safe-area-bottom safe-area-x">
        <div className="flex items-center justify-around px-2 py-2">
          {filteredItems.map((item) => {
            const active = isActive(item.href);
            const isCreate = item.href === "/dashboard/create";
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center min-w-[60px] py-1 ${
                  isCreate ? "relative -mt-4" : ""
                }`}
              >
                {isCreate ? (
                  // Special "Create" button - Professional app style
                  <div className="w-11 h-11 relative flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full gradient-primary glow-primary-sm" />
                    <div className="relative w-full h-full rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className={`p-2 rounded-xl transition-all ${
                    active ? "text-primary" : "text-gray-400"
                  }`}>
                    {item.icon}
                  </div>
                )}
                
                {!isCreate && (
                  <span className={`text-[10px] mt-0.5 transition-colors ${
                    active ? "text-primary font-semibold" : "text-gray-400"
                  }`}>
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
          
          {!isLoading && user && (
            <div className="flex flex-col items-center justify-center min-w-[60px] py-1">
              <div className="p-1">
                <div className="w-7 h-7 rounded-full overflow-hidden">
                  <UserButton afterSignOutUrl="/" />
                </div>
              </div>
              <span className="text-[10px] mt-0.5 text-gray-400">Me</span>
            </div>
          )}
        </div>
      </nav>
      <div className="h-16 md:hidden" />
    </>
  );
}
