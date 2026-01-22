-- Image Gallery Management Migration
-- This migration adds gallery status management for character images
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

-- Add gallery_status column to character_images table
-- Possible values: 'unposted' (newly generated, not in gallery), 'posted' (visible in gallery), 'archived' (hidden/archived)
ALTER TABLE public.character_images 
ADD COLUMN IF NOT EXISTS gallery_status TEXT DEFAULT 'unposted' 
CHECK (gallery_status IN ('unposted', 'posted', 'archived'));

-- Add index for efficient filtering by gallery status
CREATE INDEX IF NOT EXISTS idx_character_images_gallery_status 
ON public.character_images(character_id, gallery_status);

-- Update existing images to be 'posted' so they remain visible in gallery
-- (This ensures backward compatibility - existing images stay in gallery)
UPDATE public.character_images 
SET gallery_status = 'posted' 
WHERE gallery_status IS NULL OR gallery_status = 'unposted';

-- Comment on the column for documentation
COMMENT ON COLUMN public.character_images.gallery_status IS 
'Status of image in gallery: unposted (newly generated, pending review), posted (visible in character gallery), archived (hidden from gallery)';
