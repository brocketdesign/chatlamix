// Base Character interface (for display)
export interface Character {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: string;
  images: string[];
  // New fields for AI influencer platform
  userId?: string;
  isPublic?: boolean;
  personality?: CharacterPersonality;
  physicalAttributes?: PhysicalAttributes;
  tags?: string[];
  mainFaceImage?: string; // The image used for face swapping consistency
  createdAt?: Date;
  updatedAt?: Date;
}

// Detailed personality for realistic chat experience
export interface CharacterPersonality {
  // Core personality traits
  traits: string[]; // e.g., ["friendly", "witty", "caring", "adventurous"]
  mood: string; // e.g., "cheerful", "mysterious", "playful"
  
  // Communication style
  speakingStyle: string; // e.g., "casual", "formal", "flirty", "intellectual"
  tone: string; // e.g., "warm", "sarcastic", "enthusiastic"
  
  // Background
  backstory: string;
  interests: string[];
  hobbies: string[];
  occupation: string;
  
  // Relationship dynamics
  relationshipStyle: string; // e.g., "girlfriend", "best friend", "mentor"
  flirtLevel: number; // 1-10
  affectionLevel: number; // 1-10
  
  // Preferences
  likes: string[];
  dislikes: string[];
  
  // Conversation topics
  favoriteTopics: string[];
  avoidTopics: string[];
}

// Physical attributes for image generation consistency
export interface PhysicalAttributes {
  // General
  gender: "female" | "male" | "non-binary";
  age: string; // e.g., "20s", "early 30s"
  ethnicity: string;
  
  // Face
  faceShape: string; // e.g., "oval", "heart", "round"
  eyeColor: string;
  eyeShape: string;
  noseType: string;
  lipShape: string;
  skinTone: string;
  
  // Hair
  hairColor: string;
  hairLength: string;
  hairStyle: string;
  hairTexture: string; // e.g., "straight", "wavy", "curly"
  
  // Body
  bodyType: string; // e.g., "slim", "athletic", "curvy"
  height: string; // e.g., "tall", "average", "petite"
  
  // Distinguishing features
  distinctiveFeatures: string[]; // e.g., ["dimples", "freckles", "beauty mark"]
  
  // Style
  fashionStyle: string; // e.g., "elegant", "casual", "sporty", "bohemian"
  makeup: string; // e.g., "natural", "glamorous", "minimal"
}

// Character image with metadata
export interface CharacterImage {
  id: string;
  characterId: string;
  imageUrl: string;
  prompt: string;
  isMainFace: boolean;
  createdAt: Date;
  settings?: ImageGenerationSettings;
}

// Settings for image generation
export interface ImageGenerationSettings {
  prompt: string;
  steps?: number;
  guidanceScale?: number;
  seed?: number;
  height?: number;
  width?: number;
  imageFormat?: "jpeg" | "png" | "webp";
  quality?: number;
}

// Form data for creating a new character
export interface CreateCharacterData {
  name: string;
  description: string;
  category: string;
  personality: CharacterPersonality;
  physicalAttributes: PhysicalAttributes;
}

// API Response types
export interface GeneratedTags {
  tags: string[];
  category: string;
}

// Chat message with enhanced context
export interface ChatMessage {
  id: string;
  characterId: string;
  userId: string;
  sender: "user" | "character";
  text: string;
  timestamp: Date;
  emotion?: string; // Character's emotional state during response
}

// Chat session
export interface ChatSession {
  id: string;
  characterId: string;
  userId: string;
  messages: ChatMessage[];
  relationshipProgress: number; // Track relationship development
  createdAt: Date;
  updatedAt: Date;
}

// Filter options for gallery
export interface FilterOption {
  label: string;
  value: string;
}

// User's character collection
export interface UserCharacterCollection {
  userId: string;
  characters: Character[];
  createdAt: Date;
}

// ========================================
// Late API Types (Social Media Integration)
// ========================================

export type SocialPlatform = 
  | "twitter"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "reddit"
  | "bluesky"
  | "threads"
  | "googlebusiness"
  | "telegram"
  | "snapchat";

// Late API Profile
export interface LateProfile {
  _id: string;
  name: string;
  description?: string;
  color?: string;
  isDefault?: boolean;
  createdAt?: string;
}

// Late API Connected Account
export interface LateAccount {
  _id: string;
  platform: SocialPlatform;
  profileId: string;
  username: string;
  displayName: string;
  profilePicture?: string;
  profileUrl?: string;
  isActive: boolean;
}

// Queue slot configuration
export interface QueueSlot {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  time: string; // "HH:mm" format, e.g., "09:00"
}

// Late API Queue Schedule
export interface LateQueueSchedule {
  _id: string;
  profileId: string;
  name: string;
  timezone: string;
  slots: QueueSlot[];
  active: boolean;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Platform-specific post configuration
export interface PlatformPostConfig {
  platform: SocialPlatform;
  accountId: string;
  status?: "pending" | "published" | "failed";
  platformPostId?: string;
  platformPostUrl?: string;
}

// Media item for posts
export interface LateMediaItem {
  url: string;
  type: "image" | "video";
  altText?: string;
  thumbnail?: string;
}

// Post creation request
export interface CreatePostRequest {
  title?: string;
  content?: string;
  mediaItems?: LateMediaItem[];
  platforms: PlatformPostConfig[];
  scheduledFor?: string; // ISO date-time
  publishNow?: boolean;
  isDraft?: boolean;
  timezone?: string;
  tags?: string[];
  hashtags?: string[];
  mentions?: string[];
  queuedFromProfile?: string; // Profile ID for queue-based scheduling
  queueId?: string; // Specific queue to use
}

// Post response
export interface LatePost {
  _id: string;
  title?: string;
  content?: string;
  mediaItems?: LateMediaItem[];
  status: "draft" | "scheduled" | "published" | "failed";
  scheduledFor?: string;
  publishedAt?: string;
  timezone?: string;
  platforms: PlatformPostConfig[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// ========================================
// Scheduling Template Types (Local)
// ========================================

export interface SchedulingTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  timezone: string;
  slots: QueueSlot[];
  lateProfileId?: string; // Connected Late profile ID
  lateQueueId?: string; // Connected Late queue ID
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSchedulingTemplateData {
  name: string;
  description?: string;
  timezone: string;
  slots: QueueSlot[];
  lateProfileId?: string;
  isDefault?: boolean;
}

// Social media post record (local tracking)
export interface SocialMediaPost {
  id: string;
  userId: string;
  characterId: string;
  characterImageId: string;
  imageUrl: string;
  content?: string;
  hashtags?: string[];
  platforms: SocialPlatform[];
  latePostId?: string; // Post ID from Late API
  scheduledFor?: Date;
  publishedAt?: Date;
  status: "pending" | "scheduled" | "published" | "failed";
  templateId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// User's social media configuration
export interface UserSocialConfig {
  id: string;
  userId: string;
  lateApiKey?: string; // Encrypted
  lateProfileId?: string;
  defaultTemplateId?: string;
  connectedAccounts: LateAccount[];
  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// Content Generation Automation Types
// ========================================

export type ContentType = 
  | "lifestyle"
  | "fashion"
  | "travel"
  | "food"
  | "fitness"
  | "beauty"
  | "tech"
  | "art"
  | "nature"
  | "urban"
  | "custom";

export type FrequencyType = "hourly" | "daily" | "weekly" | "custom";

export type GeneratedContentStatus = 
  | "generated"
  | "approved"
  | "rejected"
  | "posted"
  | "scheduled";

// Content generation schedule configuration
export interface ContentGenerationSchedule {
  id: string;
  userId: string;
  characterId: string;
  
  // Basic info
  name: string;
  description?: string;
  isActive: boolean;
  
  // Frequency settings
  frequencyType: FrequencyType;
  frequencyValue: number;
  customCron?: string;
  timezone: string;
  
  // Content settings
  contentType: ContentType;
  customThemes?: string[];
  stylePreferences?: ContentStylePreferences;
  
  // Generation settings
  autoGenerateCaption: boolean;
  includeHashtags: boolean;
  hashtagCount: number;
  
  // Social media settings
  autoPost: boolean;
  schedulingTemplateId?: string;
  targetPlatforms: SocialPlatform[];
  
  // Execution tracking
  lastExecutedAt?: Date;
  nextScheduledAt?: Date;
  totalPostsGenerated: number;
  
  createdAt: Date;
  updatedAt: Date;
}

// Style preferences for content generation
export interface ContentStylePreferences {
  mood?: string[];
  settings?: string[];
  lighting?: string[];
  colorScheme?: string[];
  composition?: string[];
  additionalInstructions?: string;
}

// Generated content record
export interface GeneratedContent {
  id: string;
  scheduleId?: string;
  userId: string;
  characterId: string;
  characterImageId?: string;
  
  // Prompts
  originalPrompt: string;
  enhancedPrompt?: string;
  
  // Content
  imageUrl: string;
  caption?: string;
  hashtags?: string[];
  
  // AI metadata
  aiSuggestions?: AIContentSuggestions;
  contentType?: ContentType;
  
  // Status
  status: GeneratedContentStatus;
  reviewedAt?: Date;
  
  // Social media
  socialPostId?: string;
  postedAt?: Date;
  
  createdAt: Date;
}

// AI suggestions for content
export interface AIContentSuggestions {
  alternativePrompts?: string[];
  captionVariations?: string[];
  hashtagSuggestions?: string[];
  bestTimeToPost?: string;
  targetAudience?: string;
  reasoning?: string;
}

// Content prompt template
export interface ContentPromptTemplate {
  id: string;
  userId: string;
  characterId?: string;
  
  name: string;
  category: ContentType;
  promptTemplate: string;
  examplePrompts?: string[];
  
  isPublic: boolean;
  useCount: number;
  
  createdAt: Date;
  updatedAt: Date;
}

// Request to generate creative prompt
export interface GenerateCreativePromptRequest {
  characterId: string;
  contentType: ContentType;
  customThemes?: string[];
  stylePreferences?: ContentStylePreferences;
  previousPrompts?: string[]; // To avoid repetition
  count?: number; // Number of prompts to generate
}

// Response from creative prompt generation
export interface GenerateCreativePromptResponse {
  prompts: CreativePromptSuggestion[];
}

export interface CreativePromptSuggestion {
  prompt: string;
  caption: string;
  hashtags: string[];
  mood: string;
  setting: string;
  reasoning: string;
}

// Request to create content generation schedule
export interface CreateContentScheduleRequest {
  characterId: string;
  name: string;
  description?: string;
  frequencyType: FrequencyType;
  frequencyValue: number;
  customCron?: string;
  timezone?: string;
  contentType: ContentType;
  customThemes?: string[];
  stylePreferences?: ContentStylePreferences;
  autoGenerateCaption?: boolean;
  includeHashtags?: boolean;
  hashtagCount?: number;
  autoPost?: boolean;
  schedulingTemplateId?: string;
  targetPlatforms?: SocialPlatform[];
}

// Request to execute content generation
export interface ExecuteContentGenerationRequest {
  scheduleId?: string;
  characterId: string;
  prompt?: string; // If not provided, AI will generate one
  contentType?: ContentType;
  customThemes?: string[];
  stylePreferences?: ContentStylePreferences;
  autoPost?: boolean;
  scheduledFor?: string;
}
