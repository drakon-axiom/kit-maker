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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

const RequestSchema = z.object({
  orderId: z.string().uuid(),
  approved: z.boolean(),
  rejectionReason: z.string().optional(),
  testMode: z.boolean().optional(),
  testEmail: z.string().email().optional(),
});

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

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { orderId, approved, rejectionReason, testMode, testEmail } = RequestSchema.parse(body);

    // Fetch order details with brand_id
    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select(`
        id,
        human_uid,
        subtotal,
        deposit_required,
        deposit_amount,
        brand_id,
        customers!inner(name, email)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
    const recipientEmail = testMode && testEmail ? testEmail : customer.email;

    // Fetch company name
    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'company_name')
      .single();

    const companyName = settings?.value || 'Our Company';

    // Fetch email template
    const templateType = approved ? 'order_approval' : 'order_rejection';
    const { data: template } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_type', templateType)
      .single();

    if (!template) {
      throw new Error(`Email template ${templateType} not found`);
    }

    let subject = template.subject;
    let htmlContent = template.custom_html || getDefaultTemplate(approved);

    // Replace variables
    const variables: Record<string, string> = {
      '{{customer_name}}': customer.name,
      '{{order_number}}': order.human_uid,
      '{{order_total}}': `$${order.subtotal.toFixed(2)}`,
      '{{company_name}}': companyName,
      '{{deposit_required}}': order.deposit_required ? 'Yes' : 'No',
      '{{deposit_amount}}': order.deposit_amount ? `$${order.deposit_amount.toFixed(2)}` : '$0.00',
      '{{rejection_reason}}': rejectionReason || 'No reason provided',
    };

    Object.entries(variables).forEach(([key, value]) => {
      subject = subject.replace(new RegExp(key, 'g'), value);
      htmlContent = htmlContent.replace(new RegExp(key, 'g'), value);
    });

    // Get SMTP config (brand-specific or global fallback)
    const smtpConfig = await getSmtpConfig(supabase, order.brand_id);

    if (!smtpConfig) {
      throw new Error('SMTP configuration not available');
    }

    // Send email with Proton SMTP configuration
    const effectivePort = smtpConfig.host.includes("protonmail") ? 465 : smtpConfig.port;
    const useTls = effectivePort === 465;

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
      from: `${companyName} <${smtpConfig.user}>`,
      to: recipientEmail,
      subject: testMode ? `[TEST] ${subject}` : subject,
      content: htmlContent,
      mimeContent: [{ mimeType: 'text/html', content: htmlContent, transferEncoding: '8bit' }],
    });

    await smtpClient.close();

    console.log(`${approved ? 'Approval' : 'Rejection'} email ${testMode ? '(TEST)' : ''} sent for order ${order.human_uid} to ${recipientEmail}`);

    // Log email send to audit_log (skip logging for test emails)
    if (!testMode) {
      await supabase.from('audit_log').insert({
        entity: 'email',
        entity_id: orderId,
        action: approved ? 'order_approval_email_sent' : 'order_rejection_email_sent',
        after: {
          recipient: recipientEmail,
          subject: subject,
          template_type: templateType,
          order_number: order.human_uid,
          status: 'sent'
        }
      });
    }

    // Send SMS notification if enabled and quote was approved
    if (approved && !testMode) {
      try {
        // Get customer ID from order
        const { data: customerData } = await supabase
          .from('customers')
          .select('id')
          .eq('email', customer.email)
          .single();

        if (customerData) {
          const { data: prefs } = await supabase
            .from('notification_preferences')
            .select('sms_enabled, sms_phone_number, sms_quote_approved')
            .eq('customer_id', customerData.id)
            .single();

          if (prefs?.sms_enabled && prefs?.sms_quote_approved && prefs?.sms_phone_number) {
            const TEXTBELT_API_KEY = Deno.env.get("TEXTBELT_API_KEY");
            const message = `Hi ${customer.name}, your quote ${order.human_uid} has been approved!`;
            
            const smsResponse = await fetch("https://textbelt.com/text", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                phone: prefs.sms_phone_number,
                message: message,
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
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error sending approval email:', error);
    
    // Log email failure to audit_log
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      
      await supabase.from('audit_log').insert({
        entity: 'email',
        action: 'email_send_failed',
        after: {
          error: error.message,
          template_type: 'order_approval'
        }
      });
    } catch (logError) {
      console.error('Failed to log email error:', logError);
    }
    
    // Security: Generic error message
    return new Response(
      JSON.stringify({ error: "Failed to send approval email" }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function getDefaultTemplate(approved: boolean): string {
  if (approved) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Order Approved</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px;">
<tr>
<td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
<tr>
<td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
<h1 style="margin: 0; color: #ffffff; font-size: 28px;">Order Approved!</h1>
</td>
</tr>
<tr>
<td style="padding: 40px 30px;">
<p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
Dear {{customer_name}},
</p>
<p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
Great news! Your order <strong>{{order_number}}</strong> has been approved and is now being processed.
</p>
<table width="100%" cellpadding="10" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 4px; margin: 20px 0;">
<tr>
<td style="color: #666666; font-size: 14px;">Order Total:</td>
<td style="color: #333333; font-size: 16px; font-weight: bold; text-align: right;">{{order_total}}</td>
</tr>
<tr>
<td style="color: #666666; font-size: 14px;">Deposit Required:</td>
<td style="color: #333333; font-size: 14px; text-align: right;">{{deposit_required}}</td>
</tr>
<tr>
<td style="color: #666666; font-size: 14px;">Deposit Amount:</td>
<td style="color: #333333; font-size: 14px; text-align: right;">{{deposit_amount}}</td>
</tr>
</table>
<p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
We will keep you updated on your order progress. Thank you for your business!
</p>
<p style="margin: 0; color: #666666; font-size: 14px;">
Best regards,<br>
{{company_name}}
</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
  } else {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Order Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px;">
<tr>
<td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
<tr>
<td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
<h1 style="margin: 0; color: #ffffff; font-size: 28px;">Order Status Update</h1>
</td>
</tr>
<tr>
<td style="padding: 40px 30px;">
<p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
Dear {{customer_name}},
</p>
<p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
We regret to inform you that your order <strong>{{order_number}}</strong> could not be approved at this time.
</p>
<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
<p style="margin: 0; color: #856404; font-size: 14px;">
<strong>Reason:</strong> {{rejection_reason}}
</p>
</div>
<p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
If you have any questions or would like to discuss this further, please don't hesitate to contact us.
</p>
<p style="margin: 0; color: #666666; font-size: 14px;">
Best regards,<br>
{{company_name}}
</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
  }
}
