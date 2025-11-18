import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RenewQuoteRequest {
  orderId: string;
  additionalDays?: number; // Optional: extend by specific days, defaults to original quote_expiration_days
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authentication required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Create client with user's auth token for authorization checks
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Invalid authentication token");
    }

    const { orderId, additionalDays }: RenewQuoteRequest = await req.json();

    console.log(`Renewing quote for order: ${orderId} by user: ${user.id}`);

    // Use service role key for database operations after auth check
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the order details and verify authorization
    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select(`
        *,
        customer:customers(
          id,
          name,
          email,
          user_id
        ),
        sales_order_lines(
          qty_entered,
          bottle_qty,
          unit_price,
          line_subtotal,
          sell_mode,
          sku:skus(code, description)
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;
    if (!order) throw new Error('Order not found');
    if (!order.customer?.email) throw new Error('Customer email not found');

    // Verify the authenticated user owns this customer
    if (order.customer.user_id !== user.id) {
      console.error("Authorization failed: user does not own this order");
      throw new Error("You are not authorized to renew this quote");
    }

    // Calculate new expiration date
    const daysToAdd = additionalDays || order.quote_expiration_days || 30;
    const newExpirationDate = new Date();
    newExpirationDate.setDate(newExpirationDate.getDate() + daysToAdd);

    // Update the order with new expiration date
    const { error: updateError } = await supabase
      .from('sales_orders')
      .update({ 
        quote_expires_at: newExpirationDate.toISOString(),
        quote_expiration_days: daysToAdd 
      })
      .eq('id', orderId);

    if (updateError) throw updateError;

    console.log(`Updated order expiration to: ${newExpirationDate}`);

    // Fetch email settings
    const { data: emailSettings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 
                  'company_name', 'company_email', 'email_header_bg_color', 
                  'email_header_text_color', 'email_footer_text', 'company_logo_url']);

    const settings: Record<string, string> = {};
    emailSettings?.forEach(s => {
      settings[s.key] = s.value;
    });

    // Fetch quote renewal email template
    const { data: template } = await supabase
      .from('email_templates')
      .select('subject, custom_html')
      .eq('template_type', 'quote_renewal')
      .single();

    // Generate line items HTML
    const lineItemsHtml = order.sales_order_lines.map((line: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${line.sku.code}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${line.sku.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${line.qty_entered} ${line.sell_mode === 'kit' ? 'kits' : 'pieces'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${line.unit_price.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${line.line_subtotal.toFixed(2)}</td>
      </tr>
    `).join('');

    const approvalLink = `${supabaseUrl.replace('/functions/v1', '')}/quote/${order.quote_link_token}`;

    // Try to send email notification (non-blocking - quote renewal succeeds even if email fails)
    let emailSent = false;
    try {
      // Build email HTML
      const emailHtml = template?.custom_html
        ? template.custom_html
            .replace(/\{\{company_name\}\}/g, settings.company_name || 'Company')
            .replace(/\{\{company_email\}\}/g, settings.company_email || '')
            .replace(/\{\{customer_name\}\}/g, order.customer.name)
            .replace(/\{\{quote_number\}\}/g, order.human_uid)
            .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
            .replace(/\{\{expires_at\}\}/g, newExpirationDate.toLocaleDateString())
            .replace(/\{\{customer_email\}\}/g, order.customer.email)
            .replace(/\{\{line_items\}\}/g, lineItemsHtml)
            .replace(/\{\{subtotal\}\}/g, `$${order.subtotal.toFixed(2)}`)
            .replace(/\{\{logo_url\}\}/g, settings.company_logo_url || '')
            .replace(/\{\{approval_link\}\}/g, approvalLink)
            .replace(/\{\{expiration_warning\}\}/g, `<div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; padding: 12px; margin: 16px 0; text-align: center;">
              <p style="margin: 0; color: #065f46; font-size: 14px;">✓ <strong>Quote Extended! New expiration date: ${newExpirationDate.toLocaleDateString()}</strong></p>
            </div>`)
        : `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${settings.email_header_bg_color || '#000'}; color: ${settings.email_header_text_color || '#fff'}; padding: 20px; text-align: center;">
              <h1>Quote Renewed</h1>
            </div>
            <div style="padding: 20px;">
              <p>Dear ${order.customer.name},</p>
              <p>Good news! Your quote <strong>${order.human_uid}</strong> has been extended.</p>
              <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; padding: 12px; margin: 16px 0; text-align: center;">
                <p style="margin: 0; color: #065f46; font-size: 14px;">✓ <strong>New expiration date: ${newExpirationDate.toLocaleDateString()}</strong></p>
              </div>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${approvalLink}" style="display: inline-block; background: #28a745; color: white; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  View & Accept Quote
                </a>
              </div>
              <p>If you have any questions, please contact us at ${settings.company_email || 'support@company.com'}</p>
            </div>
            <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #666;">
              ${settings.email_footer_text || ''}
            </div>
          </div>
        `;

      // Send email
      const client = new SMTPClient({
        connection: {
          hostname: settings.smtp_host,
          port: parseInt(settings.smtp_port),
          tls: true,
          auth: {
            username: settings.smtp_user,
            password: settings.smtp_password,
          },
        },
      });

      await client.send({
        from: settings.company_email || settings.smtp_user,
        to: order.customer.email,
        subject: template?.subject?.replace(/\{\{quote_number\}\}/g, order.human_uid) || `Quote ${order.human_uid} Extended`,
        content: emailHtml,
        html: emailHtml,
      });

      await client.close();
      emailSent = true;
      console.log(`Quote renewal email sent to ${order.customer.email}`);
    } catch (emailError: any) {
      console.error('Failed to send email notification:', emailError.message);
      console.log('Quote renewal successful, but email notification could not be sent');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: emailSent 
          ? 'Quote renewed and customer notified'
          : 'Quote renewed successfully (email notification failed)',
        newExpirationDate: newExpirationDate.toISOString(),
        emailSent
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error('Error renewing quote:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
