import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Discover characters with filters and sorting
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const sortBy = searchParams.get('sortBy') || 'trending';
    const isMonetized = searchParams.get('monetized');
    const minPrice = parseFloat(searchParams.get('minPrice') || '0');
    const maxPrice = parseFloat(searchParams.get('maxPrice') || '999999');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Build the query joining characters with rankings
    let query = supabase
      .from('characters')
      .select(`
        id,
        name,
        description,
        thumbnail,
        category,
        tags,
        user_id,
        profiles!characters_user_id_fkey (id, full_name, avatar_url),
        character_rankings (
          follower_count,
          subscriber_count,
          engagement_score,
          trending_score,
          is_featured
        ),
        character_monetization (
          is_monetized,
          tips_enabled
        ),
        creator_tiers (
          id,
          price_monthly
        )
      `, { count: 'exact' })
      .eq('is_public', true);

    // Apply filters
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (tags && tags.length > 0) {
      query = query.contains('tags', tags);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Execute query
    const { data: characters, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching characters:", error);
      return NextResponse.json(
        { error: "Failed to fetch characters" },
        { status: 500 }
      );
    }

    // Transform and filter results
    let results = (characters || []).map((char) => {
      const ranking = char.character_rankings?.[0] || {};
      const monetization = char.character_monetization?.[0] || {};
      const tiers = char.creator_tiers || [];
      const lowestTierPrice = tiers.length > 0 
        ? Math.min(...tiers.map((t: { price_monthly: number }) => t.price_monthly))
        : null;
      
      // Handle profiles - it may be an array or object depending on the query
      const profile = Array.isArray(char.profiles) ? char.profiles[0] : char.profiles;

      return {
        id: char.id,
        name: char.name,
        description: char.description,
        thumbnail: char.thumbnail,
        category: char.category,
        tags: char.tags,
        creatorId: char.user_id,
        creatorName: profile?.full_name,
        creatorAvatar: profile?.avatar_url,
        // Ranking info
        followerCount: ranking.follower_count || 0,
        subscriberCount: ranking.subscriber_count || 0,
        engagementScore: ranking.engagement_score || 0,
        trendingScore: ranking.trending_score || 0,
        isFeatured: ranking.is_featured || false,
        // Monetization info
        isMonetized: monetization.is_monetized || false,
        tipsEnabled: monetization.tips_enabled || false,
        lowestTierPrice,
        tierCount: tiers.length,
      };
    });

    // Filter by monetization status
    if (isMonetized === 'true') {
      results = results.filter(r => r.isMonetized);
    } else if (isMonetized === 'false') {
      results = results.filter(r => !r.isMonetized);
    }

    // Filter by price range (for monetized characters)
    results = results.filter(r => {
      if (!r.isMonetized || r.lowestTierPrice === null) return true;
      return r.lowestTierPrice >= minPrice && r.lowestTierPrice <= maxPrice;
    });

    // Sort results
    switch (sortBy) {
      case 'popularity':
        results.sort((a, b) => b.followerCount - a.followerCount);
        break;
      case 'engagement':
        results.sort((a, b) => b.engagementScore - a.engagementScore);
        break;
      case 'trending':
        results.sort((a, b) => b.trendingScore - a.trendingScore);
        break;
      case 'newest':
        // Already sorted by created_at from DB
        break;
      case 'price_low':
        results.sort((a, b) => (a.lowestTierPrice || 0) - (b.lowestTierPrice || 0));
        break;
      case 'price_high':
        results.sort((a, b) => (b.lowestTierPrice || 0) - (a.lowestTierPrice || 0));
        break;
    }

    // If user is authenticated, get their follows and subscriptions
    if (user) {
      const characterIds = results.map(r => r.id);
      
      const [followsRes, subsRes] = await Promise.all([
        supabase
          .from('user_follows')
          .select('character_id')
          .eq('follower_id', user.id)
          .in('character_id', characterIds),
        supabase
          .from('fan_subscriptions')
          .select('character_id, tier_id')
          .eq('fan_id', user.id)
          .eq('status', 'active')
          .in('character_id', characterIds),
      ]);

      const followedIds = new Set(followsRes.data?.map(f => f.character_id) || []);
      const subscriptions = new Map(
        subsRes.data?.map(s => [s.character_id, s.tier_id]) || []
      );

      results = results.map(r => ({
        ...r,
        isFollowing: followedIds.has(r.id),
        isSubscribed: subscriptions.has(r.id),
        currentTierId: subscriptions.get(r.id),
      }));
    }

    // Featured characters first
    results.sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return 0;
    });

    return NextResponse.json({
      characters: results,
      total: count || results.length,
      page,
      totalPages: Math.ceil((count || results.length) / limit),
    });
  } catch (error) {
    console.error("Error in discovery:", error);
    return NextResponse.json(
      { error: "Failed to fetch characters" },
      { status: 500 }
    );
  }
}
