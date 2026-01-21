"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Character } from "@/lib/types";

interface Message {
  id: string;
  sender: "user" | "character";
  text: string;
  timestamp: Date;
  emotion?: string;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const characterId = params.id as string;
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadCharacter = async () => {
      try {
        const response = await fetch(`/api/characters?id=${characterId}`);
        if (response.ok) {
          const data = await response.json();
          setCharacter(data);
          
          // Initial greeting message
          const greeting = data.personality
            ? `Hey! I am ${data.name}. ${data.description} I am feeling ${data.personality.mood} today! What is on your mind?`
            : `Hello! I am ${data.name}. ${data.description}. How can I help you today?`;
          
          setMessages([
            {
              id: "1",
              sender: "character",
              text: greeting,
              timestamp: new Date(),
              emotion: data.personality?.mood || "happy",
            },
          ]);
        }
      } catch (error) {
        console.error("Error fetching character:", error);
      } finally {
        setLoading(false);
      }
    };
    loadCharacter();
  }, [characterId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: inputText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          message: inputText,
          chatHistory: messages.slice(-20),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: "character",
          text: data.response,
          timestamp: new Date(),
          emotion: data.emotion,
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        // Fallback response if API fails
        const fallbackMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: "character",
          text: "I am having trouble connecting right now. Can you try again?",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, fallbackMessage]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "character",
        text: "Oops! Something went wrong. Let me try again...",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-surface-dark text-white flex items-center justify-center">
        <div className="text-center glass border border-border rounded-2xl p-8">
          <h1 className="text-2xl font-bold mb-4">Character not found</h1>
          <Link href="/" className="text-primary-light hover:text-primary transition-colors">
            Back to Gallery
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-dark text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <button
            onClick={() => router.back()}
            className="text-2xl hover:text-primary-light transition-colors p-2 rounded-full hover:bg-surface-light"
            aria-label="Go back"
          >
            ←
          </button>
          <div className="relative">
            <div className="absolute inset-0 rounded-full gradient-primary blur-sm opacity-50 scale-110" />
            {character.thumbnail ? (
              <img
                src={character.thumbnail}
                alt={character.name}
                className="relative w-10 h-10 rounded-full object-cover border-2 border-primary"
              />
            ) : (
              <div className="relative w-10 h-10 rounded-full gradient-primary border-2 border-primary" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="font-bold">{character.name}</h1>
            <p className="text-xs text-primary-light flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Online
            </p>
          </div>
          <Link
            href={`/character/${character.id}`}
            className="text-primary-light hover:text-primary text-sm font-medium transition-colors"
          >
            View Profile
          </Link>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.sender === "user"
                  ? "gradient-primary text-white glow-primary-sm"
                  : "bg-surface-light border border-border text-white"
              }`}
            >
              <p>{message.text}</p>
              <p className="text-xs opacity-60 mt-1.5">
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-surface-light border border-border rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 glass border-t border-border p-4">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={sending ? "Waiting for response..." : "Type a message..."}
            disabled={sending}
            className="flex-1 bg-surface-light border border-border text-white rounded-full px-6 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-gray-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !inputText.trim()}
            className="gradient-primary text-white rounded-full px-8 py-3 font-semibold hover:opacity-90 transition-all glow-primary-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              "Send"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
