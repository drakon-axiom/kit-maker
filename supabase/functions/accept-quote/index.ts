import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");

    if (!orderId) {
      throw new Error("Order ID is required");
    }

    console.log("Accepting quote for order:", orderId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .select(`
        *,
        customer:customers (
          name,
          email
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order fetch error:", orderError);
      throw new Error("Order not found");
    }

    // Check if order is in correct status
    if (order.status !== "quoted") {
      throw new Error("Order is not in quoted status");
    }

    // Update order status to deposit_due
    const { error: updateError } = await supabase
      .from("sales_orders")
      .update({ 
        status: "deposit_due",
        deposit_status: "unpaid"
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Error updating order status:", updateError);
      throw new Error("Failed to update order status");
    }

    console.log("Order status updated to deposit_due");

    // TODO: Create Stripe payment link
    // This is a placeholder for now
    const paymentLink = await createStripePaymentLink(order);
    
    console.log("Payment link created (placeholder):", paymentLink);

    // Redirect to payment link or success page
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": paymentLink,
      },
    });

  } catch (error: any) {
    console.error("Error accepting quote:", error);
    
    // Return HTML error page for better user experience
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .error-container {
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              max-width: 500px;
              text-align: center;
            }
            h1 {
              color: #dc3545;
              margin-bottom: 16px;
            }
            p {
              color: #666;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>⚠️ Error</h1>
            <p>${error.message}</p>
            <p style="margin-top: 24px;">
              <a href="/" style="color: #007bff; text-decoration: none;">Return to Home</a>
            </p>
          </div>
        </body>
      </html>
    `;

    return new Response(errorHtml, {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "text/html" 
      },
      status: 400,
    });
  }
});

// Placeholder function for Stripe payment link creation
async function createStripePaymentLink(order: any): Promise<string> {
  // TODO: Implement Stripe integration
  // This would:
  // 1. Create a Stripe payment intent or checkout session
  // 2. Set the amount to order.deposit_amount
  // 3. Return the Stripe checkout URL
  
  console.log("Creating Stripe payment link for:", {
    orderId: order.id,
    amount: order.deposit_amount,
    customerEmail: order.customer?.email,
  });

  // For now, return a placeholder success page
  const successUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/accept-quote/success?orderId=${order.id}`;
  
  return successUrl;
}
