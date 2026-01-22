"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import Navigation from "@/components/Navigation";
import Link from "next/link";

interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  price_usd: number;
  original_price_usd?: number;
  bonus_percentage: number;
  bonus_coins?: number;
  is_popular: boolean;
  is_active: boolean;
  sort_order: number;
  promotion_label?: string;
  promotion_ends?: string | null;
}

interface CoinTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  description?: string;
  created_at: string;
}

interface UserCoinBalance {
  balance: number;
  lifetime_earned: number;
  lifetime_spent?: number;
  auto_recharge_enabled?: boolean;
  auto_recharge_package_id?: string | null;
}

export default function CoinsPage() {
  const { user, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<UserCoinBalance | null>(null);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [autoRechargePackages, setAutoRechargePackages] = useState<CoinPackage[]>([]);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(false);
  const [autoRechargePackage, setAutoRechargePackage] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      loadData();
    }
  }, [isLoading, user]);

  async function loadData() {
    setLoading(true);
    try {
      const [coinsRes, packagesRes] = await Promise.all([
        fetch("/api/coins"),
        fetch("/api/coins/packages"),
      ]);

      if (coinsRes.ok) {
        const data = await coinsRes.json();
        setBalance(data.balance);
        setTransactions(data.transactions || []);
        setAutoRechargeEnabled(data.balance?.auto_recharge_enabled || false);
        setAutoRechargePackage(data.balance?.auto_recharge_package_id || null);
      }

      if (packagesRes.ok) {
        const data = await packagesRes.json();
        setPackages(data.packages || []);
        setAutoRechargePackages(data.autoRechargePackages || data.packages?.filter((p: CoinPackage) => p.price_usd >= 19.99) || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePurchase(packageId: string) {
    setPurchasing(packageId);
    try {
      const res = await fetch("/api/coins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });

      if (res.ok) {
        const data = await res.json();
        // Refresh balance
        loadData();
        alert(`Successfully purchased ${data.coins_added} coins!`);
      } else {
        const data = await res.json();
        alert(data.error || "Purchase failed");
      }
    } catch (error) {
      console.error("Error purchasing:", error);
      alert("An error occurred");
    } finally {
      setPurchasing(null);
    }
  }

  async function handleSaveAutoRecharge() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/coins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoRechargeEnabled,
          autoRechargePackageId: autoRechargePackage,
        }),
      });

      if (res.ok) {
        alert("Auto-recharge settings saved!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("An error occurred");
    } finally {
      setSavingSettings(false);
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const transactionTypeLabels: Record<string, { label: string; color: string }> = {
    purchase: { label: "Purchase", color: "text-green-400" },
    subscription_bonus: { label: "Subscription Bonus", color: "text-blue-400" },
    image_generation: { label: "Image Generation", color: "text-red-400" },
    tip: { label: "Tip", color: "text-pink-400" },
    refund: { label: "Refund", color: "text-yellow-400" },
    gift: { label: "Gift", color: "text-purple-400" },
    auto_recharge: { label: "Auto Recharge", color: "text-green-400" },
  };

  return (
    <div className="min-h-screen bg-surface-dark text-white">
      <Navigation title="Coins" />
      
      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {/* Balance Card */}
        <div className="glass border border-border rounded-2xl p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-gray-400 mb-2">Your Balance</p>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold gradient-text">
                  {(balance?.balance ?? 0).toLocaleString()}
                </span>
                <span className="text-xl text-gray-400">coins</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {(balance?.lifetime_earned ?? 0).toLocaleString()} coins earned total
              </p>
            </div>
            
            <div className="text-right">
              <p className="text-sm text-gray-400 mb-1">Coin Value</p>
              <p className="text-gray-300">1 image = 5-15 coins</p>
              <p className="text-xs text-gray-500 mt-1">(depending on quality)</p>
            </div>
          </div>
        </div>

        {/* Coin Packages */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Buy Coins</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="animate-pulse w-2 h-2 bg-green-400 rounded-full"></span>
              <span className="text-green-400 font-medium">Limited Time Offers</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`glass border rounded-2xl p-6 relative ${
                  pkg.is_popular ? "border-primary ring-2 ring-primary/20" : "border-border"
                }`}
              >
                {/* Promotion Label */}
                {pkg.promotion_label && (
                  <div className={`absolute top-0 right-0 px-3 py-1 text-xs font-bold rounded-bl-lg rounded-tr-2xl ${
                    pkg.is_popular 
                      ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white" 
                      : "bg-green-500 text-white"
                  }`}>
                    {pkg.promotion_label}
                  </div>
                )}
                
                {pkg.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 gradient-primary rounded-full text-xs font-semibold z-10">
                    Most Popular
                  </div>
                )}
                
                <div className="text-center mb-4 mt-2">
                  <div className="text-3xl mb-2">🪙</div>
                  <div className="text-2xl font-bold">{pkg.coins.toLocaleString()}</div>
                  <div className="text-gray-400">coins</div>
                  {pkg.bonus_coins && pkg.bonus_coins > 0 && (
                    <div className="text-green-400 text-xs mt-1">
                      +{pkg.bonus_coins.toLocaleString()} bonus coins
                    </div>
                  )}
                </div>
                
                <div className="text-center mb-4">
                  {pkg.original_price_usd && pkg.original_price_usd > pkg.price_usd && (
                    <div className="text-gray-500 line-through text-sm">
                      ${pkg.original_price_usd.toFixed(2)}
                    </div>
                  )}
                  <span className="text-3xl font-bold">${pkg.price_usd.toFixed(2)}</span>
                  {pkg.bonus_percentage > 0 && (
                    <div className="text-green-400 text-sm mt-1 font-medium">
                      +{pkg.bonus_percentage}% bonus value
                    </div>
                  )}
                  {pkg.promotion_ends && (
                    <div className="text-yellow-400/80 text-xs mt-2">
                      ⏰ Ends {new Date(pkg.promotion_ends).toLocaleDateString()}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={purchasing === pkg.id}
                  className={`w-full py-3 rounded-xl font-semibold transition-all ${
                    pkg.is_popular
                      ? "gradient-primary hover:opacity-90"
                      : "bg-surface-light border border-border hover:border-primary"
                  } disabled:opacity-50`}
                >
                  {purchasing === pkg.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Processing...
                    </span>
                  ) : (
                    "Buy Now"
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Auto-Recharge Settings */}
        <div className="glass border border-border rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-semibold">Auto-Recharge</h2>
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">Recommended</span>
          </div>
          <p className="text-gray-400 text-sm mb-6">
            Never run out of coins! Automatically recharge when your balance falls below 50 coins.
          </p>
          
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={autoRechargeEnabled}
                    onChange={(e) => setAutoRechargeEnabled(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-12 h-6 rounded-full transition-colors ${
                    autoRechargeEnabled ? "bg-primary" : "bg-gray-600"
                  }`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                      autoRechargeEnabled ? "translate-x-6" : "translate-x-0.5"
                    }`} />
                  </div>
                </div>
                <span className="text-gray-300">Enable auto-recharge</span>
              </label>
            </div>
            
            {autoRechargeEnabled && (
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-2">Recharge package</label>
                <select
                  value={autoRechargePackage || ""}
                  onChange={(e) => setAutoRechargePackage(e.target.value || null)}
                  className="w-full px-4 py-2 bg-surface-light border border-border rounded-lg text-white"
                >
                  <option value="">Select package</option>
                  {autoRechargePackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} - {pkg.coins} coins - ${pkg.price_usd.toFixed(2)}
                      {pkg.bonus_percentage > 0 ? ` (+${pkg.bonus_percentage}% bonus)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <button
              onClick={handleSaveAutoRecharge}
              disabled={savingSettings}
              className="px-6 py-2 gradient-primary rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        {/* Transaction History */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Transaction History</h2>
          
          {transactions.length === 0 ? (
            <div className="glass border border-border rounded-2xl p-12 text-center">
              <div className="text-4xl mb-4">📜</div>
              <h3 className="text-lg font-semibold mb-2">No Transactions Yet</h3>
              <p className="text-gray-400">Your coin transactions will appear here</p>
            </div>
          ) : (
            <div className="glass border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Type</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Amount</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Description</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-surface-light/50">
                        <td className="px-6 py-4">
                          <span className={transactionTypeLabels[tx.transaction_type]?.color || "text-gray-300"}>
                            {transactionTypeLabels[tx.transaction_type]?.label || tx.transaction_type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={tx.amount >= 0 ? "text-green-400" : "text-red-400"}>
                            {tx.amount >= 0 ? "+" : ""}{tx.amount}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-300">
                          {tx.description || "-"}
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-sm">
                          {new Date(tx.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
