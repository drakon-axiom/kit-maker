import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Security: Restrict CORS to known application domains
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map(o => o.trim()).filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] || "");
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cashapp-signature",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const isManualConfirmation = url.searchParams.get("manual") === "true";

    // Initialize Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Handle manual payment confirmation from customer
    if (isManualConfirmation) {
      console.log("Processing manual CashApp payment confirmation");
      
      const body = await req.json();
      const { orderId, paymentType, amount, cashappName, notes } = body;

      if (!orderId || !paymentType || !amount) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch order details
      const { data: order, error: orderError } = await supabaseClient
        .from("sales_orders")
        .select("*, customers(email, name)")
        .eq("id", orderId)
        .single();

      if (orderError || !order) {
        console.error("Order not found:", orderError);
        return new Response(JSON.stringify({ error: "Order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert payment transaction record as "pending_verification"
      const { data: txData, error: txError } = await supabaseClient
        .from("payment_transactions")
        .insert({
          so_id: orderId,
          amount: amount,
          payment_method: "cashapp",
          payment_type: paymentType,
          status: "pending_verification",
          customer_email: order.customers?.email || "unknown",
          metadata: {
            cashapp_name: cashappName,
            customer_notes: notes,
            customer_name: order.customers?.name,
            order_number: order.human_uid,
            submitted_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (txError) {
        console.error("Error inserting payment transaction:", txError);
        return new Response(JSON.stringify({ error: "Failed to record payment notification" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log to audit trail
      await supabaseClient.from("audit_log").insert({
        entity: "payment",
        entity_id: orderId,
        action: "cashapp_payment_submitted",
        after: {
          amount,
          payment_type: paymentType,
          cashapp_name: cashappName,
          notes,
          transaction_id: txData?.id,
        },
      });

      console.log(`CashApp payment notification submitted for order ${orderId}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Payment notification received. We'll verify and update your order shortly.",
          transactionId: txData?.id 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle webhook from CashApp Business (signature verification)
    const signature = req.headers.get("x-cashapp-signature");
    const webhookSecret = Deno.env.get("CASHAPP_WEBHOOK_SECRET");

    // Security: Fail-closed — reject if webhook secret is not configured
    if (!webhookSecret) {
      console.error("CASHAPP_WEBHOOK_SECRET is not configured");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!signature) {
      console.error("No signature provided");
      return new Response(JSON.stringify({ error: "No signature provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.text();

    // Verify webhook signature
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Security: Wrap base64 decoding in try/catch
    let signatureBuffer: Uint8Array;
    try {
      signatureBuffer = Uint8Array.from(
        atob(signature),
        (c) => c.charCodeAt(0)
      );
    } catch {
      return new Response(JSON.stringify({ error: "Invalid signature format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBuffer,
      data
    );

    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(payload);
    console.log("CashApp webhook event received:", event.type);

    // Handle payment completion event
    if (event.type === "payment.completed") {
      const payment = event.data;
      const orderId = payment.metadata?.orderId;
      const paymentType = payment.metadata?.paymentType; // 'deposit' or 'final'
      const amount = payment.amount;

      console.log(`Processing ${paymentType} payment for order ${orderId}, amount: $${amount}`);

      // Fetch order details
      const { data: order, error: orderError } = await supabaseClient
        .from("sales_orders")
        .select("*, customers(email, name)")
        .eq("id", orderId)
        .single();

      if (orderError || !order) {
        console.error("Order not found:", orderError);
        return new Response(JSON.stringify({ error: "Order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Security: Idempotency check — skip if this payment was already recorded
      const { data: existingTx } = await supabaseClient
        .from("payment_transactions")
        .select("id")
        .eq("so_id", orderId)
        .eq("payment_method", "cashapp")
        .eq("metadata->>cashapp_payment_id", payment.id)
        .maybeSingle();

      if (existingTx) {
        console.log(`CashApp payment ${payment.id} already processed, skipping`);
        return new Response(
          JSON.stringify({ received: true, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Insert payment transaction record
      const { error: txError } = await supabaseClient
        .from("payment_transactions")
        .insert({
          so_id: orderId,
          amount: amount,
          payment_method: "cashapp",
          payment_type: paymentType,
          status: "completed",
          customer_email: order.customers?.email || "unknown",
          metadata: {
            cashapp_payment_id: payment.id,
            customer_name: order.customers?.name,
            order_number: order.human_uid,
          },
        });

      if (txError) {
        console.error("Error inserting payment transaction:", txError);
      }

      // Update invoice status based on payment type
      if (paymentType === "deposit") {
        const { data: invoice } = await supabaseClient
          .from("invoices")
          .select("id")
          .eq("so_id", orderId)
          .eq("type", "deposit")
          .single();

        if (invoice) {
          await supabaseClient
            .from("invoices")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
            })
            .eq("id", invoice.id);

          // Update order deposit status
          await supabaseClient
            .from("sales_orders")
            .update({ deposit_status: "paid" })
            .eq("id", orderId);
        }
      } else if (paymentType === "final") {
        const { data: invoice } = await supabaseClient
          .from("invoices")
          .select("id")
          .eq("so_id", orderId)
          .eq("type", "final")
          .single();

        if (invoice) {
          await supabaseClient
            .from("invoices")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
            })
            .eq("id", invoice.id);
        }
      }

      // Log to audit trail
      await supabaseClient.from("audit_log").insert({
        entity: "payment",
        entity_id: orderId,
        action: "cashapp_payment_received",
        after: {
          amount,
          payment_type: paymentType,
          payment_id: payment.id,
        },
      });

      console.log(`CashApp ${paymentType} payment processed successfully for order ${orderId}`);

      return new Response(
        JSON.stringify({ received: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing CashApp webhook:", error);
    // Security: Generic error message
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
