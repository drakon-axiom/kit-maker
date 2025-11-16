import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TEXTBELT_API_KEY = Deno.env.get("TEXTBELT_API_KEY");
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("INTERNAL_WEBHOOK_SECRET");

    if (webhookSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderId, newStatus, phoneNumber, eventType } = await req.json();

    if (!phoneNumber) {
      console.log("No phone number provided, skipping SMS");
      return new Response(JSON.stringify({ message: "No phone number" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch order details
    const { data: order } = await supabase
      .from("sales_orders")
      .select("human_uid, customers!inner(name)")
      .eq("id", orderId)
      .single();

    if (!order) {
      throw new Error("Order not found");
    }

    const customerName = (order.customers as any)?.name || "Customer";

    // Build message based on event type
    let message = "";
    switch (eventType) {
      case "order_status":
        message = `Hi ${customerName}, your order ${order.human_uid} status is now: ${newStatus}`;
        break;
      case "quote_approved":
        message = `Hi ${customerName}, your quote ${order.human_uid} has been approved!`;
        break;
      case "shipment_update":
        message = `Hi ${customerName}, your order ${order.human_uid} has shipped!`;
        break;
      case "payment_received":
        message = `Hi ${customerName}, payment received for order ${order.human_uid}. Thank you!`;
        break;
      default:
        message = `Update for order ${order.human_uid}: ${newStatus}`;
    }

    // Send SMS via Textbelt
    const textbeltResponse = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: phoneNumber,
        message: message,
        key: TEXTBELT_API_KEY,
      }),
    });

    const result = await textbeltResponse.json();
    console.log("Textbelt response:", result);

    if (!result.success) {
      throw new Error(`SMS failed: ${result.error || "Unknown error"}`);
    }

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending SMS:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});