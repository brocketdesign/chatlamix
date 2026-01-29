# Artsogen - AI Influencer Platform

Artsogen is an AI-powered platform for creating, customizing, and interacting with virtual AI characters. It enables users to create their own AI influencers with consistent appearances and engaging personalities for chat-based experiences.

## Features

- **User Authentication** - Secure authentication with Clerk
- **Character Creation** - Create AI characters with detailed physical attributes and personalities
- **Auto-tagging** - Automatic tag generation using OpenAI based on character attributes
- **AI Image Generation** - Generate character images using Segmind API
- **Face Swap for Consistency** - Maintain character appearance consistency across images using face swap
- **Personality-based Chat** - Chat with characters using their unique personality, mood, and relationship style
- **Voice Conversations** - 🆕 Real-time voice calls with characters using OpenAI Realtime API
- **Character Gallery** - Manage and showcase generated images for each character
- **Public/Private Characters** - Control visibility of your characters

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Authentication**: Clerk
- **AI/ML APIs**: 
  - OpenAI GPT-4o-mini (chat & tagging)
  - OpenAI Realtime API (voice conversations)
  - Segmind z-image-turbo (image generation)
  - Segmind faceswap-v5 (face consistency)
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- API keys for Clerk, OpenAI, and Segmind

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/artsogen.git
cd artsogen
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file based on `.env.example`:
```bash
cp .env.example .env.local
```

4. Fill in your API keys in `.env.local`:
```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# OpenAI API (for auto-tagging and chat)
OPENAI_API_KEY=sk-...

# Segmind API (for image generation and face swap)
SEGMIND_API_KEY=...
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## API Keys Setup

### Clerk
1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Create a new application
3. Copy the Publishable Key and Secret Key

### OpenAI
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an API key
3. Copy the key (starts with `sk-`)

### Segmind
1. Go to [Segmind](https://www.segmind.com/)
2. Create an account and get API access
3. Copy your API key

## Project Structure

```
artsogen/
├── app/
│   ├── api/
│   │   ├── characters/    # Character CRUD + auto-tagging
│   │   ├── chat/          # AI-powered chat
│   │   ├── generate-image/ # Image generation
│   │   └── face-swap/     # Face consistency
│   ├── chat/[id]/         # Chat interface
│   ├── character/[id]/    # Public character profile
│   ├── dashboard/
│   │   ├── page.tsx       # User dashboard
│   │   ├── create/        # Character creation wizard
│   │   └── character/[id]/ # Character management
│   ├── sign-in/           # Clerk sign in
│   └── sign-up/           # Clerk sign up
├── components/
├── lib/
│   ├── types.ts           # TypeScript interfaces
│   ├── store.ts           # In-memory data store
│   └── data.ts            # Mock data
└── middleware.ts          # Clerk auth middleware
```

## Usage

### Creating a Character

1. Sign in or create an account
2. Go to Dashboard
3. Click "Create Character"
4. Fill in:
   - **Basic Info**: Name, description, category
   - **Physical Attributes**: Gender, age, ethnicity, hair, eyes, body type, etc.
   - **Personality**: Traits, mood, speaking style, relationship type, interests, etc.
5. Submit - tags will be auto-generated

### Generating Images

1. Go to character management page
2. Enter a scene description (character attributes are auto-included)
3. Select image dimensions
4. Click "Generate Image"
5. First image becomes the "main face" for consistency
6. Subsequent images will have face swap applied automatically

### Chatting with Characters

1. Go to any character profile or your dashboard
2. Click "Chat"
3. The AI will respond based on the character's personality, mood, and relationship style

### Voice Conversations (NEW!)

1. Open a character chat
2. Click the phone icon (📞) in the chat header
3. Grant microphone permission when prompted
4. Click the green call button to start
5. Have a natural voice conversation with your character
6. Use the mute button to temporarily disable your microphone
7. Click the red phone button to end the call

**Features:**
- Real-time audio streaming with low latency
- Character responds with appropriate voice based on personality
- Professional UI with call controls and duration timer
- Audio visualization showing when you or the character is speaking
- Powered by OpenAI Realtime API

**Note:** Voice feature requires OpenAI API key with Realtime API access. See [VOICE_CHAT_GUIDE.md](VOICE_CHAT_GUIDE.md) for detailed setup instructions.

## Character Data Model

### Physical Attributes
- Gender, age, ethnicity
- Face shape, eye color/shape, skin tone
- Hair color, length, style, texture
- Body type, height
- Fashion style, makeup
- Distinctive features

### Personality
- Core traits (up to 5)
- Mood, speaking style, tone
- Backstory, occupation
- Interests, hobbies
- Likes, dislikes
- Relationship style
- Flirt level, affection level
- Favorite/avoid topics

## License

MIT
