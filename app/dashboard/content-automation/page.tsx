"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import Link from "next/link";
import Image from "next/image";
import Navigation from "@/components/Navigation";
import {
  Character,
  ContentGenerationSchedule,
  ContentType,
  FrequencyType,
  ContentStylePreferences,
  CreativePromptSuggestion,
  GeneratedContent,
  SchedulingTemplate,
  SocialPlatform,
  LateAccount,
} from "@/lib/types";

const CONTENT_TYPES: { value: ContentType; label: string; icon: string }[] = [
  { value: "lifestyle", label: "Lifestyle", icon: "🏠" },
  { value: "fashion", label: "Fashion", icon: "👗" },
  { value: "travel", label: "Travel", icon: "✈️" },
  { value: "food", label: "Food", icon: "🍽️" },
  { value: "fitness", label: "Fitness", icon: "💪" },
  { value: "beauty", label: "Beauty", icon: "💄" },
  { value: "tech", label: "Tech", icon: "📱" },
  { value: "art", label: "Art", icon: "🎨" },
  { value: "nature", label: "Nature", icon: "🌿" },
  { value: "urban", label: "Urban", icon: "🏙️" },
  { value: "custom", label: "Custom", icon: "✨" },
];

const FREQUENCY_OPTIONS: { value: FrequencyType; label: string }[] = [
  { value: "hourly", label: "Every X hours" },
  { value: "daily", label: "Every X days" },
  { value: "weekly", label: "Every X weeks" },
];

const MOOD_OPTIONS = [
  "happy", "mysterious", "romantic", "energetic", "peaceful",
  "confident", "playful", "elegant", "casual", "dramatic"
];

const SETTING_OPTIONS = [
  "indoor", "outdoor", "studio", "urban", "nature",
  "beach", "mountain", "city", "cafe", "home"
];

const LIGHTING_OPTIONS = [
  "natural", "golden hour", "blue hour", "studio", "neon",
  "soft", "dramatic", "backlit", "candlelit", "sunset"
];

const PLATFORM_OPTIONS: { value: SocialPlatform; label: string; icon: string }[] = [
  { value: "instagram", label: "Instagram", icon: "📸" },
  { value: "tiktok", label: "TikTok", icon: "🎵" },
  { value: "twitter", label: "X/Twitter", icon: "𝕏" },
  { value: "facebook", label: "Facebook", icon: "📘" },
  { value: "linkedin", label: "LinkedIn", icon: "💼" },
  { value: "youtube", label: "YouTube", icon: "▶️" },
  { value: "pinterest", label: "Pinterest", icon: "📌" },
  { value: "threads", label: "Threads", icon: "🧵" },
  { value: "bluesky", label: "Bluesky", icon: "🦋" },
];

export default function ContentAutomationPage() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"schedules" | "generate" | "history">("schedules");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Data
  const [characters, setCharacters] = useState<Character[]>([]);
  const [schedules, setSchedules] = useState<ContentGenerationSchedule[]>([]);
  const [templates, setTemplates] = useState<SchedulingTemplate[]>([]);
  const [generatedContent, setGeneratedContent] = useState<any[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<LateAccount[]>([]);

  // Form states
  const [selectedCharacter, setSelectedCharacter] = useState("");
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    name: "",
    description: "",
    frequencyType: "daily" as FrequencyType,
    frequencyValue: 1,
    contentType: "lifestyle" as ContentType,
    customThemes: [] as string[],
    stylePreferences: {
      mood: [] as string[],
      settings: [] as string[],
      lighting: [] as string[],
      additionalInstructions: "",
    } as ContentStylePreferences,
    autoGenerateCaption: true,
    includeHashtags: true,
    hashtagCount: 5,
    autoPost: false,
    targetPlatforms: [] as SocialPlatform[],
    schedulingTemplateId: "",
    autoConnectToScheduleTemplate: false,
  });
  const [customThemeInput, setCustomThemeInput] = useState("");

  // Generate tab
  const [generating, setGenerating] = useState(false);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [promptSuggestions, setPromptSuggestions] = useState<CreativePromptSuggestion[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<CreativePromptSuggestion | null>(null);
  const [generateContentType, setGenerateContentType] = useState<ContentType>("lifestyle");
  const [generatedImage, setGeneratedImage] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [charsRes, schedulesRes, templatesRes, contentRes, accountsRes] = await Promise.all([
        fetch("/api/characters"),
        fetch("/api/content-generation"),
        fetch("/api/social-media/schedule-template"),
        fetch("/api/content-generation/execute?limit=20"),
        fetch("/api/social-media?type=accounts"),
      ]);

      if (charsRes.ok) {
        const charsData = await charsRes.json();
        setCharacters(charsData);
        if (charsData.length > 0 && !selectedCharacter) {
          setSelectedCharacter(charsData[0].id);
        }
      }

      if (schedulesRes.ok) {
        setSchedules(await schedulesRes.json());
      }

      if (templatesRes.ok) {
        setTemplates(await templatesRes.json());
      }

      if (contentRes.ok) {
        setGeneratedContent(await contentRes.json());
      }

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setConnectedAccounts(Array.isArray(accountsData) ? accountsData : []);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCharacter]);

  useEffect(() => {
    if (!isLoading && user) {
      loadData();
    }
  }, [isLoading, user, loadData]);

  async function handleCreateSchedule() {
    if (!selectedCharacter || !newSchedule.name) {
      setError("Please select a character and provide a schedule name");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/content-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: selectedCharacter,
          ...newSchedule,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Creation failed");
      }

      const newSched = await response.json();
      setSchedules((prev) => [newSched, ...prev]);
      setShowNewSchedule(false);
      setSuccess("Schedule created successfully!");
      resetNewScheduleForm();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleSchedule(scheduleId: string, isActive: boolean) {
    try {
      const response = await fetch("/api/content-generation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: scheduleId, isActive }),
      });

      if (response.ok) {
        setSchedules((prev) =>
          prev.map((s) => (s.id === scheduleId ? { ...s, isActive } : s))
        );
      }
    } catch (err) {
      console.error("Error toggling schedule:", err);
    }
  }

  async function handleDeleteSchedule(scheduleId: string) {
    if (!confirm("Are you sure you want to delete this schedule?")) return;

    try {
      const response = await fetch(`/api/content-generation?id=${scheduleId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
        setSuccess("Schedule deleted");
      }
    } catch (err) {
      console.error("Error deleting schedule:", err);
    }
  }

  async function handleGeneratePrompts() {
    if (!selectedCharacter) {
      setError("Please select a character");
      return;
    }

    setGeneratingPrompts(true);
    setError("");
    setPromptSuggestions([]);

    try {
      const response = await fetch("/api/content-generation/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: selectedCharacter,
          contentType: generateContentType,
          customThemes: newSchedule.customThemes,
          stylePreferences: newSchedule.stylePreferences,
          count: 3,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Generation failed");
      }

      const data = await response.json();
      setPromptSuggestions(data.prompts);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingPrompts(false);
    }
  }

  async function handleGenerateImage(prompt: CreativePromptSuggestion) {
    setGenerating(true);
    setError("");
    setSelectedPrompt(prompt);

    try {
      const response = await fetch("/api/content-generation/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: selectedCharacter,
          prompt: prompt.prompt,
          contentType: generateContentType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Generation failed");
      }

      const result = await response.json();
      setGeneratedImage(result.generatedContent);
      setGeneratedContent((prev) => [result.generatedContent, ...prev]);
      setSuccess("Image generated successfully!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleExecuteSchedule(scheduleId: string) {
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) return;

    setGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/content-generation/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          characterId: schedule.characterId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Execution failed");
      }

      const result = await response.json();
      setGeneratedContent((prev) => [result.generatedContent, ...prev]);
      setSuccess("Content generated successfully!");
      
      // Refresh schedules to get updated execution time
      const schedulesRes = await fetch("/api/content-generation");
      if (schedulesRes.ok) {
        setSchedules(await schedulesRes.json());
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  function resetNewScheduleForm() {
    setNewSchedule({
      name: "",
      description: "",
      frequencyType: "daily",
      frequencyValue: 1,
      contentType: "lifestyle",
      customThemes: [],
      stylePreferences: {
        mood: [],
        settings: [],
        lighting: [],
        additionalInstructions: "",
      },
      autoGenerateCaption: true,
      includeHashtags: true,
      hashtagCount: 5,
      autoPost: false,
      targetPlatforms: [],
      schedulingTemplateId: "",
      autoConnectToScheduleTemplate: false,
    });
    setCustomThemeInput("");
  }

  function addCustomTheme() {
    if (customThemeInput.trim() && !newSchedule.customThemes.includes(customThemeInput.trim())) {
      setNewSchedule((prev) => ({
        ...prev,
        customThemes: [...prev.customThemes, customThemeInput.trim()],
      }));
      setCustomThemeInput("");
    }
  }

  function removeCustomTheme(theme: string) {
    setNewSchedule((prev) => ({
      ...prev,
      customThemes: prev.customThemes.filter((t) => t !== theme),
    }));
  }

  function toggleStyleOption(
    category: "mood" | "settings" | "lighting",
    value: string
  ) {
    setNewSchedule((prev) => {
      const current = prev.stylePreferences[category] || [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return {
        ...prev,
        stylePreferences: {
          ...prev.stylePreferences,
          [category]: updated,
        },
      };
    });
  }

  function togglePlatform(platform: SocialPlatform) {
    setNewSchedule((prev) => {
      const current = prev.targetPlatforms;
      const updated = current.includes(platform)
        ? current.filter((p) => p !== platform)
        : [...current, platform];
      return { ...prev, targetPlatforms: updated };
    });
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Login Required</h1>
          <Link href="/sign-in" className="text-pink-400 hover:text-pink-300">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const selectedCharacterData = characters.find((c) => c.id === selectedCharacter);

  return (
    <div className="min-h-screen bg-slate-950">
      <Navigation title="Content Automation" />

      <main className="container mx-auto px-4 py-8 pb-24 md:pb-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-200">
            {error}
            <button onClick={() => setError("")} className="float-right">×</button>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-200">
            {success}
            <button onClick={() => setSuccess("")} className="float-right">×</button>
          </div>
        )}

        {/* Character Selection */}
        <div className="mb-8 p-6 rounded-xl bg-white/5 border border-white/10">
          <label className="block text-white font-medium mb-3">
            Select an AI Character
          </label>
          <div className="flex flex-wrap gap-3">
            {characters.map((char) => (
              <button
                key={char.id}
                onClick={() => setSelectedCharacter(char.id)}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg border transition-all ${
                  selectedCharacter === char.id
                    ? "border-pink-500 bg-pink-500/20 text-white"
                    : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                }`}
              >
                {char.thumbnail && (
                  <Image
                    src={char.thumbnail}
                    alt={char.name}
                    width={32}
                    height={32}
                    className="rounded-full object-cover object-top"
                  />
                )}
                <span>{char.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: "schedules", label: "📅 Schedules" },
            { id: "generate", label: "✨ Generate" },
            { id: "history", label: "📜 History" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-pink-500 text-white"
                  : "bg-white/5 text-gray-300 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Schedules Tab */}
        {activeTab === "schedules" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">
                Content Generation Schedules
              </h2>
              <button
                onClick={() => setShowNewSchedule(true)}
                className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
              >
                + New Schedule
              </button>
            </div>

            {/* New Schedule Form */}
            {showNewSchedule && (
              <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-6">
                <h3 className="text-lg font-bold text-white">
                  Create a Schedule
                </h3>

                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 text-sm mb-2">Name</label>
                    <input
                      type="text"
                      value={newSchedule.name}
                      onChange={(e) =>
                        setNewSchedule((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="E.g.: Daily lifestyle posts"
                      className="w-full px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 text-sm mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={newSchedule.description}
                      onChange={(e) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Optional description"
                      className="w-full px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500"
                    />
                  </div>
                </div>

                {/* Frequency */}
                <div>
                  <label className="block text-gray-300 text-sm mb-2">
                    Frequency
                  </label>
                  <div className="flex gap-4">
                    <select
                      value={newSchedule.frequencyType}
                      onChange={(e) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          frequencyType: e.target.value as FrequencyType,
                        }))
                      }
                      className="px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white"
                    >
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={newSchedule.frequencyValue}
                      onChange={(e) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          frequencyValue: parseInt(e.target.value) || 1,
                        }))
                      }
                      className="w-20 px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white"
                    />
                  </div>
                </div>

                {/* Content Type */}
                <div>
                  <label className="block text-gray-300 text-sm mb-2">
                    Content Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CONTENT_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() =>
                          setNewSchedule((prev) => ({
                            ...prev,
                            contentType: type.value,
                          }))
                        }
                        className={`px-4 py-2 rounded-lg border transition-all ${
                          newSchedule.contentType === type.value
                            ? "border-pink-500 bg-pink-500/20 text-white"
                            : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                        }`}
                      >
                        {type.icon} {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Themes */}
                <div>
                  <label className="block text-gray-300 text-sm mb-2">
                    Custom Themes
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={customThemeInput}
                      onChange={(e) => setCustomThemeInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCustomTheme()}
                      placeholder="Add a theme..."
                      className="flex-1 px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500"
                    />
                    <button
                      onClick={addCustomTheme}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newSchedule.customThemes.map((theme) => (
                      <span
                        key={theme}
                        className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm flex items-center gap-2"
                      >
                        {theme}
                        <button
                          onClick={() => removeCustomTheme(theme)}
                          className="hover:text-white"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Style Preferences */}
                <div className="space-y-4">
                  <label className="block text-gray-300 text-sm">
                    Style Preferences
                  </label>

                  {/* Mood */}
                  <div>
                    <span className="text-gray-400 text-xs">Mood</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {MOOD_OPTIONS.map((mood) => (
                        <button
                          key={mood}
                          onClick={() => toggleStyleOption("mood", mood)}
                          className={`px-3 py-1 rounded-full text-sm transition-all ${
                            newSchedule.stylePreferences.mood?.includes(mood)
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500"
                              : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                          }`}
                        >
                          {mood}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Settings */}
                  <div>
                    <span className="text-gray-400 text-xs">Setting</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {SETTING_OPTIONS.map((setting) => (
                        <button
                          key={setting}
                          onClick={() => toggleStyleOption("settings", setting)}
                          className={`px-3 py-1 rounded-full text-sm transition-all ${
                            newSchedule.stylePreferences.settings?.includes(setting)
                              ? "bg-green-500/20 text-green-300 border border-green-500"
                              : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                          }`}
                        >
                          {setting}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lighting */}
                  <div>
                    <span className="text-gray-400 text-xs">Lighting</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {LIGHTING_OPTIONS.map((light) => (
                        <button
                          key={light}
                          onClick={() => toggleStyleOption("lighting", light)}
                          className={`px-3 py-1 rounded-full text-sm transition-all ${
                            newSchedule.stylePreferences.lighting?.includes(light)
                              ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500"
                              : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                          }`}
                        >
                          {light}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Additional Instructions */}
                  <div>
                    <span className="text-gray-400 text-xs">Additional Instructions</span>
                    <textarea
                      value={newSchedule.stylePreferences.additionalInstructions}
                      onChange={(e) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          stylePreferences: {
                            ...prev.stylePreferences,
                            additionalInstructions: e.target.value,
                          },
                        }))
                      }
                      placeholder="Specific instructions for the AI..."
                      className="w-full mt-1 px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Auto-posting settings */}
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={newSchedule.autoGenerateCaption}
                      onChange={(e) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          autoGenerateCaption: e.target.checked,
                        }))
                      }
                      className="w-5 h-5 rounded"
                    />
                    <span className="text-gray-300">Auto-generate captions</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={newSchedule.includeHashtags}
                      onChange={(e) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          includeHashtags: e.target.checked,
                        }))
                      }
                      className="w-5 h-5 rounded"
                    />
                    <span className="text-gray-300">Include hashtags</span>
                    {newSchedule.includeHashtags && (
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={newSchedule.hashtagCount}
                        onChange={(e) =>
                          setNewSchedule((prev) => ({
                            ...prev,
                            hashtagCount: parseInt(e.target.value) || 5,
                          }))
                        }
                        className="w-16 px-2 py-1 rounded bg-black/30 border border-white/10 text-white text-sm"
                      />
                    )}
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={newSchedule.autoPost}
                      onChange={(e) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          autoPost: e.target.checked,
                        }))
                      }
                      className="w-5 h-5 rounded"
                    />
                    <span className="text-gray-300">
                      Auto-publish to social media
                    </span>
                  </label>

                  {newSchedule.autoPost && (
                    <div className="ml-8 space-y-3">
                      <div>
                        <span className="text-gray-400 text-sm">Target Platforms</span>
                        {connectedAccounts.length > 0 ? (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {connectedAccounts
                              .filter((account) => account.isActive)
                              .map((account) => {
                                const platformInfo = PLATFORM_OPTIONS.find(
                                  (p) => p.value === account.platform
                                );
                                return (
                                  <button
                                    key={account._id}
                                    onClick={() => togglePlatform(account.platform)}
                                    className={`px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                                      newSchedule.targetPlatforms.includes(account.platform)
                                        ? "bg-pink-500/20 text-pink-300 border border-pink-500"
                                        : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                                    }`}
                                  >
                                    {account.profilePicture ? (
                                      <Image
                                        src={account.profilePicture}
                                        alt={account.displayName}
                                        width={20}
                                        height={20}
                                        className="rounded-full object-cover"
                                      />
                                    ) : (
                                      <span>{platformInfo?.icon || "📱"}</span>
                                    )}
                                    <span>{platformInfo?.label || account.platform}</span>
                                    <span className="text-xs opacity-70">@{account.username}</span>
                                  </button>
                                );
                              })}
                          </div>
                        ) : (
                          <div className="mt-2 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                            <p className="text-yellow-300 text-sm">
                              No social media accounts connected.{" "}
                              <Link
                                href="/dashboard/social-settings"
                                className="underline hover:text-yellow-200"
                              >
                                Connect accounts in Social Media Settings
                              </Link>
                            </p>
                          </div>
                        )}
                      </div>

                      {templates.length > 0 && (
                        <div>
                          <span className="text-gray-400 text-sm">
                            Publishing Template
                          </span>
                          <select
                            value={newSchedule.schedulingTemplateId}
                            onChange={(e) =>
                              setNewSchedule((prev) => ({
                                ...prev,
                                schedulingTemplateId: e.target.value,
                              }))
                            }
                            className="w-full mt-1 px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white"
                          >
                            <option value="">Select a template</option>
                            {templates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {templates.length > 0 && newSchedule.schedulingTemplateId && (
                        <label className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                          <input
                            type="checkbox"
                            checked={newSchedule.autoConnectToScheduleTemplate}
                            onChange={(e) =>
                              setNewSchedule((prev) => ({
                                ...prev,
                                autoConnectToScheduleTemplate: e.target.checked,
                              }))
                            }
                            className="w-5 h-5 rounded"
                          />
                          <div>
                            <span className="text-emerald-300 font-medium">
                              🔗 Auto-queue to available slots
                            </span>
                            <p className="text-gray-400 text-xs mt-1">
                              Automatically add generated content to the next available slots in your scheduling template
                            </p>
                          </div>
                        </label>
                      )}
                    </div>
                  )}
                </div>

                {/* Form Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCreateSchedule}
                    disabled={loading}
                    className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50"
                  >
                    {loading ? "Creating..." : "Create Schedule"}
                  </button>
                  <button
                    onClick={() => {
                      setShowNewSchedule(false);
                      resetNewScheduleForm();
                    }}
                    className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Schedules List */}
            <div className="grid gap-4">
              {schedules.filter((s) => !selectedCharacter || s.characterId === selectedCharacter).map((schedule) => {
                const character = characters.find((c) => c.id === schedule.characterId);
                return (
                  <div
                    key={schedule.id}
                    className={`p-6 rounded-xl border transition-all ${
                      schedule.isActive
                        ? "bg-white/5 border-green-500/30"
                        : "bg-white/5 border-white/10 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        {character?.thumbnail && (
                          <Image
                            src={character.thumbnail}
                            alt={character.name}
                            width={48}
                            height={48}
                            className="rounded-full object-cover object-top"
                          />
                        )}
                        <div>
                          <h3 className="text-lg font-bold text-white">
                            {schedule.name}
                          </h3>
                          <p className="text-gray-400 text-sm">
                            {character?.name} •{" "}
                            {CONTENT_TYPES.find((t) => t.value === schedule.contentType)?.icon}{" "}
                            {CONTENT_TYPES.find((t) => t.value === schedule.contentType)?.label}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleExecuteSchedule(schedule.id)}
                          disabled={generating}
                          className="px-3 py-1 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 disabled:opacity-50"
                        >
                          ▶ Execute
                        </button>
                        <button
                          onClick={() =>
                            handleToggleSchedule(schedule.id, !schedule.isActive)
                          }
                          className={`px-3 py-1 rounded-lg text-sm ${
                            schedule.isActive
                              ? "bg-green-500/20 text-green-300"
                              : "bg-gray-500/20 text-gray-300"
                          }`}
                        >
                          {schedule.isActive ? "Active" : "Inactive"}
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="px-3 py-1 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30"
                        >
                          🗑
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Frequency</span>
                        <p className="text-white">
                          Every {schedule.frequencyValue}{" "}
                          {schedule.frequencyType === "hourly"
                            ? "hour(s)"
                            : schedule.frequencyType === "daily"
                            ? "day(s)"
                            : "week(s)"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Posts Generated</span>
                        <p className="text-white">{schedule.totalPostsGenerated}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Last Execution</span>
                        <p className="text-white">
                          {schedule.lastExecutedAt
                            ? new Date(schedule.lastExecutedAt).toLocaleString("en-US")
                            : "Never"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Next Execution</span>
                        <p className="text-white">
                          {schedule.nextScheduledAt
                            ? new Date(schedule.nextScheduledAt).toLocaleString("en-US")
                            : "-"}
                        </p>
                      </div>
                    </div>

                    {schedule.customThemes && schedule.customThemes.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {schedule.customThemes.map((theme: string) => (
                          <span
                            key={theme}
                            className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {schedules.filter((s) => !selectedCharacter || s.characterId === selectedCharacter).length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p>No schedules created.</p>
                  <p className="text-sm mt-2">
                    Create a schedule to automatically generate content.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generate Tab */}
        {activeTab === "generate" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">
              Generate Content Manually
            </h2>

            {selectedCharacterData && (
              <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-6">
                {/* Content Type Selection */}
                <div>
                  <label className="block text-gray-300 text-sm mb-2">
                    Content Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CONTENT_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setGenerateContentType(type.value)}
                        className={`px-4 py-2 rounded-lg border transition-all ${
                          generateContentType === type.value
                            ? "border-pink-500 bg-pink-500/20 text-white"
                            : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                        }`}
                      >
                        {type.icon} {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Prompts Button */}
                <button
                  onClick={handleGeneratePrompts}
                  disabled={generatingPrompts}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {generatingPrompts
                    ? "🤔 AI is thinking..."
                    : "✨ Generate prompt suggestions"}
                </button>

                {/* Prompt Suggestions */}
                {promptSuggestions.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-white">
                      AI Suggestions
                    </h3>
                    {promptSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${
                          selectedPrompt === suggestion
                            ? "border-pink-500 bg-pink-500/10"
                            : "border-white/10 bg-black/20 hover:border-white/30"
                        }`}
                        onClick={() => setSelectedPrompt(suggestion)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-white font-medium mb-2">
                              {suggestion.prompt}
                            </p>
                            <p className="text-gray-400 text-sm italic">
                              &ldquo;{suggestion.caption}&rdquo;
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {suggestion.hashtags.slice(0, 5).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs text-blue-400"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                              <span>🎭 {suggestion.mood}</span>
                              <span>📍 {suggestion.setting}</span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateImage(suggestion);
                            }}
                            disabled={generating}
                            className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm hover:bg-pink-600 disabled:opacity-50 whitespace-nowrap"
                          >
                            {generating && selectedPrompt === suggestion
                              ? "⏳ Generating..."
                              : "🖼 Generate"}
                          </button>
                        </div>
                        {suggestion.reasoning && (
                          <p className="mt-3 text-xs text-gray-500 border-t border-white/10 pt-2">
                            💡 {suggestion.reasoning}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Generated Image Result */}
                {generatedImage && (
                  <div className="p-6 rounded-xl bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30">
                    <h3 className="text-lg font-medium text-white mb-4">
                      ✅ Image generated successfully!
                    </h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <Image
                          src={generatedImage.imageUrl}
                          alt="Generated"
                          width={600}
                          height={600}
                          className="w-full rounded-lg"
                        />
                      </div>
                      <div className="space-y-4">
                        <div>
                          <span className="text-gray-400 text-sm">Caption</span>
                          <p className="text-white">{generatedImage.caption}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-sm">Hashtags</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {generatedImage.hashtags?.map((tag: string) => (
                              <span
                                key={tag}
                                className="text-sm text-blue-400"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Link
                          href={`/dashboard/character/${selectedCharacter}`}
                          className="inline-block px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                        >
                          View in gallery →
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!selectedCharacterData && (
              <div className="text-center py-12 text-gray-400">
                <p>Select a character to generate content.</p>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">
              Generated Content History
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {generatedContent
                .filter((c) => !selectedCharacter || c.character_id === selectedCharacter)
                .map((content) => {
                  const character = characters.find(
                    (c) => c.id === content.character_id
                  );
                  return (
                    <div
                      key={content.id}
                      className="rounded-xl bg-white/5 border border-white/10 overflow-hidden"
                    >
                      {content.image_url && (
                        <Image
                          src={content.image_url}
                          alt="Generated"
                          width={400}
                          height={400}
                          className="w-full aspect-square object-cover"
                        />
                      )}
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              content.status === "posted"
                                ? "bg-green-500/20 text-green-300"
                                : content.status === "approved"
                                ? "bg-blue-500/20 text-blue-300"
                                : content.status === "rejected"
                                ? "bg-red-500/20 text-red-300"
                                : "bg-gray-500/20 text-gray-300"
                            }`}
                          >
                            {content.status === "posted"
                              ? "Posted"
                              : content.status === "approved"
                              ? "Approved"
                              : content.status === "rejected"
                              ? "Rejected"
                              : content.status === "scheduled"
                              ? "Scheduled"
                              : "Generated"}
                          </span>
                          {character && (
                            <span className="text-gray-400 text-xs">
                              {character.name}
                            </span>
                          )}
                        </div>
                        {content.caption && (
                          <p className="text-gray-300 text-sm line-clamp-2">
                            {content.caption}
                          </p>
                        )}
                        <p className="text-gray-500 text-xs mt-2">
                          {new Date(content.created_at).toLocaleString("en-US")}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>

            {generatedContent.filter(
              (c) => !selectedCharacter || c.character_id === selectedCharacter
            ).length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p>No content generated yet.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
