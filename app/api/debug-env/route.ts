import { NextResponse } from "next/server";

// DEBUG ENDPOINT - Remove in production after debugging
// This helps verify environment variables are loaded correctly on Hostinger
export async function GET() {
  const openaiKey = process.env.OPENAI_API_KEY;
  
  const envStatus = {
    nodeEnv: process.env.NODE_ENV,
    hasOpenAIKey: !!openaiKey,
    openAIKeyPrefix: openaiKey ? openaiKey.substring(0, 10) + "..." : "NOT SET",
    openAIKeyLength: openaiKey?.length || 0,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    timestamp: new Date().toISOString(),
  };

  // Test OpenAI API key validity
  if (openaiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
      });

      if (response.ok) {
        return NextResponse.json({
          ...envStatus,
          openAIKeyValid: true,
          message: "OpenAI API key is valid and working!",
        });
      } else {
        const error = await response.json();
        return NextResponse.json({
          ...envStatus,
          openAIKeyValid: false,
          openAIError: error.error?.message || "Unknown error",
          openAIStatus: response.status,
        });
      }
    } catch (error) {
      return NextResponse.json({
        ...envStatus,
        openAIKeyValid: false,
        openAIError: error instanceof Error ? error.message : "Network error",
      });
    }
  }

  return NextResponse.json({
    ...envStatus,
    openAIKeyValid: false,
    message: "OPENAI_API_KEY is not set in environment variables",
  });
}
