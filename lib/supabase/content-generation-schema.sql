-- ========================================
-- Content Generation Automation Tables
-- Run this in Supabase SQL Editor
-- ========================================

-- Content generation schedules for automated posting
CREATE TABLE IF NOT EXISTS public.content_generation_schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  
  -- Schedule configuration
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Frequency settings
  frequency_type TEXT NOT NULL CHECK (frequency_type IN ('hourly', 'daily', 'weekly', 'custom')),
  frequency_value INTEGER DEFAULT 1, -- e.g., every X hours/days
  custom_cron TEXT, -- For custom schedules (cron expression)
  timezone TEXT NOT NULL DEFAULT 'UTC',
  
  -- Content settings
  content_type TEXT NOT NULL CHECK (content_type IN ('lifestyle', 'fashion', 'travel', 'food', 'fitness', 'beauty', 'tech', 'art', 'nature', 'urban', 'custom')),
  custom_themes TEXT[], -- Custom content themes/topics
  style_preferences JSONB DEFAULT '{}', -- Additional style preferences
  
  -- Generation settings
  auto_generate_caption BOOLEAN DEFAULT true,
  include_hashtags BOOLEAN DEFAULT true,
  hashtag_count INTEGER DEFAULT 5,
  
  -- Social media settings
  auto_post BOOLEAN DEFAULT false, -- Whether to auto-post generated content
  scheduling_template_id UUID REFERENCES public.scheduling_templates(id) ON DELETE SET NULL,
  target_platforms TEXT[] DEFAULT '{}',
  
  -- Execution tracking
  last_executed_at TIMESTAMPTZ,
  next_scheduled_at TIMESTAMPTZ,
  total_posts_generated INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated content history
CREATE TABLE IF NOT EXISTS public.generated_content (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  schedule_id UUID REFERENCES public.content_generation_schedules(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  character_image_id UUID REFERENCES public.character_images(id) ON DELETE SET NULL,
  
  -- Original prompt used
  original_prompt TEXT NOT NULL,
  enhanced_prompt TEXT, -- AI-enhanced prompt
  
  -- Generated content
  image_url TEXT NOT NULL,
  caption TEXT,
  hashtags TEXT[],
  
  -- AI generation metadata
  ai_suggestions JSONB, -- Store AI's reasoning/alternatives
  content_type TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'approved', 'rejected', 'posted', 'scheduled')),
  reviewed_at TIMESTAMPTZ,
  
  -- Social media posting
  social_post_id UUID REFERENCES public.social_media_posts(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content prompt templates (user-defined or AI-generated)
CREATE TABLE IF NOT EXISTS public.content_prompt_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  prompt_template TEXT NOT NULL, -- Template with placeholders like {mood}, {location}, {activity}
  example_prompts TEXT[], -- Generated examples
  
  -- Settings
  is_public BOOLEAN DEFAULT false,
  use_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_gen_schedules_user ON public.content_generation_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_content_gen_schedules_character ON public.content_generation_schedules(character_id);
CREATE INDEX IF NOT EXISTS idx_content_gen_schedules_active ON public.content_generation_schedules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_content_gen_schedules_next ON public.content_generation_schedules(next_scheduled_at);
CREATE INDEX IF NOT EXISTS idx_generated_content_schedule ON public.generated_content(schedule_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_user ON public.generated_content(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_status ON public.generated_content(status);
CREATE INDEX IF NOT EXISTS idx_content_prompt_templates_user ON public.content_prompt_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_content_prompt_templates_category ON public.content_prompt_templates(category);

-- Enable RLS
ALTER TABLE public.content_generation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_prompt_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own content schedules" ON public.content_generation_schedules
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own generated content" ON public.generated_content
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own prompt templates" ON public.content_prompt_templates
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view public prompt templates" ON public.content_prompt_templates
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

-- Update triggers
CREATE TRIGGER update_content_gen_schedules_updated_at
  BEFORE UPDATE ON public.content_generation_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_content_prompt_templates_updated_at
  BEFORE UPDATE ON public.content_prompt_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
