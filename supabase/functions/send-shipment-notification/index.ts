import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  shipmentId: string;
  status: string;
  customerEmail?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shipmentId, status, customerEmail }: EmailRequest = await req.json();
    
    console.log(`Processing email notification for shipment ${shipmentId}, status: ${status}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get shipment details with order and customer info
    const { data: shipment, error: shipmentError } = await supabase
      .from("shipments")
      .select(`
        *,
        sales_orders!inner (
          human_uid,
          customers!inner (
            name,
            email
          )
        )
      `)
      .eq("id", shipmentId)
      .single();

    if (shipmentError || !shipment) {
      console.error("Error fetching shipment:", shipmentError);
      throw new Error("Shipment not found");
    }

    const order = shipment.sales_orders;
    const customer = order.customers;
    const recipientEmail = customerEmail || customer.email;

    if (!recipientEmail) {
      console.log("No customer email available, skipping notification");
      return new Response(
        JSON.stringify({ success: false, message: "No customer email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get SMTP configuration
    const smtpHost = Deno.env.get("SMTP_HOST");
    const envPort = parseInt(Deno.env.get("SMTP_PORT") || "0");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const effectivePort = smtpHost?.includes("protonmail") ? 465 : (envPort || 465);
    const useTls = effectivePort === 465;

    if (!smtpHost || !smtpUser || !smtpPassword) {
      throw new Error("SMTP configuration missing");
    }

    // Prepare email content based on status
    let subject = "";
    let body = "";

    if (status === "Delivered" || status === "delivered") {
      subject = `Your Order ${order.human_uid} Has Been Delivered!`;
      body = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Great news, ${customer.name}!</h2>
            <p style="font-size: 16px; color: #555;">Your order <strong>${order.human_uid}</strong> has been delivered.</p>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 8px 0;"><strong>Tracking Number:</strong> ${shipment.tracking_no}</p>
              ${shipment.carrier ? `<p style="margin: 8px 0;"><strong>Carrier:</strong> ${shipment.carrier}</p>` : ""}
              ${shipment.tracking_location ? `<p style="margin: 8px 0;"><strong>Location:</strong> ${shipment.tracking_location}</p>` : ""}
            </div>
            <p style="font-size: 16px; color: #555;">Thank you for your business!</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">This is an automated notification from Nexus Aminos.</p>
          </body>
        </html>
      `;
    } else {
      subject = `Shipment Update for Order ${order.human_uid}`;
      body = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Hello ${customer.name},</h2>
            <p style="font-size: 16px; color: #555;">Your order <strong>${order.human_uid}</strong> has a status update.</p>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 8px 0;"><strong>Status:</strong> ${status}</p>
              <p style="margin: 8px 0;"><strong>Tracking Number:</strong> ${shipment.tracking_no}</p>
              ${shipment.carrier ? `<p style="margin: 8px 0;"><strong>Carrier:</strong> ${shipment.carrier}</p>` : ""}
              ${shipment.tracking_location ? `<p style="margin: 8px 0;"><strong>Current Location:</strong> ${shipment.tracking_location}</p>` : ""}
              ${shipment.estimated_delivery ? `<p style="margin: 8px 0;"><strong>Estimated Delivery:</strong> ${new Date(shipment.estimated_delivery).toLocaleDateString()}</p>` : ""}
            </div>
            <p style="font-size: 16px; color: #555;">We'll keep you updated on your shipment's progress.</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">This is an automated notification from Nexus Aminos.</p>
          </body>
        </html>
      `;
    }

    // Send email using SMTP
    console.log(`Sending email to ${recipientEmail}`);

    // Build a clean plain-text alternative (no HTML artifacts)
    const plainText = body
      .replace(/<\/(p|div|h\d)>/gi, '\n')
      .replace(/<br\s*\/?>(\s*)/gi, '\n')
      .replace(/<li>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    try {
      const client = new SMTPClient({
        connection: {
          hostname: smtpHost,
          port: effectivePort,
          tls: useTls,
          auth: {
            username: smtpUser,
            password: smtpPassword,
          },
        },
      });

      await client.send({
        from: `Nexus Aminos <${smtpUser}>`,
        to: recipientEmail,
        subject: subject,
        content: plainText,
        html: body,
      });

      await client.close();
      console.log(`Email sent successfully to ${recipientEmail}`);
    } catch (smtpError: any) {
      console.error("SMTP Error details:", smtpError);
      throw new Error(`Failed to send email: ${smtpError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("Error in send-shipment-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
