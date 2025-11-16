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
    const authHeader = req.headers.get("authorization") || "";

    // Parse body early to detect test mode
    const body = await req.json().catch(() => ({}));
    const { orderId, newStatus, phoneNumber, eventType, testMessage } = body as any;
    const isTest = eventType === 'test';

    // Security: require internal secret for non-test events. Allow authenticated users for test.
    if (!isTest && webhookSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (!phoneNumber) {
      console.log("No phone number provided, skipping SMS");
      return new Response(JSON.stringify({ message: "No phone number" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let message = "";

    // Handle test message
    if (eventType === 'test' && testMessage) {
      message = testMessage;
    } else if (!orderId) {
      throw new Error("Order ID required for non-test messages");
    } else {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Fetch order details
      const { data: order } = await supabase
        .from("sales_orders")
        .select("human_uid, customers!inner(name, id)")
        .eq("id", orderId)
        .single();

      if (!order) {
        throw new Error("Order not found");
      }

      const customerName = (order.customers as any)?.name || "Customer";
      const customerId = (order.customers as any)?.id;

      // Get SMS template from database
      let templateType = eventType;
      if (eventType === 'shipment_update' && newStatus?.toLowerCase() === 'delivered') {
        templateType = 'shipment_delivered';
      }

      const { data: template } = await supabase
        .from("sms_templates")
        .select("message_template")
        .eq("template_type", templateType)
        .single();

      if (template) {
        // Use template and replace variables
        message = template.message_template
          .replace(/\{\{customer_name\}\}/g, customerName)
          .replace(/\{\{order_number\}\}/g, order.human_uid)
          .replace(/\{\{status\}\}/g, newStatus || '')
          .replace(/\{\{tracking_number\}\}/g, (body as any).tracking_number || '');
      } else {
        // Fallback to hardcoded messages if template not found
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
          case "custom":
            message = testMessage || `Update for order ${order.human_uid}`;
            break;
          default:
            message = `Update for order ${order.human_uid}: ${newStatus}`;
        }
      }
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

    // Log SMS send to database (only for non-test messages with order ID)
    if (!isTest && orderId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get customer ID
        const { data: order } = await supabase
          .from("sales_orders")
          .select("customer_id")
          .eq("id", orderId)
          .single();

        if (order) {
          await supabase.from("sms_logs").insert({
            customer_id: order.customer_id,
            so_id: orderId,
            phone_number: phoneNumber,
            message: message,
            template_type: eventType,
            status: "sent",
            textbelt_response: result,
          });
        }
      } catch (logError) {
        console.error("Failed to log SMS but continuing:", logError);
      }
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