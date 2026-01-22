import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get creator earnings
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('creator_earnings')
      .select(`
        *,
        characters (id, name, thumbnail)
      `, { count: 'exact' })
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: earnings, error, count } = await query;

    if (error) {
      console.error("Error fetching earnings:", error);
      return NextResponse.json(
        { error: "Failed to fetch earnings" },
        { status: 500 }
      );
    }

    // Calculate totals
    const { data: totals } = await supabase
      .from('creator_earnings')
      .select('gross_amount, platform_fee, net_amount, status')
      .eq('creator_id', user.id);

    const summary = {
      totalGross: 0,
      totalFees: 0,
      totalNet: 0,
      pending: 0,
      available: 0,
      paidOut: 0,
    };

    (totals || []).forEach(e => {
      summary.totalGross += e.gross_amount;
      summary.totalFees += e.platform_fee;
      summary.totalNet += e.net_amount;
      if (e.status === 'pending') summary.pending += e.net_amount;
      if (e.status === 'available') summary.available += e.net_amount;
      if (e.status === 'paid_out') summary.paidOut += e.net_amount;
    });

    return NextResponse.json({
      earnings,
      summary,
      total: count || 0,
    });
  } catch (error) {
    console.error("Error fetching earnings:", error);
    return NextResponse.json(
      { error: "Failed to fetch earnings" },
      { status: 500 }
    );
  }
}
