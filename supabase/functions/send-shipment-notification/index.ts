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

    if (status === "Delivered" || status === "delivered") {
      subject = `Your Order ${order.human_uid} Has Been Delivered!`;
      preheader = `Great news! Your order ${order.human_uid} has been delivered.`;
      body = buildEmailTemplate(true);
    } else {
      subject = `Shipment Update for Order ${order.human_uid}`;
      preheader = `Your order ${order.human_uid} has a shipment update.`;
      body = buildEmailTemplate(false);
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
