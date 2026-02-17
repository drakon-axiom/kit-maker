import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
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

// Security: Sanitize email header values to prevent CRLF injection
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]/g, "");
}

interface InvoiceEmailRequest {
  invoiceId: string;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const generateInvoiceEmailHtml = (
  brandName: string,
  brandLogoUrl: string | null,
  brandEmail: string | null,
  brandPhone: string | null,
  brandAddress: string | null,
  primaryColor: string,
  customerName: string,
  invoiceNo: string,
  invoiceType: string,
  orderNumber: string,
  subtotal: number,
  tax: number,
  total: number,
  issuedAt: string,
  lineItems: Array<{ sku_code: string; description: string; qty: number; unit_price: number; line_subtotal: number }>,
  paymentConfig: {
    stripe_enabled?: boolean | null;
    cashapp_tag?: string | null;
    paypal_checkout_enabled?: boolean | null;
    paypal_email?: string | null;
    wire_bank_name?: string | null;
    wire_routing_number?: string | null;
    wire_account_number?: string | null;
    btcpay_server_url?: string | null;
  },
  portalUrl: string
): string => {
  const typeLabel = invoiceType === 'deposit' ? 'Deposit Invoice' : 'Invoice';
  const formattedDate = new Date(issuedAt).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const lineItemsHtml = lineItems.map(item => 
    `<tr><td style="padding:12px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:14px;">${item.sku_code}</td><td style="padding:12px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:14px;">${item.description}</td><td style="padding:12px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:14px;text-align:center;">${item.qty}</td><td style="padding:12px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:14px;text-align:right;">${formatCurrency(item.unit_price)}</td><td style="padding:12px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:14px;text-align:right;">${formatCurrency(item.line_subtotal)}</td></tr>`
  ).join('');

  // Build HTML without unnecessary whitespace to avoid quoted-printable encoding issues
  const taxRow = tax > 0 ? `<tr><td style="padding:8px 0;font-size:14px;color:#666;">Tax</td><td style="padding:8px 0;font-size:14px;color:#333;text-align:right;">${formatCurrency(tax)}</td></tr>` : '';
  
  const logoOrName = brandLogoUrl 
    ? `<img src="${brandLogoUrl}" alt="${brandName}" style="max-width:180px;max-height:60px;">` 
    : `<h1 style="color:#ffffff;margin:0;font-size:24px;">${brandName}</h1>`;
  
  const emailLink = brandEmail ? `<p style="margin:0 0 5px;font-size:13px;color:#666;"><a href="mailto:${brandEmail}" style="color:${primaryColor};">${brandEmail}</a></p>` : '';
  const phoneText = brandPhone ? `<p style="margin:0 0 5px;font-size:13px;color:#666;">${brandPhone}</p>` : '';
  const addressText = brandAddress ? `<p style="margin:0;font-size:13px;color:#666;">${brandAddress}</p>` : '';

  // Build payment methods section
  const paymentMethods: string[] = [];
  
  if (paymentConfig.stripe_enabled) {
    paymentMethods.push(`<div style="margin-bottom:12px;"><strong style="color:#333;">💳 Credit/Debit Card</strong><br/><span style="font-size:13px;color:#666;">Pay instantly with your card</span></div>`);
  }
  
  if (paymentConfig.cashapp_tag) {
    const cashtag = paymentConfig.cashapp_tag.replace('$', '');
    const cashappLink = `https://cash.app/$${cashtag}/${total.toFixed(2)}`;
    paymentMethods.push(`<div style="margin-bottom:12px;"><strong style="color:#333;">📱 CashApp</strong><br/><a href="${cashappLink}" style="color:${primaryColor};font-size:13px;">Pay ${formatCurrency(total)} to ${paymentConfig.cashapp_tag}</a></div>`);
  }
  
  if (paymentConfig.paypal_checkout_enabled || paymentConfig.paypal_email) {
    const paypalText = paymentConfig.paypal_email ? `Send to: ${paymentConfig.paypal_email}` : 'Pay via PayPal checkout';
    paymentMethods.push(`<div style="margin-bottom:12px;"><strong style="color:#333;">🅿️ PayPal</strong><br/><span style="font-size:13px;color:#666;">${paypalText}</span></div>`);
  }
  
  if (paymentConfig.btcpay_server_url) {
    paymentMethods.push(`<div style="margin-bottom:12px;"><strong style="color:#333;">₿ Cryptocurrency</strong><br/><span style="font-size:13px;color:#666;">Bitcoin, Lightning, USDT, USDC & more</span></div>`);
  }
  
  if (paymentConfig.wire_bank_name && paymentConfig.wire_routing_number && paymentConfig.wire_account_number) {
    paymentMethods.push(`<div style="margin-bottom:12px;"><strong style="color:#333;">🏦 Wire Transfer</strong><br/><span style="font-size:13px;color:#666;">Bank: ${paymentConfig.wire_bank_name}<br/>Routing: ${paymentConfig.wire_routing_number}<br/>Account: ${paymentConfig.wire_account_number}<br/>Reference: Order ${orderNumber}</span></div>`);
  }

  const paymentSectionHtml = paymentMethods.length > 0 
    ? `<tr><td style="padding:0 40px 30px;"><div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;"><h3 style="margin:0 0 15px;font-size:16px;color:#333;">💳 Payment Options</h3>${paymentMethods.join('')}<div style="border-top:1px solid #e2e8f0;margin-top:15px;padding-top:15px;"><a href="${portalUrl}" style="display:inline-block;background-color:${primaryColor};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500;">Pay in Customer Portal</a><p style="margin:10px 0 0;font-size:12px;color:#888;">Log in to view all payment options and pay securely</p></div></div></td></tr>`
    : `<tr><td style="padding:0 40px 30px;"><div style="text-align:center;"><a href="${portalUrl}" style="display:inline-block;background-color:${primaryColor};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500;">Pay in Customer Portal</a></div></td></tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${typeLabel} ${invoiceNo}</title></head><body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);"><tr><td style="background-color:${primaryColor};padding:30px;text-align:center;">${logoOrName}</td></tr><tr><td style="padding:30px 40px 20px;"><h2 style="margin:0 0 10px;color:#333;font-size:28px;">${typeLabel}</h2><p style="margin:0;color:#666;font-size:16px;">Invoice #${invoiceNo}</p><p style="margin:5px 0 0;color:#666;font-size:14px;">Order: ${orderNumber}</p><p style="margin:5px 0 0;color:#666;font-size:14px;">Date: ${formattedDate}</p></td></tr><tr><td style="padding:0 40px 20px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:15px;background-color:#f9f9f9;border-radius:6px;"><p style="margin:0 0 5px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Bill To</p><p style="margin:0;font-size:16px;color:#333;font-weight:bold;">${customerName}</p></td></tr></table></td></tr><tr><td style="padding:0 40px 20px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;overflow:hidden;"><tr style="background-color:#f5f5f5;"><th style="padding:12px;text-align:left;font-family:Arial,sans-serif;font-size:12px;color:#666;text-transform:uppercase;">SKU</th><th style="padding:12px;text-align:left;font-family:Arial,sans-serif;font-size:12px;color:#666;text-transform:uppercase;">Description</th><th style="padding:12px;text-align:center;font-family:Arial,sans-serif;font-size:12px;color:#666;text-transform:uppercase;">Qty</th><th style="padding:12px;text-align:right;font-family:Arial,sans-serif;font-size:12px;color:#666;text-transform:uppercase;">Unit Price</th><th style="padding:12px;text-align:right;font-family:Arial,sans-serif;font-size:12px;color:#666;text-transform:uppercase;">Total</th></tr>${lineItemsHtml}</table></td></tr><tr><td style="padding:0 40px 30px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td width="60%"></td><td width="40%"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:8px 0;font-size:14px;color:#666;">Subtotal</td><td style="padding:8px 0;font-size:14px;color:#333;text-align:right;">${formatCurrency(subtotal)}</td></tr>${taxRow}<tr><td style="padding:12px 0;font-size:18px;color:#333;font-weight:bold;border-top:2px solid #333;">Amount Due</td><td style="padding:12px 0;font-size:18px;color:${primaryColor};font-weight:bold;text-align:right;border-top:2px solid #333;">${formatCurrency(total)}</td></tr></table></td></tr></table></td></tr>${paymentSectionHtml}<tr><td style="background-color:#f5f5f5;padding:25px 40px;text-align:center;border-top:1px solid #eee;"><p style="margin:0 0 5px;font-size:14px;color:#333;font-weight:bold;">${brandName}</p>${emailLink}${phoneText}${addressText}<p style="margin:15px 0 0;font-size:12px;color:#999;">&copy; ${new Date().getFullYear()} ${brandName}. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Require admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabaseAuth.auth.getUser(token);
    if (!authData.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has admin or operator role
    const supabaseRoleCheck = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: roles } = await supabaseRoleCheck
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id);

    if (!roles || !roles.some(r => r.role === "admin" || r.role === "operator")) {
      return new Response(
        JSON.stringify({ success: false, error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { invoiceId }: InvoiceEmailRequest = await req.json();

    if (!invoiceId) {
      throw new Error("Invoice ID is required");
    }

    console.log(`[send-invoice-email] Processing invoice: ${invoiceId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invoice with related data
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        sales_orders!invoices_so_id_fkey (
          id,
          human_uid,
          customer_id,
          brand_id,
          customers (
            id,
            name,
            email
          ),
      brands (
        id,
        name,
        logo_url,
        primary_color,
        contact_email,
        contact_phone,
        contact_address,
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_password,
        stripe_enabled,
        cashapp_tag,
        paypal_checkout_enabled,
        paypal_email,
        wire_bank_name,
        wire_routing_number,
        wire_account_number,
        btcpay_server_url
      ),
          sales_order_lines (
            id,
            qty_entered,
            unit_price,
            line_subtotal,
            skus (
              code,
              description
            )
          )
        )
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      console.error("[send-invoice-email] Invoice fetch error:", invoiceError);
      throw new Error(`Invoice not found: ${invoiceError?.message || "Unknown error"}`);
    }

    // Security: Don't log full invoice data

    const order = invoice.sales_orders;
    if (!order) {
      throw new Error("Order not found for this invoice");
    }

    const customer = order.customers;
    if (!customer?.email) {
      throw new Error("Customer email not found");
    }

    // Get brand from order, or fetch default brand if none assigned
    let brand = order.brands;
    if (!brand) {
      console.log("[send-invoice-email] No brand on order, fetching default brand");
      const { data: defaultBrand } = await supabase
        .from("brands")
        .select("id, name, logo_url, primary_color, contact_email, contact_phone, contact_address, smtp_host, smtp_port, smtp_user, smtp_password, stripe_enabled, cashapp_tag, paypal_checkout_enabled, paypal_email, wire_bank_name, wire_routing_number, wire_account_number, btcpay_server_url")
        .eq("is_default", true)
        .single();
      brand = defaultBrand;
    }

    console.log("[send-invoice-email] Brand:", brand?.name || "No brand found");

    const brandName = brand?.name || "Company";
    const brandLogoUrl = brand?.logo_url || null;
    const brandEmail = brand?.contact_email || null;
    const brandPhone = brand?.contact_phone || null;
    const brandAddress = brand?.contact_address || null;
    const primaryColor = brand?.primary_color || "#2563eb";

    // Build portal URL for the order
    const portalUrl = `https://naprodmgr.lovable.app/customer/orders/${order.id}`;

    // Prepare line items from parent order
    const lineItems: Array<{ sku_code: string; description: string; qty: number; unit_price: number; line_subtotal: number }> = (order.sales_order_lines || []).map((line: any) => ({
      sku_code: line.skus?.code || "N/A",
      description: line.skus?.description || "Item",
      qty: line.qty_entered,
      unit_price: line.unit_price,
      line_subtotal: line.line_subtotal,
    }));

    // For final invoices, also fetch add-on order line items
    if (invoice.type === 'final') {
      const { data: addons } = await supabase
        .from('order_addons')
        .select(`
          addon_order:sales_orders!order_addons_addon_so_id_fkey (
            id,
            human_uid,
            sales_order_lines (
              id,
              qty_entered,
              unit_price,
              line_subtotal,
              skus (
                code,
                description
              )
            )
          )
        `)
        .eq('parent_so_id', order.id);

      // Add add-on line items
      (addons || []).forEach((addon: any) => {
        const addonOrder = addon.addon_order;
        if (addonOrder?.sales_order_lines) {
          addonOrder.sales_order_lines.forEach((line: any) => {
            lineItems.push({
              sku_code: `${line.skus?.code || "N/A"} (${addonOrder.human_uid})`,
              description: line.skus?.description || "Item",
              qty: line.qty_entered,
              unit_price: line.unit_price,
              line_subtotal: line.line_subtotal,
            });
          });
        }
      });

      console.log(`[send-invoice-email] Including ${lineItems.length} total line items (parent + add-ons)`);
    }

    // Generate email HTML
    const emailHtml = generateInvoiceEmailHtml(
      brandName,
      brandLogoUrl,
      brandEmail,
      brandPhone,
      brandAddress,
      primaryColor,
      customer.name,
      invoice.invoice_no,
      invoice.type,
      order.human_uid,
      invoice.subtotal,
      invoice.tax,
      invoice.total,
      invoice.issued_at,
      lineItems,
      {
        stripe_enabled: brand?.stripe_enabled,
        cashapp_tag: brand?.cashapp_tag,
        paypal_checkout_enabled: brand?.paypal_checkout_enabled,
        paypal_email: brand?.paypal_email,
        wire_bank_name: brand?.wire_bank_name,
        wire_routing_number: brand?.wire_routing_number,
        wire_account_number: brand?.wire_account_number,
        btcpay_server_url: brand?.btcpay_server_url,
      },
      portalUrl
    );

    const subject = `${invoice.type === 'deposit' ? 'Deposit Invoice' : 'Invoice'} ${invoice.invoice_no} from ${brandName}`;

    // Check if brand has SMTP configured
    const smtpHost = brand?.smtp_host;
    const smtpPort = brand?.smtp_port;
    const smtpUser = brand?.smtp_user;
    const smtpPassword = brand?.smtp_password;

    if (smtpHost && smtpPort && smtpUser && smtpPassword) {
      // Force port 465 for ProtonMail - STARTTLS on 587 has issues in Deno
      const isProtonMail = smtpHost.includes("proton");
      const effectivePort = (isProtonMail && smtpPort === 587) ? 465 : smtpPort;
      const useTls = effectivePort === 465;
      
      console.log(`[send-invoice-email] Using brand SMTP: ${smtpHost}:${effectivePort} (tls: ${useTls})`);
      
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

      try {
        await client.send({
          from: sanitizeHeaderValue(brandEmail || smtpUser),
          to: sanitizeHeaderValue(customer.email),
          subject: sanitizeHeaderValue(subject),
          content: "Please view this email in an HTML-compatible email client.",
          html: emailHtml,
        });

        await client.close();
      } catch (smtpError: unknown) {
        console.error("[send-invoice-email] Brand SMTP error:", smtpError);
        await client.close();
        const errMsg = smtpError instanceof Error ? smtpError.message : String(smtpError);
        throw new Error(`Failed to send via brand SMTP: ${errMsg}`);
      }
    } else {
      // Fall back to global SMTP
      const globalSmtpHost = Deno.env.get("SMTP_HOST");
      const envPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
      const globalSmtpUser = Deno.env.get("SMTP_USER");
      const globalSmtpPassword = Deno.env.get("SMTP_PASSWORD");
      const globalSmtpFrom = Deno.env.get("SMTP_FROM") || globalSmtpUser;

      if (!globalSmtpHost || !globalSmtpUser || !globalSmtpPassword) {
        throw new Error("No SMTP configuration available (neither brand nor global)");
      }

      // Force port 465 for ProtonMail - STARTTLS on 587 has issues in Deno
      const isProtonMail = globalSmtpHost.includes("proton");
      const effectivePort = (isProtonMail && envPort === 587) ? 465 : envPort;
      const useTls = effectivePort === 465;

      console.log(`[send-invoice-email] Using global SMTP: ${globalSmtpHost}:${effectivePort} (tls: ${useTls})`);
      
      const client = new SMTPClient({
        connection: {
          hostname: globalSmtpHost,
          port: effectivePort,
          tls: useTls,
          auth: {
            username: globalSmtpUser,
            password: globalSmtpPassword,
          },
        },
      });

      try {
        await client.send({
          from: sanitizeHeaderValue(globalSmtpFrom || globalSmtpUser),
          to: sanitizeHeaderValue(customer.email),
          subject: sanitizeHeaderValue(subject),
          content: "Please view this email in an HTML-compatible email client.",
          html: emailHtml,
        });

        await client.close();
      } catch (smtpError: unknown) {
        console.error("[send-invoice-email] Global SMTP error:", smtpError);
        await client.close();
        const errMsg = smtpError instanceof Error ? smtpError.message : String(smtpError);
        throw new Error(`Failed to send via global SMTP: ${errMsg}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Invoice sent to ${customer.email}` 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error: unknown) {
    console.error("[send-invoice-email] Error:", error);
    // Security: Generic error message
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to send invoice email"
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
