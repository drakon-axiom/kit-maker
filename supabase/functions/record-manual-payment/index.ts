import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  orderNumber: string;
  amount: number;
  paymentType: "deposit" | "final";
  notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (!roles || !roles.some(r => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderNumber, amount, paymentType, notes }: PaymentRequest = await req.json();

    // Validate input
    if (!orderNumber || !amount || !paymentType) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: "Amount must be greater than 0" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create service role client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Look up order by human_uid (order number)
    const { data: order, error: orderError } = await supabaseAdmin
      .from("sales_orders")
      .select("*, customers(email, name)")
      .eq("human_uid", orderNumber)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the invoice for this payment type
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("so_id", order.id)
      .eq("type", paymentType)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: `No ${paymentType} invoice found for this order` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate amount doesn't exceed invoice total
    if (amount > invoice.total) {
      return new Response(
        JSON.stringify({ 
          error: `Amount exceeds ${paymentType} invoice total of $${invoice.total}`,
          invoiceTotal: invoice.total
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert payment transaction record
    const { error: txError } = await supabaseAdmin
      .from("payment_transactions")
      .insert({
        so_id: order.id,
        amount: amount,
        payment_method: "cashapp",
        payment_type: paymentType,
        status: "completed",
        customer_email: order.customers.email,
        metadata: {
          manual_entry: true,
          recorded_by: user.id,
          customer_name: order.customers.name,
          order_number: order.human_uid,
          notes: notes || null,
        },
      });

    if (txError) {
      console.error("Error inserting payment transaction:", txError);
      return new Response(JSON.stringify({ error: "Failed to record payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update invoice status if amount matches total
    if (amount >= invoice.total) {
      await supabaseAdmin
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      // Update order deposit status if this is a deposit payment
      if (paymentType === "deposit") {
        await supabaseAdmin
          .from("sales_orders")
          .update({ deposit_status: "paid" })
          .eq("id", order.id);
      }
    } else {
      // Partial payment
      if (paymentType === "deposit") {
        await supabaseAdmin
          .from("sales_orders")
          .update({ deposit_status: "partial" })
          .eq("id", order.id);
      }
    }

    // Log to audit trail
    await supabaseAdmin.from("audit_log").insert({
      entity: "payment",
      entity_id: order.id,
      action: "manual_cashapp_payment_recorded",
      after: {
        amount,
        payment_type: paymentType,
        recorded_by: user.id,
        notes: notes || null,
      },
    });

    console.log(`Manual CashApp ${paymentType} payment recorded for order ${orderNumber}, amount: $${amount}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        orderId: order.id,
        orderNumber: order.human_uid,
        amount,
        paymentType,
        invoiceStatus: amount >= invoice.total ? "paid" : "partial"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing manual payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
