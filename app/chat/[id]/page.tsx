"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Character } from "@/lib/types";
import { useAuth } from "@/lib/supabase/auth-context";
import VoiceChat from "@/components/VoiceChat";

interface Message {
  id: string;
  sender: "user" | "character";
  text: string;
  timestamp: Date;
  emotion?: string;
  message_type?: "text" | "image" | "gift";
  image_url?: string;
  gift_id?: string;
  faceSwapApplied?: boolean;
  originalPrompt?: string;
}

interface GiftType {
  id: string;
  name: string;
  display_name: string;
  emoji: string;
  coin_cost: number;
  description: string;
}

interface ChatImage {
  id: string;
  image_url: string;
  prompt: string;
  created_at: string;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const characterId = params.id as string;
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userCoins, setUserCoins] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Gift modal state
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [gifts, setGifts] = useState<GiftType[]>([]);
  const [sendingGift, setSendingGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");

  // Image generation state
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [retryingFaceSwap, setRetryingFaceSwap] = useState<string | null>(null);

  // Chat gallery state
  const [showGallery, setShowGallery] = useState(false);
  const [chatImages, setChatImages] = useState<ChatImage[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  // Reset confirmation state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Dropdown menu state
  const [showDropdownMenu, setShowDropdownMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Voice chat state
  const [showVoiceChat, setShowVoiceChat] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdownMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load user coins
  const loadCoins = useCallback(async () => {
    try {
      const response = await fetch("/api/coins");
      if (response.ok) {
        const data = await response.json();
        setUserCoins(data.balance?.balance || 0);
      }
    } catch (error) {
      console.error("Error loading coins:", error);
    }
  }, []);

  // Load chat history
  const loadChatHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/chat?characterId=${characterId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          const loadedMessages: Message[] = data.messages.map((msg: {
            id: string;
            sender: "user" | "character";
            text: string;
            created_at: string;
            emotion?: string;
            message_type?: "text" | "image" | "gift";
            image_url?: string;
            gift_id?: string;
          }) => ({
            id: msg.id,
            sender: msg.sender,
            text: msg.text,
            timestamp: new Date(msg.created_at),
            emotion: msg.emotion,
            message_type: msg.message_type || "text",
            image_url: msg.image_url,
            gift_id: msg.gift_id,
          }));
          return loadedMessages;
        }
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
    return null;
  }, [characterId]);

  // Load gift types
  const loadGifts = useCallback(async () => {
    try {
      const response = await fetch("/api/chat/gifts");
      if (response.ok) {
        const data = await response.json();
        setGifts(data.gifts || []);
      }
    } catch (error) {
      console.error("Error loading gifts:", error);
    }
  }, []);

  // Load chat images for gallery
  const loadChatImages = useCallback(async () => {
    setLoadingGallery(true);
    try {
      const response = await fetch(`/api/chat/images?characterId=${characterId}`);
      if (response.ok) {
        const data = await response.json();
        setChatImages(data.images || []);
      }
    } catch (error) {
      console.error("Error loading chat images:", error);
    } finally {
      setLoadingGallery(false);
    }
  }, [characterId]);

  useEffect(() => {
    const loadCharacter = async () => {
      try {
        const response = await fetch(`/api/characters?id=${characterId}`);
        if (response.ok) {
          const data = await response.json();
          setCharacter(data);

          // Try to load existing chat history
          const existingMessages = await loadChatHistory();
          
          if (existingMessages && existingMessages.length > 0) {
            setMessages(existingMessages);
          } else {
            // Initial greeting message for new chats
            const greeting = data.personality
              ? `Hey! I am ${data.name}. ${data.description} I am feeling ${data.personality.mood} today! What is on your mind?`
              : `Hello! I am ${data.name}. ${data.description}. How can I help you today?`;

            const greetingMessage: Message = {
              id: "1",
              sender: "character",
              text: greeting,
              timestamp: new Date(),
              emotion: data.personality?.mood || "happy",
              message_type: "text",
            };

            setMessages([greetingMessage]);

            // Save the initial greeting to the database so it persists on refresh
            try {
              const initResponse = await fetch("/api/chat/init", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  characterId,
                  greetingText: greeting,
                  emotion: data.personality?.mood || "happy",
                }),
              });
              
              if (initResponse.ok) {
                const initData = await initResponse.json();
                // Update the greeting message with the saved ID
                if (initData.messageId) {
                  setMessages([{ ...greetingMessage, id: initData.messageId }]);
                }
              }
            } catch (initError) {
              console.error("Error saving initial greeting:", initError);
              // Continue anyway - greeting will show but won't persist
            }
          }
        }
      } catch (error) {
        console.error("Error fetching character:", error);
      } finally {
        setLoading(false);
      }
    };
    loadCharacter();
    loadCoins();
    loadGifts();
  }, [characterId, loadChatHistory, loadCoins, loadGifts]);

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
      message_type: "text",
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
          id: data.savedCharacterMessageId || (Date.now() + 1).toString(),
          sender: "character",
          text: data.response,
          timestamp: new Date(),
          emotion: data.emotion,
          message_type: "text",
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        // Fallback response if API fails
        const fallbackMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: "character",
          text: "I am having trouble connecting right now. Can you try again?",
          timestamp: new Date(),
          message_type: "text",
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
        message_type: "text",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  // Handle sending a gift
  const handleSendGift = async (gift: GiftType) => {
    if (sendingGift) return;
    setSendingGift(true);

    try {
      const response = await fetch("/api/chat/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          giftType: gift.name,
          giftName: gift.display_name,
          giftEmoji: gift.emoji,
          coinCost: gift.coin_cost,
          message: giftMessage,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Add gift message to chat
        const giftUserMessage: Message = {
          id: Date.now().toString(),
          sender: "user",
          text: `Sent a ${gift.display_name} ${gift.emoji}${giftMessage ? `: ${giftMessage}` : ""}`,
          timestamp: new Date(),
          message_type: "gift",
        };
        
        const giftResponseMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: "character",
          text: data.characterResponse,
          timestamp: new Date(),
          emotion: "happy",
          message_type: "text",
        };

        setMessages((prev) => [...prev, giftUserMessage, giftResponseMessage]);
        setShowGiftModal(false);
        setGiftMessage("");
        
        // Update coin balance directly if returned, otherwise refresh
        if (data.newBalance !== null && data.newBalance !== undefined) {
          setUserCoins(data.newBalance);
        } else {
          loadCoins();
        }
      } else {
        const errorData = await response.json();
        alert(errorData.message || "Failed to send gift");
      }
    } catch (error) {
      console.error("Error sending gift:", error);
      alert("Failed to send gift. Please try again.");
    } finally {
      setSendingGift(false);
    }
  };

  // Handle generating an image from a message
  const handleGenerateImage = async (messageText: string, messageId: string) => {
    if (generatingImage) return;
    setGeneratingImage(messageId);

    try {
      const response = await fetch("/api/chat/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          messageId,
          messageText,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Add image message to chat (appears as character message)
        const imageMessage: Message = {
          id: Date.now().toString(),
          sender: "character",
          text: data.faceSwapApplied ? "Here's the image you requested! 📸" : "Here's the image I generated for you! 📸",
          timestamp: new Date(),
          message_type: "image",
          image_url: data.imageUrl,
          faceSwapApplied: data.faceSwapApplied,
          originalPrompt: messageText,
        };

        setMessages((prev) => [...prev, imageMessage]);
        
        // Update coin balance directly if returned, otherwise refresh
        if (data.newBalance !== null && data.newBalance !== undefined) {
          setUserCoins(data.newBalance);
        } else {
          loadCoins();
        }
      } else {
        const errorData = await response.json();
        alert(errorData.message || "Failed to generate image");
      }
    } catch (error) {
      console.error("Error generating image:", error);
      alert("Failed to generate image. Please try again.");
    } finally {
      setGeneratingImage(null);
    }
  };

  // Handle retry face swap for an existing image
  const handleRetryFaceSwap = async (messageId: string, imageUrl: string) => {
    if (retryingFaceSwap) return;
    setRetryingFaceSwap(messageId);

    try {
      const response = await fetch("/api/chat/images/face-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId,
          targetImageUrl: imageUrl,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update the message with the new face-swapped image
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, image_url: data.imageUrl, faceSwapApplied: true }
              : msg
          )
        );

        // Update coin balance if returned
        if (data.newBalance !== null && data.newBalance !== undefined) {
          setUserCoins(data.newBalance);
        }
      } else {
        const errorData = await response.json();
        alert(errorData.message || "Failed to apply face swap");
      }
    } catch (error) {
      console.error("Error retrying face swap:", error);
      alert("Failed to apply face swap. Please try again.");
    } finally {
      setRetryingFaceSwap(null);
    }
  };

  // Handle resetting the chat
  const handleResetChat = async () => {
    if (resetting) return;
    setResetting(true);

    try {
      const response = await fetch(`/api/chat?characterId=${characterId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Reset to initial greeting
        const greeting = character?.personality
          ? `Hey! I am ${character.name}. ${character.description} I am feeling ${character.personality.mood} today! What is on your mind?`
          : `Hello! I am ${character?.name}. ${character?.description}. How can I help you today?`;

        setMessages([
          {
            id: "1",
            sender: "character",
            text: greeting,
            timestamp: new Date(),
            emotion: character?.personality?.mood || "happy",
            message_type: "text",
          },
        ]);
        setShowResetConfirm(false);
      } else {
        alert("Failed to reset chat. Please try again.");
      }
    } catch (error) {
      console.error("Error resetting chat:", error);
      alert("Failed to reset chat. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  // Redirect to sign-in if not authenticated
  if (!authLoading && !user) {
    router.push("/sign-in");
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (loading || authLoading) {
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
              <div className="relative w-10 h-10 rounded-full border-2 border-primary overflow-hidden">
                <Image
                  src={character.thumbnail}
                  alt={character.name}
                  fill
                  className="object-cover object-top"
                />
              </div>
            ) : (
              <div className="relative w-10 h-10 rounded-full gradient-primary border-2 border-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold truncate">{character.name}</h1>
            <p className="text-xs text-primary-light flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Online
            </p>
          </div>
          
          {/* Header Actions */}
          <div className="flex items-center gap-2">
            {/* Voice Call Button */}
            <button
              onClick={() => setShowVoiceChat(true)}
              className="p-2 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
              aria-label="Start voice call"
              title="Start voice call"
            >
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
            </button>
            
            {/* Coins Display */}
            <div className="flex items-center gap-1 px-2 py-1 bg-surface-light rounded-full text-sm">
              <span>🪙</span>
              <span>{userCoins}</span>
            </div>
            
            {/* Three-dot Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdownMenu(!showDropdownMenu)}
                className="p-2 rounded-full hover:bg-surface-light transition-colors"
                aria-label="More options"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
              
              {showDropdownMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-dark border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={() => {
                      setShowGallery(true);
                      loadChatImages();
                      setShowDropdownMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-surface-light transition-colors flex items-center gap-3"
                  >
                    <span>🖼️</span>
                    <span>View Gallery</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowResetConfirm(true);
                      setShowDropdownMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-surface-light transition-colors flex items-center gap-3 text-red-400"
                  >
                    <span>🔄</span>
                    <span>Reset Chat</span>
                  </button>
                  <Link
                    href={`/character/${character.id}`}
                    className="w-full px-4 py-3 text-left hover:bg-surface-light transition-colors flex items-center gap-3 block"
                    onClick={() => setShowDropdownMenu(false)}
                  >
                    <span>👤</span>
                    <span>View Profile</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
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
            <div className="max-w-[80%]">
              <div
                className={`rounded-2xl px-4 py-3 ${
                  message.sender === "user"
                    ? "gradient-primary text-white glow-primary-sm"
                    : "bg-surface-light border border-border text-white"
                }`}
              >
                {/* Gift indicator */}
                {message.message_type === "gift" && (
                  <div className="text-2xl mb-2 text-center">🎁</div>
                )}
                
                {/* Image display */}
                {message.message_type === "image" && message.image_url && (
                  <div className="mb-2">
                    <Image
                      src={message.image_url}
                      alt="Generated"
                      width={500}
                      height={500}
                      className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(message.image_url, "_blank")}
                    />
                    {/* Retry Face Swap button - only show if face swap was not applied */}
                    {message.faceSwapApplied === false && (
                      <button
                        onClick={() => handleRetryFaceSwap(message.id, message.image_url!)}
                        disabled={retryingFaceSwap === message.id}
                        className="mt-2 w-full text-xs flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/50 text-amber-300 transition-colors disabled:opacity-50"
                        title="Retry face swap with character's face (5 coins)"
                      >
                        {retryingFaceSwap === message.id ? (
                          <>
                            <div className="animate-spin w-3 h-3 border border-amber-300 border-t-transparent rounded-full" />
                            <span>Applying face swap...</span>
                          </>
                        ) : (
                          <>
                            <span>🔄</span>
                            <span>Retry Face Swap</span>
                            <span className="text-amber-400">(5🪙)</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
                
                <p>{message.text}</p>
                <p className="text-xs opacity-60 mt-1.5">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              
              {/* Generate Image Button (only for user text messages) */}
              {message.sender === "user" && message.message_type === "text" && (
                <div className="mt-1 flex justify-end">
                  <button
                    onClick={() => handleGenerateImage(message.text, message.id)}
                    disabled={generatingImage === message.id}
                    className="text-xs flex items-center gap-1 px-2 py-1 rounded-full bg-surface-light hover:bg-surface border border-border transition-colors disabled:opacity-50"
                    title="Generate image from this message (10 coins)"
                  >
                    {generatingImage === message.id ? (
                      <>
                        <div className="animate-spin w-3 h-3 border border-primary border-t-transparent rounded-full" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <span>🎨</span>
                        <span>Generate Image</span>
                        <span className="text-primary-light">(10🪙)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
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
        <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
          {/* Gift Button */}
          <button
            type="button"
            onClick={() => setShowGiftModal(true)}
            className="p-2.5 rounded-full bg-surface-light border border-border hover:bg-surface transition-colors flex-shrink-0"
            title="Send a gift"
          >
            🎁
          </button>
          
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={sending ? "Waiting..." : "Type a message..."}
            disabled={sending}
            className="flex-1 min-w-0 bg-surface-light border border-border text-white rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-gray-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !inputText.trim()}
            className="gradient-primary text-white rounded-full p-2.5 hover:opacity-90 transition-all glow-primary-sm disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Send message"
          >
            {sending ? (
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
      </div>

      {/* Gift Modal */}
      {showGiftModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="glass border border-border rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Send a Gift</h2>
              <button
                onClick={() => {
                  setShowGiftModal(false);
                  setGiftMessage("");
                }}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <p className="text-sm text-gray-400 mb-4">
              Your balance: <span className="text-primary-light">{userCoins} 🪙</span>
            </p>

            <div className="mb-4">
              <input
                type="text"
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                placeholder="Add a message (optional)"
                className="w-full bg-surface-light border border-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {gifts.map((gift) => (
                <button
                  key={gift.id}
                  onClick={() => handleSendGift(gift)}
                  disabled={sendingGift || userCoins < gift.coin_cost}
                  className={`p-4 rounded-xl border transition-all ${
                    userCoins >= gift.coin_cost
                      ? "border-border hover:border-primary hover:bg-surface-light"
                      : "border-border opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="text-3xl mb-2">{gift.emoji}</div>
                  <div className="font-medium">{gift.display_name}</div>
                  <div className="text-sm text-primary-light">{gift.coin_cost} 🪙</div>
                </button>
              ))}
            </div>

            {sendingGift && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                <span>Sending gift...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="glass border border-border rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Chat Gallery with {character.name}</h2>
              <button
                onClick={() => setShowGallery(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {loadingGallery ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : chatImages.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-4">🖼️</p>
                <p>No images generated yet</p>
                <p className="text-sm mt-2">Generate images from your chat messages to see them here!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {chatImages.map((image) => (
                  <div key={image.id} className="relative group">
                    <Image
                      src={image.image_url}
                      alt={image.prompt}
                      width={300}
                      height={300}
                      className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(image.image_url, "_blank")}
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-3 flex flex-col justify-end">
                      <p className="text-xs line-clamp-3">{image.prompt}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(image.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="glass border border-border rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">Reset Chat?</h2>
            <p className="text-gray-400 mb-6">
              This will clear all conversation history with {character.name}. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-surface-light transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetChat}
                disabled={resetting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {resetting ? "Resetting..." : "Reset Chat"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Chat Modal */}
      {showVoiceChat && (
        <VoiceChat
          characterId={character.id}
          characterName={character.name}
          characterImage={character.thumbnail}
          onClose={() => setShowVoiceChat(false)}
        />
      )}
    </div>
  );
}
