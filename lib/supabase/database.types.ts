export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      characters: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string
          thumbnail: string | null
          category: string
          is_public: boolean
          personality: Json | null
          physical_attributes: Json | null
          tags: string[] | null
          main_face_image: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description: string
          thumbnail?: string | null
          category: string
          is_public?: boolean
          personality?: Json | null
          physical_attributes?: Json | null
          tags?: string[] | null
          main_face_image?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string
          thumbnail?: string | null
          category?: string
          is_public?: boolean
          personality?: Json | null
          physical_attributes?: Json | null
          tags?: string[] | null
          main_face_image?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      character_images: {
        Row: {
          id: string
          character_id: string
          image_url: string
          prompt: string | null
          is_main_face: boolean
          settings: Json | null
          gallery_status: 'unposted' | 'posted' | 'archived'
          created_at: string
        }
        Insert: {
          id?: string
          character_id: string
          image_url: string
          prompt?: string | null
          is_main_face?: boolean
          settings?: Json | null
          gallery_status?: 'unposted' | 'posted' | 'archived'
          created_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          image_url?: string
          prompt?: string | null
          is_main_face?: boolean
          settings?: Json | null
          gallery_status?: 'unposted' | 'posted' | 'archived'
          created_at?: string
        }
      }
      chat_sessions: {
        Row: {
          id: string
          character_id: string
          user_id: string
          relationship_progress: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          character_id: string
          user_id: string
          relationship_progress?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          user_id?: string
          relationship_progress?: number
          created_at?: string
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          character_id: string
          user_id: string
          sender: 'user' | 'character'
          text: string
          emotion: string | null
          message_type: 'text' | 'image' | 'gift'
          image_url: string | null
          image_id: string | null
          gift_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          character_id: string
          user_id: string
          sender: 'user' | 'character'
          text: string
          emotion?: string | null
          message_type?: 'text' | 'image' | 'gift'
          image_url?: string | null
          image_id?: string | null
          gift_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          character_id?: string
          user_id?: string
          sender?: 'user' | 'character'
          text?: string
          emotion?: string | null
          message_type?: 'text' | 'image' | 'gift'
          image_url?: string | null
          image_id?: string | null
          gift_id?: string | null
          created_at?: string
        }
      }
      // ========================================
      // Chat Enhancement Tables
      // ========================================
      chat_images: {
        Row: {
          id: string
          session_id: string
          message_id: string | null
          character_id: string
          user_id: string
          image_url: string
          prompt: string
          coin_cost: number
          settings: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          message_id?: string | null
          character_id: string
          user_id: string
          image_url: string
          prompt: string
          coin_cost?: number
          settings?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          message_id?: string | null
          character_id?: string
          user_id?: string
          image_url?: string
          prompt?: string
          coin_cost?: number
          settings?: Json | null
          created_at?: string
        }
      }
      chat_gifts: {
        Row: {
          id: string
          session_id: string
          character_id: string
          user_id: string
          gift_type: string
          gift_name: string
          coin_cost: number
          message: string | null
          character_response: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          character_id: string
          user_id: string
          gift_type: string
          gift_name: string
          coin_cost: number
          message?: string | null
          character_response?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          character_id?: string
          user_id?: string
          gift_type?: string
          gift_name?: string
          coin_cost?: number
          message?: string | null
          character_response?: string | null
          created_at?: string
        }
      }
      gift_types: {
        Row: {
          id: string
          name: string
          display_name: string
          emoji: string
          coin_cost: number
          description: string | null
          category: string
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          display_name: string
          emoji: string
          coin_cost: number
          description?: string | null
          category?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          display_name?: string
          emoji?: string
          coin_cost?: number
          description?: string | null
          category?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
      }
      // ========================================
      // Monetization Tables
      // ========================================
      premium_plans: {
        Row: {
          id: string
          name: string
          display_name: string
          description: string | null
          price_monthly: number
          price_yearly: number | null
          features: Json
          monthly_coins: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          display_name: string
          description?: string | null
          price_monthly: number
          price_yearly?: number | null
          features?: Json
          monthly_coins?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          display_name?: string
          description?: string | null
          price_monthly?: number
          price_yearly?: number | null
          features?: Json
          monthly_coins?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_premium_subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_id: string
          status: 'active' | 'cancelled' | 'expired' | 'past_due'
          billing_cycle: 'monthly' | 'yearly'
          current_period_start: string
          current_period_end: string
          cancel_at_period_end: boolean
          stripe_subscription_id: string | null
          stripe_customer_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_id: string
          status?: 'active' | 'cancelled' | 'expired' | 'past_due'
          billing_cycle?: 'monthly' | 'yearly'
          current_period_start?: string
          current_period_end: string
          cancel_at_period_end?: boolean
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_id?: string
          status?: 'active' | 'cancelled' | 'expired' | 'past_due'
          billing_cycle?: 'monthly' | 'yearly'
          current_period_start?: string
          current_period_end?: string
          cancel_at_period_end?: boolean
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_coin_balances: {
        Row: {
          id: string
          user_id: string
          balance: number
          lifetime_earned: number
          lifetime_spent: number
          auto_recharge_enabled: boolean
          auto_recharge_threshold: number
          auto_recharge_amount: number
          last_monthly_allocation: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          balance?: number
          lifetime_earned?: number
          lifetime_spent?: number
          auto_recharge_enabled?: boolean
          auto_recharge_threshold?: number
          auto_recharge_amount?: number
          last_monthly_allocation?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          balance?: number
          lifetime_earned?: number
          lifetime_spent?: number
          auto_recharge_enabled?: boolean
          auto_recharge_threshold?: number
          auto_recharge_amount?: number
          last_monthly_allocation?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      coin_packages: {
        Row: {
          id: string
          name: string
          coin_amount: number
          price: number
          bonus_coins: number
          is_popular: boolean
          is_active: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          coin_amount: number
          price: number
          bonus_coins?: number
          is_popular?: boolean
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          coin_amount?: number
          price?: number
          bonus_coins?: number
          is_popular?: boolean
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
      }
      coin_transactions: {
        Row: {
          id: string
          user_id: string
          transaction_type: 'purchase' | 'premium_allocation' | 'image_generation' | 'tip_sent' | 'refund' | 'bonus' | 'admin_adjustment'
          amount: number
          balance_after: number
          reference_type: string | null
          reference_id: string | null
          description: string | null
          metadata: Json
          stripe_payment_intent_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          transaction_type: 'purchase' | 'premium_allocation' | 'image_generation' | 'tip_sent' | 'refund' | 'bonus' | 'admin_adjustment'
          amount: number
          balance_after: number
          reference_type?: string | null
          reference_id?: string | null
          description?: string | null
          metadata?: Json
          stripe_payment_intent_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          transaction_type?: 'purchase' | 'premium_allocation' | 'image_generation' | 'tip_sent' | 'refund' | 'bonus' | 'admin_adjustment'
          amount?: number
          balance_after?: number
          reference_type?: string | null
          reference_id?: string | null
          description?: string | null
          metadata?: Json
          stripe_payment_intent_id?: string | null
          created_at?: string
        }
      }
      creator_tiers: {
        Row: {
          id: string
          character_id: string
          creator_id: string
          name: string
          description: string | null
          price_monthly: number
          tier_level: number
          benefits: Json
          exclusive_posts: boolean
          private_chat: boolean
          custom_images: boolean
          custom_images_per_month: number
          priority_responses: boolean
          behind_the_scenes: boolean
          early_access: boolean
          badge_color: string
          badge_emoji: string | null
          subscriber_count: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          character_id: string
          creator_id: string
          name: string
          description?: string | null
          price_monthly: number
          tier_level?: number
          benefits?: Json
          exclusive_posts?: boolean
          private_chat?: boolean
          custom_images?: boolean
          custom_images_per_month?: number
          priority_responses?: boolean
          behind_the_scenes?: boolean
          early_access?: boolean
          badge_color?: string
          badge_emoji?: string | null
          subscriber_count?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          creator_id?: string
          name?: string
          description?: string | null
          price_monthly?: number
          tier_level?: number
          benefits?: Json
          exclusive_posts?: boolean
          private_chat?: boolean
          custom_images?: boolean
          custom_images_per_month?: number
          priority_responses?: boolean
          behind_the_scenes?: boolean
          early_access?: boolean
          badge_color?: string
          badge_emoji?: string | null
          subscriber_count?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      fan_subscriptions: {
        Row: {
          id: string
          fan_id: string
          tier_id: string
          character_id: string
          creator_id: string
          status: 'active' | 'cancelled' | 'expired' | 'past_due'
          current_period_start: string
          current_period_end: string
          cancel_at_period_end: boolean
          stripe_subscription_id: string | null
          custom_images_used_this_month: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          fan_id: string
          tier_id: string
          character_id: string
          creator_id: string
          status?: 'active' | 'cancelled' | 'expired' | 'past_due'
          current_period_start?: string
          current_period_end: string
          cancel_at_period_end?: boolean
          stripe_subscription_id?: string | null
          custom_images_used_this_month?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          fan_id?: string
          tier_id?: string
          character_id?: string
          creator_id?: string
          status?: 'active' | 'cancelled' | 'expired' | 'past_due'
          current_period_start?: string
          current_period_end?: string
          cancel_at_period_end?: boolean
          stripe_subscription_id?: string | null
          custom_images_used_this_month?: number
          created_at?: string
          updated_at?: string
        }
      }
      tips: {
        Row: {
          id: string
          fan_id: string | null
          creator_id: string
          character_id: string | null
          amount: number
          coin_amount: number | null
          message: string | null
          is_anonymous: boolean
          stripe_payment_intent_id: string | null
          coin_transaction_id: string | null
          status: 'pending' | 'completed' | 'refunded' | 'failed'
          created_at: string
        }
        Insert: {
          id?: string
          fan_id?: string | null
          creator_id: string
          character_id?: string | null
          amount: number
          coin_amount?: number | null
          message?: string | null
          is_anonymous?: boolean
          stripe_payment_intent_id?: string | null
          coin_transaction_id?: string | null
          status?: 'pending' | 'completed' | 'refunded' | 'failed'
          created_at?: string
        }
        Update: {
          id?: string
          fan_id?: string | null
          creator_id?: string
          character_id?: string | null
          amount?: number
          coin_amount?: number | null
          message?: string | null
          is_anonymous?: boolean
          stripe_payment_intent_id?: string | null
          coin_transaction_id?: string | null
          status?: 'pending' | 'completed' | 'refunded' | 'failed'
          created_at?: string
        }
      }
      character_monetization: {
        Row: {
          id: string
          character_id: string
          creator_id: string
          is_monetized: boolean
          tips_enabled: boolean
          min_tip_amount: number
          fan_image_requests_enabled: boolean
          fan_image_request_cost: number
          welcome_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          character_id: string
          creator_id: string
          is_monetized?: boolean
          tips_enabled?: boolean
          min_tip_amount?: number
          fan_image_requests_enabled?: boolean
          fan_image_request_cost?: number
          welcome_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          creator_id?: string
          is_monetized?: boolean
          tips_enabled?: boolean
          min_tip_amount?: number
          fan_image_requests_enabled?: boolean
          fan_image_request_cost?: number
          welcome_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_interactions: {
        Row: {
          id: string
          user_id: string
          character_id: string
          interaction_type: 'message_sent' | 'message_received' | 'image_generated' | 'image_viewed' | 'post_viewed' | 'post_liked' | 'post_commented' | 'post_shared' | 'profile_viewed' | 'subscription_started' | 'subscription_cancelled' | 'subscription_upgraded' | 'tip_sent' | 'follow' | 'unfollow'
          session_id: string | null
          metadata: Json
          duration_seconds: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          character_id: string
          interaction_type: 'message_sent' | 'message_received' | 'image_generated' | 'image_viewed' | 'post_viewed' | 'post_liked' | 'post_commented' | 'post_shared' | 'profile_viewed' | 'subscription_started' | 'subscription_cancelled' | 'subscription_upgraded' | 'tip_sent' | 'follow' | 'unfollow'
          session_id?: string | null
          metadata?: Json
          duration_seconds?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          character_id?: string
          interaction_type?: 'message_sent' | 'message_received' | 'image_generated' | 'image_viewed' | 'post_viewed' | 'post_liked' | 'post_commented' | 'post_shared' | 'profile_viewed' | 'subscription_started' | 'subscription_cancelled' | 'subscription_upgraded' | 'tip_sent' | 'follow' | 'unfollow'
          session_id?: string | null
          metadata?: Json
          duration_seconds?: number | null
          created_at?: string
        }
      }
      character_daily_stats: {
        Row: {
          id: string
          character_id: string
          date: string
          messages_received: number
          messages_sent: number
          images_generated: number
          profile_views: number
          post_views: number
          post_likes: number
          post_comments: number
          post_shares: number
          new_followers: number
          unfollows: number
          new_subscribers: number
          churned_subscribers: number
          subscription_revenue: number
          tip_revenue: number
          total_revenue: number
          unique_chatters: number
          unique_viewers: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          character_id: string
          date: string
          messages_received?: number
          messages_sent?: number
          images_generated?: number
          profile_views?: number
          post_views?: number
          post_likes?: number
          post_comments?: number
          post_shares?: number
          new_followers?: number
          unfollows?: number
          new_subscribers?: number
          churned_subscribers?: number
          subscription_revenue?: number
          tip_revenue?: number
          total_revenue?: number
          unique_chatters?: number
          unique_viewers?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          date?: string
          messages_received?: number
          messages_sent?: number
          images_generated?: number
          profile_views?: number
          post_views?: number
          post_likes?: number
          post_comments?: number
          post_shares?: number
          new_followers?: number
          unfollows?: number
          new_subscribers?: number
          churned_subscribers?: number
          subscription_revenue?: number
          tip_revenue?: number
          total_revenue?: number
          unique_chatters?: number
          unique_viewers?: number
          created_at?: string
          updated_at?: string
        }
      }
      user_follows: {
        Row: {
          id: string
          follower_id: string
          character_id: string
          notifications_enabled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          follower_id: string
          character_id: string
          notifications_enabled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          follower_id?: string
          character_id?: string
          notifications_enabled?: boolean
          created_at?: string
        }
      }
      creator_earnings: {
        Row: {
          id: string
          creator_id: string
          character_id: string | null
          source_type: 'subscription' | 'tip'
          source_id: string | null
          gross_amount: number
          platform_fee: number
          net_amount: number
          status: 'pending' | 'available' | 'paid_out' | 'refunded'
          available_at: string | null
          payout_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          creator_id: string
          character_id?: string | null
          source_type: 'subscription' | 'tip'
          source_id?: string | null
          gross_amount: number
          platform_fee: number
          net_amount: number
          status?: 'pending' | 'available' | 'paid_out' | 'refunded'
          available_at?: string | null
          payout_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          creator_id?: string
          character_id?: string | null
          source_type?: 'subscription' | 'tip'
          source_id?: string | null
          gross_amount?: number
          platform_fee?: number
          net_amount?: number
          status?: 'pending' | 'available' | 'paid_out' | 'refunded'
          available_at?: string | null
          payout_id?: string | null
          created_at?: string
        }
      }
      creator_payout_settings: {
        Row: {
          id: string
          creator_id: string
          stripe_connect_account_id: string | null
          payout_threshold: number
          payout_schedule: 'weekly' | 'biweekly' | 'monthly'
          is_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          creator_id: string
          stripe_connect_account_id?: string | null
          payout_threshold?: number
          payout_schedule?: 'weekly' | 'biweekly' | 'monthly'
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          creator_id?: string
          stripe_connect_account_id?: string | null
          payout_threshold?: number
          payout_schedule?: 'weekly' | 'biweekly' | 'monthly'
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      creator_payouts: {
        Row: {
          id: string
          creator_id: string
          amount: number
          status: 'pending' | 'processing' | 'completed' | 'failed'
          stripe_transfer_id: string | null
          period_start: string
          period_end: string
          processed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          creator_id: string
          amount: number
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          stripe_transfer_id?: string | null
          period_start: string
          period_end: string
          processed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          creator_id?: string
          amount?: number
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          stripe_transfer_id?: string | null
          period_start?: string
          period_end?: string
          processed_at?: string | null
          created_at?: string
        }
      }
      character_rankings: {
        Row: {
          id: string
          character_id: string
          follower_count: number
          subscriber_count: number
          total_interactions: number
          engagement_score: number
          messages_7d: number
          images_7d: number
          views_7d: number
          revenue_30d: number
          popularity_rank: number | null
          engagement_rank: number | null
          trending_score: number
          category: string | null
          tags: string[] | null
          is_featured: boolean
          last_calculated_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          character_id: string
          follower_count?: number
          subscriber_count?: number
          total_interactions?: number
          engagement_score?: number
          messages_7d?: number
          images_7d?: number
          views_7d?: number
          revenue_30d?: number
          popularity_rank?: number | null
          engagement_rank?: number | null
          trending_score?: number
          category?: string | null
          tags?: string[] | null
          is_featured?: boolean
          last_calculated_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          follower_count?: number
          subscriber_count?: number
          total_interactions?: number
          engagement_score?: number
          messages_7d?: number
          images_7d?: number
          views_7d?: number
          revenue_30d?: number
          popularity_rank?: number | null
          engagement_rank?: number | null
          trending_score?: number
          category?: string | null
          tags?: string[] | null
          is_featured?: boolean
          last_calculated_at?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      user_has_premium: {
        Args: { check_user_id: string }
        Returns: boolean
      }
      deduct_coins: {
        Args: {
          p_user_id: string
          p_amount: number
          p_transaction_type: string
          p_reference_type?: string
          p_reference_id?: string
          p_description?: string
        }
        Returns: { success: boolean; new_balance: number; transaction_id: string }[]
      }
      add_coins: {
        Args: {
          p_user_id: string
          p_amount: number
          p_transaction_type: string
          p_reference_type?: string
          p_reference_id?: string
          p_description?: string
          p_stripe_payment_intent_id?: string
        }
        Returns: { success: boolean; new_balance: number; transaction_id: string }[]
      }
      record_interaction: {
        Args: {
          p_user_id: string
          p_character_id: string
          p_interaction_type: string
          p_metadata?: Json
          p_duration_seconds?: number
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
