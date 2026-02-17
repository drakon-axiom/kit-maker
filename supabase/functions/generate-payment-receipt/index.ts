import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { transactionId } = await req.json();

    // Fetch transaction details
    const { data: transaction, error } = await supabaseClient
      .from("payment_transactions")
      .select(`
        *,
        sales_orders (
          human_uid,
          customer_id,
          customers (
            name,
            email,
            shipping_address_line1,
            shipping_city,
            shipping_state,
            shipping_zip
          )
        )
      `)
      .eq("id", transactionId)
      .single();

    if (error) throw error;

    // Security: Verify user owns this transaction's order
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdminOrOperator = roles?.some(r => r.role === "admin" || r.role === "operator");
    const txCustomer = transaction.sales_orders.customers as any;
    const txCustomerUserId = Array.isArray(txCustomer) ? txCustomer[0]?.user_id : txCustomer?.user_id;

    if (!isAdminOrOperator && txCustomerUserId !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const customers = transaction.sales_orders.customers as any;
    const customer = Array.isArray(customers) ? customers[0] : customers;
    const orderNumber = transaction.sales_orders.human_uid;
    const paymentDate = new Date(transaction.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Generate HTML for PDF
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #4F46E5; padding-bottom: 20px; }
          .header h1 { color: #4F46E5; font-size: 32px; margin-bottom: 10px; }
          .header .subtitle { color: #6b7280; font-size: 14px; }
          .receipt-badge { background-color: #10b981; color: white; padding: 10px 20px; border-radius: 5px; display: inline-block; margin: 20px 0; font-weight: bold; }
          .section { margin-bottom: 30px; }
          .section-title { font-size: 18px; font-weight: bold; color: #111827; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .info-row { margin-bottom: 10px; }
          .info-label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
          .info-value { font-size: 16px; font-weight: 600; color: #111827; margin-top: 5px; }
          .payment-details { background-color: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; padding: 25px; margin: 20px 0; }
          .amount-row { display: flex; justify-content: space-between; align-items: center; padding: 15px 0; border-bottom: 1px solid #e5e7eb; }
          .amount-row:last-child { border-bottom: none; font-size: 24px; font-weight: bold; color: #4F46E5; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PAYMENT RECEIPT</h1>
          <div class="subtitle">Official Payment Confirmation</div>
          <div class="receipt-badge">✓ PAID</div>
        </div>

        <div class="section">
          <div class="section-title">Receipt Information</div>
          <div class="info-grid">
            <div class="info-row">
              <div class="info-label">Receipt Number</div>
              <div class="info-value">${transaction.id.substring(0, 13).toUpperCase()}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Payment Date</div>
              <div class="info-value">${paymentDate}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Order Number</div>
              <div class="info-value">${orderNumber}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Transaction ID</div>
              <div class="info-value">${transaction.stripe_payment_intent?.substring(0, 20) || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Customer Information</div>
          <div class="info-row">
            <div class="info-label">Name</div>
            <div class="info-value">${customer.name}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Email</div>
            <div class="info-value">${customer.email}</div>
          </div>
          ${customer.shipping_address_line1 ? `
          <div class="info-row">
            <div class="info-label">Address</div>
            <div class="info-value">
              ${customer.shipping_address_line1}<br>
              ${customer.shipping_city}, ${customer.shipping_state} ${customer.shipping_zip}
            </div>
          </div>
          ` : ''}
        </div>

        <div class="section">
          <div class="section-title">Payment Details</div>
          <div class="payment-details">
            <div class="amount-row">
              <span class="info-label">Payment Type</span>
              <span class="info-value">${transaction.payment_type === 'deposit' ? 'Deposit Payment' : 'Final Payment'}</span>
            </div>
            <div class="amount-row">
              <span class="info-label">Payment Method</span>
              <span class="info-value">Credit Card (${transaction.payment_method})</span>
            </div>
            <div class="amount-row">
              <span class="info-label">Status</span>
              <span class="info-value">${transaction.status.toUpperCase()}</span>
            </div>
            <div class="amount-row">
              <span>TOTAL AMOUNT PAID</span>
              <span>$${Number(transaction.amount).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <p><strong>Thank you for your payment!</strong></p>
          <p style="margin-top: 10px;">This is a computer-generated receipt and is valid without signature.</p>
          <p>For questions, please contact support@yourcompany.com</p>
          <p style="margin-top: 20px;">Generated on ${new Date().toLocaleDateString('en-US')}</p>
        </div>
      </body>
      </html>
    `;

    // Convert HTML to PDF using a simple approach
    // For production, consider using a proper PDF library like jsPDF or puppeteer
    const pdfBuffer = new TextEncoder().encode(html);

    return new Response(pdfBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html",
        "Content-Disposition": `attachment; filename="receipt-${orderNumber}-${transaction.payment_type}.html"`,
      },
      status: 200,
    });
  } catch (error) {
    console.error("Error generating receipt:", error);
    // Security: Generic error message
    return new Response(JSON.stringify({ error: "Failed to generate receipt" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
