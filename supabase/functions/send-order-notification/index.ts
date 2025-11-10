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

  switch (status) {
    case 'in_production':
      subject = `Your Order ${orderNumber} is Now in Production`;
      greeting = `Great news, ${customerName}!`;
      mainMessage = `Your order <strong>${orderNumber}</strong> has entered production. Our team is working on preparing your items.`;
      additionalInfo = `<p style="color: #555;">We'll notify you when your order is ready to ship.</p>`;
      break;

    case 'in_packing':
    case 'packed':
      subject = `Your Order ${orderNumber} is Ready to Ship`;
      greeting = `Hello ${customerName},`;
      mainMessage = `Your order <strong>${orderNumber}</strong> has been completed and is now being prepared for shipment.`;
      additionalInfo = `<p style="color: #555;">You'll receive tracking information as soon as your order ships.</p>`;
      break;

    case 'shipped':
      subject = `Your Order ${orderNumber} Has Shipped!`;
      greeting = `Exciting news, ${customerName}!`;
      mainMessage = `Your order <strong>${orderNumber}</strong> has been shipped and is on its way to you.`;
      
      if (orderDetails.shipmentCount > 0) {
        additionalInfo = `
          <p style="color: #555;">Your order contains ${orderDetails.shipmentCount} shipment${orderDetails.shipmentCount !== 1 ? 's' : ''}.</p>
          <p style="color: #555;">You'll receive separate tracking information for each shipment.</p>
        `;
      } else {
        additionalInfo = `<p style="color: #555;">You'll receive tracking information shortly.</p>`;
      }
      break;

    default:
      subject = `Update on Your Order ${orderNumber}`;
      greeting = `Hello ${customerName},`;
      mainMessage = `Your order <strong>${orderNumber}</strong> status has been updated to <strong>${statusDisplay}</strong>.`;
      additionalInfo = `<p style="color: #555;">We'll keep you updated on your order's progress.</p>`;
  }

  const body = `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">${greeting}</h2>
        <p style="font-size: 16px; color: #555;">${mainMessage}</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 8px 0;"><strong>Order Number:</strong> ${orderNumber}</p>
          <p style="margin: 8px 0;"><strong>Status:</strong> ${statusDisplay}</p>
          ${orderDetails.etaDate ? `<p style="margin: 8px 0;"><strong>Estimated Delivery:</strong> ${new Date(orderDetails.etaDate).toLocaleDateString()}</p>` : ''}
          ${orderDetails.promisedDate ? `<p style="margin: 8px 0;"><strong>Promised Date:</strong> ${new Date(orderDetails.promisedDate).toLocaleDateString()}</p>` : ''}
        </div>
        
        ${additionalInfo}
        
        <p style="font-size: 16px; color: #555;">Thank you for your business!</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">This is an automated notification from Nexus Aminos.</p>
      </body>
    </html>
  `;

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
        from: smtpUser,
        to: recipientEmail,
        subject: subject,
        content: "Order Status Update",
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
