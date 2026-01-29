// WebSocket client for OpenAI Realtime API
// This handles the real-time audio conversation with character AI

interface RealtimeConfig {
  apiKey: string;
  systemInstructions: string;
  voice: string;
  model: string;
}

export class RealtimeVoiceClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private isConnected = false;

  // Callbacks
  public onConnectionChange?: (connected: boolean) => void;
  public onCharacterSpeaking?: (speaking: boolean) => void;
  public onError?: (error: string) => void;

  constructor() {}

  async connect(config: RealtimeConfig, mediaStream: MediaStream) {
    try {
      this.mediaStream = mediaStream;
      
      // Initialize audio context
      this.audioContext = new AudioContext({ sampleRate: 24000 });

      // SECURITY WARNING: This implementation connects directly to OpenAI from the client
      // In production, you MUST implement a WebSocket proxy on your backend that:
      // 1. Accepts WebSocket connections from authenticated clients
      // 2. Connects to OpenAI Realtime API using the API key server-side
      // 3. Relays messages between client and OpenAI
      // Never expose API keys to the client!
      
      // Connect to OpenAI Realtime API
      const wsUrl = `wss://api.openai.com/v1/realtime?model=${config.model}`;
      
      this.ws = new WebSocket(wsUrl, [
        "realtime",
        `openai-insecure-api-key.${config.apiKey}`,
        "openai-beta.realtime-v1",
      ]);

      this.ws.addEventListener("open", () => {
        this.isConnected = true;
        this.onConnectionChange?.(true);
        this.sendSessionUpdate(config);
        this.startAudioStreaming();
      });

      this.ws.addEventListener("message", (event) => {
        this.handleServerMessage(JSON.parse(event.data));
      });

      this.ws.addEventListener("close", () => {
        this.isConnected = false;
        this.onConnectionChange?.(false);
      });

      this.ws.addEventListener("error", (error) => {
        console.error("WebSocket error:", error);
        this.onError?.("Connection error. Please try again.");
      });
    } catch (error) {
      console.error("Error connecting to Realtime API:", error);
      this.onError?.("Failed to connect. Please try again.");
    }
  }

  private sendSessionUpdate(config: RealtimeConfig) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions: config.systemInstructions,
          voice: config.voice,
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          input_audio_transcription: {
            model: "whisper-1",
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
          },
          temperature: 0.8,
        },
      })
    );
  }

  private async startAudioStreaming() {
    if (!this.mediaStream || !this.audioContext || !this.ws) return;

    try {
      // Create audio worklet for processing microphone input
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = this.floatTo16BitPCM(inputData);
        const base64Audio = this.arrayBufferToBase64(pcm16);

        // Send audio to server
        this.ws.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: base64Audio,
          })
        );
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error("Error starting audio streaming:", error);
      this.onError?.("Failed to start audio streaming.");
    }
  }

  private handleServerMessage(message: any) {
    switch (message.type) {
      case "response.audio.delta":
        // Play audio response from character
        this.playAudioChunk(message.delta);
        this.onCharacterSpeaking?.(true);
        break;

      case "response.audio.done":
        this.onCharacterSpeaking?.(false);
        break;

      case "input_audio_buffer.speech_started":
        // User started speaking
        break;

      case "input_audio_buffer.speech_stopped":
        // User stopped speaking - commit the audio
        this.commitAudioBuffer();
        break;

      case "error":
        console.error("Server error:", message.error);
        this.onError?.(message.error.message || "An error occurred");
        break;

      case "response.done":
        // Response completed
        break;

      default:
        // Handle other message types as needed
        break;
    }
  }

  private commitAudioBuffer() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: "input_audio_buffer.commit",
      })
    );

    this.ws.send(
      JSON.stringify({
        type: "response.create",
      })
    );
  }

  private playAudioChunk(base64Audio: string) {
    if (!this.audioContext) return;

    try {
      const audioData = this.base64ToArrayBuffer(base64Audio);
      const pcm16 = new Int16Array(audioData);
      const float32 = this.pcm16ToFloat32(pcm16);

      const audioBuffer = this.audioContext.createBuffer(
        1,
        float32.length,
        this.audioContext.sampleRate
      );
      audioBuffer.getChannelData(0).set(float32);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
    } catch (error) {
      console.error("Error playing audio chunk:", error);
    }
  }

  // Audio conversion utilities
  private floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  private pcm16ToFloat32(pcm16: Int16Array): Float32Array {
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff);
    }
    return float32;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isConnected = false;
    this.onConnectionChange?.(false);
  }

  mute(muted: boolean) {
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }
}
