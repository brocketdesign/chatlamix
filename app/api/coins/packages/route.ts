import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Promotional coin packages starting at $20
const PROMOTIONAL_PACKAGES = [
  {
    id: "starter-20",
    name: "Starter Pack",
    coins: 200,
    price_usd: 20.00,
    original_price_usd: 25.00,
    bonus_percentage: 20,
    bonus_coins: 40,
    is_popular: false,
    is_active: true,
    sort_order: 1,
    promotion_label: "20% OFF",
    promotion_ends: "2026-02-28",
  },
  {
    id: "value-50",
    name: "Value Pack",
    coins: 550,
    price_usd: 50.00,
    original_price_usd: 65.00,
    bonus_percentage: 30,
    bonus_coins: 165,
    is_popular: true,
    is_active: true,
    sort_order: 2,
    promotion_label: "BEST VALUE",
    promotion_ends: null,
  },
  {
    id: "pro-100",
    name: "Pro Pack",
    coins: 1200,
    price_usd: 100.00,
    original_price_usd: 140.00,
    bonus_percentage: 40,
    bonus_coins: 480,
    is_popular: false,
    is_active: true,
    sort_order: 3,
    promotion_label: "40% BONUS",
    promotion_ends: "2026-02-28",
  },
  {
    id: "ultimate-200",
    name: "Ultimate Pack",
    coins: 2600,
    price_usd: 200.00,
    original_price_usd: 300.00,
    bonus_percentage: 50,
    bonus_coins: 1300,
    is_popular: false,
    is_active: true,
    sort_order: 4,
    promotion_label: "50% BONUS",
    promotion_ends: "2026-02-28",
  },
];

// Auto-recharge packages (minimum $19.99)
const AUTO_RECHARGE_PACKAGES = PROMOTIONAL_PACKAGES.filter(pkg => pkg.price_usd >= 19.99);

// Normalize database package to match frontend expected format
function normalizePackage(dbPkg: Record<string, unknown>) {
  return {
    id: dbPkg.id,
    name: dbPkg.name,
    coins: dbPkg.coin_amount ?? dbPkg.coins ?? 0,
    price_usd: Number(dbPkg.price_usd ?? dbPkg.price ?? 0),
    original_price_usd: dbPkg.original_price_usd,
    bonus_percentage: dbPkg.bonus_percentage ?? 0,
    bonus_coins: dbPkg.bonus_coins ?? 0,
    is_popular: dbPkg.is_popular ?? false,
    is_active: dbPkg.is_active ?? true,
    sort_order: dbPkg.sort_order ?? 0,
    promotion_label: dbPkg.promotion_label,
    promotion_ends: dbPkg.promotion_ends,
  };
}

// GET - Get available coin packages
export async function GET() {
  try {
    const supabase = await createClient();

    // Try to get packages from database first
    const { data: dbPackages, error } = await supabase
      .from('coin_packages')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    // If database has packages, normalize and use them
    if (!error && dbPackages && dbPackages.length > 0) {
      const normalizedPackages = dbPackages.map(normalizePackage);
      return NextResponse.json({ 
        packages: normalizedPackages,
        autoRechargePackages: normalizedPackages.filter((pkg) => pkg.price_usd >= 19.99),
      });
    }

    // Otherwise return promotional packages
    return NextResponse.json({ 
      packages: PROMOTIONAL_PACKAGES,
      autoRechargePackages: AUTO_RECHARGE_PACKAGES,
    });
  } catch (error) {
    console.error("Error fetching packages:", error);
    // Return promotional packages as fallback
    return NextResponse.json({ 
      packages: PROMOTIONAL_PACKAGES,
      autoRechargePackages: AUTO_RECHARGE_PACKAGES,
    });
  }
}
