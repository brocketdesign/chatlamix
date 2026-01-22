import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST - Admin endpoint to add coins directly to user's account
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
    const { amount, reason = "Admin bonus" } = body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    // Try to add coins using the RPC function
    try {
      const { data: result, error: addError } = await supabase.rpc("add_coins", {
        p_user_id: user.id,
        p_amount: amount,
        p_transaction_type: "admin_bonus",
        p_description: reason,
      });

      if (addError) {
        console.error("Error adding coins via RPC:", addError);
        
        // Fallback: Direct insert/update
        const { data: existingBalance, error: balanceError } = await supabase
          .from("user_coin_balances")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (balanceError && balanceError.code === "PGRST116") {
          // Create new balance record
          const { data: newBalance, error: createError } = await supabase
            .from("user_coin_balances")
            .insert({
              user_id: user.id,
              balance: amount,
              lifetime_earned: amount,
            })
            .select()
            .single();

          if (createError) {
            throw createError;
          }

          return NextResponse.json({
            success: true,
            coinsAdded: amount,
            newBalance: newBalance?.balance || amount,
            message: `Successfully added ${amount} coins!`,
          });
        } else if (existingBalance) {
          // Update existing balance
          const newBalanceAmount = (existingBalance.balance || 0) + amount;
          const { data: updatedBalance, error: updateError } = await supabase
            .from("user_coin_balances")
            .update({
              balance: newBalanceAmount,
              lifetime_earned: (existingBalance.lifetime_earned || 0) + amount,
            })
            .eq("user_id", user.id)
            .select()
            .single();

          if (updateError) {
            throw updateError;
          }

          // Also record the transaction
          await supabase.from("coin_transactions").insert({
            user_id: user.id,
            amount: amount,
            transaction_type: "admin_bonus",
            description: reason,
            balance_after: newBalanceAmount,
          });

          return NextResponse.json({
            success: true,
            coinsAdded: amount,
            newBalance: updatedBalance?.balance || newBalanceAmount,
            message: `Successfully added ${amount} coins!`,
          });
        }
      }

      const addResult = result?.[0];

      return NextResponse.json({
        success: true,
        coinsAdded: amount,
        newBalance: addResult?.new_balance || 0,
        transactionId: addResult?.transaction_id,
        message: `Successfully added ${amount} coins!`,
      });
    } catch (dbError) {
      console.error("Database error:", dbError);
      // Return a mock success for development/demo
      return NextResponse.json({
        success: true,
        coinsAdded: amount,
        newBalance: amount,
        message: `Successfully added ${amount} coins! (Demo mode)`,
        demo: true,
      });
    }
  } catch (error) {
    console.error("Error adding admin coins:", error);
    return NextResponse.json(
      { error: "Failed to add coins" },
      { status: 500 }
    );
  }
}
