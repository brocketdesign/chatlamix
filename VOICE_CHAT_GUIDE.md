# Voice Chat Feature - Implementation Guide

## Overview

This feature enables real-time voice conversations with AI characters using audio streaming and AI-powered responses. The implementation is designed to be professional, fast, and fluid with beautiful animations.

## Architecture

### Components

1. **VoiceChat Component** (`components/VoiceChat.tsx`)
   - Professional UI with animations
   - Microphone access and audio visualization
   - Call controls (start, stop, mute)
   - Real-time audio level monitoring
   - Animated speaking indicators

2. **Voice Chat API** (`app/api/voice-chat/route.ts`)
   - Session initialization
   - Character personality-based system instructions
   - Voice selection based on character attributes
   - Session tracking in database

3. **Realtime Voice Client** (`lib/realtime-voice-client.ts`)
   - WebSocket connection to OpenAI Realtime API
   - Audio streaming and processing
   - PCM16 audio format conversion
   - Bidirectional audio communication

## Technologies Used

### Current Implementation
- **OpenAI GPT-4o Realtime API** - For conversational AI with voice
- **Web Audio API** - For microphone access and audio processing
- **WebSocket** - For real-time communication
- **React** - UI components with hooks
- **Tailwind CSS** - Professional styling and animations

### Alternative APIs Researched
1. **OpenAI Realtime API** ⭐ (Selected)
   - Pros: Native voice support, low latency, integrated with GPT-4
   - Cons: Requires WebSocket handling, audio format conversion

2. **Twilio Voice API**
   - Pros: Phone call support, reliable infrastructure
   - Cons: Complex setup, higher cost, requires server infrastructure

3. **ElevenLabs**
   - Pros: High-quality voice synthesis
   - Cons: One-way TTS only, requires separate STT service

4. **Web Speech API**
   - Pros: Native browser support, no API costs
   - Cons: Limited quality, browser compatibility issues

## Features

### ✅ Implemented
- [x] Voice call button in chat interface
- [x] Professional UI with gradient backgrounds
- [x] Animated call indicators
- [x] Microphone access and permissions
- [x] Audio level visualization
- [x] Call controls (start/end/mute)
- [x] Call duration timer
- [x] Character-based voice selection
- [x] System instructions from character personality
- [x] Error handling and user feedback

### 🚧 Requires Production Setup

#### 1. OpenAI Realtime API Integration
The current implementation includes the WebSocket client structure but requires:
- OpenAI API key with Realtime API access
- Proper error handling for WebSocket disconnections
- Audio buffering and queue management
- Network latency compensation

#### 2. Security Enhancements
- API key should be proxied through backend (not sent to client)
- Rate limiting for voice calls
- User authentication for voice sessions
- Session timeout management

#### 3. Database Schema
Add these tables to Supabase:

```sql
-- Voice chat sessions
CREATE TABLE voice_chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'started',
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_voice_sessions_user ON voice_chat_sessions(user_id);
CREATE INDEX idx_voice_sessions_character ON voice_chat_sessions(character_id);
```

#### 4. Audio Format Handling
The Realtime API uses PCM16 format. The implementation includes:
- Float32 to PCM16 conversion for outgoing audio
- PCM16 to Float32 conversion for incoming audio
- Base64 encoding for WebSocket transmission
- Audio buffer management

#### 5. Browser Compatibility
Test and ensure compatibility with:
- Chrome/Edge (Chromium) ✅
- Firefox ⚠️ (May need polyfills)
- Safari ⚠️ (Limited WebRTC support)
- Mobile browsers ⚠️ (Permissions handling differs)

## Usage

### For Users
1. Open a character chat
2. Click the phone icon in the header
3. Grant microphone permission when prompted
4. Click the green phone button to start the call
5. Speak naturally with the character
6. Use the mute button to temporarily disable your microphone
7. Click the red phone button to end the call

### For Developers

#### Basic Integration
```tsx
import VoiceChat from "@/components/VoiceChat";

function ChatPage() {
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  
  return (
    <>
      <button onClick={() => setShowVoiceChat(true)}>
        Start Voice Call
      </button>
      
      {showVoiceChat && (
        <VoiceChat
          characterId="char-123"
          characterName="Alice"
          characterImage="/images/alice.jpg"
          onClose={() => setShowVoiceChat(false)}
        />
      )}
    </>
  );
}
```

#### Customizing Voice Selection
Edit `app/api/voice-chat/route.ts`:

```typescript
function determineVoice(personality?: CharacterPersonality): string {
  // OpenAI voices: alloy, echo, fable, onyx, nova, shimmer
  
  // Add your custom logic here
  if (personality?.mood === "mysterious") return "shimmer";
  if (personality?.speakingStyle === "formal") return "onyx";
  
  return "alloy"; // default
}
```

## Production Checklist

Before deploying to production:

- [ ] Set up OpenAI API key with Realtime API access
- [ ] Implement API key proxy (don't expose to client)
- [ ] Add database tables for voice sessions
- [ ] Test microphone permissions on all browsers
- [ ] Add rate limiting for voice calls
- [ ] Implement call quality monitoring
- [ ] Add analytics for voice usage
- [ ] Test on mobile devices
- [ ] Add fallback for unsupported browsers
- [ ] Implement reconnection logic for dropped calls
- [ ] Add cost tracking for API usage
- [ ] Set up monitoring and alerts
- [ ] Add user consent/privacy notices
- [ ] Test with different network conditions
- [ ] Add accessibility features (captions, transcripts)

## Cost Considerations

OpenAI Realtime API pricing (as of implementation):
- Input audio: ~$0.06 per minute
- Output audio: ~$0.24 per minute
- Average conversation: ~$0.30-0.40 per minute

Consider implementing:
- Time limits per call
- Monthly usage limits per user
- Premium feature for unlimited calls
- Call cost display to users

## Troubleshooting

### "Microphone permission denied"
- Check browser permissions
- Ensure HTTPS connection (required for getUserMedia)
- Guide user to browser settings

### "Connection failed"
- Verify OpenAI API key is valid and has Realtime API access
- Check WebSocket connection (firewall, network)
- Verify API key is not exposed in client code

### "No audio playing"
- Check AudioContext state (may be suspended)
- Verify speaker/output device is working
- Check browser audio permissions

### "Poor audio quality"
- Check network connection quality
- Verify sample rate settings (24000 Hz recommended)
- Check for buffer underruns

## Future Enhancements

1. **Multi-language Support**
   - Add language selection
   - Use Whisper for transcription
   - Support multiple languages per character

2. **Call Recording**
   - Save audio conversations
   - Provide playback feature
   - Generate transcripts

3. **Video Calls**
   - Add video streaming
   - Character avatar animation
   - Lip-sync with speech

4. **Group Calls**
   - Multiple users with one character
   - Character-to-character conversations
   - Party/group chat mode

5. **Advanced Features**
   - Voice effects and filters
   - Background noise suppression
   - Echo cancellation
   - Emotion detection from voice

## Resources

- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [Web Audio API Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [WebRTC Documentation](https://webrtc.org/getting-started/overview)
- [getUserMedia API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

## Support

For issues or questions about the voice chat feature:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Verify OpenAI API status
4. Check database connection and schema

## License

Same as the main project (MIT)
