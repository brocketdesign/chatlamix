// Alternative implementation using Web Speech API (browser-native)
// This provides a simpler fallback when OpenAI Realtime API is not available

interface SpeechConfig {
  characterName: string;
  systemInstructions: string;
  onResponse?: (text: string) => void;
  onError?: (error: string) => void;
}

export class WebSpeechVoiceClient {
  private recognition: any = null;
  private synthesis: SpeechSynthesis | null = null;
  private isListening = false;
  private characterContext: string = "";

  constructor() {
    // Check for browser support
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';
    }

    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
    }
  }

  isSupported(): boolean {
    return this.recognition !== null && this.synthesis !== null;
  }

  async startListening(config: SpeechConfig) {
    if (!this.recognition) {
      config.onError?.("Speech recognition not supported in this browser");
      return;
    }

    this.characterContext = config.systemInstructions;
    this.isListening = true;

    this.recognition.onresult = async (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript;

      console.log("User said:", transcript);

      // Generate AI response using text-based chat API
      try {
        const response = await this.generateResponse(transcript, config.characterName);
        this.speak(response);
        config.onResponse?.(response);
      } catch (error) {
        console.error("Error generating response:", error);
        config.onError?.("Failed to generate response");
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      config.onError?.(event.error);
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        // Restart if still supposed to be listening
        this.recognition.start();
      }
    };

    this.recognition.start();
  }

  private async generateResponse(userInput: string, characterId: string): Promise<string> {
    // Use the existing chat API to generate response
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterId,
        message: userInput,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate response');
    }

    const data = await response.json();
    return data.response || "I didn't quite catch that.";
  }

  speak(text: string, voice?: SpeechSynthesisVoice) {
    if (!this.synthesis) return;

    // Cancel any ongoing speech
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure voice if provided, otherwise use default
    if (voice) {
      utterance.voice = voice;
    } else {
      // Try to find a good default voice
      const voices = this.synthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Female'));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    this.synthesis.speak(utterance);
  }

  stopListening() {
    this.isListening = false;
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices();
  }

  // Select a voice based on character attributes
  selectVoice(gender: 'male' | 'female' | 'non-binary', language: string = 'en-US'): SpeechSynthesisVoice | undefined {
    const voices = this.getAvailableVoices();
    
    // Filter by language first
    let filtered = voices.filter(v => v.lang.startsWith(language.split('-')[0]));
    
    if (filtered.length === 0) {
      filtered = voices;
    }

    // Try to match gender
    const genderHints = gender === 'female' 
      ? ['female', 'woman', 'girl']
      : gender === 'male'
      ? ['male', 'man', 'boy']
      : [];

    for (const hint of genderHints) {
      const match = filtered.find(v => v.name.toLowerCase().includes(hint));
      if (match) return match;
    }

    // Return first available voice
    return filtered[0];
  }
}
