import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cashapp-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("x-cashapp-signature");
    const webhookSecret = Deno.env.get("CASHAPP_WEBHOOK_SECRET");

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
    
    const signatureBuffer = Uint8Array.from(
      atob(signature),
      (c) => c.charCodeAt(0)
    );
    
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

      // Initialize Supabase client with service role key
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

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

      // Insert payment transaction record
      const { error: txError } = await supabaseClient
        .from("payment_transactions")
        .insert({
          so_id: orderId,
          amount: amount,
          payment_method: "cashapp",
          payment_type: paymentType,
          status: "completed",
          customer_email: order.customers.email,
          metadata: {
            cashapp_payment_id: payment.id,
            customer_name: order.customers.name,
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
