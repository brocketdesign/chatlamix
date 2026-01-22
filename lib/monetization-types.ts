// ========================================
// Monetization Types
// AI Influencer Platform - Patreon-style Monetization
// ========================================

// ========================================
// Premium Subscriptions (Platform Level)
// ========================================

export interface PremiumPlan {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  priceMonthly: number;
  priceYearly?: number;
  features: string[];
  monthlyCoins: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPremiumSubscription {
  id: string;
  userId: string;
  planId: string;
  plan?: PremiumPlan;
  status: PremiumSubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PremiumSubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due';
export type BillingCycle = 'monthly' | 'yearly';

// ========================================
// Coins Virtual Currency System
// ========================================

export interface UserCoinBalance {
  id: string;
  userId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  autoRechargeEnabled: boolean;
  autoRechargeThreshold: number;
  autoRechargeAmount: number;
  lastMonthlyAllocation?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoinPackage {
  id: string;
  name: string;
  coinAmount: number;
  price: number;
  bonusCoins: number;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
}

export interface CoinTransaction {
  id: string;
  userId: string;
  transactionType: CoinTransactionType;
  amount: number; // Positive for credits, negative for debits
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  stripePaymentIntentId?: string;
  createdAt: Date;
}

export type CoinTransactionType = 
  | 'purchase'
  | 'premium_allocation'
  | 'image_generation'
  | 'tip_sent'
  | 'refund'
  | 'bonus'
  | 'admin_adjustment';

// ========================================
// Creator Monetization - Subscription Tiers
// ========================================

export interface TierBenefit {
  id: string;
  type: string;
  description: string;
}

export interface CreatorTier {
  id: string;
  characterId: string;
  creatorId: string;
  name: string;
  description?: string;
  priceMonthly: number;
  tierLevel: number;
  benefits: string[];
  // Access controls
  exclusivePosts: boolean;
  privateChat: boolean;
  customImages: boolean;
  customImagesPerMonth: number;
  priorityResponses: boolean;
  behindTheScenes: boolean;
  earlyAccess: boolean;
  // Visual
  badgeColor: string;
  badgeEmoji?: string;
  // Stats
  subscriberCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FanSubscription {
  id: string;
  fanId: string;
  tierId: string;
  tier?: CreatorTier;
  characterId: string;
  creatorId: string;
  status: FanSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string;
  customImagesUsedThisMonth: number;
  createdAt: Date;
  updatedAt: Date;
}

export type FanSubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due';

// ========================================
// Tips System
// ========================================

export interface Tip {
  id: string;
  fanId?: string;
  creatorId: string;
  characterId?: string;
  amount: number;
  coinAmount?: number;
  message?: string;
  isAnonymous: boolean;
  stripePaymentIntentId?: string;
  coinTransactionId?: string;
  status: TipStatus;
  createdAt: Date;
}

export type TipStatus = 'pending' | 'completed' | 'refunded' | 'failed';

// ========================================
// Character Monetization Settings
// ========================================

export interface CharacterMonetization {
  id: string;
  characterId: string;
  creatorId: string;
  isMonetized: boolean;
  tipsEnabled: boolean;
  minTipAmount: number;
  fanImageRequestsEnabled: boolean;
  fanImageRequestCost: number;
  welcomeMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// User Interaction Tracking
// ========================================

export interface UserInteraction {
  id: string;
  userId: string;
  characterId: string;
  interactionType: InteractionType;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  durationSeconds?: number;
  createdAt: Date;
}

export type InteractionType =
  | 'message_sent'
  | 'message_received'
  | 'image_generated'
  | 'image_viewed'
  | 'post_viewed'
  | 'post_liked'
  | 'post_commented'
  | 'post_shared'
  | 'profile_viewed'
  | 'subscription_started'
  | 'subscription_cancelled'
  | 'subscription_upgraded'
  | 'tip_sent'
  | 'follow'
  | 'unfollow';

// ========================================
// Analytics & Daily Stats
// ========================================

export interface CharacterDailyStats {
  id: string;
  characterId: string;
  date: string; // YYYY-MM-DD
  // Engagement
  messagesReceived: number;
  messagesSent: number;
  imagesGenerated: number;
  profileViews: number;
  postViews: number;
  postLikes: number;
  postComments: number;
  postShares: number;
  // Growth
  newFollowers: number;
  unfollows: number;
  newSubscribers: number;
  churnedSubscribers: number;
  // Revenue
  subscriptionRevenue: number;
  tipRevenue: number;
  totalRevenue: number;
  // Unique users
  uniqueChatters: number;
  uniqueViewers: number;
  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// Follows System
// ========================================

export interface UserFollow {
  id: string;
  followerId: string;
  characterId: string;
  notificationsEnabled: boolean;
  createdAt: Date;
}

// ========================================
// Creator Payouts
// ========================================

export interface CreatorEarning {
  id: string;
  creatorId: string;
  characterId?: string;
  sourceType: EarningSourceType;
  sourceId?: string;
  grossAmount: number;
  platformFee: number;
  platformFeePercentage?: number;
  netAmount: number;
  status: EarningStatus;
  availableAt?: Date;
  payoutId?: string;
  createdAt: Date;
}

export type EarningSourceType = 'subscription' | 'tip';
export type EarningStatus = 'pending' | 'available' | 'paid_out' | 'refunded';

export interface CreatorPayoutSettings {
  id: string;
  creatorId: string;
  stripeConnectAccountId?: string;
  stripeConnectOnboardingComplete: boolean;
  stripeConnectDetailsSubmitted: boolean;
  stripeConnectChargesEnabled: boolean;
  stripeConnectPayoutsEnabled: boolean;
  stripeConnectCountry: string;
  stripeConnectCurrency: string;
  stripeConnectRequirements?: StripeConnectRequirements;
  stripeConnectCreatedAt?: Date;
  payoutThreshold: number;
  payoutSchedule: PayoutSchedule;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StripeConnectRequirements {
  currentlyDue: string[];
  eventuallyDue: string[];
  pastDue: string[];
  pendingVerification: string[];
  disabledReason?: string;
}

export type PayoutSchedule = 'weekly' | 'biweekly' | 'monthly';

export interface CreatorPayout {
  id: string;
  creatorId: string;
  amount: number;
  status: PayoutStatus;
  stripeTransferId?: string;
  periodStart: Date;
  periodEnd: Date;
  processedAt?: Date;
  createdAt: Date;
}

export interface PayoutRequest {
  id: string;
  creatorId: string;
  amount: number;
  platformFee: number;
  netAmount: number;
  status: PayoutRequestStatus;
  stripeTransferId?: string;
  stripePayoutId?: string;
  failureReason?: string;
  processedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type PayoutRequestStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// ========================================
// Stripe Connect Types
// ========================================

export interface StripeConnectAccountStatus {
  hasAccount: boolean;
  accountId?: string;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements?: StripeConnectRequirements;
  payoutSchedule?: {
    interval: string;
    delay_days?: number;
  };
  defaultCurrency?: string;
  country?: string;
}

export interface StripeConnectOnboardingResponse {
  url: string;
  accountId: string;
}

export interface StripeConnectDashboardResponse {
  url: string;
}

export interface PayoutBalanceSummary {
  totalGross: number;
  totalFees: number;
  totalNet: number;
  pending: number;
  available: number;
  paidOut: number;
  pendingPayout: number;
}

export interface PayoutResponse {
  balance: PayoutBalanceSummary;
  payouts: PayoutRequest[];
  totalPayouts: number;
  settings: {
    minimumPayout: number;
    platformFeePercentage: number;
    payoutsEnabled: boolean;
    hasStripeAccount: boolean;
    onboardingComplete: boolean;
  };
}

export interface RequestPayoutResponse {
  success: boolean;
  payoutRequestId: string;
  transferId: string;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  message: string;
}

// ========================================
// Discovery & Ranking
// ========================================

export interface CharacterRanking {
  id: string;
  characterId: string;
  // Popularity metrics
  followerCount: number;
  subscriberCount: number;
  totalInteractions: number;
  // Engagement metrics (7-day rolling)
  engagementScore: number;
  messages7d: number;
  images7d: number;
  views7d: number;
  // Revenue metrics (for premium creators)
  revenue30d: number;
  // Calculated scores
  popularityRank?: number;
  engagementRank?: number;
  trendingScore: number;
  // Metadata
  category?: string;
  tags?: string[];
  isFeatured: boolean;
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// API Request/Response Types
// ========================================

// Premium subscription
export interface CreatePremiumSubscriptionRequest {
  planId: string;
  billingCycle: BillingCycle;
  paymentMethodId?: string; // Stripe payment method
}

export interface PremiumStatusResponse {
  isPremium: boolean;
  subscription?: UserPremiumSubscription;
  plan?: PremiumPlan;
  daysRemaining?: number;
}

// Coins
export interface PurchaseCoinsRequest {
  packageId: string;
  paymentMethodId?: string;
}

export interface CoinBalanceResponse {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  autoRechargeEnabled: boolean;
  autoRechargeThreshold: number;
  autoRechargeAmount: number;
}

export interface UpdateAutoRechargeRequest {
  enabled: boolean;
  threshold?: number;
  amount?: number;
}

// Creator tiers
export interface CreateTierRequest {
  characterId: string;
  name: string;
  description?: string;
  priceMonthly: number;
  benefits?: string[];
  exclusivePosts?: boolean;
  privateChat?: boolean;
  customImages?: boolean;
  customImagesPerMonth?: number;
  priorityResponses?: boolean;
  behindTheScenes?: boolean;
  earlyAccess?: boolean;
  badgeColor?: string;
  badgeEmoji?: string;
}

export interface UpdateTierRequest extends Partial<CreateTierRequest> {
  tierId: string;
}

// Fan subscriptions
export interface SubscribeToTierRequest {
  tierId: string;
  paymentMethodId?: string;
}

// Tips
export interface SendTipRequest {
  characterId: string;
  amount: number;
  useCoins?: boolean;
  message?: string;
  isAnonymous?: boolean;
}

// Character monetization
export interface UpdateMonetizationSettingsRequest {
  characterId: string;
  isMonetized?: boolean;
  tipsEnabled?: boolean;
  minTipAmount?: number;
  fanImageRequestsEnabled?: boolean;
  fanImageRequestCost?: number;
  welcomeMessage?: string;
}

// Discovery
export interface DiscoveryFilters {
  search?: string;
  category?: string;
  tags?: string[];
  sortBy?: 'popularity' | 'engagement' | 'trending' | 'newest';
  isMonetized?: boolean;
  monetizedOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  priceRange?: {
    min?: number;
    max?: number;
  };
  page?: number;
  limit?: number;
}

export interface DiscoveryResult {
  characters: CharacterWithRanking[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CharacterWithRanking {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  category: string;
  tags?: string[];
  creatorId: string;
  creatorName?: string;
  // Ranking info
  followerCount: number;
  subscriberCount: number;
  engagementScore: number;
  trendingScore: number;
  isFeatured: boolean;
  // Monetization info
  isMonetized: boolean;
  lowestTierPrice?: number;
  tipsEnabled: boolean;
  // User's relationship (if authenticated)
  isFollowing?: boolean;
  isSubscribed?: boolean;
  currentTierId?: string;
}

// Analytics
export interface CreatorAnalyticsRequest {
  characterId?: string; // If not provided, aggregate all characters
  period: AnalyticsPeriod;
  startDate?: string;
  endDate?: string;
}

export type AnalyticsPeriod = '7d' | '30d' | '90d' | 'all' | 'custom';

export interface CreatorAnalyticsResponse {
  overview: AnalyticsOverview;
  revenue: RevenueAnalytics;
  engagement: EngagementAnalytics;
  growth: GrowthAnalytics;
  topContent: TopContentAnalytics;
  dailyStats: CharacterDailyStats[];
}

export interface AnalyticsOverview {
  totalRevenue: number;
  revenueChange: number; // Percentage change from previous period
  totalSubscribers: number;
  subscriberChange: number;
  totalFollowers: number;
  followerChange: number;
  totalInteractions: number;
  interactionChange: number;
}

export interface RevenueAnalytics {
  subscriptionRevenue: number;
  tipRevenue: number;
  totalRevenue: number;
  averageRevenuePerSubscriber: number;
  topTippers: TipperInfo[];
  revenueByTier: TierRevenueInfo[];
}

export interface TipperInfo {
  userId?: string;
  displayName?: string;
  totalTips: number;
  tipCount: number;
  isAnonymous: boolean;
}

export interface TierRevenueInfo {
  tierId: string;
  tierName: string;
  subscriberCount: number;
  revenue: number;
}

export interface EngagementAnalytics {
  totalMessages: number;
  totalImageGenerated: number;
  totalViews: number;
  avgSessionDuration: number;
  engagementRate: number;
  peakHours: PeakHourInfo[];
}

export interface PeakHourInfo {
  hour: number;
  interactions: number;
}

export interface GrowthAnalytics {
  newFollowers: number;
  lostFollowers: number;
  netFollowerGrowth: number;
  newSubscribers: number;
  churnedSubscribers: number;
  netSubscriberGrowth: number;
  conversionRate: number; // Followers to subscribers
}

export interface TopContentAnalytics {
  topImages: TopImageInfo[];
  topPosts: TopPostInfo[];
}

export interface TopImageInfo {
  imageId: string;
  imageUrl: string;
  views: number;
  likes: number;
}

export interface TopPostInfo {
  postId: string;
  content: string;
  views: number;
  likes: number;
  shares: number;
}

// Interaction tracking
export interface TrackInteractionRequest {
  characterId: string;
  interactionType: InteractionType;
  metadata?: Record<string, unknown>;
  durationSeconds?: number;
}
