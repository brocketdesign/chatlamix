"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import { UserButton } from "@/components/auth/UserButton";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export const dynamic = 'force-dynamic';

interface StripeAccountStatus {
  hasAccount: boolean;
  accountId?: string;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements?: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
    pendingVerification: string[];
    disabledReason?: string;
  };
  country?: string;
  defaultCurrency?: string;
}

function PayoutSettingsContent() {
  const { user, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeAccountStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadStripeStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe-connect/account');
      if (res.ok) {
        const data = await res.json();
        setStripeStatus(data);
      }
    } catch (err) {
      console.error("Error loading Stripe status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      loadStripeStatus();
    }
  }, [isLoading, user, loadStripeStatus]);

  // Handle return from Stripe onboarding
  useEffect(() => {
    const successParam = searchParams.get('success');
    const refreshParam = searchParams.get('refresh');

    if (successParam === 'true') {
      setSuccess("Stripe Connect setup completed! Your account is being verified.");
      loadStripeStatus();
      // Clear URL params
      window.history.replaceState({}, '', '/dashboard/monetization/settings');
    } else if (refreshParam === 'true') {
      setError("Stripe Connect setup was interrupted. Please try again.");
      window.history.replaceState({}, '', '/dashboard/monetization/settings');
    }
  }, [searchParams, loadStripeStatus]);

  async function handleConnectStripe() {
    setConnectingStripe(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe-connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/dashboard/monetization/settings?success=true`,
          refreshUrl: `${window.location.origin}/dashboard/monetization/settings?refresh=true`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start onboarding');
      }

      const data = await res.json();
      
      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Stripe');
      setConnectingStripe(false);
    }
  }

  async function handleOpenStripeDashboard() {
    try {
      const res = await fetch('/api/stripe-connect/account', {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to open dashboard');
      }

      const data = await res.json();
      window.open(data.url, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open Stripe dashboard');
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const accountStatus = stripeStatus?.hasAccount 
    ? stripeStatus.payoutsEnabled 
      ? 'verified'
      : stripeStatus.detailsSubmitted 
        ? 'pending'
        : 'incomplete'
    : 'not_connected';

  const statusConfig = {
    not_connected: { 
      label: 'Not Connected', 
      color: 'text-gray-400 bg-gray-500/20',
      icon: '⚪'
    },
    incomplete: { 
      label: 'Setup Incomplete', 
      color: 'text-yellow-400 bg-yellow-500/20',
      icon: '🟡'
    },
    pending: { 
      label: 'Pending Verification', 
      color: 'text-blue-400 bg-blue-500/20',
      icon: '🔵'
    },
    verified: { 
      label: 'Verified', 
      color: 'text-green-400 bg-green-500/20',
      icon: '🟢'
    },
  };

  const currentStatus = statusConfig[accountStatus];

  return (
    <div className="min-h-screen bg-surface-dark text-white">
      <Header />
      
      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Payout Settings</h1>
          <p className="text-gray-400">Connect your bank account to receive earnings from fans</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400">
            {success}
          </div>
        )}

        {/* Stripe Connect Card */}
        <div className="glass border border-border rounded-2xl p-6 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Stripe Connect</h2>
              <p className="text-gray-400 text-sm">
                Connect your bank account via Stripe to receive payouts from tips and subscriptions.
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${currentStatus.color}`}>
              {currentStatus.icon} {currentStatus.label}
            </span>
          </div>

          {accountStatus === 'not_connected' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-blue-400 font-medium mb-2">💳 Get paid directly to your bank account</p>
                <p className="text-gray-400 text-sm">
                  Stripe Connect securely handles payouts to your bank account. You&apos;ll need to provide 
                  your business information and bank details during setup.
                </p>
              </div>
              
              <button
                onClick={handleConnectStripe}
                disabled={connectingStripe}
                className="w-full px-6 py-4 gradient-primary rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {connectingStripe ? (
                  <>
                    <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
                    </svg>
                    Connect with Stripe
                  </>
                )}
              </button>
            </div>
          )}

          {accountStatus === 'incomplete' && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <p className="text-yellow-400 font-medium mb-2">⚠️ Setup Incomplete</p>
                <p className="text-gray-400 text-sm">
                  Your Stripe account setup is incomplete. Please complete the onboarding process to start receiving payouts.
                </p>
                {stripeStatus?.requirements?.currentlyDue && stripeStatus.requirements.currentlyDue.length > 0 && (
                  <div className="mt-2">
                    <p className="text-gray-500 text-xs">Missing information:</p>
                    <ul className="text-gray-400 text-sm list-disc list-inside mt-1">
                      {stripeStatus.requirements.currentlyDue.slice(0, 3).map((req) => (
                        <li key={req}>{req.replace(/_/g, ' ')}</li>
                      ))}
                      {stripeStatus.requirements.currentlyDue.length > 3 && (
                        <li>and {stripeStatus.requirements.currentlyDue.length - 3} more...</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
              
              <button
                onClick={handleConnectStripe}
                disabled={connectingStripe}
                className="w-full px-6 py-4 gradient-primary rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {connectingStripe ? 'Connecting...' : 'Complete Setup'}
              </button>
            </div>
          )}

          {accountStatus === 'pending' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-blue-400 font-medium mb-2">🔄 Verification in Progress</p>
                <p className="text-gray-400 text-sm">
                  Your information has been submitted and is being verified by Stripe. 
                  This usually takes 1-2 business days. We&apos;ll notify you once verification is complete.
                </p>
              </div>
              
              <button
                onClick={handleOpenStripeDashboard}
                className="w-full px-6 py-4 bg-surface-light border border-border rounded-xl font-semibold hover:border-primary transition-colors"
              >
                View Stripe Dashboard
              </button>
            </div>
          )}

          {accountStatus === 'verified' && (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <p className="text-green-400 font-medium mb-2">✓ Ready to Receive Payouts</p>
                <p className="text-gray-400 text-sm">
                  Your Stripe account is verified and ready to receive payouts from tips and subscriptions.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-surface-light rounded-xl">
                  <p className="text-gray-400 text-sm">Country</p>
                  <p className="font-medium">{stripeStatus?.country?.toUpperCase() || 'US'}</p>
                </div>
                <div className="p-4 bg-surface-light rounded-xl">
                  <p className="text-gray-400 text-sm">Currency</p>
                  <p className="font-medium">{stripeStatus?.defaultCurrency?.toUpperCase() || 'USD'}</p>
                </div>
              </div>
              
              <button
                onClick={handleOpenStripeDashboard}
                className="w-full px-6 py-4 bg-surface-light border border-border rounded-xl font-semibold hover:border-primary transition-colors"
              >
                Manage in Stripe Dashboard
              </button>
            </div>
          )}
        </div>

        {/* Platform Fee Info */}
        <div className="glass border border-border rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Platform Fee</h2>
          
          <div className="p-4 bg-surface-light rounded-xl mb-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Platform Fee</span>
              <span className="text-2xl font-bold text-primary">15%</span>
            </div>
            <p className="text-gray-500 text-sm mt-2">
              Chatlamix takes a 15% fee on all earnings from tips and subscriptions. 
              This fee covers payment processing, platform maintenance, and support.
            </p>
          </div>

          <div className="text-sm text-gray-400">
            <p className="mb-2">Example breakdown:</p>
            <div className="flex justify-between mb-1">
              <span>Fan pays:</span>
              <span>$10.00</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Platform fee (15%):</span>
              <span className="text-red-400">-$1.50</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t border-border">
              <span>You receive:</span>
              <span className="text-green-400">$8.50</span>
            </div>
          </div>
        </div>

        {/* Payout Info */}
        <div className="glass border border-border rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">Payout Information</h2>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💵</span>
              <div>
                <p className="font-medium">Minimum Payout: $20</p>
                <p className="text-gray-400 text-sm">
                  You can request a payout once your available balance reaches $20.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">⏱️</span>
              <div>
                <p className="font-medium">Processing Time: 2-7 business days</p>
                <p className="text-gray-400 text-sm">
                  After requesting a payout, funds typically arrive in your bank account within 2-7 business days.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <p className="font-medium">Secure Transfers</p>
                <p className="text-gray-400 text-sm">
                  All payouts are processed securely through Stripe, a trusted payment processor used by millions of businesses.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Back to Earnings */}
        <div className="mt-8 text-center">
          <Link
            href="/dashboard/monetization/earnings"
            className="text-primary hover:underline"
          >
            ← Back to Earnings
          </Link>
        </div>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-10 glass border-b border-border">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-2xl font-bold gradient-text">
            Chatlamix
          </Link>
          <span className="text-gray-400">|</span>
          <Link href="/dashboard/monetization" className="text-gray-400 hover:text-white transition-colors">
            Monetization
          </Link>
          <span className="text-gray-400">›</span>
          <span className="text-gray-300">Settings</span>
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}

export default function PayoutSettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    }>
      <PayoutSettingsContent />
    </Suspense>
  );
}
