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
  customerEmail?: string;
  lineItemsHtml: string;
  subtotal: number;
  depositRequired: boolean;
  depositAmount: number;
  depositPercentage: number;
}

function generateQuoteHtml(params: QuoteEmailParams): string {
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
    customerEmail: custEmail,
    lineItemsHtml,
    subtotal,
    depositRequired,
    depositAmount,
    depositPercentage,
  } = params;

  if (customHtml) {
    return customHtml
      .replace(/\{\{company_name\}\}/g, companyName)
      .replace(/\{\{company_email\}\}/g, companyEmail)
      .replace(/\{\{customer_name\}\}/g, customerName)
      .replace(/\{\{quote_number\}\}/g, quoteNumber)
      .replace(/\{\{date\}\}/g, date)
      .replace(/\{\{customer_email\}\}/g, custEmail || '')
      .replace(/\{\{line_items\}\}/g, lineItemsHtml)
      .replace(/\{\{subtotal\}\}/g, `$${subtotal.toFixed(2)}`)
      .replace(/\{\{logo_url\}\}/g, logoUrl)
      .replace(/\{\{deposit_info\}\}/g, depositRequired && depositAmount > 0 
        ? `<tr><td colspan="3" style="padding: 8px; text-align: right;">Deposit Required (${depositPercentage}%):</td><td style="padding: 8px; text-align: right;">$${depositAmount.toFixed(2)}</td></tr>`
        : '');
  }

  const headerContent = logoUrl 
    ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 80px; max-width: 300px;" />`
    : `<h1 style="color: ${headerTextColor}; margin: 0; font-size: 24px; font-weight: bold;">${companyName.toUpperCase()}</h1>`;

  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family: 'Open Sans', Arial, sans-serif; background: #ffffff; color: #222; margin: 0; padding: 0;"><div style="background: ${headerBgColor}; padding: 30px; text-align: center;">${headerContent}</div><div style="max-width: 600px; margin: 0 auto; padding: 30px 20px;"><h2 style="font-size: 20px; margin-bottom: 16px;">Hello ${customerName},</h2><p style="margin-bottom: 16px; line-height: 1.6;">Thank you for your interest in ${companyName}. Please find your quote details below.</p><div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 16px;"><p style="margin: 8px 0;"><strong>Quote Number:</strong> ${quoteNumber}</p><p style="margin: 8px 0;"><strong>Date:</strong> ${date}</p><p style="margin: 8px 0;"><strong>Customer:</strong> ${customerName}</p>${custEmail ? `<p style="margin: 8px 0;"><strong>Email:</strong> ${custEmail}</p>` : ''}</div><div style="margin-bottom: 24px;"><h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Line Items</h3><table style="width: 100%; border-collapse: collapse; font-size: 14px;"><thead><tr style="background: #f0f0f0; border-bottom: 2px solid #ddd;"><th style="padding: 8px; text-align: left;">SKU</th><th style="padding: 8px; text-align: left;">Quantity</th><th style="padding: 8px; text-align: right;">Unit Price</th><th style="padding: 8px; text-align: right;">Total</th></tr></thead><tbody>${lineItemsHtml}</tbody><tfoot><tr style="border-top: 2px solid #ddd; font-weight: 600;"><td colspan="3" style="padding: 8px; text-align: right;">Subtotal:</td><td style="padding: 8px; text-align: right;">$${subtotal.toFixed(2)}</td></tr>${depositRequired && depositAmount > 0 ? `<tr><td colspan="3" style="padding: 8px; text-align: right;">Deposit Required (${depositPercentage}%):</td><td style="padding: 8px; text-align: right;">$${depositAmount.toFixed(2)}</td></tr>` : ''}</tfoot></table></div><p style="margin-bottom: 16px; line-height: 1.6;">This quote is valid for 30 days. If you have any questions or would like to proceed with this order, please reply to this email or contact us.</p>${depositRequired && depositAmount > 0 ? `<div style="background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 4px; margin-bottom: 16px;"><strong>Note:</strong> A ${depositPercentage}% deposit ($${depositAmount.toFixed(2)}) is required before production begins.</div>` : ''}<p style="line-height: 1.6;">${footerText}</p></div><div style="background: ${headerBgColor}; padding: 20px; text-align: center; margin-top: 40px;"><p style="margin: 8px 0; font-weight: 500;">${companyName}<br>${companyEmail}</p><p style="font-size: 12px; color: #666; margin: 8px 0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p></div></body></html>`;
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

    // Handle test mode
    if (testMode && testEmail) {
      const smtpHost = Deno.env.get("SMTP_HOST")!;
      const envPort = parseInt(Deno.env.get("SMTP_PORT") || "0");
      const smtpUser = Deno.env.get("SMTP_USER")!;
      const smtpPassword = Deno.env.get("SMTP_PASSWORD")!;
      const effectivePort = smtpHost?.includes("protonmail") ? 465 : (envPort || 465);
      const useTls = effectivePort === 465;

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
      });

      await client.send({
        from: `${companyName} <${smtpUser}>`,
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
          phone
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
      console.error("Order fetch error:", orderError);
      throw new Error("Order not found");
    }

    const customerEmail = order.customer?.email || "";
    const customerName = order.customer?.name || "Customer";
    const depositAmount = order.deposit_amount || 0;
    const depositPercentage = order.subtotal > 0 ? Math.round((depositAmount / order.subtotal) * 100) : 0;

    // Send email with PDF attachment
    const smtpHost = Deno.env.get("SMTP_HOST")!;
    const envPort = parseInt(Deno.env.get("SMTP_PORT") || "0");
    const smtpUser = Deno.env.get("SMTP_USER")!;
    const smtpPassword = Deno.env.get("SMTP_PASSWORD")!;
    const effectivePort = smtpHost?.includes("protonmail") ? 465 : (envPort || 465);
    const useTls = effectivePort === 465;

    // Generate line items HTML
    let lineItemsHtml = '';
    for (const line of order.sales_order_lines) {
      lineItemsHtml += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px;">${line.sku?.code || "N/A"}</td><td style="padding: 8px;">${line.qty_entered} (${line.bottle_qty} bottles)</td><td style="padding: 8px; text-align: right;">$${line.unit_price.toFixed(2)}</td><td style="padding: 8px; text-align: right;">$${line.line_subtotal.toFixed(2)}</td></tr>`;
    }

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
      customerEmail: order.customer?.email,
      lineItemsHtml,
      subtotal: order.subtotal,
      depositRequired: order.deposit_required,
      depositAmount,
      depositPercentage,
    });

    await client.send({
      from: `${companyName} <${smtpUser}>`,
      to: customerEmail,
      subject: `Quote ${order.human_uid} from ${companyName}`,
      html: emailHtml,
    });

    await client.close();

    // Update order status to 'quoted'
    await supabase
      .from("sales_orders")
      .update({ status: "quoted" })
      .eq("id", orderId);

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
