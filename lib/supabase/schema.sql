-- Supabase Database Schema for Chatlamix
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Characters table
CREATE TABLE IF NOT EXISTS public.characters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  thumbnail TEXT,
  category TEXT NOT NULL DEFAULT 'Other',
  is_public BOOLEAN DEFAULT true,
  personality JSONB,
  physical_attributes JSONB,
  tags TEXT[],
  main_face_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Character images table
CREATE TABLE IF NOT EXISTS public.character_images (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  prompt TEXT,
  is_main_face BOOLEAN DEFAULT false,
  settings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat sessions table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  relationship_progress INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'character')),
  text TEXT NOT NULL,
  emotion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON public.characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_is_public ON public.characters(is_public);
CREATE INDEX IF NOT EXISTS idx_character_images_character_id ON public.character_images(character_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_character_id ON public.chat_sessions(character_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for characters
CREATE POLICY "Anyone can view public characters" ON public.characters
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can create their own characters" ON public.characters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own characters" ON public.characters
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own characters" ON public.characters
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for character_images
CREATE POLICY "Anyone can view images of public characters" ON public.character_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.characters 
      WHERE id = character_images.character_id 
      AND (is_public = true OR user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage images of their own characters" ON public.character_images
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.characters 
      WHERE id = character_images.character_id 
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for chat_sessions
CREATE POLICY "Users can view their own chat sessions" ON public.chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat sessions" ON public.chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat sessions" ON public.chat_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view their own chat messages" ON public.chat_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_characters_updated_at
  BEFORE UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- Social Media Integration Tables
-- ========================================

-- User social media configuration
CREATE TABLE IF NOT EXISTS public.user_social_config (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  late_api_key TEXT, -- Should be encrypted in production
  late_profile_id TEXT,
  default_template_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduling templates for automated posting
CREATE TABLE IF NOT EXISTS public.scheduling_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  slots JSONB NOT NULL DEFAULT '[]', -- Array of {dayOfWeek: number, time: "HH:mm"}
  late_profile_id TEXT, -- Connected Late.dev profile ID
  late_queue_id TEXT, -- Connected Late.dev queue ID
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social media posts tracking
CREATE TABLE IF NOT EXISTS public.social_media_posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  character_image_id UUID REFERENCES public.character_images(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  content TEXT,
  hashtags TEXT[],
  platforms TEXT[] NOT NULL, -- Array of platform names
  late_post_id TEXT, -- Post ID from Late API
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'published', 'failed')),
  template_id UUID REFERENCES public.scheduling_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for social media tables
CREATE INDEX IF NOT EXISTS idx_user_social_config_user_id ON public.user_social_config(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_templates_user_id ON public.scheduling_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_templates_is_default ON public.scheduling_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_social_media_posts_user_id ON public.social_media_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_media_posts_character_id ON public.social_media_posts(character_id);
CREATE INDEX IF NOT EXISTS idx_social_media_posts_status ON public.social_media_posts(status);

-- Enable RLS for social media tables
ALTER TABLE public.user_social_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduling_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_social_config
CREATE POLICY "Users can view their own social config" ON public.user_social_config
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own social config" ON public.user_social_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social config" ON public.user_social_config
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social config" ON public.user_social_config
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for scheduling_templates
CREATE POLICY "Users can view their own scheduling templates" ON public.scheduling_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduling templates" ON public.scheduling_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduling templates" ON public.scheduling_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduling templates" ON public.scheduling_templates
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for social_media_posts
CREATE POLICY "Users can view their own social media posts" ON public.social_media_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own social media posts" ON public.social_media_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social media posts" ON public.social_media_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social media posts" ON public.social_media_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_user_social_config_updated_at
  BEFORE UPDATE ON public.user_social_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduling_templates_updated_at
  BEFORE UPDATE ON public.scheduling_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_social_media_posts_updated_at
  BEFORE UPDATE ON public.social_media_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Foreign key for default_template_id (added after scheduling_templates table exists)
ALTER TABLE public.user_social_config 
  ADD CONSTRAINT fk_default_template 
  FOREIGN KEY (default_template_id) 
  REFERENCES public.scheduling_templates(id) 
  ON DELETE SET NULL;

-- Storage bucket for character images (run separately in Storage settings or use this)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('character-images', 'character-images', true);
