"use client";

import { useState } from "react";
import VoiceChat from "@/components/VoiceChat";

export default function VoiceChatDemo() {
  const [showVoiceChat, setShowVoiceChat] = useState(false); // Start hidden

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
            Voice Chat Feature Demo
          </h1>
          <p className="text-gray-300 text-lg mb-8">
            Experience real-time voice conversations with AI characters
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass border border-purple-500/30 rounded-2xl p-6">
            <div className="text-3xl mb-3">🎤</div>
            <h3 className="text-xl font-bold mb-2">Real-time Audio</h3>
            <p className="text-gray-400 text-sm">
              Speak naturally and get instant voice responses from your character
            </p>
          </div>

          <div className="glass border border-purple-500/30 rounded-2xl p-6">
            <div className="text-3xl mb-3">✨</div>
            <h3 className="text-xl font-bold mb-2">Professional UI</h3>
            <p className="text-gray-400 text-sm">
              Beautiful animations and smooth transitions for an engaging experience
            </p>
          </div>

          <div className="glass border border-purple-500/30 rounded-2xl p-6">
            <div className="text-3xl mb-3">🎭</div>
            <h3 className="text-xl font-bold mb-2">Personality-Driven</h3>
            <p className="text-gray-400 text-sm">
              Characters respond based on their unique personality and mood
            </p>
          </div>

          <div className="glass border border-purple-500/30 rounded-2xl p-6">
            <div className="text-3xl mb-3">🚀</div>
            <h3 className="text-xl font-bold mb-2">Low Latency</h3>
            <p className="text-gray-400 text-sm">
              Powered by OpenAI Realtime API for fast, fluid conversations
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowVoiceChat(true)}
          className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        >
          Launch Voice Chat Demo
        </button>

        <div className="text-sm text-gray-500 space-y-2">
          <p>
            ⚡ Features: Microphone visualization, Call controls, Duration timer
          </p>
          <p>
            🔒 Note: Microphone permission required
          </p>
        </div>
      </div>

      {showVoiceChat && (
        <VoiceChat
          characterId="demo-char-123"
          characterName="Sophia"
          characterImage="/placeholder.jpg"
          onClose={() => setShowVoiceChat(false)}
        />
      )}
    </div>
  );
}
