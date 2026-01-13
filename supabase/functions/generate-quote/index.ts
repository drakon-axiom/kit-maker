import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

interface QuoteEmailParams {
  companyName: string;
  companyEmail: string;
  headerBgColor: string;
  headerTextColor: string;
  footerText: string;
  logoUrl: string;
  customHtml: string;
  customerName: string;
  quoteNumber: string;
  date: string;
  expiresAt?: string;
  customerEmail?: string;
  lineItemsHtml: string;
  subtotal: number;
  depositRequired: boolean;
  depositAmount: number;
  depositPercentage: number;
  approvalLink?: string;
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

function generateQuoteHtml(params: QuoteEmailParams & { orderId?: string }): string {
  const {
    companyName,
    companyEmail,
    headerBgColor,
    headerTextColor,
    footerText,
    logoUrl,
    customHtml,
    customerName,
    quoteNumber,
    date,
    expiresAt,
    customerEmail: custEmail,
    lineItemsHtml,
    subtotal,
    depositRequired,
    depositAmount,
    depositPercentage,
    orderId,
    approvalLink,
  } = params;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const acceptQuoteUrl = orderId ? `${supabaseUrl}/functions/v1/accept-quote?orderId=${orderId}` : "";
  
  // Use approval link if provided, otherwise use direct accept URL
  const actionUrl = approvalLink || acceptQuoteUrl;
  
  const acceptButtonHtml = actionUrl
    ? `<div style="text-align: center; margin: 32px 0;">
         <a href="${actionUrl}" style="display: inline-block; background: #28a745; color: white; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
           ${depositRequired && depositAmount > 0 ? 'Accept Quote & Pay Deposit' : 'Accept Quote'}
         </a>
         <p style="font-size: 12px; color: #666; margin-top: 8px;">Click the button above to review and accept this quote.</p>
       </div>`
    : '';

  const expirationWarningHtml = expiresAt
    ? `<div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px; margin: 16px 0; text-align: center;">
         <p style="margin: 0; color: #856404; font-size: 14px;">⏰ <strong>This quote expires on ${expiresAt}</strong></p>
       </div>`
    : '';

  if (customHtml) {
    return customHtml
      .replace(/\{\{company_name\}\}/g, companyName)
      .replace(/\{\{company_email\}\}/g, companyEmail)
      .replace(/\{\{customer_name\}\}/g, customerName)
      .replace(/\{\{quote_number\}\}/g, quoteNumber)
      .replace(/\{\{date\}\}/g, date)
      .replace(/\{\{expires_at\}\}/g, expiresAt || '')
      .replace(/\{\{expiration_warning\}\}/g, expirationWarningHtml)
      .replace(/\{\{customer_email\}\}/g, custEmail || '')
      .replace(/\{\{line_items\}\}/g, lineItemsHtml)
      .replace(/\{\{subtotal\}\}/g, `$${subtotal.toFixed(2)}`)
      .replace(/\{\{logo_url\}\}/g, logoUrl)
      .replace(/\{\{accept_button\}\}/g, acceptButtonHtml)
      .replace(/\{\{deposit_info\}\}/g, depositRequired && depositAmount > 0 
        ? `<tr><td colspan="3" style="padding: 8px; text-align: right;">Deposit Required (${depositPercentage}%):</td><td style="padding: 8px; text-align: right;">$${depositAmount.toFixed(2)}</td></tr>`
        : '');
  }

  const headerContent = logoUrl 
    ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 80px; max-width: 300px;" />`
    : `<h1 style="color: ${headerTextColor}; margin: 0; font-size: 24px; font-weight: bold;">${companyName.toUpperCase()}</h1>`;

  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family: 'Open Sans', Arial, sans-serif; background: #ffffff; color: #222; margin: 0; padding: 0;"><div style="background: ${headerBgColor}; padding: 30px; text-align: center;">${headerContent}</div><div style="max-width: 600px; margin: 0 auto; padding: 30px 20px;"><h2 style="font-size: 20px; margin-bottom: 16px;">Hello ${customerName},</h2><p style="margin-bottom: 16px; line-height: 1.6;">Thank you for your interest in ${companyName}. Please find your quote details below.</p><div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 16px;"><p style="margin: 8px 0;"><strong>Quote Number:</strong> ${quoteNumber}</p><p style="margin: 8px 0;"><strong>Date:</strong> ${date}</p>${expiresAt ? `<p style="margin: 8px 0;"><strong>Expires:</strong> ${expiresAt}</p>` : ''}<p style="margin: 8px 0;"><strong>Customer:</strong> ${customerName}</p>${custEmail ? `<p style="margin: 8px 0;"><strong>Email:</strong> ${custEmail}</p>` : ''}</div>${expirationWarningHtml}<div style="margin-bottom: 24px;"><h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Line Items</h3><table style="width: 100%; border-collapse: collapse; font-size: 14px;"><thead><tr style="background: #f0f0f0; border-bottom: 2px solid #ddd;"><th style="padding: 8px; text-align: left;">SKU</th><th style="padding: 8px; text-align: left;">Quantity</th><th style="padding: 8px; text-align: right;">Unit Price</th><th style="padding: 8px; text-align: right;">Total</th></tr></thead><tbody>${lineItemsHtml}</tbody><tfoot><tr style="border-top: 2px solid #ddd; font-weight: 600;"><td colspan="3" style="padding: 8px; text-align: right;">Subtotal:</td><td style="padding: 8px; text-align: right;">$${subtotal.toFixed(2)}</td></tr>${depositRequired && depositAmount > 0 ? `<tr><td colspan="3" style="padding: 8px; text-align: right;">Deposit Required (${depositPercentage}%):</td><td style="padding: 8px; text-align: right;">$${depositAmount.toFixed(2)}</td></tr>` : ''}</tfoot></table></div>${acceptButtonHtml}<p style="margin-bottom: 16px; line-height: 1.6;">This quote is valid for ${expiresAt ? `until ${expiresAt}` : '30 days'}. If you have any questions or would like to proceed with this order, please reply to this email or contact us.</p>${depositRequired && depositAmount > 0 ? `<div style="background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 4px; margin-bottom: 16px;"><strong>Note:</strong> A ${depositPercentage}% deposit ($${depositAmount.toFixed(2)}) is required before production begins.</div>` : ''}<p style="line-height: 1.6;">${footerText}</p></div><div style="background: ${headerBgColor}; padding: 20px; text-align: center; margin-top: 40px;"><p style="margin: 8px 0; font-weight: 500;">${companyName}<br>${companyEmail}</p><p style="font-size: 12px; color: #666; margin: 8px 0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p></div></body></html>`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateQuoteRequest {
  orderId?: string;
  testEmail?: string;
  testMode?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, testEmail, testMode }: GenerateQuoteRequest = await req.json();
    console.log("Generating quote for order:", orderId, "Test mode:", testMode);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch quote template from email_templates table
    const { data: templateData } = await supabase
      .from("email_templates")
      .select("custom_html")
      .eq("template_type", "quote")
      .single();

    // Fetch settings for company info
    const { data: templateSettings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["company_name", "company_email", "quote_header_bg_color", "quote_header_text_color", "quote_footer_text", "company_logo_url"]);
    
    const settings: Record<string, string> = {};
    templateSettings?.forEach((s) => {
      settings[s.key] = s.value;
    });

    const companyName = settings.company_name || "Nexus Aminos";
    const companyEmail = settings.company_email || "info@nexusaminos.com";
    const headerBgColor = settings.quote_header_bg_color || "#c2e4fb";
    const headerTextColor = settings.quote_header_text_color || "#000000";
    const footerText = settings.quote_footer_text || "We look forward to working with you!";
    const logoUrl = settings.company_logo_url || "";
    const customHtml = templateData?.custom_html || "";

    // Handle test mode - use global SMTP config for test emails
    if (testMode && testEmail) {
      const smtpConfig = await getSmtpConfig(supabase, null);
      
      if (!smtpConfig) {
        throw new Error('SMTP configuration not available');
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

      const testHtml = generateQuoteHtml({
        companyName,
        companyEmail,
        headerBgColor,
        headerTextColor,
        footerText,
        logoUrl,
        customHtml,
        customerName: "Test Customer",
        quoteNumber: "TEST-001",
        date: new Date().toLocaleDateString(),
        customerEmail: testEmail,
        lineItemsHtml: '<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px;">TEST-SKU</td><td style="padding: 8px;">10 (100 bottles)</td><td style="padding: 8px; text-align: right;">$50.00</td><td style="padding: 8px; text-align: right;">$500.00</td></tr>',
        subtotal: 500,
        depositRequired: true,
        depositAmount: 125,
        depositPercentage: 25,
        orderId: undefined, // No order ID for test emails
      });

      await client.send({
        from: `${companyName} <${smtpConfig.user}>`,
        to: testEmail,
        subject: `Test Quote from ${companyName}`,
        html: testHtml,
      });

      await client.close();

      console.log("Test quote sent successfully to", testEmail);

      return new Response(
        JSON.stringify({ success: true, message: "Test quote sent" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (!orderId) {
      throw new Error("Order ID is required");
    }

    // Fetch order details with customer and line items
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .select(`
        *,
        customer:customers (
          name,
          email,
          phone,
          quote_expiration_days
        ),
        sales_order_lines (
          id,
          qty_entered,
          bottle_qty,
          unit_price,
          line_subtotal,
          sku:skus (
            code,
            description
          )
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    const customerEmail = order.customer?.email || "";
    const customerName = order.customer?.name || "Customer";
    const depositAmount = order.deposit_amount || 0;
    const depositPercentage = order.subtotal > 0 ? Math.round((depositAmount / order.subtotal) * 100) : 0;

    // Generate approval link using the quote token
    const baseUrl = Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app') || "";
    const approvalLink = `${baseUrl}/quote-approval?token=${order.quote_link_token}`;

    // Get SMTP config (brand-specific or global fallback)
    const smtpConfig = await getSmtpConfig(supabase, order.brand_id);
    
    if (!smtpConfig) {
      throw new Error('SMTP configuration not available');
    }

    const effectivePort = smtpConfig.host.includes("protonmail") ? 465 : smtpConfig.port;
    const useTls = effectivePort === 465;

    // Generate line items HTML
    let lineItemsHtml = '';
    for (const line of order.sales_order_lines) {
      lineItemsHtml += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px;">${line.sku?.code || "N/A"}</td><td style="padding: 8px;">${line.qty_entered} (${line.bottle_qty} bottles)</td><td style="padding: 8px; text-align: right;">$${line.unit_price.toFixed(2)}</td><td style="padding: 8px; text-align: right;">$${line.line_subtotal.toFixed(2)}</td></tr>`;
    }

    // Determine quote expiration days using hierarchy: order > customer > default
    let expirationDays = 7; // fallback default
    
    // Fetch default setting
    const { data: defaultSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "default_quote_expiration_days")
      .single();
    
    if (defaultSetting?.value) {
      expirationDays = parseInt(defaultSetting.value);
    }
    
    // Override with customer-specific setting if exists
    if (order.customer?.quote_expiration_days) {
      expirationDays = order.customer.quote_expiration_days;
    }
    
    // Override with order-specific setting if exists
    if (order.quote_expiration_days) {
      expirationDays = order.quote_expiration_days;
    }

    // Calculate quote expiration date
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + expirationDays);
    const expiresAtFormatted = expirationDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    console.log(`Quote expiration: ${expirationDays} days (expires: ${expiresAtFormatted})`);

    // Update order with expiration date and status
    const { error: updateError } = await supabase
      .from("sales_orders")
      .update({ 
        quote_expires_at: expirationDate.toISOString(),
        status: "quoted"
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Error updating order with expiration date:", updateError);
    }

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

    const emailHtml = generateQuoteHtml({
      companyName,
      companyEmail,
      headerBgColor,
      headerTextColor,
      footerText,
      logoUrl,
      customHtml,
      customerName,
      quoteNumber: order.human_uid,
      date: new Date(order.created_at).toLocaleDateString(),
      expiresAt: expiresAtFormatted,
      customerEmail: order.customer?.email,
      lineItemsHtml,
      subtotal: order.subtotal,
      depositRequired: order.deposit_required,
      depositAmount,
      depositPercentage,
      orderId: order.id,
      approvalLink,
    });

    await client.send({
      from: `${companyName} <${smtpConfig.user}>`,
      to: customerEmail,
      subject: `Quote ${order.human_uid} from ${companyName}`,
      html: emailHtml,
    });

    await client.close();

    console.log("Quote generated and sent successfully to", customerEmail);

    return new Response(
      JSON.stringify({ success: true, message: "Quote generated and sent" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error generating quote:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
