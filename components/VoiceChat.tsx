"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";

interface VoiceChatProps {
  characterId: string;
  characterName: string;
  characterImage?: string;
  onClose: () => void;
}

type CallState = "idle" | "connecting" | "connected" | "ended";

export default function VoiceChat({
  characterId,
  characterName,
  characterImage,
  onClose,
}: VoiceChatProps) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCharacterSpeaking, setIsCharacterSpeaking] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<RealtimeSession | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Start voice call
  const startCall = async () => {
    try {
      setCallState("connecting");
      setError(null);

      // Check if mediaDevices API is available (requires secure context: HTTPS or localhost)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isSecure = window.isSecureContext;
        if (!isSecure) {
          throw new Error("Voice chat requires a secure connection (HTTPS). Please access the site via HTTPS.");
        }
        throw new Error("Your browser does not support microphone access.");
      }

      // Initialize voice chat session with backend to get character instructions
      const response = await fetch("/api/voice-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });

      if (!response.ok) {
        throw new Error("Failed to initialize voice chat");
      }

      const data = await response.json();
      console.log("Voice chat session initialized:", data.session);

      // Create the RealtimeAgent with character personality
      const agent = new RealtimeAgent({
        name: data.session.characterName,
        instructions: data.session.systemInstructions,
        voice: data.session.voice,
      });

      // Create the session
      const session = new RealtimeSession(agent, {
        model: data.session.model,
      });
      sessionRef.current = session;

      // Set up event listeners for audio feedback
      session.on("audio_start", () => {
        setIsCharacterSpeaking(true);
      });

      session.on("audio_stopped", () => {
        setIsCharacterSpeaking(false);
      });

      session.on("error", (err) => {
        console.error("Session error:", err);
        setError(err.error?.toString() || "An error occurred during the call");
      });

      // Connect using the ephemeral token from the server
      // The token is valid for 1 minute and securely authenticates the session
      await session.connect({
        apiKey: data.session.clientSecret,
      });

      // Set up audio visualization after connection
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        monitorAudioLevels();
      } catch (audioErr) {
        console.warn("Could not set up audio visualization:", audioErr);
      }

      setCallState("connected");
      startCallTimer();

    } catch (err) {
      console.error("Error starting call:", err);
      const errorMessage = err instanceof Error ? err.message : "Unable to start voice chat. Please try again.";
      setError(errorMessage);
      setCallState("idle");
      
      // Clean up on error
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }
    }
  };

  // Monitor audio levels for visualization
  const monitorAudioLevels = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      
      // Consider speaking if average is above threshold
      // Threshold of 30 is empirically chosen for typical speech levels
      // Adjust based on your environment (lower for quiet, higher for noisy)
      setIsSpeaking(average > 30);

      animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  };

  // Start call timer
  const startCallTimer = () => {
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  // End voice call
  const endCall = () => {
    // Close the realtime session
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Stop audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    setCallState("ended");
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  // Toggle mute
  const toggleMute = () => {
    if (sessionRef.current) {
      const newMutedState = !isMuted;
      sessionRef.current.mute(newMutedState);
      setIsMuted(newMutedState);
    }
  };

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 rounded-3xl shadow-2xl p-8">
        {/* Close button */}
        <button
          onClick={callState === "connected" ? endCall : onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          aria-label="Close voice chat"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Character avatar with animation */}
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            {/* Animated rings */}
            {(callState === "connecting" || (callState === "connected" && isCharacterSpeaking)) && (
              <>
                <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
                <div className="absolute inset-0 rounded-full bg-white/10 animate-pulse" style={{ animationDelay: "0.5s" }} />
              </>
            )}
            
            {/* Character image */}
            <div className={`relative w-40 h-40 rounded-full overflow-hidden border-4 transition-all duration-300 ${
              callState === "connected" && isCharacterSpeaking
                ? "border-green-400 shadow-lg shadow-green-400/50 scale-105"
                : "border-white/30"
            }`}>
              {characterImage ? (
                <Image
                  src={characterImage}
                  alt={characterName}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <span className="text-5xl font-bold text-white">
                    {characterName.charAt(0)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Character name and status */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">{characterName}</h2>
            <p className="text-white/80 text-sm">
              {callState === "idle" && "Ready to call"}
              {callState === "connecting" && (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  Connecting...
                </span>
              )}
              {callState === "connected" && (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  {formatDuration(callDuration)}
                </span>
              )}
              {callState === "ended" && (
                <span className="text-white/60">Call ended</span>
              )}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="w-full p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* User speaking indicator */}
          {callState === "connected" && (
            <div className="flex items-center gap-3 px-4 py-2 bg-white/10 rounded-full">
              <div className={`w-3 h-3 rounded-full transition-colors ${
                isSpeaking ? "bg-green-400 animate-pulse" : "bg-gray-400"
              }`} />
              <span className="text-sm text-white/80">
                {isSpeaking ? "You're speaking" : "You're listening"}
              </span>
            </div>
          )}

          {/* Control buttons */}
          <div className="flex items-center gap-4 pt-4">
            {callState === "idle" && (
              <button
                onClick={startCall}
                className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                aria-label="Start voice call"
              >
                <svg
                  className="w-10 h-10 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
              </button>
            )}

            {callState === "connected" && (
              <>
                <button
                  onClick={toggleMute}
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                    isMuted
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-white/20 hover:bg-white/30"
                  }`}
                  aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                >
                  <svg
                    className="w-8 h-8 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    {isMuted ? (
                      <path
                        fillRule="evenodd"
                        d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    ) : (
                      <path
                        fillRule="evenodd"
                        d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                        clipRule="evenodd"
                      />
                    )}
                  </svg>
                </button>

                <button
                  onClick={endCall}
                  className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                  aria-label="End voice call"
                >
                  <svg
                    className="w-10 h-10 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                </button>
              </>
            )}

            {(callState === "connecting" || callState === "ended") && (
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Info text */}
          {callState === "idle" && (
            <p className="text-sm text-white/60 text-center max-w-xs">
              Start a voice conversation with {characterName}. Make sure your microphone is enabled.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
