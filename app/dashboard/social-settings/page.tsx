"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth-context";
import Link from "next/link";
import {
  LateProfile,
  LateAccount,
  SchedulingTemplate,
  QueueSlot,
  SocialPlatform,
} from "@/lib/types";

const DAYS_OF_WEEK = [
  { value: 0, label: "Dimanche" },
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
];

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

export default function SocialMediaSettingsPage() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"connection" | "templates">("connection");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Configuration
  const [apiKey, setApiKey] = useState("");
  const [profiles, setProfiles] = useState<LateProfile[]>([]);
  const [accounts, setAccounts] = useState<LateAccount[]>([]);
  const [selectedProfile, setSelectedProfile] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<SchedulingTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<SchedulingTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    slots: [] as QueueSlot[],
    isDefault: false,
  });
  const [showNewTemplate, setShowNewTemplate] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      loadData();
    }
  }, [isLoading, user]);

  async function loadData() {
    setLoading(true);
    try {
      // Try to load profiles (will fail if no API key)
      const profilesRes = await fetch("/api/social-media?type=profiles");
      if (profilesRes.ok) {
        const profilesData = await profilesRes.json();
        setProfiles(profilesData);
        setHasApiKey(true);
        if (profilesData.length > 0 && !selectedProfile) {
          setSelectedProfile(profilesData[0]._id);
        }
      }

      // Load templates
      const templatesRes = await fetch("/api/social-media/schedule-template");
      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        setTemplates(templatesData);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedProfile) {
      loadAccounts();
    }
  }, [selectedProfile]);

  async function loadAccounts() {
    try {
      const res = await fetch(`/api/social-media?type=accounts&profileId=${selectedProfile}`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (err) {
      console.error("Error loading accounts:", err);
    }
  }

  async function handleSaveApiKey() {
    if (!apiKey.trim()) {
      setError("Veuillez entrer une clé API");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/social-media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lateApiKey: apiKey,
          lateProfileId: selectedProfile || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      setSuccess("Clé API sauvegardée avec succès !");
      setApiKey("");
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTemplate() {
    if (!newTemplate.name.trim()) {
      setError("Le nom du modèle est requis");
      return;
    }

    if (newTemplate.slots.length === 0) {
      setError("Ajoutez au moins un créneau de publication");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/social-media/schedule-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newTemplate,
          lateProfileId: selectedProfile || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      const { template } = await res.json();
      setTemplates([template, ...templates]);
      setNewTemplate({
        name: "",
        description: "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        slots: [],
        isDefault: false,
      });
      setShowNewTemplate(false);
      setSuccess("Modèle créé avec succès !");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce modèle ?")) return;

    try {
      const res = await fetch(`/api/social-media/schedule-template?id=${templateId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setTemplates(templates.filter((t) => t.id !== templateId));
        setSuccess("Modèle supprimé");
      }
    } catch (err) {
      setError("Erreur lors de la suppression");
    }
  }

  async function handleSetDefaultTemplate(templateId: string) {
    try {
      const res = await fetch("/api/social-media/schedule-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: templateId, isDefault: true }),
      });

      if (res.ok) {
        setTemplates(
          templates.map((t) => ({
            ...t,
            isDefault: t.id === templateId,
          }))
        );
      }
    } catch (err) {
      setError("Erreur lors de la mise à jour");
    }
  }

  function addSlot(dayOfWeek: number, time: string) {
    const exists = newTemplate.slots.some(
      (s) => s.dayOfWeek === dayOfWeek && s.time === time
    );
    if (!exists) {
      setNewTemplate({
        ...newTemplate,
        slots: [...newTemplate.slots, { dayOfWeek, time }].sort(
          (a, b) => a.dayOfWeek - b.dayOfWeek || a.time.localeCompare(b.time)
        ),
      });
    }
  }

  function removeSlot(dayOfWeek: number, time: string) {
    setNewTemplate({
      ...newTemplate,
      slots: newTemplate.slots.filter(
        (s) => !(s.dayOfWeek === dayOfWeek && s.time === time)
      ),
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
      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-2xl hover:text-primary-light transition-colors"
            >
              ←
            </Link>
            <h1 className="text-xl font-bold">Paramètres Réseaux Sociaux</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400">
            {error}
            <button onClick={() => setError("")} className="ml-2">×</button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400">
            {success}
            <button onClick={() => setSuccess("")} className="ml-2">×</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("connection")}
            className={`py-2 px-4 rounded-lg transition-all ${
              activeTab === "connection"
                ? "gradient-primary text-white"
                : "bg-surface-light border border-border hover:border-primary/50"
            }`}
          >
            Connexion
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`py-2 px-4 rounded-lg transition-all ${
              activeTab === "templates"
                ? "gradient-primary text-white"
                : "bg-surface-light border border-border hover:border-primary/50"
            }`}
          >
            Calendriers
          </button>
        </div>

        {activeTab === "connection" && (
          <div className="space-y-6">
            {/* API Key Section */}
            <div className="glass border border-border rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">Clé API Late</h2>
              <p className="text-gray-400 text-sm mb-4">
                Connectez votre compte{" "}
                <a
                  href="https://getlate.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Late.dev
                </a>{" "}
                pour publier sur les réseaux sociaux.
              </p>

              {hasApiKey ? (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-green-400 flex items-center gap-2">
                    <span className="text-lg">✓</span>
                    Clé API configurée
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk_..."
                    className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    disabled={saving}
                    className="gradient-primary text-white py-3 px-6 rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {saving ? "Sauvegarde..." : "Sauvegarder"}
                  </button>
                </div>
              )}
            </div>

            {/* Connected Accounts */}
            {hasApiKey && (
              <div className="glass border border-border rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-4">Comptes Connectés</h2>

                {profiles.length > 1 && (
                  <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-2">Profil</label>
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

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {accounts.map((account) => (
                    <div
                      key={account._id}
                      className="p-4 rounded-xl border border-border bg-surface-light"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{PLATFORM_ICONS[account.platform]}</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            account.isActive ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                      </div>
                      <div className="font-medium truncate">{account.displayName}</div>
                      <div className="text-xs text-gray-400 truncate">@{account.username}</div>
                    </div>
                  ))}
                </div>

                {accounts.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    Aucun compte connecté.{" "}
                    <a
                      href="https://getlate.dev/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Connecter des comptes sur Late.dev
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "templates" && (
          <div className="space-y-6">
            {/* Create Template */}
            <div className="glass border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Modèles de Calendrier</h2>
                <button
                  onClick={() => setShowNewTemplate(!showNewTemplate)}
                  className="py-2 px-4 gradient-primary text-white rounded-lg font-semibold hover:opacity-90 transition-all"
                >
                  {showNewTemplate ? "Annuler" : "+ Nouveau"}
                </button>
              </div>

              <p className="text-gray-400 text-sm mb-4">
                Créez des calendriers de publication avec des créneaux horaires prédéfinis.
                Les posts seront automatiquement programmés au prochain créneau disponible.
              </p>

              {showNewTemplate && (
                <div className="border-t border-border pt-4 mt-4 space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Nom du modèle</label>
                    <input
                      type="text"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                      placeholder="Ex: Publications quotidiennes"
                      className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Description (optionnel)</label>
                    <input
                      type="text"
                      value={newTemplate.description}
                      onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                      placeholder="Description du calendrier"
                      className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Fuseau horaire</label>
                    <select
                      value={newTemplate.timezone}
                      onChange={(e) => setNewTemplate({ ...newTemplate, timezone: e.target.value })}
                      className="w-full px-4 py-3 bg-surface-light border border-border rounded-xl focus:border-primary focus:outline-none"
                    >
                      <option value="Europe/Paris">Europe/Paris</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="America/Los_Angeles">America/Los_Angeles</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Créneaux de publication</label>
                    <div className="grid grid-cols-7 gap-2 mb-4">
                      {DAYS_OF_WEEK.map((day) => (
                        <div key={day.value} className="text-center">
                          <div className="text-xs text-gray-400 mb-2">{day.label.slice(0, 3)}</div>
                          <div className="space-y-1">
                            {["09:00", "12:00", "18:00", "21:00"].map((time) => {
                              const isSelected = newTemplate.slots.some(
                                (s) => s.dayOfWeek === day.value && s.time === time
                              );
                              return (
                                <button
                                  key={`${day.value}-${time}`}
                                  onClick={() =>
                                    isSelected
                                      ? removeSlot(day.value, time)
                                      : addSlot(day.value, time)
                                  }
                                  className={`w-full py-1 text-xs rounded transition-all ${
                                    isSelected
                                      ? "bg-primary text-white"
                                      : "bg-surface-light hover:bg-primary/20"
                                  }`}
                                >
                                  {time}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      {newTemplate.slots.length} créneaux sélectionnés
                    </p>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTemplate.isDefault}
                      onChange={(e) => setNewTemplate({ ...newTemplate, isDefault: e.target.checked })}
                      className="w-4 h-4 accent-primary"
                    />
                    <span>Définir comme calendrier par défaut</span>
                  </label>

                  <button
                    onClick={handleCreateTemplate}
                    disabled={saving}
                    className="w-full gradient-primary text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {saving ? "Création..." : "Créer le modèle"}
                  </button>
                </div>
              )}
            </div>

            {/* Existing Templates */}
            {templates.length > 0 && (
              <div className="space-y-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="glass border border-border rounded-2xl p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          {template.name}
                          {template.isDefault && (
                            <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full">
                              Par défaut
                            </span>
                          )}
                        </h3>
                        {template.description && (
                          <p className="text-sm text-gray-400">{template.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!template.isDefault && (
                          <button
                            onClick={() => handleSetDefaultTemplate(template.id)}
                            className="text-sm text-primary hover:underline"
                          >
                            Définir par défaut
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-sm text-red-400 hover:text-red-300"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {template.slots.map((slot, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-surface-light rounded text-sm"
                        >
                          {DAYS_OF_WEEK[slot.dayOfWeek]?.label.slice(0, 3)} {slot.time}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 text-xs text-gray-500">
                      Fuseau: {template.timezone} • {template.slots.length} créneaux/semaine
                    </div>
                  </div>
                ))}
              </div>
            )}

            {templates.length === 0 && !showNewTemplate && (
              <div className="text-center py-12 glass border border-border rounded-2xl">
                <div className="text-4xl mb-4">📅</div>
                <h3 className="text-lg font-semibold mb-2">Aucun calendrier</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Créez un calendrier pour programmer automatiquement vos publications.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
