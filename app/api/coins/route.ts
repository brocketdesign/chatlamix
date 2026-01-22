import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get user's coin balance and transaction history
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
    const includeTransactions = searchParams.get('transactions') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Try to get or create coin balance
    let balance = null;
    try {
      const { data: existingBalance, error: balanceError } = await supabase
        .from('user_coin_balances')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (balanceError && balanceError.code === 'PGRST116') {
        // Create initial balance if doesn't exist
        const { data: newBalance } = await supabase
          .from('user_coin_balances')
          .insert({
            user_id: user.id,
            balance: 0,
          })
          .select()
          .single();

        balance = newBalance;
      } else if (!balanceError) {
        balance = existingBalance;
      }
    } catch {
      // Table might not exist yet - return default
      console.log("Coin balance table not available yet");
      balance = { balance: 0, lifetime_earned: 0, lifetime_spent: 0 };
    }

    const response: {
      balance: typeof balance;
      transactions?: unknown[];
      totalTransactions?: number;
    } = { balance: balance || { balance: 0, lifetime_earned: 0, lifetime_spent: 0 } };

    if (includeTransactions) {
      try {
        const { data: transactions, error: txError, count } = await supabase
          .from('coin_transactions')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (!txError) {
          response.transactions = transactions;
          response.totalTransactions = count || 0;
        }
      } catch {
        console.log("Coin transactions table not available yet");
        response.transactions = [];
        response.totalTransactions = 0;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching coin balance:", error);
    // Return safe default instead of error
    return NextResponse.json({
      balance: { balance: 0, lifetime_earned: 0, lifetime_spent: 0 },
      transactions: [],
      totalTransactions: 0,
    });
  }
}

// POST - Purchase coins
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { packageId } = body;

    if (!packageId) {
      return NextResponse.json(
        { error: "Package ID required" },
        { status: 400 }
      );
    }

    // Get the package
    const { data: pkg, error: pkgError } = await supabase
      .from('coin_packages')
      .select('*')
      .eq('id', packageId)
      .eq('is_active', true)
      .single();

    if (pkgError || !pkg) {
      return NextResponse.json(
        { error: "Invalid package" },
        { status: 400 }
      );
    }

    // In a real implementation, you would:
    // 1. Create a Stripe payment intent
    // 2. Process the payment
    // 3. Only add coins after successful payment
    
    // For now, simulate successful purchase
    const totalCoins = pkg.coin_amount + pkg.bonus_coins;
    
    const { data: result, error: addError } = await supabase
      .rpc('add_coins', {
        p_user_id: user.id,
        p_amount: totalCoins,
        p_transaction_type: 'purchase',
        p_reference_type: 'coin_package',
        p_reference_id: packageId,
        p_description: `Purchased ${pkg.name} - ${pkg.coin_amount} coins${pkg.bonus_coins > 0 ? ` + ${pkg.bonus_coins} bonus` : ''}`,
      });

    if (addError) {
      console.error("Error adding coins:", addError);
      return NextResponse.json(
        { error: "Failed to add coins" },
        { status: 500 }
      );
    }

    const addResult = result?.[0];

    return NextResponse.json({
      success: true,
      coinsAdded: totalCoins,
      newBalance: addResult?.new_balance || 0,
      transactionId: addResult?.transaction_id,
      message: `Successfully purchased ${totalCoins} coins!`,
    });
  } catch (error) {
    console.error("Error purchasing coins:", error);
    return NextResponse.json(
      { error: "Failed to purchase coins" },
      { status: 500 }
    );
  }
}

// PATCH - Update auto-recharge settings
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { enabled, threshold, amount } = body;

    const updateData: Record<string, unknown> = {};
    if (typeof enabled === 'boolean') updateData.auto_recharge_enabled = enabled;
    if (typeof threshold === 'number') updateData.auto_recharge_threshold = threshold;
    if (typeof amount === 'number') updateData.auto_recharge_amount = amount;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid update fields provided" },
        { status: 400 }
      );
    }

    const { data: balance, error } = await supabase
      .from('user_coin_balances')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating auto-recharge:", error);
      return NextResponse.json(
        { error: "Failed to update auto-recharge settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      balance,
      message: "Auto-recharge settings updated",
    });
  } catch (error) {
    console.error("Error updating auto-recharge:", error);
    return NextResponse.json(
      { error: "Failed to update auto-recharge settings" },
      { status: 500 }
    );
  }
}
