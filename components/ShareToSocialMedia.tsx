"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LateAccount,
  LateProfile,
  SchedulingTemplate,
  SocialPlatform,
  CharacterImage,
} from "@/lib/types";

interface ShareToSocialMediaProps {
  characterId: string;
  characterName: string;
  image: CharacterImage;
  onClose: () => void;
  onSuccess?: () => void;
}

const PLATFORM_ICONS: Record<SocialPlatform, string> = {
  twitter: "𝕏",
  instagram: "📸",
  facebook: "📘",
  linkedin: "💼",
  tiktok: "🎵",
  youtube: "▶️",
  pinterest: "📌",
  reddit: "🔴",
  bluesky: "🦋",
  threads: "🧵",
  googlebusiness: "🏢",
  telegram: "✈️",
  snapchat: "👻",
};

const PLATFORM_NAMES: Record<SocialPlatform, string> = {
  twitter: "X (Twitter)",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
  reddit: "Reddit",
  bluesky: "Bluesky",
  threads: "Threads",
  googlebusiness: "Google Business",
  telegram: "Telegram",
  snapchat: "Snapchat",
};

export default function ShareToSocialMedia({
  characterId,
  characterName,
  image,
  onClose,
  onSuccess,
}: ShareToSocialMediaProps) {
  const [step, setStep] = useState<"config" | "compose" | "success">("config");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  // Configuration data
  const [profiles, setProfiles] = useState<LateProfile[]>([]);
  const [accounts, setAccounts] = useState<LateAccount[]>([]);
  const [templates, setTemplates] = useState<SchedulingTemplate[]>([]);
  const [hasApiKey, setHasApiKey] = useState(false);

  // Selected options
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [useQueue, setUseQueue] = useState(true);
  const [publishNow, setPublishNow] = useState(false);

  // Post content
  const [content, setContent] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  
  // AI generation loading states
  const [generatingContent, setGeneratingContent] = useState(false);
  const [generatingHashtags, setGeneratingHashtags] = useState(false);

  // Next slot preview
  const [nextSlot, setNextSlot] = useState<string | null>(null);

  // Load initial data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Load profiles
      const profilesRes = await fetch("/api/social-media?type=profiles");
      if (profilesRes.ok) {
        const profilesData = await profilesRes.json();
        setProfiles(profilesData);
        setHasApiKey(true);
        if (profilesData.length > 0) {
          setSelectedProfile(profilesData[0]._id);
        }
      } else {
        const errData = await profilesRes.json();
        if (errData.error?.includes("API key")) {
          setHasApiKey(false);
        }
      }

      // Load templates
      const templatesRes = await fetch("/api/social-media/schedule-template");
      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        setTemplates(templatesData);
        const defaultTemplate = templatesData.find((t: SchedulingTemplate) => t.isDefault);
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate.id);
        }
      }
    } catch (err) {
      console.error("Error loading social media data:", err);
      setError("Failed to load social media configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/social-media?type=accounts&profileId=${selectedProfile}`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (err) {
      console.error("Error loading accounts:", err);
    }
  }, [selectedProfile]);

  const loadNextSlot = useCallback(async () => {
    if (!selectedProfile || !useQueue) {
      setNextSlot(null);
      return;
    }

    try {
      let url = `/api/social-media?type=next-slot&profileId=${selectedProfile}`;
      if (selectedTemplate) {
        const template = templates.find((t) => t.id === selectedTemplate);
        if (template?.lateQueueId) {
          url += `&queueId=${template.lateQueueId}`;
        }
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setNextSlot(data.nextSlot);
      }
    } catch (err) {
      console.error("Error loading next slot:", err);
    }
  }, [selectedProfile, selectedTemplate, templates, useQueue]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load accounts when profile changes
  useEffect(() => {
    if (selectedProfile) {
      loadAccounts();
      loadNextSlot();
    }
  }, [selectedProfile, selectedTemplate, loadAccounts, loadNextSlot]);

  async function generateContent() {
    setGeneratingContent(true);
    try {
      const platforms = selectedAccounts.map((accountId) => {
        const account = accounts.find((a) => a._id === accountId);
        return account?.platform;
      }).filter(Boolean);

      const res = await fetch("/api/social-media/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "content",
          characterName,
          imagePrompt: image.prompt,
          platforms,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setContent(data.content || "");
      } else {
        const errData = await res.json();
        setError(errData.error || "Error generating content");
      }
    } catch (err) {
      console.error("Error generating content:", err);
      setError("Error generating content");
    } finally {
      setGeneratingContent(false);
    }
  }

  async function generateHashtags() {
    setGeneratingHashtags(true);
    try {
      const res = await fetch("/api/social-media/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "hashtags",
          characterName,
          imagePrompt: image.prompt,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Merge with existing hashtags, avoiding duplicates
        const newHashtags = data.hashtags || [];
        setHashtags((prev) => {
          const combined = [...prev, ...newHashtags];
          return [...new Set(combined)];
        });
      } else {
        const errData = await res.json();
        setError(errData.error || "Error generating hashtags");
      }
    } catch (err) {
      console.error("Error generating hashtags:", err);
      setError("Error generating hashtags");
    } finally {
      setGeneratingHashtags(false);
    }
  }

  function handleAddHashtag() {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
    }
    setHashtagInput("");
  }

  function handleRemoveHashtag(tag: string) {
    setHashtags(hashtags.filter((h) => h !== tag));
  }

  function toggleAccount(accountId: string) {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  }

  async function handlePost() {
    if (selectedAccounts.length === 0) {
      setError("Please select at least one account to post to");
      return;
    }

    setPosting(true);
    setError("");

    try {
      const platforms = selectedAccounts.map((accountId) => {
        const account = accounts.find((a) => a._id === accountId);
        return {
          platform: account?.platform,
          accountId,
        };
      });

      const template = templates.find((t) => t.id === selectedTemplate);

      const res = await fetch("/api/social-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          characterImageId: image.id,
          imageUrl: image.imageUrl,
          content,
          hashtags,
          platforms,
          useQueue: useQueue && !publishNow,
          profileId: selectedProfile,
          queueId: template?.lateQueueId,
          publishNow,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create post");
      }

      setStep("success");
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="glass border border-border rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!hasApiKey) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="glass border border-border rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-4xl mb-4">🔑</div>
            <h2 className="text-xl font-bold mb-2">Configuration Required</h2>
            <p className="text-gray-400 mb-6">
              To post on social media, you need to configure your Late API key.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Create an account on{" "}
              <a
                href="https://getlate.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                getlate.dev
              </a>{" "}
              and add your API key in settings.
            </p>
            <button
              onClick={onClose}
              className="py-2 px-6 bg-surface-light border border-border rounded-lg hover:border-primary/50 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 overflow-y-auto py-8">
      <div className="glass border border-border rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {step === "success" ? "✅ Published!" : "Share on Social Media"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {step === "success" ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-lg font-semibold mb-2">Post Scheduled!</h3>
            <p className="text-gray-400 mb-6">
              Your image will be published automatically according to your schedule.
            </p>
            <button
              onClick={onClose}
              className="gradient-primary text-white py-3 px-8 rounded-xl font-semibold hover:opacity-90 transition-all"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Image Preview */}
            <div className="flex gap-4 mb-6">
              <img
                src={image.imageUrl}
                alt={characterName}
                className="w-24 h-24 rounded-xl object-cover border border-border"
              />
              <div className="flex-1">
                <h3 className="font-semibold">{characterName}</h3>
                <p className="text-sm text-gray-400 line-clamp-2">{image.prompt}</p>
              </div>
            </div>

            {/* Profile Selection */}
            {profiles.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Late Profile</label>
                <select
                  value={selectedProfile}
                  onChange={(e) => setSelectedProfile(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none"
                >
                  {profiles.map((profile) => (
                    <option key={profile._id} value={profile._id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Account Selection */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                Accounts ({selectedAccounts.length} selected)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {accounts.map((account) => (
                  <button
                    key={account._id}
                    onClick={() => toggleAccount(account._id)}
                    className={`p-3 rounded-xl border transition-all text-left ${
                      selectedAccounts.includes(account._id)
                        ? "border-primary bg-primary/10"
                        : "border-border bg-surface-light hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {PLATFORM_ICONS[account.platform]}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium truncate text-sm">
                          {account.displayName}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {PLATFORM_NAMES[account.platform]}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {accounts.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  No accounts connected.{" "}
                  <a
                    href="https://getlate.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Connect accounts
                  </a>
                </p>
              )}
            </div>

            {/* Content */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm text-gray-400">
                  Post text (optional)
                </label>
                <button
                  onClick={generateContent}
                  disabled={generatingContent}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg hover:border-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Generate with AI"
                >
                  {generatingContent ? (
                    <>
                      <div className="animate-spin w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Generate with AI</span>
                    </>
                  )}
                </button>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Add text to your post..."
                rows={3}
                className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none resize-none"
              />
            </div>

            {/* Hashtags */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm text-gray-400">Hashtags</label>
                <button
                  onClick={generateHashtags}
                  disabled={generatingHashtags}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg hover:border-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Generate with AI"
                >
                  {generatingHashtags ? (
                    <>
                      <div className="animate-spin w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Generate with AI</span>
                    </>
                  )}
                </button>
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddHashtag()}
                  placeholder="Add a hashtag"
                  className="flex-1 px-4 py-2 bg-surface-light border border-border rounded-lg focus:border-primary focus:outline-none"
                />
                <button
                  onClick={handleAddHashtag}
                  className="px-4 py-2 bg-surface-light border border-border rounded-lg hover:border-primary/50 transition-all"
                >
                  +
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm flex items-center gap-1"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveHashtag(tag)}
                      className="hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Scheduling Options */}
            <div className="mb-6 p-4 bg-surface-light rounded-xl border border-border">
              <h4 className="font-semibold mb-3">Scheduling</h4>
              
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    checked={useQueue && !publishNow}
                    onChange={() => {
                      setUseQueue(true);
                      setPublishNow(false);
                    }}
                    className="w-4 h-4 accent-primary"
                  />
                  <div>
                    <span className="font-medium">Use schedule</span>
                    {nextSlot && (
                      <p className="text-xs text-gray-400">
                        Next slot: {formatDate(nextSlot)}
                      </p>
                    )}
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    checked={publishNow}
                    onChange={() => {
                      setPublishNow(true);
                      setUseQueue(false);
                    }}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="font-medium">Publish immediately</span>
                </label>
              </div>

              {/* Template Selection */}
              {useQueue && !publishNow && templates.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <label className="block text-sm text-gray-400 mb-2">
                    Schedule template
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg focus:border-primary focus:outline-none text-sm"
                  >
                    <option value="">Default</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} {template.isDefault && "(default)"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-surface-light border border-border rounded-xl hover:border-primary/50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handlePost}
                disabled={posting || selectedAccounts.length === 0}
                className="flex-1 gradient-primary text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {posting ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    Publishing...
                  </>
                ) : publishNow ? (
                  "Publish now"
                ) : (
                  "Schedule"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
