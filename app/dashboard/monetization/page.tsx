"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import Navigation from "@/components/Navigation";
import Link from "next/link";

interface AnalyticsOverview {
  totalRevenue: number;
  revenueChange: number;
  totalSubscribers: number;
  subscriberChange: number;
  totalFollowers: number;
  followerChange: number;
  totalInteractions: number;
  interactionChange: number;
}

interface RevenueByTier {
  tierId: string;
  tierName: string;
  subscriberCount: number;
  revenue: number;
}

interface DailyStat {
  date: string;
  total_revenue: number;
  subscription_revenue: number;
  tip_revenue: number;
  messages_received: number;
  images_generated: number;
  profile_views: number;
  new_followers: number;
  new_subscribers: number;
}

interface Character {
  id: string;
  name: string;
  thumbnail?: string;
}

interface PremiumStatus {
  isPremium: boolean;
  subscription: {
    current_period_end: string;
    cancel_at_period_end: boolean;
  } | null;
  plan: {
    display_name: string;
    price_monthly: number;
    monthly_coins: number;
  } | null;
  daysRemaining: number;
}

export default function MonetizationDashboardPage() {
  const { user, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [premiumStatus, setPremiumStatus] = useState<PremiumStatus | null>(null);
  const [analytics, setAnalytics] = useState<{
    overview: AnalyticsOverview;
    revenue: {
      subscriptionRevenue: number;
      tipRevenue: number;
      totalRevenue: number;
      averageRevenuePerSubscriber: number;
      revenueByTier: RevenueByTier[];
    };
    growth: {
      newFollowers: number;
      lostFollowers: number;
      netFollowerGrowth: number;
      newSubscribers: number;
      churnedSubscribers: number;
      netSubscriberGrowth: number;
      conversionRate: number;
    };
    dailyStats: DailyStat[];
    characters: Character[];
  } | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [coinBalance, setCoinBalance] = useState<number>(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [premiumRes, analyticsRes, coinsRes] = await Promise.all([
        fetch("/api/premium"),
        fetch(`/api/analytics?period=${selectedPeriod}${selectedCharacter ? `&characterId=${selectedCharacter}` : ""}`),
        fetch("/api/coins"),
      ]);

      if (premiumRes.ok) {
        setPremiumStatus(await premiumRes.json());
      }

      if (analyticsRes.ok) {
        setAnalytics(await analyticsRes.json());
      }

      if (coinsRes.ok) {
        const coinsData = await coinsRes.json();
        setCoinBalance(coinsData.balance?.balance || 0);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedCharacter]);

  useEffect(() => {
    if (!isLoading && user) {
      loadData();
    }
  }, [isLoading, user, selectedPeriod, selectedCharacter, loadData]);

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!premiumStatus?.isPremium) {
    return (
      <div className="min-h-screen bg-surface-dark text-white">
        <Navigation title="Monetization" />
        <main className="max-w-4xl mx-auto px-4 py-16 pb-24 md:pb-16">
          <div className="text-center">
            <div className="w-20 h-20 gradient-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-4">Unlock Monetization</h1>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Upgrade to Creator Premium to start earning from your AI influencers. 
              Create subscription tiers, receive tips, and access detailed analytics.
            </p>
            
            <div className="glass border border-border rounded-2xl p-8 max-w-md mx-auto mb-8">
              <div className="text-4xl font-bold gradient-text mb-2">$6.99</div>
              <div className="text-gray-400 mb-6">per month</div>
              
              <ul className="text-left space-y-3 mb-8">
                {[
                  "Enable monetization on AI characters",
                  "Create unlimited subscription tiers",
                  "Receive tips from fans",
                  "Access detailed analytics dashboard",
                  "Priority content generation",
                  "500 coins included monthly",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Link
                href="/dashboard/monetization/upgrade"
                className="w-full px-6 py-3 gradient-primary rounded-xl font-semibold hover:opacity-90 transition-opacity block text-center"
              >
                Upgrade to Premium
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const overview = analytics?.overview || {
    totalRevenue: 0,
    revenueChange: 0,
    totalSubscribers: 0,
    subscriberChange: 0,
    totalFollowers: 0,
    followerChange: 0,
    totalInteractions: 0,
    interactionChange: 0,
  };

  return (
    <div className="min-h-screen bg-surface-dark text-white">
      <Navigation title="Monetization" />
      
      <main className="max-w-7xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Monetization Dashboard</h1>
            <p className="text-gray-400">Track your earnings, subscribers, and engagement</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Character Filter */}
            <select
              value={selectedCharacter || ""}
              onChange={(e) => setSelectedCharacter(e.target.value || null)}
              className="px-4 py-2 bg-surface-light border border-border rounded-lg text-white"
            >
              <option value="">All Characters</option>
              {analytics?.characters.map((char) => (
                <option key={char.id} value={char.id}>{char.name}</option>
              ))}
            </select>
            
            {/* Period Selector */}
            <div className="flex gap-2 p-1 bg-surface-light rounded-lg">
              {(["7d", "30d", "90d"] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedPeriod === period
                      ? "gradient-primary"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {period === "7d" ? "7 Days" : period === "30d" ? "30 Days" : "90 Days"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Revenue"
            value={`$${overview.totalRevenue.toFixed(2)}`}
            change={overview.revenueChange}
            icon="💰"
          />
          <StatCard
            title="Subscribers"
            value={overview.totalSubscribers.toString()}
            change={overview.subscriberChange}
            icon="⭐"
          />
          <StatCard
            title="Followers"
            value={overview.totalFollowers.toString()}
            change={overview.followerChange}
            icon="❤️"
          />
          <StatCard
            title="Interactions"
            value={overview.totalInteractions.toString()}
            change={overview.interactionChange}
            icon="💬"
          />
        </div>

        {/* Coin Balance & Premium Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="glass border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Coin Balance</h3>
              <Link href="/dashboard/coins" className="text-primary text-sm hover:underline">
                Manage
              </Link>
            </div>
            <div className="text-3xl font-bold gradient-text mb-2">{coinBalance.toLocaleString()}</div>
            <p className="text-gray-400 text-sm">Coins available for image generation</p>
          </div>
          
          <div className="glass border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Premium Status</h3>
              <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-full">Active</span>
            </div>
            <p className="text-gray-300 mb-2">{premiumStatus.plan?.display_name}</p>
            <p className="text-gray-400 text-sm">
              {premiumStatus.subscription?.cancel_at_period_end 
                ? `Cancels in ${premiumStatus.daysRemaining} days`
                : `Renews in ${premiumStatus.daysRemaining} days`
              }
            </p>
          </div>
          
          <div className="glass border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Quick Actions</h3>
            </div>
            <div className="space-y-2">
              <Link
                href="/dashboard/monetization/tiers"
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
              >
                <span>📊</span>
                <span>Manage Tiers</span>
              </Link>
              <Link
                href="/dashboard/monetization/earnings"
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
              >
                <span>💵</span>
                <span>View Earnings</span>
              </Link>
              <Link
                href="/dashboard/monetization/settings"
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
              >
                <span>⚙️</span>
                <span>Payout Settings</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="glass border border-border rounded-2xl p-6">
            <h3 className="font-semibold mb-4">Revenue Breakdown</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Subscriptions</span>
                <span className="font-semibold">${analytics?.revenue.subscriptionRevenue.toFixed(2) || "0.00"}</span>
              </div>
              <div className="w-full bg-surface-light rounded-full h-2">
                <div 
                  className="gradient-primary h-2 rounded-full" 
                  style={{ 
                    width: `${analytics?.revenue.totalRevenue ? (analytics.revenue.subscriptionRevenue / analytics.revenue.totalRevenue * 100) : 0}%` 
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Tips</span>
                <span className="font-semibold">${analytics?.revenue.tipRevenue.toFixed(2) || "0.00"}</span>
              </div>
              <div className="w-full bg-surface-light rounded-full h-2">
                <div 
                  className="bg-pink-500 h-2 rounded-full" 
                  style={{ 
                    width: `${analytics?.revenue.totalRevenue ? (analytics.revenue.tipRevenue / analytics.revenue.totalRevenue * 100) : 0}%` 
                  }}
                />
              </div>
              
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 font-semibold">Total Revenue</span>
                  <span className="text-xl font-bold gradient-text">${analytics?.revenue.totalRevenue.toFixed(2) || "0.00"}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="glass border border-border rounded-2xl p-6">
            <h3 className="font-semibold mb-4">Revenue by Tier</h3>
            {analytics?.revenue.revenueByTier.length ? (
              <div className="space-y-3">
                {analytics.revenue.revenueByTier.map((tier) => (
                  <div key={tier.tierId} className="flex items-center justify-between p-3 bg-surface-light rounded-lg">
                    <div>
                      <div className="font-medium">{tier.tierName}</div>
                      <div className="text-sm text-gray-400">{tier.subscriberCount} subscribers</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${tier.revenue.toFixed(2)}</div>
                      <div className="text-sm text-gray-400">/month</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">No tiers created yet</p>
                <Link
                  href="/dashboard/monetization/tiers"
                  className="px-4 py-2 gradient-primary rounded-lg text-sm font-medium"
                >
                  Create Tier
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Growth Metrics */}
        <div className="glass border border-border rounded-2xl p-6 mb-8">
          <h3 className="font-semibold mb-6">Growth Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-400 mb-1">New Followers</div>
              <div className="text-2xl font-bold text-green-400">+{analytics?.growth.newFollowers || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Lost Followers</div>
              <div className="text-2xl font-bold text-red-400">-{analytics?.growth.lostFollowers || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">New Subscribers</div>
              <div className="text-2xl font-bold text-green-400">+{analytics?.growth.newSubscribers || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Conversion Rate</div>
              <div className="text-2xl font-bold">{(analytics?.growth.conversionRate || 0).toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* Daily Stats Chart Placeholder */}
        <div className="glass border border-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Daily Performance</h3>
          <div className="h-64 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="mb-2">📊 Performance chart</p>
              <p className="text-sm">Chart visualization would go here</p>
              {analytics?.dailyStats.length ? (
                <p className="text-xs mt-2">{analytics.dailyStats.length} days of data available</p>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  change, 
  icon 
}: { 
  title: string; 
  value: string; 
  change: number; 
  icon: string;
}) {
  const isPositive = change >= 0;
  
  return (
    <div className="glass border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className={`text-sm font-medium px-2 py-1 rounded-full ${
          isPositive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
        }`}>
          {isPositive ? "+" : ""}{change}%
        </span>
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-sm text-gray-400">{title}</div>
    </div>
  );
}
