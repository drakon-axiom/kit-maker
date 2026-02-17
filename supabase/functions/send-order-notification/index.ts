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
  orderId: z.string().uuid("Invalid order ID format"),
  newStatus: z.string().min(1, "Status is required"),
  oldStatus: z.string().optional(),
});

type EmailRequest = z.infer<typeof EmailRequestSchema>;

const getStatusDisplayName = (status: string): string => {
  const statusMap: Record<string, string> = {
    'draft': 'Draft',
    'quoted': 'Quoted',
    'deposit_due': 'Deposit Due',
    'in_queue': 'In Queue',
    'in_production': 'In Production',
    'in_labeling': 'In Labeling',
    'in_packing': 'Ready to Ship',
    'packed': 'Packed - Ready to Ship',
    'shipped': 'Shipped',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled',
  };
  return statusMap[status] || status;
};

const shouldSendNotification = (status: string): boolean => {
  return ['in_production', 'in_packing', 'packed', 'shipped'].includes(status);
};

const getEmailContent = (
  status: string,
  customerName: string,
  orderNumber: string,
  orderDetails: any
): { subject: string; body: string } => {
  const statusDisplay = getStatusDisplayName(status);
  
  let subject = '';
  let greeting = '';
  let mainMessage = '';
  let additionalInfo = '';
  let preheader = '';

  switch (status) {
    case 'in_production':
      subject = `Your Order ${orderNumber} is Now in Production`;
      greeting = `Great news, ${customerName}!`;
      mainMessage = `Your order <strong>${orderNumber}</strong> has entered production. Our team is working on preparing your items.`;
      additionalInfo = `We'll notify you when your order is ready to ship.`;
      preheader = `Great news! Your order ${orderNumber} is now in production.`;
      break;

    case 'in_packing':
    case 'packed':
      subject = `Your Order ${orderNumber} is Ready to Ship`;
      greeting = `Hello ${customerName},`;
      mainMessage = `Your order <strong>${orderNumber}</strong> has been completed and is now being prepared for shipment.`;
      additionalInfo = `You'll receive tracking information as soon as your order ships.`;
      preheader = `Your order ${orderNumber} is ready to ship.`;
      break;

    case 'shipped':
      subject = `Your Order ${orderNumber} Has Shipped!`;
      greeting = `Exciting news, ${customerName}!`;
      mainMessage = `Your order <strong>${orderNumber}</strong> has been shipped and is on its way to you.`;
      
      if (orderDetails.shipmentCount > 0) {
        additionalInfo = `Your order contains ${orderDetails.shipmentCount} shipment${orderDetails.shipmentCount !== 1 ? 's' : ''}. You'll receive separate tracking information for each shipment.`;
      } else {
        additionalInfo = `You'll receive tracking information shortly.`;
      }
      preheader = `Your order ${orderNumber} has shipped!`;
      break;

    default:
      subject = `Update on Your Order ${orderNumber}`;
      greeting = `Hello ${customerName},`;
      mainMessage = `Your order <strong>${orderNumber}</strong> status has been updated to <strong>${statusDisplay}</strong>.`;
      additionalInfo = `We'll keep you updated on your order's progress.`;
      preheader = `Update on your order ${orderNumber}.`;
  }

  const body = `<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
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
                  <table width="540" border="0" cellpadding="0" cellspacing="0" align="center" class="row" style="width: 540px; max-width: 540px;">
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
                                    Order ${orderNumber}
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
                              <strong>${greeting}</strong>
                            </td>
                          </tr>
                          <tr><td height="20">&nbsp;</td></tr>
                          <tr>
                            <td align="center" style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 15px;color: #797979; line-height: 24px;">
                              ${mainMessage}
                            </td>
                          </tr>
                          <tr><td height="25">&nbsp;</td></tr>
                          <tr>
                            <td align="center" style="background-color: #F1F8E7; padding: 20px; border-radius: 8px;">
                              <table border="0" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 14px;color: #282828;">
                                    <strong>Order Number:</strong> ${orderNumber}
                                  </td>
                                </tr>
                                <tr><td height="10">&nbsp;</td></tr>
                                <tr>
                                  <td style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 14px;color: #282828;">
                                    <strong>Status:</strong> ${statusDisplay}
                                  </td>
                                </tr>
                                ${orderDetails.etaDate ? `<tr><td height="10">&nbsp;</td></tr><tr><td style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 14px;color: #282828;"><strong>Estimated Delivery:</strong> ${new Date(orderDetails.etaDate).toLocaleDateString()}</td></tr>` : ''}
                                ${orderDetails.promisedDate ? `<tr><td height="10">&nbsp;</td></tr><tr><td style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 14px;color: #282828;"><strong>Promised Date:</strong> ${new Date(orderDetails.promisedDate).toLocaleDateString()}</td></tr>` : ''}
                              </table>
                            </td>
                          </tr>
                          <tr><td height="25">&nbsp;</td></tr>
                          <tr>
                            <td align="center" style="font-family:'Open Sans', Arial, Helvetica, sans-serif;font-size: 15px;color: #797979; line-height: 24px;">
                              ${additionalInfo}
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

  return { subject, body };
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // JWT authentication is handled by Supabase (verify_jwt = true in config.toml)
    // No additional authentication needed here

    const rawBody = await req.json();
    
    // Validate input with zod
    const validationResult = EmailRequestSchema.safeParse(rawBody);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid request data", details: validationResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { orderId, newStatus, oldStatus }: EmailRequest = validationResult.data;
    
    console.log(`Processing order notification: ${orderId}, status: ${oldStatus} -> ${newStatus}`);

    // Check if we should send notification for this status
    if (!shouldSendNotification(newStatus)) {
      console.log(`Skipping notification for status: ${newStatus}`);
      return new Response(
        JSON.stringify({ success: true, message: "Status does not require notification" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get order details with customer info and shipments
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .select(`
        *,
        customers!inner (
          name,
          email
        ),
        shipments (
          id,
          tracking_no
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Error fetching order:", orderError);
      throw new Error("Order not found");
    }

    const customer = order.customers;
    const recipientEmail = customer.email;

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

    // Prepare order details for email
    const orderDetails = {
      etaDate: order.eta_date,
      promisedDate: order.promised_date,
      shipmentCount: order.shipments?.length || 0,
    };

    // Get email content
    const { subject, body } = getEmailContent(
      newStatus,
      customer.name,
      order.human_uid,
      orderDetails
    );

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
        content: body,
        mimeContent: [{ mimeType: 'text/html', content: body, transferEncoding: '8bit' }],
      });

      await client.close();
      console.log(`Email sent successfully to ${recipientEmail} for order ${order.human_uid}`);
    } catch (smtpError: any) {
      console.error("SMTP Error details:", smtpError);
      throw new Error(`Failed to send email: ${smtpError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("Error in send-order-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
