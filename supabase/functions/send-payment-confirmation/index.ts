import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// Security: Restrict CORS to known application domains
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map(o => o.trim()).filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] || "");
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

interface PaymentConfirmationRequest {
  orderId: string;
  orderNumber: string;
  paymentType: string;
  amount: number;
  customerEmail: string;
  paymentIntent: string;
}

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
    const { orderId, orderNumber, paymentType, amount, customerEmail, paymentIntent }: PaymentConfirmationRequest = await req.json();

    console.log(`Sending payment confirmation for order ${orderNumber}, type: ${paymentType}, amount: $${amount}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get order to find brand_id
    const { data: order } = await supabase
      .from('sales_orders')
      .select('brand_id')
      .eq('id', orderId)
      .single();

    // Get SMTP config (brand-specific or global fallback)
    const smtpConfig = await getSmtpConfig(supabase, order?.brand_id);

    if (!smtpConfig) {
      throw new Error('SMTP configuration not available');
    }

    const effectivePort = smtpConfig.host.includes("protonmail") ? 465 : smtpConfig.port;
    const useTls = effectivePort === 465;

    // Initialize SMTP client
    const client = new SMTPClient({
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

    const paymentTypeName = paymentType === 'deposit' ? 'Deposit Payment' : 'Final Payment';
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .receipt-box { background-color: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .receipt-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .receipt-row:last-child { border-bottom: none; font-weight: bold; font-size: 1.2em; color: #4F46E5; }
          .label { color: #6b7280; }
          .value { font-weight: 600; color: #111827; }
          .success-badge { background-color: #10b981; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 0.9em; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Payment Confirmed</h1>
          </div>
          <div class="content">
            <div class="success-badge">Payment Successfully Processed</div>
            
            <p>Dear Valued Customer,</p>
            
            <p>Thank you for your payment! We've successfully received your ${paymentTypeName.toLowerCase()} for Order ${orderNumber}.</p>
            
            <div class="receipt-box">
              <h2 style="margin-top: 0; color: #111827;">Payment Receipt</h2>
              
              <div class="receipt-row">
                <span class="label">Order Number:</span>
                <span class="value">${orderNumber}</span>
              </div>
              
              <div class="receipt-row">
                <span class="label">Payment Type:</span>
                <span class="value">${paymentTypeName}</span>
              </div>
              
              <div class="receipt-row">
                <span class="label">Payment Date:</span>
                <span class="value">${currentDate}</span>
              </div>
              
              <div class="receipt-row">
                <span class="label">Payment Method:</span>
                <span class="value">Credit Card (Stripe)</span>
              </div>
              
              <div class="receipt-row">
                <span class="label">Transaction ID:</span>
                <span class="value">${paymentIntent}</span>
              </div>
              
              <div class="receipt-row">
                <span class="label">Amount Paid:</span>
                <span class="value">$${amount.toFixed(2)}</span>
              </div>
            </div>
            
            ${paymentType === 'deposit' 
              ? '<p><strong>Next Steps:</strong> Your order will now move into production. We\'ll keep you updated on its progress.</p>' 
              : '<p><strong>Order Complete:</strong> Your order is now fully paid and will be prepared for shipment soon.</p>'
            }
            
            <p>You can view your complete payment history and order status anytime by logging into your account.</p>
            
            <div class="footer">
              <p>Questions? Contact us at support@yourcompany.com</p>
              <p>This is an automated receipt. Please keep it for your records.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await client.send({
      from: smtpConfig.user,
      to: customerEmail,
      subject: `Payment Confirmed - Order ${orderNumber}`,
      content: emailHtml,
      mimeContent: [{ mimeType: 'text/html', content: emailHtml, transferEncoding: '8bit' }],
    });

    await client.close();

    console.log(`Payment confirmation email sent to ${customerEmail}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error sending payment confirmation:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
