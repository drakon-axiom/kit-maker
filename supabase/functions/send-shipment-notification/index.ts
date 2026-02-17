import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Security: Restrict CORS to known application domains
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map(o => o.trim()).filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] || "");
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  };
}

// Validation schema
const EmailRequestSchema = z.object({
  shipmentId: z.string().uuid("Invalid shipment ID format"),
  status: z.string().min(1, "Status is required"),
  customerEmail: z.string().email("Invalid email format").optional(),
});

type EmailRequest = z.infer<typeof EmailRequestSchema>;

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

// Helper function to get SMTP config: brand-specific first, then global fallback
async function getSmtpConfig(supabase: any, brandId?: string | null): Promise<SmtpConfig | null> {
  // Try brand-specific SMTP first
  if (brandId) {
    const { data: brand } = await supabase
      .from('brands')
      .select('smtp_host, smtp_port, smtp_user, smtp_password')
      .eq('id', brandId)
      .single();

    if (brand?.smtp_host && brand?.smtp_user && brand?.smtp_password) {
      console.log('Using brand-specific SMTP configuration');
      return {
        host: brand.smtp_host,
        port: brand.smtp_port || 465,
        user: brand.smtp_user,
        password: brand.smtp_password,
      };
    }
  }

  // Fallback to global SMTP from environment variables
  const smtpHost = Deno.env.get('SMTP_HOST');
  const smtpUser = Deno.env.get('SMTP_USER');
  const smtpPassword = Deno.env.get('SMTP_PASSWORD');

  if (smtpHost && smtpUser && smtpPassword) {
    console.log('Using global SMTP configuration');
    return {
      host: smtpHost,
      port: parseInt(Deno.env.get('SMTP_PORT') || '465'),
      user: smtpUser,
      password: smtpPassword,
    };
  }

  return null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook secret
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("INTERNAL_WEBHOOK_SECRET");
    
    if (webhookSecret !== expectedSecret) {
      console.error("Invalid or missing webhook secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawBody = await req.json();
    
    // Validate input
    const validationResult = EmailRequestSchema.safeParse(rawBody);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid request data", details: validationResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { shipmentId, status, customerEmail }: EmailRequest = validationResult.data;
    
    console.log(`Processing email notification for shipment ${shipmentId}, status: ${status}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get shipment details with order and customer info (include brand_id)
    const { data: shipment, error: shipmentError } = await supabase
      .from("shipments")
      .select(`
        *,
        sales_orders!inner (
          human_uid,
          brand_id,
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

    // Get SMTP configuration (brand-specific or global fallback)
    const smtpConfig = await getSmtpConfig(supabase, order.brand_id);

    if (!smtpConfig) {
      throw new Error("SMTP configuration missing");
    }

    const effectivePort = smtpConfig.host.includes("protonmail") ? 465 : smtpConfig.port;
    const useTls = effectivePort === 465;

    // Prepare email content based on status
    let subject = "";
    let body = "";
    let preheader = "";

    const buildEmailTemplate = (isDelivered: boolean) => {
      const mainTitle = isDelivered ? 'DELIVERY CONFIRMED' : 'SHIPMENT UPDATE';
      const greeting = isDelivered ? `Great news, ${customer.name}!` : `Hello ${customer.name},`;
      const mainMessage = isDelivered 
        ? `Your order <strong>${order.human_uid}</strong> has been delivered.`
        : `Your order <strong>${order.human_uid}</strong> has a shipment status update.`;
      
      return `<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${subject}</title>
<link href="https://fonts.googleapis.com/css?family=Open+Sans:300,400,600,700" rel="stylesheet">
<style type="text/css">
body { margin: 0px !important; padding: 0px !important; display: block !important; min-width: 100% !important; width: 100% !important; -webkit-text-size-adjust: none; }
table { border-spacing: 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
table td { border-collapse: collapse; }
td img { -ms-interpolation-mode: bicubic; display: block; width: auto; max-width: auto; height: auto; margin: auto; border: 0px!important; }
td p { margin: 0; padding: 0; font-family: 'Open Sans', Arial, Helvetica, sans-serif; font-size: 13px; color: #797979; line-height: 20px; }
td a { text-decoration: none; font-size: inherit; }
strong { font-weight: bold !important; }
@media screen and (max-width: 640px) {
  td.img-responsive img { width: 100% !important; max-width: 100%!important; height: auto!important; margin: auto; }
  table.row { width: 100%!important; max-width: 100%!important; }
  td.container-padding { width: 100%!important; padding-left: 15px!important; padding-right: 15px!important; }
}
</style>
</head>
<body>
<span style="display:none; max-height:0px; overflow:hidden; visibility:hidden; mso-hide:all;">${preheader}</span>
<table style="width: 100%; max-width: 100%;" width="100%" cellspacing="0" cellpadding="0" border="0" align="center">
  <tr>
    <td bgcolor="#F5F5F8" align="center">
      <table class="row" style="width: 600px; max-width: 600px; border-radius: 10px;" width="600" cellspacing="0" cellpadding="0" border="0" align="center">
        <tr>
          <td bgcolor="#c2e4fb" align="center" style="border-radius: 10px 10px 0 0;">
            <table class="row" style="width: 540px; max-width: 540px;" width="540" cellspacing="0" cellpadding="0" border="0" align="center">
              <tr>
                <td class="container-padding" align="center">
                  <table width="540" border="0" cellpadding="0" cellspacing="0" align="center" class="row">
                    <tr>
                      <td align="center">
                        <table border="0" width="100%" cellpadding="0" cellspacing="0" align="center">
                          <tr><td height="10">&nbsp;</td></tr>
                          <tr>
                            <td>
                              <table border="0" width="100%" cellpadding="0" cellspacing="0" align="center">
                                <tr>
                                  <td width="160" align="left">
                                    <img align="left" width="160" style="display: block; width: 100%; max-width: 160px;" src="https://cdn.shopify.com/s/files/1/0622/2220/5001/files/Nexus_Aminos_Logo.png" alt="Nexus Aminos">
                                  </td>
                                  <td>&nbsp;</td>
                                  <td align="right" style="font-family: 'Open Sans', Arial, Helvetica, sans-serif; font-size: 13px; color: #000000;">
                                    Order ${order.human_uid}
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <tr><td height="10">&nbsp;</td></tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<table style="width:100%;max-width:100%;" width="100%" cellspacing="0" cellpadding="0" border="0" align="center">
  <tr>
    <td bgcolor="#F5F5F8" align="center">
      <table class="row" style="width:600px;max-width:600px;" width="600" cellspacing="0" cellpadding="0" border="0" align="center">
        <tr>
          <td bgcolor="#FFFFFF" align="center">
            <table class="row" style="width:540px;max-width:540px;" width="540" cellspacing="0" cellpadding="0" border="0" align="center">
              <tr>
                <td class="container-padding" align="center">
                  <table width="540" border="0" cellpadding="0" cellspacing="0" align="center" class="row">
                    <tr>
                      <td align="center">
                        <table border="0" width="100%" cellpadding="0" cellspacing="0" align="center">
                          <tr><td height="30">&nbsp;</td></tr>
                          <tr>
                            <td align="center" style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 20px;color: #282828;">
                              <strong>${mainTitle}</strong>
                            </td>
                          </tr>
                          <tr><td height="20">&nbsp;</td></tr>
                          <tr>
                            <td align="center" style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 15px;color: #797979; line-height: 24px;">
                              ${greeting}<br>${mainMessage}
                            </td>
                          </tr>
                          <tr><td height="25">&nbsp;</td></tr>
                          <tr>
                            <td align="center" style="background-color: #F1F8E7; padding: 20px; border-radius: 8px;">
                              <table border="0" width="100%" cellpadding="0" cellspacing="0">
                                ${!isDelivered ? `<tr><td style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 14px;color: #282828;"><strong>Status:</strong> ${status}</td></tr><tr><td height="10">&nbsp;</td></tr>` : ''}
                                <tr><td style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 14px;color: #282828;"><strong>Tracking Number:</strong> ${shipment.tracking_no}</td></tr>
                                ${shipment.carrier ? `<tr><td height="10">&nbsp;</td></tr><tr><td style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 14px;color: #282828;"><strong>Carrier:</strong> ${shipment.carrier}</td></tr>` : ''}
                                ${shipment.tracking_location ? `<tr><td height="10">&nbsp;</td></tr><tr><td style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 14px;color: #282828;"><strong>${isDelivered ? 'Location' : 'Current Location'}:</strong> ${shipment.tracking_location}</td></tr>` : ''}
                                ${!isDelivered && shipment.estimated_delivery ? `<tr><td height="10">&nbsp;</td></tr><tr><td style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 14px;color: #282828;"><strong>Estimated Delivery:</strong> ${new Date(shipment.estimated_delivery).toLocaleDateString()}</td></tr>` : ''}
                              </table>
                            </td>
                          </tr>
                          <tr><td height="25">&nbsp;</td></tr>
                          <tr>
                            <td align="center" style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 15px;color: #797979; line-height: 24px;">
                              ${isDelivered ? 'Thank you for your business!' : "We'll keep you updated on your shipment's progress."}
                            </td>
                          </tr>
                          <tr><td height="30">&nbsp;</td></tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<table style="width:100%;max-width:100%;" width="100%" cellspacing="0" cellpadding="0" border="0" align="center">
  <tr>
    <td bgcolor="#F5F5F8" align="center">
      <table bgcolor="#FFFFFF" class="row" style="width:600px;max-width:600px;" width="600" cellspacing="0" cellpadding="0" border="0" align="center">
        <tr>
          <td bgcolor="#c2e4fb" align="center" style="border-radius: 0 0 10px 10px;">
            <table class="row" style="width:540px;max-width:540px;" width="540" cellspacing="0" cellpadding="0" border="0" align="center">
              <tr>
                <td class="container-padding" align="center">
                  <table width="540" border="0" cellpadding="0" cellspacing="0" align="center" class="row">
                    <tr>
                      <td align="center">
                        <table border="0" width="100%" cellpadding="0" cellspacing="0" align="center">
                          <tr><td height="20">&nbsp;</td></tr>
                          <tr>
                            <td width="200" align="center">
                              <img align="center" width="160" style="display: block; width: 100%; max-width: 160px;" src="https://cdn.shopify.com/s/files/1/0622/2220/5001/files/Nexus_Aminos_Logo.png" alt="Nexus Aminos">
                            </td>
                          </tr>
                          <tr><td height="10">&nbsp;</td></tr>
                          <tr>
                            <td>
                              <table cellspacing="0" cellpadding="0" border="0" align="center">
                                <tr>
                                  <td width="25">
                                    <a href="https://www.facebook.com/nexusaminos/" target="_blank">
                                      <img width="25" style="display:block;width:100%;max-width:25px;" src="https://cdn.shopify.com/s/files/1/0622/2220/5001/files/facebook-icon.png" alt="Facebook">
                                    </a>
                                  </td>
                                  <td width="15">&nbsp;</td>
                                  <td width="25">
                                    <a href="https://www.instagram.com/nexus.aminos/" target="_blank">
                                      <img width="25" style="display:block;width:100%;max-width:25px;" src="https://cdn.shopify.com/s/files/1/0622/2220/5001/files/instagram-icon.png" alt="Instagram">
                                    </a>
                                  </td>
                                  <td width="15">&nbsp;</td>
                                  <td width="25">
                                    <a href="https://www.tiktok.com/@nexusaminos/" target="_blank">
                                      <img width="25" style="display:block;width:100%;max-width:25px;" src="https://cdn.shopify.com/s/files/1/0622/2220/5001/files/tiktok-icon.png" alt="TikTok">
                                    </a>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <tr><td height="20">&nbsp;</td></tr>
                          <tr>
                            <td align="center" style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 12px;color: #000000;line-height: 18px;">
                              Please <b>do NOT reply</b> to this email. This is an automated email sent from an unmonitored email address. If you have any questions, feel free to contact us at <a href="mailto:support@nexusaminos.com" style="color: #000000;">support@nexusaminos.com</a>
                            </td>
                          </tr>
                          <tr><td height="20">&nbsp;</td></tr>
                          <tr>
                            <td align="center" style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 12px;color: #000000;">
                              © ${new Date().getFullYear()} Nexus Aminos, All rights reserved.
                            </td>
                          </tr>
                          <tr><td height="10">&nbsp;</td></tr>
                          <tr>
                            <td align="center">
                              <table cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                  <td align="center" style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 12px;color: #000000;text-decoration: underline">
                                    <a href="https://nexusaminos.com/policies/terms-of-service" target="_blank" style="color: #000000;">Terms of Service</a>
                                  </td>
                                  <td width="20" align="center" style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 13px;color: #000000;">|</td>
                                  <td align="center" style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 12px;color: #000000;text-decoration: underline">
                                    <a href="https://nexusaminos.com/policies/privacy-policy" target="_blank" style="color: #000000;">Privacy Policy</a>
                                  </td>
                                  <td width="20" align="center" style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 13px;color: #000000;">|</td>
                                  <td align="center" style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 12px;color: #000000;text-decoration: underline">
                                    <a href="https://nexusaminos.com/policies/refund-policy" target="_blank" style="color: #000000;">Refund Policy</a>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <tr><td height="30">&nbsp;</td></tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
    };

    // Set email content based on status
    const isDelivered = status.toLowerCase() === 'delivered';
    
    if (isDelivered) {
      subject = `Your Order ${order.human_uid} Has Been Delivered!`;
      preheader = `Great news! Your order has been delivered.`;
    } else {
      subject = `Shipment Update for Order ${order.human_uid}`;
      preheader = `Your order status has been updated to: ${status}`;
    }

    body = buildEmailTemplate(isDelivered);

    // Plain text version
    const plainText = isDelivered 
      ? `Great news, ${customer.name}! Your order ${order.human_uid} has been delivered. Tracking: ${shipment.tracking_no}`
      : `Hello ${customer.name}, your order ${order.human_uid} has a shipment update. Status: ${status}. Tracking: ${shipment.tracking_no}`;

    // Send email
    const smtpClient = new SMTPClient({
      connection: {
        hostname: smtpConfig.host,
        port: effectivePort,
        tls: useTls,
        auth: {
          username: smtpConfig.user,
          password: smtpConfig.password,
        },
      },
    });

    await smtpClient.send({
      from: smtpConfig.user,
      to: recipientEmail,
      subject: subject,
      content: plainText,
      mimeContent: [{ mimeType: 'text/html', content: body, transferEncoding: '8bit' }],
    });

    await smtpClient.close();

    console.log(`Shipment notification email sent to ${recipientEmail}`);

    // Check if SMS notification should be sent
    try {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('email', customer.email)
        .single();

      if (customerData) {
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('sms_enabled, sms_phone_number, sms_shipment_updates')
          .eq('customer_id', customerData.id)
          .single();

        if (prefs?.sms_enabled && prefs?.sms_shipment_updates && prefs?.sms_phone_number) {
          const TEXTBELT_API_KEY = Deno.env.get("TEXTBELT_API_KEY");
          const smsMessage = isDelivered 
            ? `Your order ${order.human_uid} has been delivered!`
            : `Shipment update for order ${order.human_uid}: ${status}`;
          
          const smsResponse = await fetch("https://textbelt.com/text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: prefs.sms_phone_number,
              message: smsMessage,
              key: TEXTBELT_API_KEY,
            }),
          });
          
          const smsResult = await smsResponse.json();
          console.log('SMS sent:', smsResult);
        }
      }
    } catch (smsError) {
      console.error('SMS notification failed but continuing:', smsError);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("Error sending shipment notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
