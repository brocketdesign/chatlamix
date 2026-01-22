"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import { UserButton } from "@/components/auth/UserButton";
import Link from "next/link";
import type { TierBenefit } from "@/lib/monetization-types";

// Local type that matches the database schema (snake_case)
interface Tier {
  id: string;
  character_id: string;
  creator_id: string;
  name: string;
  description?: string;
  price_monthly: number;
  tier_level: number;
  benefits: TierBenefit[];
  subscriber_count: number;
  is_active: boolean;
  created_at: string;
}

interface TierFormData {
  name: string;
  description: string;
  price_monthly: number;
  benefits: TierBenefit[];
  character_id: string;
}

const DEFAULT_BENEFITS: TierBenefit[] = [
  { id: "1", type: "exclusive_content", description: "Access to exclusive content" },
];

export default function TierManagementPage() {
  const { user, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [characters, setCharacters] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTier, setEditingTier] = useState<Tier | null>(null);
  const [formData, setFormData] = useState<TierFormData>({
    name: "",
    description: "",
    price_monthly: 4.99,
    benefits: DEFAULT_BENEFITS,
    character_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user]);

  async function loadData() {
    setLoading(true);
    try {
      const [tiersRes, charsRes] = await Promise.all([
        fetch("/api/tiers"),
        fetch("/api/characters"),
      ]);

      if (tiersRes.ok) {
        const data = await tiersRes.json();
        setTiers(data.tiers || []);
      }

      if (charsRes.ok) {
        const data = await charsRes.json();
        setCharacters(data || []);
        if (data?.length > 0 && !formData.character_id) {
          setFormData((prev) => ({ ...prev, character_id: data[0].id }));
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const url = "/api/tiers";
      const method = editingTier ? "PATCH" : "POST";
      const body = editingTier
        ? { tierId: editingTier.id, ...formData }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save tier");
      }

      if (editingTier) {
        setTiers(tiers.map((t) => (t.id === editingTier.id ? data.tier : t)));
      } else {
        setTiers([...tiers, data.tier]);
      }

      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tier: Tier) {
    if (!confirm(`Are you sure you want to delete the "${tier.name}" tier? This will cancel all active subscriptions.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/tiers?tierId=${tier.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete tier");
      }

      setTiers(tiers.filter((t) => t.id !== tier.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  }

  function startEdit(tier: Tier) {
    setEditingTier(tier);
    setFormData({
      name: tier.name,
      description: tier.description || "",
      price_monthly: tier.price_monthly,
      benefits: tier.benefits,
      character_id: tier.character_id,
    });
    setShowForm(true);
  }

  function resetForm() {
    setEditingTier(null);
    setFormData({
      name: "",
      description: "",
      price_monthly: 4.99,
      benefits: DEFAULT_BENEFITS,
      character_id: characters[0]?.id || "",
    });
    setShowForm(false);
    setError(null);
  }

  function addBenefit() {
    const newBenefit: TierBenefit = {
      id: Date.now().toString(),
      type: "exclusive_content",
      description: "",
    };
    setFormData({
      ...formData,
      benefits: [...formData.benefits, newBenefit],
    });
  }

  function updateBenefit(index: number, field: keyof TierBenefit, value: string) {
    const newBenefits = [...formData.benefits];
    newBenefits[index] = { ...newBenefits[index], [field]: value };
    setFormData({ ...formData, benefits: newBenefits });
  }

  function removeBenefit(index: number) {
    setFormData({
      ...formData,
      benefits: formData.benefits.filter((_, i) => i !== index),
    });
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark text-white">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Subscription Tiers</h1>
            <p className="text-gray-400">Create and manage subscription tiers for your characters</p>
          </div>
          
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 gradient-primary rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              + Create Tier
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400">
            {error}
          </div>
        )}

        {/* Tier Form */}
        {showForm && (
          <div className="glass border border-border rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-semibold mb-6">
              {editingTier ? "Edit Tier" : "Create New Tier"}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Character
                  </label>
                  <select
                    value={formData.character_id}
                    onChange={(e) => setFormData({ ...formData, character_id: e.target.value })}
                    className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl text-white focus:outline-none focus:border-primary"
                    required
                    disabled={!!editingTier}
                  >
                    <option value="">Select a character</option>
                    {characters.map((char) => (
                      <option key={char.id} value={char.id}>{char.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tier Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Fan, Super Fan, VIP"
                    className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                    required
                    maxLength={100}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what subscribers get with this tier..."
                  rows={3}
                  className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Monthly Price ($)
                </label>
                <input
                  type="number"
                  value={formData.price_monthly}
                  onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) || 0 })}
                  min="0.99"
                  max="999.99"
                  step="0.01"
                  className="w-full md:w-48 px-4 py-3 bg-surface-light border border-border rounded-xl text-white focus:outline-none focus:border-primary"
                  required
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-300">
                    Benefits
                  </label>
                  <button
                    type="button"
                    onClick={addBenefit}
                    className="text-sm text-primary hover:underline"
                  >
                    + Add Benefit
                  </button>
                </div>
                
                <div className="space-y-3">
                  {formData.benefits.map((benefit, index) => (
                    <div key={benefit.id} className="flex gap-3">
                      <select
                        value={benefit.type}
                        onChange={(e) => updateBenefit(index, "type", e.target.value)}
                        className="w-48 px-3 py-2 bg-surface-light border border-border rounded-lg text-white text-sm"
                      >
                        <option value="exclusive_content">Exclusive Content</option>
                        <option value="early_access">Early Access</option>
                        <option value="direct_messages">Direct Messages</option>
                        <option value="custom_requests">Custom Requests</option>
                        <option value="shoutouts">Shoutouts</option>
                        <option value="other">Other</option>
                      </select>
                      <input
                        type="text"
                        value={benefit.description}
                        onChange={(e) => updateBenefit(index, "description", e.target.value)}
                        placeholder="Describe this benefit..."
                        className="flex-1 px-3 py-2 bg-surface-light border border-border rounded-lg text-white placeholder-gray-500 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeBenefit(index)}
                        className="px-3 py-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 gradient-primary rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingTier ? "Save Changes" : "Create Tier"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 bg-surface-light border border-border rounded-xl font-semibold hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tiers List */}
        {tiers.length === 0 && !showForm ? (
          <div className="glass border border-border rounded-2xl p-12 text-center">
            <div className="w-16 h-16 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">No Tiers Yet</h3>
            <p className="text-gray-400 mb-6">Create your first subscription tier to start earning</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 gradient-primary rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              Create Your First Tier
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tiers.map((tier) => (
              <TierCard
                key={tier.id}
                tier={tier}
                onEdit={() => startEdit(tier)}
                onDelete={() => handleDelete(tier)}
              />
            ))}
          </div>
        )}
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
          <span className="text-gray-400">|</span>
          <Link href="/dashboard/monetization" className="text-gray-400 hover:text-white transition-colors">
            Monetization
          </Link>
          <span className="text-gray-400">›</span>
          <span className="text-gray-300">Tiers</span>
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}

function TierCard({
  tier,
  onEdit,
  onDelete,
}: {
  tier: Tier;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const benefitTypeLabels: Record<string, string> = {
    exclusive_content: "🎬 Exclusive Content",
    early_access: "⚡ Early Access",
    direct_messages: "💬 Direct Messages",
    custom_requests: "🎨 Custom Requests",
    shoutouts: "📣 Shoutouts",
    other: "✨ Perk",
  };

  return (
    <div className="glass border border-border rounded-2xl p-6 flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{tier.name}</h3>
          <div className="text-2xl font-bold gradient-text">
            ${tier.price_monthly.toFixed(2)}
            <span className="text-sm font-normal text-gray-400">/mo</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-white hover:bg-surface-light rounded-lg transition-colors"
            title="Edit tier"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
            title="Delete tier"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      {tier.description && (
        <p className="text-gray-400 text-sm mb-4">{tier.description}</p>
      )}
      
      <div className="flex-1">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Benefits</p>
        <ul className="space-y-2">
          {tier.benefits.map((benefit) => (
            <li key={benefit.id} className="text-sm text-gray-300 flex items-start gap-2">
              <span className="shrink-0">{benefitTypeLabels[benefit.type]?.split(" ")[0] || "✨"}</span>
              <span>{benefit.description || benefitTypeLabels[benefit.type]?.split(" ").slice(1).join(" ")}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-sm">
        <span className="text-gray-400">
          {tier.is_active ? (
            <span className="text-green-400">● Active</span>
          ) : (
            <span className="text-gray-500">● Inactive</span>
          )}
        </span>
        <span className="text-gray-400">
          Created {new Date(tier.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
