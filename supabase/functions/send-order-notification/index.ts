import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  orderId: string;
  newStatus: string;
  oldStatus?: string;
}

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

  const body = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>${subject}</title><meta name="viewport" content="width=device-width, initial-scale=1.0" /><style type="text/css">@media only screen and (max-width: 600px) { .container { width: 100% !important; } .content { padding: 15px !important; } }</style></head><body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; color: #222222;"><div style="display: none; font-size: 1px; color: #ffffff; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">${preheader}</div><table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;"><tr><td align="center" style="background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); padding: 30px 20px;"><img src="https://dfaafbwhdnoaknuxonig.supabase.co/storage/v1/object/public/assets/axiom-logo.png" alt="Axiom Collective LLC" style="max-width: 200px; height: auto;" /></td></tr><tr><td align="center" valign="top" style="padding: 30px 20px;"><table border="0" cellpadding="0" cellspacing="0" width="100%" class="container"><tr><td align="left" style="padding: 0;"><h2 style="color: #333333; margin: 0 0 16px 0; font-size: 24px;">${greeting}</h2><p style="font-size: 16px; color: #555555; line-height: 1.5; margin: 0 0 20px 0;">${mainMessage}</p></td></tr><tr><td align="left" style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;"><p style="margin: 8px 0; font-size: 14px;"><strong>Order Number:</strong> ${orderNumber}</p><p style="margin: 8px 0; font-size: 14px;"><strong>Status:</strong> ${statusDisplay}</p>${orderDetails.etaDate ? `<p style="margin: 8px 0; font-size: 14px;"><strong>Estimated Delivery:</strong> ${new Date(orderDetails.etaDate).toLocaleDateString()}</p>` : ''}${orderDetails.promisedDate ? `<p style="margin: 8px 0; font-size: 14px;"><strong>Promised Date:</strong> ${new Date(orderDetails.promisedDate).toLocaleDateString()}</p>` : ''}</td></tr><tr><td align="left" style="padding: 0;"><p style="color: #555555; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">${additionalInfo}</p><p style="font-size: 16px; color: #555555; margin: 0 0 30px 0;">Thank you for your business!</p></td></tr></table></td></tr><tr><td align="center" style="background-color: #2d3748; padding: 20px; color: #ffffff;"><p style="color: #cbd5e0; font-size: 12px; margin: 0 0 8px 0;">This is an automated notification from Axiom Collective LLC.</p><p style="color: #718096; font-size: 11px; margin: 0;">© ${new Date().getFullYear()} Axiom Collective LLC. All rights reserved.</p></td></tr></table></body></html>`;

  return { subject, body };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, newStatus, oldStatus }: EmailRequest = await req.json();
    
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
        from: `Axiom Collective <${smtpUser}>`,
        to: recipientEmail,
        subject: subject,
        html: body,
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
