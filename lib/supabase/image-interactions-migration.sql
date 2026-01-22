-- Image Interactions Migration
-- Adds tables for image likes and comments
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

-- Image likes table
CREATE TABLE IF NOT EXISTS public.image_likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  image_identifier TEXT NOT NULL, -- Format: "characterId-imageIndex"
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each user can only like an image once
  UNIQUE(image_identifier, user_id)
);

-- Image comments table
CREATE TABLE IF NOT EXISTS public.image_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  image_identifier TEXT NOT NULL, -- Format: "characterId-imageIndex"
  character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_image_likes_identifier ON public.image_likes(image_identifier);
CREATE INDEX IF NOT EXISTS idx_image_likes_user ON public.image_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_image_likes_character ON public.image_likes(character_id);

CREATE INDEX IF NOT EXISTS idx_image_comments_identifier ON public.image_comments(image_identifier);
CREATE INDEX IF NOT EXISTS idx_image_comments_user ON public.image_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_image_comments_character ON public.image_comments(character_id);
CREATE INDEX IF NOT EXISTS idx_image_comments_created ON public.image_comments(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.image_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for image_likes
CREATE POLICY "Anyone can view image likes" ON public.image_likes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can like images" ON public.image_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own likes" ON public.image_likes
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for image_comments
CREATE POLICY "Anyone can view image comments" ON public.image_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can comment on images" ON public.image_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.image_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Comment on tables
COMMENT ON TABLE public.image_likes IS 'Stores likes on character gallery images';
COMMENT ON TABLE public.image_comments IS 'Stores comments on character gallery images';
COMMENT ON COLUMN public.image_likes.image_identifier IS 'Composite identifier: characterId-imageIndex';
COMMENT ON COLUMN public.image_comments.image_identifier IS 'Composite identifier: characterId-imageIndex';
