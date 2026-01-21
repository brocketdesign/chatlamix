import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  LateAccount,
  LateProfile,
  LatePost,
  CreatePostRequest,
  LateMediaItem,
  SocialPlatform,
} from "@/lib/types";

const LATE_API_BASE = "https://getlate.dev/api/v1";

// Helper to get Late API key from user config or environment
async function getLateApiKey(supabase: any, userId: string): Promise<string | null> {
  // First check user's stored API key
  const { data: userConfig } = await supabase
    .from("user_social_config")
    .select("late_api_key")
    .eq("user_id", userId)
    .single();

  if (userConfig?.late_api_key) {
    return userConfig.late_api_key;
  }

  // Fallback to environment variable for shared/demo key
  return process.env.LATE_API_KEY || null;
}

// Helper to make Late API requests
async function lateApiRequest<T>(
  endpoint: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: string }> {
  try {
    const response = await fetch(`${LATE_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error || `API error: ${response.status}` };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error("Late API request failed:", error);
    return { error: "Failed to connect to Late API" };
  }
}

// GET - Get connected accounts, profiles, or queue info
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "accounts", "profiles", "queue", "next-slot", "posts"
    const profileId = searchParams.get("profileId");

    const apiKey = await getLateApiKey(supabase, user.id);
    if (!apiKey) {
      return NextResponse.json(
        { error: "Late API key not configured. Please add your API key in settings." },
        { status: 400 }
      );
    }

    switch (type) {
      case "profiles": {
        const { data, error } = await lateApiRequest<{ profiles: LateProfile[] }>(
          "/profiles",
          apiKey
        );
        if (error) return NextResponse.json({ error }, { status: 500 });
        return NextResponse.json(data?.profiles || []);
      }

      case "accounts": {
        const endpoint = profileId
          ? `/accounts?profileId=${profileId}`
          : "/accounts";
        const { data, error } = await lateApiRequest<{ accounts: LateAccount[] }>(
          endpoint,
          apiKey
        );
        if (error) return NextResponse.json({ error }, { status: 500 });
        return NextResponse.json(data?.accounts || []);
      }

      case "queue": {
        if (!profileId) {
          return NextResponse.json(
            { error: "Profile ID is required for queue info" },
            { status: 400 }
          );
        }
        const queueId = searchParams.get("queueId");
        const all = searchParams.get("all");
        let endpoint = `/queue/slots?profileId=${profileId}`;
        if (queueId) endpoint += `&queueId=${queueId}`;
        if (all === "true") endpoint += "&all=true";
        
        const { data, error } = await lateApiRequest(endpoint, apiKey);
        if (error) return NextResponse.json({ error }, { status: 500 });
        return NextResponse.json(data);
      }

      case "next-slot": {
        if (!profileId) {
          return NextResponse.json(
            { error: "Profile ID is required for next slot" },
            { status: 400 }
          );
        }
        const queueId = searchParams.get("queueId");
        let endpoint = `/queue/next-slot?profileId=${profileId}`;
        if (queueId) endpoint += `&queueId=${queueId}`;
        
        const { data, error } = await lateApiRequest(endpoint, apiKey);
        if (error) return NextResponse.json({ error }, { status: 500 });
        return NextResponse.json(data);
      }

      case "posts": {
        const status = searchParams.get("status");
        let endpoint = "/posts?";
        if (profileId) endpoint += `profileId=${profileId}&`;
        if (status) endpoint += `status=${status}&`;
        endpoint += "limit=50";
        
        const { data, error } = await lateApiRequest<{ posts: LatePost[] }>(
          endpoint,
          apiKey
        );
        if (error) return NextResponse.json({ error }, { status: 500 });
        return NextResponse.json(data?.posts || []);
      }

      default:
        return NextResponse.json(
          { error: "Invalid type parameter. Use: profiles, accounts, queue, next-slot, or posts" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in social-media GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch social media data" },
      { status: 500 }
    );
  }
}

// POST - Create a post or schedule via queue
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      characterId,
      characterImageId,
      imageUrl,
      content,
      hashtags,
      platforms,
      useQueue,
      profileId,
      queueId,
      publishNow,
      scheduledFor,
    } = body;

    if (!imageUrl || !platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: "Image URL and at least one platform are required" },
        { status: 400 }
      );
    }

    const apiKey = await getLateApiKey(supabase, user.id);
    if (!apiKey) {
      return NextResponse.json(
        { error: "Late API key not configured" },
        { status: 400 }
      );
    }

    // First, upload the image to Late's media storage
    // Get presigned URL
    const { data: presignData, error: presignError } = await lateApiRequest<{
      uploadUrl: string;
      publicUrl: string;
    }>("/media/presign", apiKey, {
      method: "POST",
      body: JSON.stringify({
        filename: `character-${characterId}-${Date.now()}.webp`,
        contentType: "image/webp",
      }),
    });

    if (presignError || !presignData) {
      return NextResponse.json(
        { error: "Failed to get media upload URL" },
        { status: 500 }
      );
    }

    // Upload the image (convert base64 to blob if needed)
    let imageBlob: Blob;
    if (imageUrl.startsWith("data:")) {
      const base64Data = imageUrl.split(",")[1];
      const binaryData = Buffer.from(base64Data, "base64");
      imageBlob = new Blob([binaryData], { type: "image/webp" });
    } else {
      // Fetch the image from URL
      const imageResponse = await fetch(imageUrl);
      imageBlob = await imageResponse.blob();
    }

    // Upload to presigned URL
    const uploadResponse = await fetch(presignData.uploadUrl, {
      method: "PUT",
      body: imageBlob,
      headers: {
        "Content-Type": "image/webp",
      },
    });

    if (!uploadResponse.ok) {
      return NextResponse.json(
        { error: "Failed to upload image to Late" },
        { status: 500 }
      );
    }

    // Build the post content
    const postContent = content || "";
    const hashtagString = hashtags?.length
      ? "\n\n" + hashtags.map((h: string) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
      : "";

    // Build platform configurations
    const platformConfigs = platforms.map((p: { platform: SocialPlatform; accountId: string }) => ({
      platform: p.platform,
      accountId: p.accountId,
    }));

    // Create the post request
    const postRequest: CreatePostRequest = {
      content: postContent + hashtagString,
      mediaItems: [
        {
          url: presignData.publicUrl,
          type: "image",
        },
      ],
      platforms: platformConfigs,
    };

    // Determine scheduling method
    if (publishNow) {
      postRequest.publishNow = true;
    } else if (useQueue && profileId) {
      // Use queue-based scheduling (next available slot)
      postRequest.queuedFromProfile = profileId;
      if (queueId) {
        postRequest.queueId = queueId;
      }
    } else if (scheduledFor) {
      // Manual scheduling
      postRequest.scheduledFor = scheduledFor;
      postRequest.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    // Create the post via Late API
    const { data: postData, error: postError } = await lateApiRequest<{
      post: LatePost;
      message: string;
    }>("/posts", apiKey, {
      method: "POST",
      body: JSON.stringify(postRequest),
    });

    if (postError || !postData) {
      return NextResponse.json(
        { error: postError || "Failed to create post" },
        { status: 500 }
      );
    }

    // Save the post record locally
    const { data: savedPost, error: saveError } = await supabase
      .from("social_media_posts")
      .insert({
        user_id: user.id,
        character_id: characterId,
        character_image_id: characterImageId,
        image_url: imageUrl,
        content: postContent,
        hashtags,
        platforms: platforms.map((p: { platform: string }) => p.platform),
        late_post_id: postData.post._id,
        scheduled_for: postData.post.scheduledFor,
        status: postData.post.status,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Failed to save post locally:", saveError);
      // Don't fail the request, the post was created in Late
    }

    return NextResponse.json({
      success: true,
      post: postData.post,
      localPost: savedPost,
      message: postData.message,
    });
  } catch (error) {
    console.error("Error creating social media post:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}

// PUT - Update Late API configuration
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { lateApiKey, lateProfileId, defaultTemplateId } = body;

    // Validate API key if provided
    if (lateApiKey) {
      const { error } = await lateApiRequest("/profiles", lateApiKey);
      if (error) {
        return NextResponse.json(
          { error: "Invalid Late API key" },
          { status: 400 }
        );
      }
    }

    // Upsert user social config
    const { data, error } = await supabase
      .from("user_social_config")
      .upsert(
        {
          user_id: user.id,
          late_api_key: lateApiKey,
          late_profile_id: lateProfileId,
          default_template_id: defaultTemplateId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Error saving social config:", error);
      return NextResponse.json(
        { error: `Failed to save configuration: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      config: data,
    });
  } catch (error) {
    console.error("Error updating social media config:", error);
    return NextResponse.json(
      { error: "Failed to update configuration" },
      { status: 500 }
    );
  }
}
