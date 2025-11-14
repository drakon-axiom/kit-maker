import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

    // Check if quote has expired
    if (order.quote_expires_at) {
      const expiresAt = new Date(order.quote_expires_at);
      const now = new Date();
      
      if (expiresAt < now) {
        throw new Error("This quote has expired. Please contact us to request a new quote.");
      }
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

    // Send email notification to admin team
    await sendAdminNotification(supabase, order);

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

// Send email notification to admin team
async function sendAdminNotification(supabase: any, order: any): Promise<void> {
  try {
    // Fetch company settings
    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["company_name", "company_email"]);
    
    const settingsMap: Record<string, string> = {};
    settings?.forEach((s: any) => {
      settingsMap[s.key] = s.value;
    });

    const companyEmail = settingsMap.company_email || "admin@company.com";
    const companyName = settingsMap.company_name || "Company";

    // Setup SMTP client
    const smtpHost = Deno.env.get("SMTP_HOST")!;
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER")!;
    const smtpPassword = Deno.env.get("SMTP_PASSWORD")!;
    
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Quote Approved</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #28a745; margin: 0 0 10px 0;">✅ Quote Approved</h1>
            <p style="margin: 0; color: #666;">A customer has approved their quote</p>
          </div>
          
          <div style="background: white; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
            <h2 style="margin-top: 0; color: #333;">Order Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #666;">Order Number:</td>
                <td style="padding: 8px 0;">${order.human_uid}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #666;">Customer:</td>
                <td style="padding: 8px 0;">${order.customer.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #666;">Email:</td>
                <td style="padding: 8px 0;">${order.customer.email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #666;">Order Total:</td>
                <td style="padding: 8px 0; font-weight: 600; color: #28a745;">$${order.subtotal.toFixed(2)}</td>
              </tr>
              ${order.deposit_required && order.deposit_amount > 0 ? `
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #666;">Deposit Due:</td>
                <td style="padding: 8px 0; font-weight: 600; color: #ffc107;">$${order.deposit_amount.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #666;">Status:</td>
                <td style="padding: 8px 0;"><span style="background: #ffc107; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">DEPOSIT DUE</span></td>
              </tr>
            </table>
            
            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #dee2e6;">
              <p style="margin: 0 0 16px 0; color: #666;">
                ${order.deposit_required ? 'The customer will complete their deposit payment shortly.' : 'This order is ready to be processed.'}
              </p>
              <a href="${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app')}/orders/${order.id}" 
                 style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                View Order Details
              </a>
            </div>
          </div>
          
          <div style="margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 8px; text-align: center; color: #666; font-size: 12px;">
            <p style="margin: 0;">This is an automated notification from ${companyName}</p>
          </div>
        </body>
      </html>
    `;

    await client.send({
      from: `${companyName} <${smtpUser}>`,
      to: companyEmail,
      subject: `Quote Approved - Order ${order.human_uid}`,
      html: emailHtml,
    });

    await client.close();
    console.log("Admin notification sent to:", companyEmail);
  } catch (error) {
    console.error("Error sending admin notification:", error);
    // Don't throw - we don't want to fail the quote acceptance if email fails
  }
}

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
