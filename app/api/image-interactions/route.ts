import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get like status or comments for an image
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get('characterId');
    const imageIndex = searchParams.get('imageIndex');
    const type = searchParams.get('type'); // 'like' or 'comments'

    if (!characterId || imageIndex === null) {
      return NextResponse.json(
        { error: "Character ID and image index are required" },
        { status: 400 }
      );
    }

    const imageIdentifier = `${characterId}-${imageIndex}`;

    if (type === 'like') {
      // Get like count
      const { count: likeCount } = await supabase
        .from('image_likes')
        .select('*', { count: 'exact', head: true })
        .eq('image_identifier', imageIdentifier);

      // Check if current user has liked
      let isLiked = false;
      if (user) {
        const { data: userLike } = await supabase
          .from('image_likes')
          .select('id')
          .eq('image_identifier', imageIdentifier)
          .eq('user_id', user.id)
          .single();
        
        isLiked = !!userLike;
      }

      return NextResponse.json({
        isLiked,
        likeCount: likeCount || 0,
      });
    }

    if (type === 'comments') {
      // Get comments with user profiles
      const { data: comments, error } = await supabase
        .from('image_comments')
        .select(`
          id,
          user_id,
          text,
          created_at,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .eq('image_identifier', imageIdentifier)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching comments:", error);
        return NextResponse.json(
          { error: "Failed to fetch comments" },
          { status: 500 }
        );
      }

      return NextResponse.json({ comments: comments || [] });
    }

    return NextResponse.json(
      { error: "Type parameter must be 'like' or 'comments'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in image interactions GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch image interactions" },
      { status: 500 }
    );
  }
}

// POST - Like/unlike an image or add a comment
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { characterId, imageIndex, action, text } = body;

    if (!characterId || imageIndex === undefined || !action) {
      return NextResponse.json(
        { error: "Character ID, image index, and action are required" },
        { status: 400 }
      );
    }

    const imageIdentifier = `${characterId}-${imageIndex}`;

    // Verify character exists
    const { data: character, error: charError } = await supabase
      .from('characters')
      .select('id')
      .eq('id', characterId)
      .single();

    if (charError || !character) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    if (action === 'like') {
      // Check if already liked
      const { data: existingLike } = await supabase
        .from('image_likes')
        .select('id')
        .eq('image_identifier', imageIdentifier)
        .eq('user_id', user.id)
        .single();

      if (existingLike) {
        return NextResponse.json({ message: "Already liked" });
      }

      // Insert like
      const { error: likeError } = await supabase
        .from('image_likes')
        .insert({
          image_identifier: imageIdentifier,
          character_id: characterId,
          user_id: user.id,
        });

      if (likeError) {
        console.error("Error liking image:", likeError);
        return NextResponse.json(
          { error: "Failed to like image" },
          { status: 500 }
        );
      }

      // Track interaction (fire and forget)
      try {
        await supabase.rpc('record_interaction', {
          p_user_id: user.id,
          p_character_id: characterId,
          p_interaction_type: 'post_liked',
          p_metadata: { image_index: imageIndex },
          p_duration_seconds: null,
        });
      } catch { /* ignore tracking errors */ }

      // Get updated like count
      const { count: newLikeCount } = await supabase
        .from('image_likes')
        .select('*', { count: 'exact', head: true })
        .eq('image_identifier', imageIdentifier);

      return NextResponse.json({ 
        success: true, 
        isLiked: true,
        likeCount: newLikeCount || 1 
      });
    }

    if (action === 'unlike') {
      const { error: unlikeError } = await supabase
        .from('image_likes')
        .delete()
        .eq('image_identifier', imageIdentifier)
        .eq('user_id', user.id);

      if (unlikeError) {
        console.error("Error unliking image:", unlikeError);
        return NextResponse.json(
          { error: "Failed to unlike image" },
          { status: 500 }
        );
      }

      // Get updated like count
      const { count: newLikeCount } = await supabase
        .from('image_likes')
        .select('*', { count: 'exact', head: true })
        .eq('image_identifier', imageIdentifier);

      return NextResponse.json({ 
        success: true, 
        isLiked: false,
        likeCount: newLikeCount || 0 
      });
    }

    if (action === 'comment') {
      if (!text || !text.trim()) {
        return NextResponse.json(
          { error: "Comment text is required" },
          { status: 400 }
        );
      }

      // Insert comment
      const { data: comment, error: commentError } = await supabase
        .from('image_comments')
        .insert({
          image_identifier: imageIdentifier,
          character_id: characterId,
          user_id: user.id,
          text: text.trim(),
        })
        .select(`
          id,
          user_id,
          text,
          created_at,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .single();

      if (commentError) {
        console.error("Error adding comment:", commentError);
        return NextResponse.json(
          { error: "Failed to add comment" },
          { status: 500 }
        );
      }

      // Track interaction (fire and forget)
      try {
        await supabase.rpc('record_interaction', {
          p_user_id: user.id,
          p_character_id: characterId,
          p_interaction_type: 'post_commented',
          p_metadata: { image_index: imageIndex, comment_id: comment.id },
          p_duration_seconds: null,
        });
      } catch { /* ignore tracking errors */ }

      return NextResponse.json({ success: true, comment });
    }

    return NextResponse.json(
      { error: "Invalid action. Must be 'like', 'unlike', or 'comment'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in image interactions POST:", error);
    return NextResponse.json(
      { error: "Failed to process image interaction" },
      { status: 500 }
    );
  }
}
