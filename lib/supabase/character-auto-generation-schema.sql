-- ========================================
-- Character Auto-Generation Tables
-- Run this in Supabase SQL Editor
-- ========================================

-- Character auto-generation settings (one per user)
CREATE TABLE IF NOT EXISTS public.character_auto_generation_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Generation settings
  is_active BOOLEAN DEFAULT false,
  characters_per_day INTEGER DEFAULT 5 CHECK (characters_per_day >= 1 AND characters_per_day <= 20),
  images_per_character INTEGER DEFAULT 5 CHECK (images_per_character >= 1 AND images_per_character <= 10),
  
  -- Profile diversity settings
  profile_types TEXT[] DEFAULT ARRAY['influencer', 'gamer', 'yoga_instructor', 'tech', 'billionaire', 'philosopher', 'fitness', 'artist', 'musician', 'chef'],
  gender_distribution JSONB DEFAULT '{"male": 40, "female": 50, "nonBinary": 10}',
  
  -- Scheduling
  timezone TEXT NOT NULL DEFAULT 'UTC',
  generation_time_slots TEXT[] DEFAULT ARRAY['09:00', '12:00', '15:00', '18:00', '21:00'],
  
  -- Character defaults
  make_public_by_default BOOLEAN DEFAULT false,
  
  -- Tracking
  total_characters_generated INTEGER DEFAULT 0,
  total_images_generated INTEGER DEFAULT 0,
  last_generated_at TIMESTAMPTZ,
  next_scheduled_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generated character records (tracks each auto-generated character)
CREATE TABLE IF NOT EXISTS public.auto_generated_characters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  settings_id UUID REFERENCES public.character_auto_generation_settings(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  profile_type TEXT NOT NULL,
  
  -- Generation info
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  images_generated INTEGER DEFAULT 0,
  is_complete BOOLEAN DEFAULT false,
  
  -- Status
  is_approved BOOLEAN DEFAULT true,
  is_released BOOLEAN DEFAULT false,
  
  -- Metadata
  generation_prompts TEXT[],
  generation_errors TEXT[]
);

-- Character generation queue (for tracking in-progress generations)
CREATE TABLE IF NOT EXISTS public.character_generation_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  settings_id UUID REFERENCES public.character_auto_generation_settings(id) ON DELETE CASCADE NOT NULL,
  profile_type TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'non-binary')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  
  -- Results
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  images_generated INTEGER DEFAULT 0,
  total_images INTEGER DEFAULT 5,
  error_message TEXT,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auto_gen_settings_user ON public.character_auto_generation_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_gen_settings_active ON public.character_auto_generation_settings(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_auto_gen_settings_next_scheduled ON public.character_auto_generation_settings(next_scheduled_at);
CREATE INDEX IF NOT EXISTS idx_auto_gen_characters_user ON public.auto_generated_characters(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_gen_characters_settings ON public.auto_generated_characters(settings_id);
CREATE INDEX IF NOT EXISTS idx_auto_gen_characters_character ON public.auto_generated_characters(character_id);
CREATE INDEX IF NOT EXISTS idx_gen_queue_user ON public.character_generation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_gen_queue_status ON public.character_generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_gen_queue_settings ON public.character_generation_queue(settings_id);

-- Enable RLS
ALTER TABLE public.character_auto_generation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_generated_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_generation_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own auto-generation settings" ON public.character_auto_generation_settings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own auto-generated characters" ON public.auto_generated_characters
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own generation queue" ON public.character_generation_queue
  FOR ALL USING (auth.uid() = user_id);

-- Update triggers
CREATE TRIGGER update_auto_gen_settings_updated_at
  BEFORE UPDATE ON public.character_auto_generation_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to increment auto-generation stats
CREATE OR REPLACE FUNCTION increment_auto_generation_stats(
  p_settings_id UUID,
  p_characters INTEGER DEFAULT 0,
  p_images INTEGER DEFAULT 0
)
RETURNS void AS $$
BEGIN
  UPDATE public.character_auto_generation_settings
  SET 
    total_characters_generated = total_characters_generated + p_characters,
    total_images_generated = total_images_generated + p_images,
    last_generated_at = NOW()
  WHERE id = p_settings_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
