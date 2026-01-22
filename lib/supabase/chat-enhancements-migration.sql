-- Chat Enhancements Migration
-- Adds support for chat persistence, gifts, and chat-generated images

-- ========================================
-- Chat Images Table (images generated from chat messages)
-- ========================================
CREATE TABLE IF NOT EXISTS public.chat_images (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  coin_cost INTEGER DEFAULT 0,
  settings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- Chat Gifts Table (gifts sent to characters)
-- ========================================
CREATE TABLE IF NOT EXISTS public.chat_gifts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  gift_type TEXT NOT NULL,
  gift_name TEXT NOT NULL,
  coin_cost INTEGER NOT NULL,
  message TEXT,
  character_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- Add image_url column to chat_messages for inline images
-- ========================================
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_id UUID REFERENCES public.chat_images(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS gift_id UUID REFERENCES public.chat_gifts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'gift'));

-- ========================================
-- Indexes
-- ========================================
CREATE INDEX IF NOT EXISTS idx_chat_images_session_id ON public.chat_images(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_images_character_id ON public.chat_images(character_id);
CREATE INDEX IF NOT EXISTS idx_chat_images_user_id ON public.chat_images(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_gifts_session_id ON public.chat_gifts(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_gifts_character_id ON public.chat_gifts(character_id);
CREATE INDEX IF NOT EXISTS idx_chat_gifts_user_id ON public.chat_gifts(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_message_type ON public.chat_messages(message_type);

-- ========================================
-- Enable RLS
-- ========================================
ALTER TABLE public.chat_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_gifts ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS Policies for chat_images
-- ========================================
CREATE POLICY "Users can view their own chat images" ON public.chat_images
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat images" ON public.chat_images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat images" ON public.chat_images
  FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- RLS Policies for chat_gifts
-- ========================================
CREATE POLICY "Users can view their own chat gifts" ON public.chat_gifts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat gifts" ON public.chat_gifts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ========================================
-- Gift Types Configuration
-- ========================================
CREATE TABLE IF NOT EXISTS public.gift_types (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  coin_cost INTEGER NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'standard',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default gift types
INSERT INTO public.gift_types (name, display_name, emoji, coin_cost, description, category, sort_order) VALUES
  ('rose', 'Rose', '🌹', 5, 'A beautiful red rose', 'flowers', 1),
  ('heart', 'Heart', '❤️', 10, 'Show your love', 'emotions', 2),
  ('kiss', 'Kiss', '💋', 15, 'Send a sweet kiss', 'emotions', 3),
  ('chocolate', 'Chocolate', '🍫', 20, 'Sweet chocolate treat', 'treats', 4),
  ('teddy_bear', 'Teddy Bear', '🧸', 30, 'A cuddly teddy bear', 'toys', 5),
  ('diamond', 'Diamond', '💎', 50, 'A precious diamond', 'luxury', 6),
  ('champagne', 'Champagne', '🍾', 40, 'Celebrate together', 'drinks', 7),
  ('crown', 'Crown', '👑', 100, 'Crown them royalty', 'luxury', 8),
  ('fire', 'Fire', '🔥', 25, 'Things are heating up!', 'emotions', 9),
  ('star', 'Star', '⭐', 35, 'They are a star!', 'special', 10)
ON CONFLICT (name) DO NOTHING;

-- Enable RLS for gift_types (public read)
ALTER TABLE public.gift_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view gift types" ON public.gift_types
  FOR SELECT USING (true);
