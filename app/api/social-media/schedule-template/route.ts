import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { QueueSlot, SchedulingTemplate, CreateSchedulingTemplateData } from "@/lib/types";

const LATE_API_BASE = "https://getlate.dev/api/v1";

// Helper to get Late API key
async function getLateApiKey(supabase: any, userId: string): Promise<string | null> {
  const { data: userConfig } = await supabase
    .from("user_social_config")
    .select("late_api_key")
    .eq("user_id", userId)
    .single();

  if (userConfig?.late_api_key) {
    return userConfig.late_api_key;
  }

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

// Transform database row to SchedulingTemplate
function transformDbTemplate(row: any): SchedulingTemplate {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    timezone: row.timezone,
    slots: row.slots,
    lateProfileId: row.late_profile_id,
    lateQueueId: row.late_queue_id,
    isActive: row.is_active,
    isDefault: row.is_default,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// GET - Get user's scheduling templates
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
    const templateId = searchParams.get("id");

    if (templateId) {
      // Get single template
      const { data, error } = await supabase
        .from("scheduling_templates")
        .select("*")
        .eq("id", templateId)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(transformDbTemplate(data));
    }

    // Get all templates
    const { data, error } = await supabase
      .from("scheduling_templates")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch templates" },
        { status: 500 }
      );
    }

    const templates = data.map(transformDbTemplate);
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching scheduling templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST - Create a new scheduling template
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

    const body: CreateSchedulingTemplateData = await request.json();
    const { name, description, timezone, slots, lateProfileId, isDefault } = body;

    if (!name || !timezone || !slots || slots.length === 0) {
      return NextResponse.json(
        { error: "Name, timezone, and at least one slot are required" },
        { status: 400 }
      );
    }

    // Validate slots
    for (const slot of slots) {
      if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
        return NextResponse.json(
          { error: "Day of week must be between 0 (Sunday) and 6 (Saturday)" },
          { status: 400 }
        );
      }
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(slot.time)) {
        return NextResponse.json(
          { error: "Time must be in HH:mm format" },
          { status: 400 }
        );
      }
    }

    // If this will be the default, unset other defaults
    if (isDefault) {
      await supabase
        .from("scheduling_templates")
        .update({ is_default: false })
        .eq("user_id", user.id);
    }

    // Check if this is the first template (make it default)
    const { count } = await supabase
      .from("scheduling_templates")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    const shouldBeDefault = isDefault || count === 0;

    // Sync with Late API if a profile is connected
    let lateQueueId: string | undefined;
    if (lateProfileId) {
      const apiKey = await getLateApiKey(supabase, user.id);
      if (apiKey) {
        const { data: queueData, error: queueError } = await lateApiRequest<{
          success: boolean;
          schedule: { _id: string };
        }>("/queue/slots", apiKey, {
          method: "POST",
          body: JSON.stringify({
            profileId: lateProfileId,
            name,
            timezone,
            slots,
            active: true,
          }),
        });

        if (!queueError && queueData?.schedule) {
          lateQueueId = queueData.schedule._id;
        }
      }
    }

    // Create the template
    const { data, error } = await supabase
      .from("scheduling_templates")
      .insert({
        user_id: user.id,
        name,
        description,
        timezone,
        slots,
        late_profile_id: lateProfileId,
        late_queue_id: lateQueueId,
        is_active: true,
        is_default: shouldBeDefault,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to create template" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template: transformDbTemplate(data),
    });
  } catch (error) {
    console.error("Error creating scheduling template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}

// PUT - Update a scheduling template
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
    const { id, name, description, timezone, slots, isActive, isDefault } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existing, error: existError } = await supabase
      .from("scheduling_templates")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (existError || !existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // If setting as default, unset others
    if (isDefault) {
      await supabase
        .from("scheduling_templates")
        .update({ is_default: false })
        .eq("user_id", user.id);
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (slots !== undefined) updateData.slots = slots;
    if (isActive !== undefined) updateData.is_active = isActive;
    if (isDefault !== undefined) updateData.is_default = isDefault;

    // Sync with Late API if connected
    if (existing.late_queue_id && existing.late_profile_id) {
      const apiKey = await getLateApiKey(supabase, user.id);
      if (apiKey) {
        await lateApiRequest("/queue/slots", apiKey, {
          method: "PUT",
          body: JSON.stringify({
            profileId: existing.late_profile_id,
            queueId: existing.late_queue_id,
            name: name || existing.name,
            timezone: timezone || existing.timezone,
            slots: slots || existing.slots,
            active: isActive !== undefined ? isActive : existing.is_active,
          }),
        });
      }
    }

    // Update the template
    const { data, error } = await supabase
      .from("scheduling_templates")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update template" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template: transformDbTemplate(data),
    });
  } catch (error) {
    console.error("Error updating scheduling template:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a scheduling template
export async function DELETE(request: NextRequest) {
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
    const templateId = searchParams.get("id");

    if (!templateId) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership and get template
    const { data: existing, error: existError } = await supabase
      .from("scheduling_templates")
      .select("*")
      .eq("id", templateId)
      .eq("user_id", user.id)
      .single();

    if (existError || !existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Delete from Late API if connected
    if (existing.late_queue_id && existing.late_profile_id) {
      const apiKey = await getLateApiKey(supabase, user.id);
      if (apiKey) {
        await lateApiRequest(
          `/queue/slots?profileId=${existing.late_profile_id}&queueId=${existing.late_queue_id}`,
          apiKey,
          { method: "DELETE" }
        );
      }
    }

    // Delete the template
    const { error } = await supabase
      .from("scheduling_templates")
      .delete()
      .eq("id", templateId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete template" },
        { status: 500 }
      );
    }

    // If deleted template was default, make another one default
    if (existing.is_default) {
      const { data: firstTemplate } = await supabase
        .from("scheduling_templates")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (firstTemplate) {
        await supabase
          .from("scheduling_templates")
          .update({ is_default: true })
          .eq("id", firstTemplate.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting scheduling template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
