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

      // Get order details for email
      const { data: orderData } = await supabaseClient
        .from("sales_orders")
        .select(`
          human_uid,
          customer_id,
          customers!inner (
            email
          )
        `)
        .eq("id", orderId)
        .single();

      const customers = orderData?.customers as any;
      const customerEmail = Array.isArray(customers) ? customers[0]?.email : customers?.email;
      const orderNumber = orderData?.human_uid;
      const amountPaid = session.amount_total ? session.amount_total / 100 : 0;

      // Security: Idempotency check — skip if this payment intent was already recorded
      const paymentIntentId = session.payment_intent as string;
      const { data: existingTx } = await supabaseClient
        .from("payment_transactions")
        .select("id")
        .eq("stripe_payment_intent", paymentIntentId)
        .maybeSingle();

      if (existingTx) {
        console.log(`Payment intent ${paymentIntentId} already processed, skipping`);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Save payment transaction
      await supabaseClient.from("payment_transactions").insert({
        so_id: orderId,
        payment_type: paymentType,
        amount: amountPaid,
        payment_method: "stripe",
        stripe_payment_intent: paymentIntentId,
        stripe_session_id: session.id,
        customer_email: customerEmail,
        metadata: {
          session_id: session.id,
          customer_details: session.customer_details,
        },
      });

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

      // Send payment confirmation email
      if (customerEmail && orderNumber) {
        try {
          await supabaseClient.functions.invoke("send-payment-confirmation", {
            body: {
              orderId,
              orderNumber,
              paymentType,
              amount: amountPaid,
              customerEmail,
              paymentIntent: session.payment_intent,
            },
          });
          console.log(`Payment confirmation email queued for ${customerEmail}`);
        } catch (emailError) {
          console.error("Error sending payment confirmation email:", emailError);
          // Don't fail the webhook if email fails
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    // Security: Generic error message
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 400,
    });
  }
});
