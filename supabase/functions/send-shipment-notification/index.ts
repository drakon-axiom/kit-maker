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
    let preheader = "";

    if (status === "Delivered" || status === "delivered") {
      subject = `Your Order ${order.human_uid} Has Been Delivered!`;
      preheader = `Great news! Your order ${order.human_uid} has been delivered.`;
      body = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>${subject}</title><meta name="viewport" content="width=device-width, initial-scale=1.0" /><style type="text/css">@media only screen and (max-width: 600px) { .container { width: 100% !important; } .content { padding: 15px !important; } }</style></head><body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; color: #222222;"><div style="display: none; font-size: 1px; color: #ffffff; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">${preheader}</div><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;"><tr><td align="center" style="background: linear-gradient(135deg, #1974bb 0%, #1560a0 100%); padding: 30px 20px;"><img src="https://cdn.shopify.com/s/files/1/0622/2220/5001/files/Nexus_Aminos_Logo.png" alt="Nexus Aminos" style="max-width: 200px; height: auto;" /></td></tr><tr><td align="center" valign="top" style="padding: 30px 20px;"><table border="0" cellpadding="0" cellspacing="0" width="100%" class="container"><tr><td align="left" style="padding: 0;"><h2 style="color: #333333; margin: 0 0 16px 0; font-size: 24px;">Great news, ${customer.name}!</h2><p style="font-size: 16px; color: #555555; line-height: 1.5; margin: 0 0 20px 0;">Your order <strong>${order.human_uid}</strong> has been delivered.</p></td></tr><tr><td align="left" style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;"><p style="margin: 8px 0; font-size: 14px;"><strong>Tracking Number:</strong> ${shipment.tracking_no}</p>${shipment.carrier ? `<p style="margin: 8px 0; font-size: 14px;"><strong>Carrier:</strong> ${shipment.carrier}</p>` : ""}${shipment.tracking_location ? `<p style="margin: 8px 0; font-size: 14px;"><strong>Location:</strong> ${shipment.tracking_location}</p>` : ""}</td></tr><tr><td align="left" style="padding: 0;"><p style="font-size: 16px; color: #555555; margin: 0 0 30px 0;">Thank you for your business!</p></td></tr></table></td></tr><tr><td align="center" style="background-color: #2d3748; padding: 20px; color: #ffffff;"><p style="color: #cbd5e0; font-size: 12px; margin: 0 0 8px 0;">This is an automated notification from Nexus Aminos.</p><p style="color: #718096; font-size: 11px; margin: 0;">© ${new Date().getFullYear()} Nexus Aminos. All rights reserved.</p></td></tr></table></body></html>`;
    } else {
      subject = `Shipment Update for Order ${order.human_uid}`;
      preheader = `Your order ${order.human_uid} has a shipment update.`;
      body = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>${subject}</title><meta name="viewport" content="width=device-width, initial-scale=1.0" /><style type="text/css">@media only screen and (max-width: 600px) { .container { width: 100% !important; } .content { padding: 15px !important; } }</style></head><body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; color: #222222;"><div style="display: none; font-size: 1px; color: #ffffff; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">${preheader}</div><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;"><tr><td align="center" style="background: linear-gradient(135deg, #1974bb 0%, #1560a0 100%); padding: 30px 20px;"><img src="https://cdn.shopify.com/s/files/1/0622/2220/5001/files/Nexus_Aminos_Logo.png" alt="Nexus Aminos" style="max-width: 200px; height: auto;" /></td></tr><tr><td align="center" valign="top" style="padding: 30px 20px;"><table border="0" cellpadding="0" cellspacing="0" width="100%" class="container"><tr><td align="left" style="padding: 0;"><h2 style="color: #333333; margin: 0 0 16px 0; font-size: 24px;">Hello ${customer.name},</h2><p style="font-size: 16px; color: #555555; line-height: 1.5; margin: 0 0 20px 0;">Your order <strong>${order.human_uid}</strong> has a status update.</p></td></tr><tr><td align="left" style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;"><p style="margin: 8px 0; font-size: 14px;"><strong>Status:</strong> ${status}</p><p style="margin: 8px 0; font-size: 14px;"><strong>Tracking Number:</strong> ${shipment.tracking_no}</p>${shipment.carrier ? `<p style="margin: 8px 0; font-size: 14px;"><strong>Carrier:</strong> ${shipment.carrier}</p>` : ""}${shipment.tracking_location ? `<p style="margin: 8px 0; font-size: 14px;"><strong>Current Location:</strong> ${shipment.tracking_location}</p>` : ""}${shipment.estimated_delivery ? `<p style="margin: 8px 0; font-size: 14px;"><strong>Estimated Delivery:</strong> ${new Date(shipment.estimated_delivery).toLocaleDateString()}</p>` : ""}</td></tr><tr><td align="left" style="padding: 0;"><p style="color: #555555; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">We'll keep you updated on your shipment's progress.</p><p style="font-size: 16px; color: #555555; margin: 0 0 30px 0;">Thank you for your business!</p></td></tr></table></td></tr><tr><td align="center" style="background-color: #2d3748; padding: 20px; color: #ffffff;"><p style="color: #cbd5e0; font-size: 12px; margin: 0 0 8px 0;">This is an automated notification from Nexus Aminos.</p><p style="color: #718096; font-size: 11px; margin: 0;">© ${new Date().getFullYear()} Nexus Aminos. All rights reserved.</p></td></tr></table></body></html>`;
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
    const cleanedText = plainText.split('\n').map(l => l.replace(/\s+$/g, '')).join('\n');
    
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
