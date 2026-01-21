"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { mockCharacters } from "@/lib/data";
import Link from "next/link";

interface Message {
  id: string;
  sender: "user" | "character";
  text: string;
  timestamp: Date;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const characterId = params.id as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const character = mockCharacters.find((c) => c.id === characterId);

  useEffect(() => {
    // Initial greeting message
    if (character) {
      setMessages([
        {
          id: "1",
          sender: "character",
          text: `Hello! I'm ${character.name}. ${character.description}. How can I help you today?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [character]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!character) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Character not found</h1>
          <Link href="/" className="text-blue-500 hover:underline">
            Back to Gallery
          </Link>
        </div>
      </div>
    );
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: inputText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "character",
        text: `Thanks for your message! As ${character.name}, I appreciate you reaching out. This is a demo chat interface.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center gap-4 p-4">
          <button
            onClick={() => router.back()}
            className="text-2xl hover:text-gray-400"
            aria-label="Go back"
          >
            ←
          </button>
          <img
            src={character.thumbnail}
            alt={character.name}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex-1">
            <h1 className="font-bold">{character.name}</h1>
            <p className="text-xs text-gray-400">Online</p>
          </div>
          <Link
            href={`/character/${character.id}`}
            className="text-blue-500 hover:underline text-sm"
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
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                message.sender === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-white"
              }`}
            >
              <p>{message.text}</p>
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-black/90 backdrop-blur-sm border-t border-gray-800 p-4">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 text-white rounded-full px-6 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white rounded-full px-8 py-3 font-semibold hover:bg-blue-700 transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
