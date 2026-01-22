import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

// Initialize Stripe if configured
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// POST - Sync premium plans with Stripe (creates products and prices)
export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get all active premium plans
    const { data: plans, error: plansError } = await supabase
      .from("premium_plans")
      .select("*")
      .eq("is_active", true);

    if (plansError || !plans) {
      return NextResponse.json(
        { error: "Failed to fetch plans" },
        { status: 500 }
      );
    }

    const results = [];

    for (const plan of plans) {
      try {
        let productId = plan.stripe_product_id;
        let monthlyPriceId = plan.stripe_monthly_price_id;
        let yearlyPriceId = plan.stripe_yearly_price_id;
        const updates: Record<string, string> = {};

        // Create or update Stripe product
        if (!productId) {
          const product = await stripe.products.create({
            name: plan.display_name,
            description: plan.description || `${plan.display_name} subscription plan`,
            metadata: {
              plan_id: plan.id,
              plan_name: plan.name,
            },
          });
          productId = product.id;
          updates.stripe_product_id = productId;
        } else {
          // Update existing product
          await stripe.products.update(productId, {
            name: plan.display_name,
            description: plan.description || `${plan.display_name} subscription plan`,
          });
        }

        // Create monthly price if not exists
        if (!monthlyPriceId) {
          const monthlyPrice = await stripe.prices.create({
            product: productId,
            unit_amount: Math.round(plan.price_monthly * 100),
            currency: "usd",
            recurring: {
              interval: "month",
            },
            metadata: {
              plan_id: plan.id,
              billing_cycle: "monthly",
            },
          });
          monthlyPriceId = monthlyPrice.id;
          updates.stripe_monthly_price_id = monthlyPriceId;
        }

        // Create yearly price if plan has yearly pricing
        if (plan.price_yearly && !yearlyPriceId) {
          const yearlyPrice = await stripe.prices.create({
            product: productId,
            unit_amount: Math.round(plan.price_yearly * 100),
            currency: "usd",
            recurring: {
              interval: "year",
            },
            metadata: {
              plan_id: plan.id,
              billing_cycle: "yearly",
            },
          });
          yearlyPriceId = yearlyPrice.id;
          updates.stripe_yearly_price_id = yearlyPriceId;
        }

        // Update database with new Stripe IDs
        if (Object.keys(updates).length > 0) {
          await supabase
            .from("premium_plans")
            .update(updates)
            .eq("id", plan.id);
        }

        results.push({
          plan_id: plan.id,
          plan_name: plan.name,
          stripe_product_id: productId,
          stripe_monthly_price_id: monthlyPriceId,
          stripe_yearly_price_id: yearlyPriceId,
          status: "synced",
        });
      } catch (error) {
        console.error(`Error syncing plan ${plan.name}:`, error);
        results.push({
          plan_id: plan.id,
          plan_name: plan.name,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${results.filter((r) => r.status === "synced").length} plans with Stripe`,
      results,
    });
  } catch (error) {
    console.error("Error syncing plans with Stripe:", error);
    return NextResponse.json(
      { error: "Failed to sync plans with Stripe" },
      { status: 500 }
    );
  }
}

// GET - Get Stripe sync status for all plans
export async function GET() {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe not configured", configured: false },
        { status: 200 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { data: plans, error } = await supabase
      .from("premium_plans")
      .select("id, name, display_name, price_monthly, price_yearly, stripe_product_id, stripe_monthly_price_id, stripe_yearly_price_id, is_active")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch plans" },
        { status: 500 }
      );
    }

    const syncStatus = plans?.map((plan) => ({
      ...plan,
      stripe_synced: !!(plan.stripe_product_id && plan.stripe_monthly_price_id),
      needs_yearly_price: !!(plan.price_yearly && !plan.stripe_yearly_price_id),
    }));

    return NextResponse.json({
      configured: true,
      plans: syncStatus,
    });
  } catch (error) {
    console.error("Error checking Stripe sync status:", error);
    return NextResponse.json(
      { error: "Failed to check sync status" },
      { status: 500 }
    );
  }
}
