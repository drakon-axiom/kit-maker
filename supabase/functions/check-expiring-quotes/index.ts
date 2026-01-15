import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

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
      console.log('Using brand-specific SMTP configuration for brand:', brandId);
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting quote expiration check...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const reminderThreshold = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

    // Fetch quotes that are expired (include brand_id)
    const { data: expiredQuotes, error: expiredError } = await supabase
      .from("sales_orders")
      .select(`
        *,
        customer:customers (
          name,
          email
        )
      `)
      .eq("status", "quoted")
      .lt("quote_expires_at", now.toISOString())
      .not("quote_expires_at", "is", null);

    if (expiredError) {
      console.error("Error fetching expired quotes:", expiredError);
      throw expiredError;
    }

    // Fetch quotes expiring soon (within 3 days) - include brand_id
    const { data: expiringSoonQuotes, error: expiringSoonError } = await supabase
      .from("sales_orders")
      .select(`
        *,
        customer:customers (
          name,
          email
        )
      `)
      .eq("status", "quoted")
      .gte("quote_expires_at", now.toISOString())
      .lt("quote_expires_at", reminderThreshold.toISOString())
      .not("quote_expires_at", "is", null);

    if (expiringSoonError) {
      console.error("Error fetching expiring soon quotes:", expiringSoonError);
      throw expiringSoonError;
    }

    console.log(`Found ${expiredQuotes?.length || 0} expired quotes`);
    console.log(`Found ${expiringSoonQuotes?.length || 0} quotes expiring within 3 days`);

    // Process expired quotes
    if (expiredQuotes && expiredQuotes.length > 0) {
      for (const quote of expiredQuotes) {
        console.log(`Processing expired quote: ${quote.human_uid}`);
        
        // Update status to draft (or you could create a new 'expired' status)
        const { error: updateError } = await supabase
          .from("sales_orders")
          .update({ status: "draft" })
          .eq("id", quote.id);

        if (updateError) {
          console.error(`Error updating expired quote ${quote.human_uid}:`, updateError);
          continue;
        }

        // Send notification to customer
        await sendExpirationNotification(supabase, quote, "expired");
        
        // Send notification to admin
        await sendAdminExpirationNotification(supabase, quote, "expired");
      }
    }

    // Process quotes expiring soon
    if (expiringSoonQuotes && expiringSoonQuotes.length > 0) {
      for (const quote of expiringSoonQuotes) {
        console.log(`Processing expiring soon quote: ${quote.human_uid}`);
        
        // Send reminder to customer
        await sendExpirationNotification(supabase, quote, "expiring_soon");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired_count: expiredQuotes?.length || 0,
        expiring_soon_count: expiringSoonQuotes?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in check-expiring-quotes:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function sendExpirationNotification(
  supabase: any,
  order: any,
  type: "expired" | "expiring_soon"
) {
  try {
    if (!order.customer?.email) {
      console.log("Customer email missing, skipping email");
      return;
    }

    // Get SMTP config (brand-specific or global fallback)
    const smtpConfig = await getSmtpConfig(supabase, order.brand_id);

    if (!smtpConfig) {
      console.log("SMTP not configured, skipping email");
      return;
    }

    const effectivePort = smtpConfig.host.includes("protonmail") ? 465 : smtpConfig.port;
    const useTls = effectivePort === 465;

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

    const expiresAt = new Date(order.quote_expires_at);
    const formattedDate = expiresAt.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const daysUntilExpiration = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    let subject: string;
    let body: string;
    const approvalLink = `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app')}/quote-approval?token=${order.quote_link_token}`;

    if (type === "expired") {
      subject = `Quote ${order.human_uid} Has Expired`;
      body = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
              .content { padding: 20px 0; }
              .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 14px; color: #6c757d; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>Quote Expired</h2>
              </div>
              <div class="content">
                <p>Dear ${order.customer.name},</p>
                <p>Your quote <strong>${order.human_uid}</strong> expired on <strong>${formattedDate}</strong>.</p>
                <p>If you're still interested in this quote, please contact us to request a new quote.</p>
                <p><strong>Quote Details:</strong></p>
                <ul>
                  <li>Quote Number: ${order.human_uid}</li>
                  <li>Total Amount: $${order.subtotal?.toFixed(2)}</li>
                  <li>Expired: ${formattedDate}</li>
                </ul>
              </div>
              <div class="footer">
                <p>If you have any questions, please don't hesitate to contact us.</p>
              </div>
            </div>
          </body>
        </html>
      `;
    } else {
      subject = `Reminder: Quote ${order.human_uid} Expires in ${daysUntilExpiration} Day${daysUntilExpiration !== 1 ? 's' : ''}`;
      body = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
              .content { padding: 20px 0; }
              .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
              .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 14px; color: #6c757d; }
              .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 16px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>⏰ Quote Expiring Soon</h2>
              </div>
              <div class="content">
                <p>Dear ${order.customer.name},</p>
                <div class="warning">
                  <strong>⚠️ Your quote expires in ${daysUntilExpiration} day${daysUntilExpiration !== 1 ? 's' : ''}!</strong>
                </div>
                <p>Your quote <strong>${order.human_uid}</strong> will expire on <strong>${formattedDate}</strong>.</p>
                <p>To secure this pricing, please approve your quote before it expires.</p>
                <p><strong>Quote Details:</strong></p>
                <ul>
                  <li>Quote Number: ${order.human_uid}</li>
                  <li>Total Amount: $${order.subtotal?.toFixed(2)}</li>
                  <li>Expires: ${formattedDate}</li>
                </ul>
                <p>
                  <a href="${approvalLink}" class="button">Approve Quote Now</a>
                </p>
              </div>
              <div class="footer">
                <p>If you have any questions, please don't hesitate to contact us.</p>
              </div>
            </div>
          </body>
        </html>
      `;
    }

    await client.send({
      from: smtpConfig.user,
      to: order.customer.email,
      subject: subject,
      content: body,
      mimeContent: [{ mimeType: 'text/html', content: body, transferEncoding: '8bit' }],
    });

    await client.close();
    console.log(`${type} notification sent to customer: ${order.customer.email}`);

  } catch (error) {
    console.error(`Error sending ${type} notification:`, error);
  }
}

async function sendAdminExpirationNotification(
  supabase: any,
  order: any,
  type: "expired"
) {
  try {
    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["company_email"]);

    const settingsMap = settings?.reduce((acc: any, s: any) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    if (!settingsMap?.company_email) {
      console.log("Company email missing, skipping admin email");
      return;
    }

    // Get SMTP config (brand-specific or global fallback)
    const smtpConfig = await getSmtpConfig(supabase, order.brand_id);

    if (!smtpConfig) {
      console.log("SMTP not configured, skipping admin email");
      return;
    }

    const effectivePort = smtpConfig.host.includes("protonmail") ? 465 : smtpConfig.port;
    const useTls = effectivePort === 465;

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

    const expiresAt = new Date(order.quote_expires_at);
    const formattedDate = expiresAt.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const subject = `Quote ${order.human_uid} Has Expired`;
    const body = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .content { padding: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 14px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Quote Expired - Admin Notification</h2>
            </div>
            <div class="content">
              <p>Quote <strong>${order.human_uid}</strong> has expired without customer approval.</p>
              <p><strong>Details:</strong></p>
              <ul>
                <li>Quote Number: ${order.human_uid}</li>
                <li>Customer: ${order.customer.name}</li>
                <li>Total Amount: $${order.subtotal?.toFixed(2)}</li>
                <li>Expired: ${formattedDate}</li>
              </ul>
              <p>The order status has been automatically updated to "draft".</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await client.send({
      from: smtpConfig.user,
      to: settingsMap.company_email,
      subject: subject,
      content: body,
      mimeContent: [{ mimeType: 'text/html', content: body, transferEncoding: '8bit' }],
    });

    await client.close();
    console.log(`Admin expiration notification sent for quote: ${order.human_uid}`);

  } catch (error) {
    console.error("Error sending admin expiration notification:", error);
  }
}
