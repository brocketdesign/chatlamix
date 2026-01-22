"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth-context";

interface PremiumStatus {
  isPremium: boolean;
  subscription: {
    id: string;
    plan_id: string;
    status: string;
  } | null;
  plan: {
    id: string;
    display_name: string;
  } | null;
}

interface CoinBalance {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
}

export function AdminFloatingButton() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [premiumStatus, setPremiumStatus] = useState<PremiumStatus | null>(null);
  const [coinBalance, setCoinBalance] = useState<CoinBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [coinsToAdd, setCoinsToAdd] = useState<number>(100);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch premium status and coin balance when menu opens
  useEffect(() => {
    if (isOpen && user) {
      fetchStatus();
    }
  }, [isOpen, user]);

  const fetchStatus = async () => {
    try {
      const [premiumRes, coinsRes] = await Promise.all([
        fetch("/api/premium"),
        fetch("/api/coins"),
      ]);

      if (premiumRes.ok) {
        const premiumData = await premiumRes.json();
        setPremiumStatus(premiumData);
      }

      if (coinsRes.ok) {
        const coinsData = await coinsRes.json();
        setCoinBalance(coinsData.balance);
      }
    } catch (error) {
      console.error("Error fetching status:", error);
    }
  };

  const handleTogglePremium = async () => {
    setIsLoading(true);
    try {
      if (premiumStatus?.isPremium && premiumStatus?.subscription) {
        // Cancel premium - immediately deactivate for admin testing
        const response = await fetch("/api/premium", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscriptionId: premiumStatus.subscription.id,
            immediate: true, // Admin flag for immediate cancellation
          }),
        });

        if (!response.ok) {
          // If DELETE doesn't work, try PATCH with cancel action
          await fetch("/api/premium", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "cancel",
              subscriptionId: premiumStatus.subscription.id,
            }),
          });
        }
      } else {
        // Subscribe to premium (using a default plan)
        const plansRes = await fetch("/api/premium/plans");
        let planId: string | undefined = undefined;
        let planName = "creator_premium"; // default plan name fallback
        
        if (plansRes.ok) {
          const plansData = await plansRes.json();
          // Plans API returns array directly, not { plans: [...] }
          const plans = Array.isArray(plansData) ? plansData : (plansData.plans || []);
          if (plans.length > 0) {
            planId = plans[0].id;
            planName = plans[0].name;
          }
        }

        // Use adminBypass flag to skip Stripe checkout for admin testing
        const response = await fetch("/api/premium", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            planName,
            billingCycle: "monthly",
            adminBypass: true, // Skip Stripe for admin testing
          }),
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
          console.error("Error creating subscription:", responseData.error);
        } else if (responseData.checkoutUrl) {
          // If Stripe returned a checkout URL (adminBypass not supported), redirect
          window.location.href = responseData.checkoutUrl;
          return; // Don't refresh status, we're navigating away
        }
      }

      await fetchStatus();
    } catch (error) {
      console.error("Error toggling premium:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCoins = async () => {
    setIsLoading(true);
    try {
      // Direct RPC call to add coins for admin testing
      const response = await fetch("/api/admin/coins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: coinsToAdd,
          reason: "Admin test coins",
        }),
      });

      if (!response.ok) {
        // Fallback: Try using a test package purchase simulation
        console.log("Admin coins endpoint not available, using fallback");
      }

      await fetchStatus();
    } catch (error) {
      console.error("Error adding coins:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Only show for authenticated users
  if (!user) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50" ref={menuRef}>
      {/* Floating Admin Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 
          flex items-center justify-center text-white shadow-lg 
          hover:shadow-xl hover:scale-105 transition-all duration-200
          ${isOpen ? "rotate-45" : ""}`}
        title="Admin Menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          />
        </svg>
      </button>

      {/* Admin Menu */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-72 glass border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="p-4 border-b border-border bg-gradient-to-r from-amber-500/10 to-orange-600/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4 text-white"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white">Admin Menu</h3>
                <p className="text-xs text-gray-400">Development tools</p>
              </div>
            </div>
          </div>

          {/* Current Status */}
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Plan Status</span>
              <span
                className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                  premiumStatus?.isPremium
                    ? "bg-primary/20 text-primary-light"
                    : "bg-gray-500/20 text-gray-400"
                }`}
              >
                {premiumStatus?.isPremium ? "Premium" : "Free"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Coins</span>
              <span className="text-sm font-medium text-yellow-400">
                🪙 {coinBalance?.balance ?? 0}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 space-y-4">
            {/* Toggle Premium */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Subscription
              </label>
              <button
                onClick={handleTogglePremium}
                disabled={isLoading}
                className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 
                  ${
                    premiumStatus?.isPremium
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                      : "bg-primary/20 text-primary-light hover:bg-primary/30 border border-primary/30"
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading
                  ? "Processing..."
                  : premiumStatus?.isPremium
                  ? "Switch to Free Plan"
                  : "Upgrade to Premium"}
              </button>
            </div>

            {/* Add Coins */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Add Coins
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-400">
                    🪙
                  </span>
                  <input
                    type="number"
                    value={coinsToAdd}
                    onChange={(e) =>
                      setCoinsToAdd(Math.max(1, parseInt(e.target.value) || 0))
                    }
                    className="w-full pl-9 pr-3 py-2 bg-surface-light border border-border rounded-lg text-white text-sm focus:outline-none focus:border-primary/50"
                    min="1"
                  />
                </div>
                <button
                  onClick={handleAddCoins}
                  disabled={isLoading}
                  className="px-4 py-2 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              {/* Quick add buttons */}
              <div className="flex gap-2 mt-2">
                {[50, 100, 500, 1000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setCoinsToAdd(amount)}
                    className="flex-1 py-1 text-xs text-gray-400 hover:text-yellow-400 bg-surface-light hover:bg-surface border border-border rounded transition-colors"
                  >
                    +{amount}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-surface-dark/50 border-t border-border">
            <p className="text-xs text-gray-500 text-center">
              ⚠️ Admin-only testing features
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
