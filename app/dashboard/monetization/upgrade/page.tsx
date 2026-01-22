"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import { UserButton } from "@/components/auth/UserButton";
import Link from "next/link";

interface PremiumPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly?: number;
  monthly_coins: number;
  features: string[];
}

export default function UpgradePremiumPage() {
  const { user, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    if (!isLoading) {
      loadData();
    }
  }, [isLoading]);

  async function loadData() {
    setLoading(true);
    try {
      const [plansRes, premiumRes] = await Promise.all([
        fetch("/api/premium/plans"),
        fetch("/api/premium"),
      ]);

      if (plansRes.ok) {
        const data = await plansRes.json();
        // Plans API returns array directly or { plans: [...] }
        setPlans(Array.isArray(data) ? data : (data.plans || []));
      } else {
        // If plans API fails, use default plan
        setPlans([{
          id: "default",
          name: "creator_premium",
          display_name: "Creator Premium",
          price_monthly: 6.99,
          price_yearly: 59.99,
          monthly_coins: 500,
          features: [
            "Enable monetization on AI characters",
            "Create unlimited subscription tiers",
            "Receive tips from fans",
            "Access detailed analytics dashboard",
            "Priority content generation",
            "500 coins included monthly"
          ]
        }]);
      }

      if (premiumRes.ok) {
        const data = await premiumRes.json();
        if (data.isPremium && data.plan) {
          setCurrentPlan(data.plan.name);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
      // Use default plan on error
      setPlans([{
        id: "default",
        name: "creator_premium",
        display_name: "Creator Premium",
        price_monthly: 6.99,
        price_yearly: 59.99,
        monthly_coins: 500,
        features: [
          "Enable monetization on AI characters",
          "Create unlimited subscription tiers",
          "Receive tips from fans",
          "Access detailed analytics dashboard",
          "Priority content generation",
          "500 coins included monthly"
        ]
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(plan: PremiumPlan) {
    if (!user) {
      alert("Please sign in to subscribe");
      return;
    }

    setUpgrading(plan.name);
    setError(null);

    try {
      const res = await fetch("/api/premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          planId: plan.id !== "default" ? plan.id : undefined,
          planName: plan.name, 
          billingCycle 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Subscription failed");
      }

      // If we got a Stripe checkout URL, redirect to it
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      // Otherwise, subscription was created directly (e.g., free trial or dev mode)
      alert("Successfully subscribed! Welcome to Premium.");
      window.location.href = "/dashboard/monetization";
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setUpgrading(null);
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const premiumPlan = plans[0] || {
    name: "creator_premium",
    display_name: "Creator Premium",
    price_monthly: 6.99,
    price_yearly: 59.99,
    monthly_coins: 500,
    features: [
      "Enable monetization on AI characters",
      "Create unlimited subscription tiers", 
      "Receive tips from fans",
      "Access detailed analytics dashboard",
      "Priority content generation",
      "500 coins included monthly"
    ]
  };

  const currentPrice = billingCycle === "yearly" 
    ? (premiumPlan.price_yearly || premiumPlan.price_monthly * 10) 
    : premiumPlan.price_monthly;
  
  const yearlyDiscount = premiumPlan.price_yearly 
    ? Math.round((1 - (premiumPlan.price_yearly / (premiumPlan.price_monthly * 12))) * 100)
    : 30;

  return (
    <div className="min-h-screen bg-surface-dark text-white">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="w-20 h-20 gradient-primary rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">👑</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Unlock Your <span className="gradient-text">Creator Potential</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Turn your AI characters into a source of income. Create subscription tiers, 
            receive tips, and build a loyal community of fans.
          </p>
        </div>

        {error && (
          <div className="max-w-lg mx-auto mb-8 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center gap-4 p-1 bg-surface-light rounded-xl">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                billingCycle === "monthly"
                  ? "gradient-primary"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                billingCycle === "yearly"
                  ? "gradient-primary"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Yearly
              <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                Save {yearlyDiscount}%
              </span>
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {/* Free Plan */}
          <div className="glass border border-border rounded-3xl p-8">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">Free</h3>
              <div className="text-4xl font-bold">$0</div>
              <div className="text-gray-400">/month</div>
            </div>
            
            <ul className="space-y-4 mb-8">
              {[
                { text: "Create AI characters", included: true },
                { text: "Basic image generation", included: true },
                { text: "Chat with characters", included: true },
                { text: "Share on social media", included: true },
                { text: "5 coins on signup", included: true },
                { text: "Monetization features", included: false },
                { text: "Subscription tiers", included: false },
                { text: "Receive tips", included: false },
                { text: "Analytics dashboard", included: false },
                { text: "Priority generation", included: false },
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3">
                  {feature.included ? (
                    <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className={feature.included ? "text-gray-300" : "text-gray-600"}>
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>
            
            <div className="py-3 text-center text-gray-500 border border-border rounded-xl">
              {currentPlan ? "Current Plan" : "Free Forever"}
            </div>
          </div>

          {/* Premium Plan */}
          <div className="glass border-2 border-primary rounded-3xl p-8 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 gradient-primary rounded-full text-sm font-semibold">
              👑 Recommended
            </div>
            
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">{premiumPlan.display_name}</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold gradient-text">
                  ${currentPrice.toFixed(2)}
                </span>
                {billingCycle === "yearly" && (
                  <span className="text-gray-500 line-through text-lg">
                    ${(premiumPlan.price_monthly * 12).toFixed(2)}
                  </span>
                )}
              </div>
              <div className="text-gray-400">
                /{billingCycle === "yearly" ? "year" : "month"}
              </div>
              {billingCycle === "yearly" && (
                <div className="text-sm text-green-400 mt-1">
                  That&apos;s only ${(currentPrice / 12).toFixed(2)}/month!
                </div>
              )}
            </div>
            
            <ul className="space-y-4 mb-8">
              {[
                "Everything in Free",
                `${premiumPlan.monthly_coins} coins included monthly`,
                ...premiumPlan.features,
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>
            
            <button
              onClick={() => handleSubscribe(premiumPlan)}
              disabled={upgrading === premiumPlan.name || currentPlan === premiumPlan.name}
              className="w-full py-4 gradient-primary rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {upgrading === premiumPlan.name ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  Processing...
                </span>
              ) : currentPlan === premiumPlan.name ? (
                "✓ Current Plan"
              ) : (
                <>Get Started - ${currentPrice.toFixed(2)}/{billingCycle === "yearly" ? "yr" : "mo"}</>
              )}
            </button>
            
            {currentPlan !== premiumPlan.name && (
              <p className="text-center text-xs text-gray-500 mt-3">
                Cancel anytime. No questions asked.
              </p>
            )}
          </div>
        </div>

        {/* Features Grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything You Need to <span className="gradient-text">Succeed</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "💰",
                title: "Subscription Tiers",
                description: "Create multiple subscription levels with different perks and pricing to maximize earnings.",
              },
              {
                icon: "💝",
                title: "Tips & Donations",
                description: "Let fans show their appreciation with one-time tips. Set your own minimums.",
              },
              {
                icon: "📊",
                title: "Analytics Dashboard",
                description: "Track revenue, engagement, and growth with detailed charts and insights.",
              },
              {
                icon: "🪙",
                title: "Monthly Coins",
                description: "Get 500 coins every month for image generation, included with your subscription.",
              },
              {
                icon: "⚡",
                title: "Priority Generation",
                description: "Skip the queue with priority access to AI image and content generation.",
              },
              {
                icon: "🔔",
                title: "Notifications",
                description: "Stay informed when you get new subscribers, tips, or followers.",
              },
            ].map((feature, i) => (
              <div key={i} className="glass border border-border rounded-2xl p-6">
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-4">
            {[
              {
                q: "How do payouts work?",
                a: "Earnings are accumulated in your account. Once you reach the minimum threshold ($20), you can request a payout to your PayPal or bank account. Payouts are processed within 5-7 business days.",
              },
              {
                q: "What percentage does Chatlamix take?",
                a: "We take a 15% platform fee on all earnings from subscriptions and tips. This covers payment processing, hosting, and platform maintenance.",
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes! You can cancel your premium subscription at any time. You'll retain access until the end of your billing period.",
              },
              {
                q: "How many subscription tiers can I create?",
                a: "Premium creators can create unlimited subscription tiers per character. We recommend 2-4 tiers to give fans options without overwhelming them.",
              },
            ].map((faq, i) => (
              <details key={i} className="glass border border-border rounded-xl group">
                <summary className="p-4 cursor-pointer flex items-center justify-between font-semibold list-none">
                  {faq.q}
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-4 pb-4 text-gray-400">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-10 glass border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-2xl font-bold gradient-text">
            Chatlamix
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-gray-400 hover:text-white transition-colors"
          >
            Dashboard
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  );
}
