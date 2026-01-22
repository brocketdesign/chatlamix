import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Utility to check if user has premium
async function checkPremium(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: isPremium } = await supabase.rpc('user_has_premium', { check_user_id: userId });
  return isPremium || false;
}

// GET - Get creator analytics
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check premium status
    const isPremium = await checkPremium(supabase, user.id);
    if (!isPremium) {
      return NextResponse.json(
        { error: "Premium subscription required for analytics" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get('characterId');
    const period = searchParams.get('period') || '30d';

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(startDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const previousStartDateStr = previousStartDate.toISOString().split('T')[0];
    const endDateStr = now.toISOString().split('T')[0];

    // Get user's characters
    let characterQuery = supabase
      .from('characters')
      .select('id, name, thumbnail')
      .eq('user_id', user.id);
    
    if (characterId) {
      characterQuery = characterQuery.eq('id', characterId);
    }

    const { data: characters } = await characterQuery;
    const characterIds = characters?.map(c => c.id) || [];

    if (characterIds.length === 0) {
      return NextResponse.json({
        overview: {
          totalRevenue: 0,
          revenueChange: 0,
          totalSubscribers: 0,
          subscriberChange: 0,
          totalFollowers: 0,
          followerChange: 0,
          totalInteractions: 0,
          interactionChange: 0,
        },
        revenue: {
          subscriptionRevenue: 0,
          tipRevenue: 0,
          totalRevenue: 0,
          averageRevenuePerSubscriber: 0,
          topTippers: [],
          revenueByTier: [],
        },
        engagement: {
          totalMessages: 0,
          totalImageGenerated: 0,
          totalViews: 0,
          avgSessionDuration: 0,
          engagementRate: 0,
          peakHours: [],
        },
        growth: {
          newFollowers: 0,
          lostFollowers: 0,
          netFollowerGrowth: 0,
          newSubscribers: 0,
          churnedSubscribers: 0,
          netSubscriberGrowth: 0,
          conversionRate: 0,
        },
        dailyStats: [],
        characters: [],
      });
    }

    // Get daily stats for the period
    const { data: dailyStats } = await supabase
      .from('character_daily_stats')
      .select('*')
      .in('character_id', characterIds)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true });

    // Get previous period stats for comparison
    const { data: previousStats } = await supabase
      .from('character_daily_stats')
      .select('*')
      .in('character_id', characterIds)
      .gte('date', previousStartDateStr)
      .lt('date', startDateStr);

    // Aggregate current period
    const currentAgg = (dailyStats || []).reduce((acc, stat) => ({
      revenue: acc.revenue + (stat.total_revenue || 0),
      subscriptionRevenue: acc.subscriptionRevenue + (stat.subscription_revenue || 0),
      tipRevenue: acc.tipRevenue + (stat.tip_revenue || 0),
      messages: acc.messages + (stat.messages_received || 0),
      images: acc.images + (stat.images_generated || 0),
      views: acc.views + (stat.profile_views || 0) + (stat.post_views || 0),
      newFollowers: acc.newFollowers + (stat.new_followers || 0),
      unfollows: acc.unfollows + (stat.unfollows || 0),
      newSubscribers: acc.newSubscribers + (stat.new_subscribers || 0),
      churnedSubscribers: acc.churnedSubscribers + (stat.churned_subscribers || 0),
    }), {
      revenue: 0,
      subscriptionRevenue: 0,
      tipRevenue: 0,
      messages: 0,
      images: 0,
      views: 0,
      newFollowers: 0,
      unfollows: 0,
      newSubscribers: 0,
      churnedSubscribers: 0,
    });

    // Aggregate previous period
    const previousAgg = (previousStats || []).reduce((acc, stat) => ({
      revenue: acc.revenue + (stat.total_revenue || 0),
      messages: acc.messages + (stat.messages_received || 0),
      newFollowers: acc.newFollowers + (stat.new_followers || 0),
      newSubscribers: acc.newSubscribers + (stat.new_subscribers || 0),
    }), { revenue: 0, messages: 0, newFollowers: 0, newSubscribers: 0 });

    // Get current totals from rankings
    const { data: rankings } = await supabase
      .from('character_rankings')
      .select('*')
      .in('character_id', characterIds);

    const totalFollowers = rankings?.reduce((sum, r) => sum + (r.follower_count || 0), 0) || 0;
    const totalSubscribers = rankings?.reduce((sum, r) => sum + (r.subscriber_count || 0), 0) || 0;
    const totalInteractions = rankings?.reduce((sum, r) => sum + (r.total_interactions || 0), 0) || 0;

    // Get top tippers
    const { data: topTippers } = await supabase
      .from('tips')
      .select(`
        fan_id,
        amount,
        is_anonymous,
        profiles!tips_fan_id_fkey (full_name)
      `)
      .in('character_id', characterIds)
      .eq('status', 'completed')
      .gte('created_at', startDate.toISOString())
      .order('amount', { ascending: false })
      .limit(10);

    // Get revenue by tier
    const { data: tiers } = await supabase
      .from('creator_tiers')
      .select(`
        id,
        name,
        subscriber_count,
        price_monthly
      `)
      .in('character_id', characterIds)
      .eq('is_active', true);

    // Calculate percentage changes
    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const response = {
      overview: {
        totalRevenue: currentAgg.revenue,
        revenueChange: calcChange(currentAgg.revenue, previousAgg.revenue),
        totalSubscribers,
        subscriberChange: calcChange(currentAgg.newSubscribers, previousAgg.newSubscribers),
        totalFollowers,
        followerChange: calcChange(currentAgg.newFollowers, previousAgg.newFollowers),
        totalInteractions: currentAgg.messages + currentAgg.images + currentAgg.views,
        interactionChange: calcChange(currentAgg.messages, previousAgg.messages),
      },
      revenue: {
        subscriptionRevenue: currentAgg.subscriptionRevenue,
        tipRevenue: currentAgg.tipRevenue,
        totalRevenue: currentAgg.revenue,
        averageRevenuePerSubscriber: totalSubscribers > 0 
          ? currentAgg.subscriptionRevenue / totalSubscribers 
          : 0,
        topTippers: (topTippers || []).map(t => {
          const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
          return {
            userId: t.fan_id,
            displayName: t.is_anonymous ? 'Anonymous' : profile?.full_name || 'User',
            totalTips: t.amount,
            isAnonymous: t.is_anonymous,
          };
        }),
        revenueByTier: (tiers || []).map(t => ({
          tierId: t.id,
          tierName: t.name,
          subscriberCount: t.subscriber_count,
          revenue: t.subscriber_count * t.price_monthly,
        })),
      },
      engagement: {
        totalMessages: currentAgg.messages,
        totalImageGenerated: currentAgg.images,
        totalViews: currentAgg.views,
        avgSessionDuration: 0, // Would need more detailed tracking
        engagementRate: currentAgg.views > 0 
          ? ((currentAgg.messages + currentAgg.images) / currentAgg.views) * 100 
          : 0,
        peakHours: [], // Would need hourly aggregation
      },
      growth: {
        newFollowers: currentAgg.newFollowers,
        lostFollowers: currentAgg.unfollows,
        netFollowerGrowth: currentAgg.newFollowers - currentAgg.unfollows,
        newSubscribers: currentAgg.newSubscribers,
        churnedSubscribers: currentAgg.churnedSubscribers,
        netSubscriberGrowth: currentAgg.newSubscribers - currentAgg.churnedSubscribers,
        conversionRate: totalFollowers > 0 
          ? (totalSubscribers / totalFollowers) * 100 
          : 0,
      },
      dailyStats: dailyStats || [],
      characters: characters || [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
