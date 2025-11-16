import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    console.error("Missing signature or webhook secret");
    return new Response("Webhook signature or secret missing", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );

    console.log(`Received event: ${event.type}`);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { orderId, paymentType } = session.metadata || {};

      if (!orderId || !paymentType) {
        console.error("Missing metadata in checkout session");
        return new Response("Missing metadata", { status: 400 });
      }

      console.log(`Processing ${paymentType} payment for order ${orderId}`);

      if (paymentType === "deposit") {
        // Update deposit status
        const { error } = await supabaseClient
          .from("sales_orders")
          .update({
            deposit_status: "paid",
            manual_payment_notes: `Stripe payment completed: ${session.payment_intent}`,
          })
          .eq("id", orderId);

        if (error) {
          console.error("Error updating deposit status:", error);
          throw error;
        }

        console.log(`Deposit marked as paid for order ${orderId}`);

        // Log to audit
        await supabaseClient.from("audit_log").insert({
          entity: "sales_order",
          entity_id: orderId,
          action: "deposit_paid",
          after: {
            deposit_status: "paid",
            payment_intent: session.payment_intent,
            amount: session.amount_total ? session.amount_total / 100 : 0,
          },
        });
      } else if (paymentType === "final") {
        // Create or update invoice to paid status
        const { data: existingInvoice } = await supabaseClient
          .from("invoices")
          .select("id")
          .eq("so_id", orderId)
          .eq("type", "final")
          .single();

        if (existingInvoice) {
          await supabaseClient
            .from("invoices")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
            })
            .eq("id", existingInvoice.id);

          console.log(`Invoice marked as paid for order ${orderId}`);
        }

        // Update order manual payment notes
        await supabaseClient
          .from("sales_orders")
          .update({
            manual_payment_notes: `Stripe payment completed: ${session.payment_intent}`,
          })
          .eq("id", orderId);

        // Log to audit
        await supabaseClient.from("audit_log").insert({
          entity: "sales_order",
          entity_id: orderId,
          action: "final_payment_paid",
          after: {
            payment_intent: session.payment_intent,
            amount: session.amount_total ? session.amount_total / 100 : 0,
          },
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
    });
  }
});
