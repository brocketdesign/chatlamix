"use client";

import { useState } from "react";

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterId: string;
  characterName: string;
  tipMinimum?: number;
  userCoinBalance?: number;
  onSendTip: (data: { 
    amount: number; 
    message?: string; 
    isPublic: boolean; 
    paymentMethod: "coins" | "direct";
  }) => Promise<void>;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

export function TipModal({
  isOpen,
  onClose,
  characterId,
  characterName,
  tipMinimum = 1,
  userCoinBalance = 0,
  onSendTip,
}: TipModalProps) {
  const [amount, setAmount] = useState<number>(tipMinimum);
  const [message, setMessage] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"coins" | "direct">("direct");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (amount < tipMinimum) {
      setError(`Minimum tip amount is $${tipMinimum.toFixed(2)}`);
      return;
    }

    if (paymentMethod === "coins") {
      const coinsNeeded = Math.ceil(amount * 100); // 100 coins = $1
      if (coinsNeeded > userCoinBalance) {
        setError(`Not enough coins. You need ${coinsNeeded} coins but have ${userCoinBalance}`);
        return;
      }
    }

    setSending(true);
    try {
      await onSendTip({
        amount,
        message: message.trim() || undefined,
        isPublic,
        paymentMethod,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send tip");
    } finally {
      setSending(false);
    }
  }

  const coinsNeeded = Math.ceil(amount * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative glass border border-border rounded-2xl p-6 max-w-md w-full">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">💝</span>
          </div>
          <h2 className="text-2xl font-bold mb-1">Send a Tip</h2>
          <p className="text-gray-400">Show your support for {characterName}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Preset Amounts */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Select Amount
            </label>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset)}
                  className={`py-2 rounded-lg font-semibold text-sm transition-colors ${
                    amount === preset
                      ? "gradient-primary"
                      : "bg-surface-light border border-border hover:border-primary"
                  }`}
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Custom Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                min={tipMinimum}
                step="0.01"
                className="w-full pl-8 pr-4 py-3 bg-surface-light border border-border rounded-xl text-white focus:outline-none focus:border-primary"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Minimum: ${tipMinimum.toFixed(2)}
            </p>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("direct")}
                className={`p-4 rounded-xl border transition-colors ${
                  paymentMethod === "direct"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface-light hover:border-primary/50"
                }`}
              >
                <div className="text-2xl mb-1">💳</div>
                <div className="font-medium">Direct</div>
                <div className="text-xs text-gray-400">${amount.toFixed(2)}</div>
              </button>
              
              <button
                type="button"
                onClick={() => setPaymentMethod("coins")}
                className={`p-4 rounded-xl border transition-colors ${
                  paymentMethod === "coins"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface-light hover:border-primary/50"
                }`}
              >
                <div className="text-2xl mb-1">🪙</div>
                <div className="font-medium">Coins</div>
                <div className="text-xs text-gray-400">
                  {coinsNeeded} coins
                  {userCoinBalance < coinsNeeded && (
                    <span className="text-red-400 block">
                      Need {coinsNeeded - userCoinBalance} more
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Add a Message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Say something nice..."
              maxLength={500}
              rows={3}
              className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Public Toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-10 h-5 rounded-full transition-colors ${
                isPublic ? "bg-primary" : "bg-gray-600"
              }`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${
                  isPublic ? "translate-x-5" : "translate-x-0.5"
                }`} />
              </div>
            </div>
            <div>
              <span className="text-gray-300 text-sm">Make tip public</span>
              <p className="text-xs text-gray-500">Your name will be shown to other fans</p>
            </div>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={sending || amount < tipMinimum || (paymentMethod === "coins" && coinsNeeded > userCoinBalance)}
            className="w-full py-4 gradient-primary rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {sending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                Sending...
              </span>
            ) : (
              `Send $${amount.toFixed(2)} Tip 💝`
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

interface TipButtonProps {
  characterId: string;
  characterName: string;
  tipMinimum?: number;
  userCoinBalance?: number;
  onSendTip: (data: { 
    amount: number; 
    message?: string; 
    isPublic: boolean; 
    paymentMethod: "coins" | "direct";
  }) => Promise<void>;
  className?: string;
}

export function TipButton({
  characterId,
  characterName,
  tipMinimum,
  userCoinBalance,
  onSendTip,
  className = "",
}: TipButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`px-4 py-2 bg-pink-500/20 text-pink-400 rounded-lg font-semibold hover:bg-pink-500/30 transition-colors ${className}`}
      >
        💝 Send Tip
      </button>
      
      <TipModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        characterId={characterId}
        characterName={characterName}
        tipMinimum={tipMinimum}
        userCoinBalance={userCoinBalance}
        onSendTip={onSendTip}
      />
    </>
  );
}
