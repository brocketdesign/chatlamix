"use client";

import { useState } from "react";

// Local type that matches the database schema (snake_case)
interface Tier {
  id: string;
  name: string;
  description?: string;
  price_monthly: number;
  is_active?: boolean;
  benefits: { id: string; type: string; description?: string }[];
}

interface SubscribeTierCardProps {
  tier: Tier;
  characterName: string;
  isSubscribed?: boolean;
  onSubscribe: (tierId: string) => Promise<void>;
  onUnsubscribe?: (tierId: string) => Promise<void>;
}

export function SubscribeTierCard({
  tier,
  characterName,
  isSubscribed = false,
  onSubscribe,
  onUnsubscribe,
}: SubscribeTierCardProps) {
  const [loading, setLoading] = useState(false);

  const benefitTypeIcons: Record<string, string> = {
    exclusive_content: "🎬",
    early_access: "⚡",
    direct_messages: "💬",
    custom_requests: "🎨",
    shoutouts: "📣",
    other: "✨",
  };

  async function handleClick() {
    setLoading(true);
    try {
      if (isSubscribed && onUnsubscribe) {
        await onUnsubscribe(tier.id);
      } else {
        await onSubscribe(tier.id);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`glass border rounded-2xl p-6 flex flex-col h-full transition-colors ${
        isSubscribed ? "border-primary" : "border-border hover:border-primary/50"
      }`}
    >
      {isSubscribed && (
        <div className="mb-4 px-3 py-1 bg-primary/20 text-primary text-xs font-semibold rounded-full self-start">
          ✓ Subscribed
        </div>
      )}
      
      <div className="mb-4">
        <h3 className="text-xl font-semibold mb-1">{tier.name}</h3>
        <div className="text-3xl font-bold">
          <span className="gradient-text">${tier.price_monthly.toFixed(2)}</span>
          <span className="text-sm font-normal text-gray-400">/month</span>
        </div>
      </div>
      
      {tier.description && (
        <p className="text-gray-400 text-sm mb-4">{tier.description}</p>
      )}
      
      <div className="flex-1">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">What you get</p>
        <ul className="space-y-2">
          {tier.benefits.map((benefit) => (
            <li key={benefit.id} className="flex items-start gap-2 text-sm">
              <span className="shrink-0">{benefitTypeIcons[benefit.type] || "✨"}</span>
              <span className="text-gray-300">
                {benefit.description || benefit.type.replace(/_/g, " ")}
              </span>
            </li>
          ))}
        </ul>
      </div>
      
      <button
        onClick={handleClick}
        disabled={loading}
        className={`mt-6 w-full py-3 rounded-xl font-semibold transition-all ${
          isSubscribed
            ? "bg-surface-light border border-border hover:border-red-500 hover:text-red-400"
            : "gradient-primary hover:opacity-90"
        } disabled:opacity-50`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
            Processing...
          </span>
        ) : isSubscribed ? (
          "Cancel Subscription"
        ) : (
          `Subscribe to ${characterName}`
        )}
      </button>
    </div>
  );
}

interface TierListProps {
  tiers: Tier[];
  characterName: string;
  subscribedTierId?: string;
  onSubscribe: (tierId: string) => Promise<void>;
  onUnsubscribe?: (tierId: string) => Promise<void>;
}

export function TierList({
  tiers,
  characterName,
  subscribedTierId,
  onSubscribe,
  onUnsubscribe,
}: TierListProps) {
  if (tiers.length === 0) {
    return (
      <div className="glass border border-border rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">📋</div>
        <h3 className="text-lg font-semibold mb-2">No Subscription Tiers</h3>
        <p className="text-gray-400">
          This creator hasn&apos;t set up any subscription tiers yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {tiers
        .filter((t) => t.is_active)
        .sort((a, b) => a.price_monthly - b.price_monthly)
        .map((tier) => (
          <SubscribeTierCard
            key={tier.id}
            tier={tier}
            characterName={characterName}
            isSubscribed={subscribedTierId === tier.id}
            onSubscribe={onSubscribe}
            onUnsubscribe={onUnsubscribe}
          />
        ))}
    </div>
  );
}
