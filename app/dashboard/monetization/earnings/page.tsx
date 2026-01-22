"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import { UserButton } from "@/components/auth/UserButton";
import Link from "next/link";

export const dynamic = 'force-dynamic';

interface BalanceSummary {
  totalGross: number;
  totalFees: number;
  totalNet: number;
  pending: number;
  available: number;
  paidOut: number;
  pendingPayout: number;
}

interface PayoutSettings {
  minimumPayout: number;
  platformFeePercentage: number;
  payoutsEnabled: boolean;
  hasStripeAccount: boolean;
  onboardingComplete: boolean;
}

interface PayoutRequest {
  id: string;
  amount: number;
  platform_fee: number;
  net_amount: number;
  status: string;
  stripe_transfer_id?: string;
  failure_reason?: string;
  processed_at?: string;
  completed_at?: string;
  created_at: string;
}

interface Earning {
  id: string;
  source_type: string;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  status: string;
  characters?: { name: string };
  created_at: string;
}

export default function EarningsPage() {
  const { user, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [settings, setSettings] = useState<PayoutSettings | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch balance and payout info
      const payoutRes = await fetch('/api/stripe-connect/payout');
      if (payoutRes.ok) {
        const payoutData = await payoutRes.json();
        setBalance(payoutData.balance);
        setPayouts(payoutData.payouts || []);
        setSettings(payoutData.settings);
      }

      // Fetch earnings history
      const earningsRes = await fetch(`/api/earnings?status=${filter !== "all" ? filter : ""}`);
      if (earningsRes.ok) {
        const earningsData = await earningsRes.json();
        setEarnings(earningsData.earnings || []);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (!isLoading && user) {
      loadData();
    }
  }, [isLoading, user, loadData]);

  async function handleRequestPayout() {
    if (!settings || !balance) return;

    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount < settings.minimumPayout) {
      setError(`Minimum payout amount is $${settings.minimumPayout}`);
      return;
    }

    if (amount > balance.available) {
      setError(`You only have $${balance.available.toFixed(2)} available`);
      return;
    }

    if (!settings.payoutsEnabled) {
      setError("Please complete Stripe Connect setup to request payouts");
      return;
    }

    setRequestingPayout(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe-connect/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to request payout');
      }

      setSuccess(data.message);
      setShowPayoutModal(false);
      setPayoutAmount("");
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request payout');
    } finally {
      setRequestingPayout(false);
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const earningTypeLabels: Record<string, { label: string; icon: string }> = {
    subscription: { label: "Subscription", icon: "⭐" },
    tip: { label: "Tip", icon: "💝" },
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: "Pending", color: "text-yellow-400 bg-yellow-500/20" },
    available: { label: "Available", color: "text-green-400 bg-green-500/20" },
    paid_out: { label: "Paid Out", color: "text-blue-400 bg-blue-500/20" },
    processing: { label: "Processing", color: "text-purple-400 bg-purple-500/20" },
    completed: { label: "Completed", color: "text-green-400 bg-green-500/20" },
    failed: { label: "Failed", color: "text-red-400 bg-red-500/20" },
  };

  return (
    <div className="min-h-screen bg-surface-dark text-white">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Earnings</h1>
          <p className="text-gray-400">Track your revenue and request payouts</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white">✕</button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400 flex justify-between items-center">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Stripe Connect Status Banner */}
        {settings && !settings.payoutsEnabled && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-400 font-medium">⚠️ Stripe Connect Setup Required</p>
                <p className="text-gray-400 text-sm mt-1">
                  {settings.hasStripeAccount 
                    ? "Complete your Stripe Connect verification to start receiving payouts."
                    : "Connect your bank account via Stripe to receive your earnings."}
                </p>
              </div>
              <Link
                href="/dashboard/monetization/settings"
                className="px-4 py-2 gradient-primary rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                {settings.hasStripeAccount ? 'Complete Setup' : 'Connect Stripe'}
              </Link>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass border border-border rounded-2xl p-6">
            <div className="text-sm text-gray-400 mb-1">Pending</div>
            <div className="text-2xl font-bold text-yellow-400">
              ${balance?.pending.toFixed(2) || "0.00"}
            </div>
            <div className="text-xs text-gray-500 mt-1">Awaiting clearance</div>
          </div>
          
          <div className="glass border border-border rounded-2xl p-6">
            <div className="text-sm text-gray-400 mb-1">Available</div>
            <div className="text-2xl font-bold text-green-400">
              ${balance?.available.toFixed(2) || "0.00"}
            </div>
            <div className="text-xs text-gray-500 mt-1">Ready to withdraw</div>
          </div>
          
          <div className="glass border border-border rounded-2xl p-6">
            <div className="text-sm text-gray-400 mb-1">Paid Out</div>
            <div className="text-2xl font-bold text-blue-400">
              ${balance?.paidOut.toFixed(2) || "0.00"}
            </div>
            <div className="text-xs text-gray-500 mt-1">Total withdrawn</div>
          </div>
          
          <div className="glass border border-primary rounded-2xl p-6">
            <div className="text-sm text-gray-400 mb-1">Total Earnings</div>
            <div className="text-2xl font-bold gradient-text">
              ${balance?.totalNet.toFixed(2) || "0.00"}
            </div>
            <div className="text-xs text-gray-500 mt-1">After platform fees</div>
          </div>
        </div>

        {/* Payout Section */}
        <div className="glass border border-border rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold mb-2">Request Payout</h2>
              <p className="text-gray-400 text-sm">
                Minimum payout: ${settings?.minimumPayout || 20} • Platform fee: {settings?.platformFeePercentage || 15}% • Processed in 2-7 business days
              </p>
              {(balance?.pendingPayout || 0) > 0 && (
                <p className="text-yellow-400 text-sm mt-1">
                  📤 You have ${balance?.pendingPayout.toFixed(2)} in pending payouts
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/monetization/settings"
                className="px-4 py-2 bg-surface-light border border-border rounded-lg hover:border-primary transition-colors"
              >
                ⚙️ Payout Settings
              </Link>
              
              <button
                onClick={() => {
                  setPayoutAmount(balance?.available.toFixed(2) || "0");
                  setShowPayoutModal(true);
                }}
                disabled={!settings?.payoutsEnabled || (balance?.available || 0) < (settings?.minimumPayout || 20)}
                className="px-6 py-3 gradient-primary rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Withdraw ${balance?.available.toFixed(2) || "0.00"}
              </button>
            </div>
          </div>
        </div>

        {/* Recent Payouts */}
        {payouts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Recent Payouts</h2>
            <div className="glass border border-border rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Date</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Amount</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Fee</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">You Receive</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.slice(0, 5).map((payout) => {
                    const statusInfo = statusLabels[payout.status] || { label: payout.status, color: "text-gray-400 bg-gray-500/20" };
                    return (
                      <tr key={payout.id} className="border-b border-border last:border-0 hover:bg-surface-light/50">
                        <td className="px-6 py-4 text-gray-300">
                          {new Date(payout.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right font-medium">
                          ${payout.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-400">
                          -${payout.platform_fee.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-green-400">
                          ${payout.net_amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                          {payout.failure_reason && (
                            <p className="text-red-400 text-xs mt-1">{payout.failure_reason}</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Earnings History */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Earnings History</h2>
            
            <div className="flex gap-2 p-1 bg-surface-light rounded-lg">
              {[
                { value: "all", label: "All" },
                { value: "pending", label: "Pending" },
                { value: "available", label: "Available" },
                { value: "paid_out", label: "Paid Out" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === option.value
                      ? "gradient-primary"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {earnings.length === 0 ? (
            <div className="glass border border-border rounded-2xl p-12 text-center">
              <div className="text-5xl mb-4">💰</div>
              <h3 className="text-xl font-semibold mb-2">No Earnings Yet</h3>
              <p className="text-gray-400 mb-6">
                Start earning by creating subscription tiers and receiving tips from fans
              </p>
              <Link
                href="/dashboard/monetization/tiers"
                className="px-6 py-3 gradient-primary rounded-xl font-semibold hover:opacity-90 transition-opacity inline-block"
              >
                Create Your First Tier
              </Link>
            </div>
          ) : (
            <div className="glass border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Type</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Character</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Gross</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Fee (15%)</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Net</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Status</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.map((earning) => {
                      const typeInfo = earningTypeLabels[earning.source_type] || { label: earning.source_type, icon: "💵" };
                      const statusInfo = statusLabels[earning.status] || { label: earning.status, color: "text-gray-400 bg-gray-500/20" };
                      
                      return (
                        <tr key={earning.id} className="border-b border-border last:border-0 hover:bg-surface-light/50">
                          <td className="px-6 py-4">
                            <span className="flex items-center gap-2">
                              <span>{typeInfo.icon}</span>
                              <span>{typeInfo.label}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {earning.characters?.name || "-"}
                          </td>
                          <td className="px-6 py-4 text-right font-medium">
                            ${earning.gross_amount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right text-gray-400">
                            -${earning.platform_fee.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-green-400">
                            ${earning.net_amount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-400 text-sm">
                            {new Date(earning.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass border border-border rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Request Payout</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount to withdraw
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  min={settings?.minimumPayout || 20}
                  max={balance?.available || 0}
                  step="0.01"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 bg-surface-light border border-border rounded-xl text-white focus:outline-none focus:border-primary"
                />
              </div>
              <p className="text-gray-500 text-sm mt-2">
                Available: ${balance?.available.toFixed(2) || "0.00"} • Min: ${settings?.minimumPayout || 20}
              </p>
            </div>

            <div className="p-4 bg-surface-light rounded-xl mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Withdrawal amount:</span>
                <span>${parseFloat(payoutAmount || "0").toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Platform fee (15%):</span>
                <span className="text-red-400">-${(parseFloat(payoutAmount || "0") * 0.15).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-border">
                <span>You receive:</span>
                <span className="text-green-400">${(parseFloat(payoutAmount || "0") * 0.85).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowPayoutModal(false)}
                className="flex-1 px-4 py-3 bg-surface-light border border-border rounded-xl font-medium hover:border-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestPayout}
                disabled={requestingPayout || parseFloat(payoutAmount) < (settings?.minimumPayout || 20)}
                className="flex-1 px-4 py-3 gradient-primary rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {requestingPayout ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Processing...
                  </span>
                ) : (
                  'Request Payout'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
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
          <span className="text-gray-300">Earnings</span>
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
