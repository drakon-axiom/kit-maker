import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

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

interface BrandedPDFRequest {
  type: 'invoice' | 'receipt';
  id: string; // invoice_id or payment_transaction_id
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { type, id } = await req.json() as BrandedPDFRequest;

    console.log(`Generating ${type} PDF for ID: ${id}`);

    let brandData, documentData, customerData, orderData;

    if (type === 'invoice') {
      // Fetch invoice data with related information
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          sales_orders:so_id (
            *,
            customers:customer_id (
              *,
              brands:brand_id (*)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (invoiceError) throw invoiceError;
      if (!invoice) throw new Error('Invoice not found');

      documentData = invoice;
      orderData = invoice.sales_orders;
      customerData = invoice.sales_orders.customers;
      brandData = invoice.sales_orders.customers.brands;
    } else {
      // Fetch payment transaction data
      const { data: payment, error: paymentError } = await supabase
        .from('payment_transactions')
        .select(`
          *,
          sales_orders:so_id (
            *,
            customers:customer_id (
              *,
              brands:brand_id (*)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (paymentError) throw paymentError;
      if (!payment) throw new Error('Payment transaction not found');

      documentData = payment;
      orderData = payment.sales_orders;
      customerData = payment.sales_orders.customers;
      brandData = payment.sales_orders.customers.brands;
    }

    // Generate HTML for the PDF
    const html = generateBrandedHTML(type, documentData, customerData, orderData, brandData);

    // Convert HTML to PDF using a simple approach
    const pdfBytes = await generatePDFFromHTML(html, brandData);

    console.log(`Successfully generated ${type} PDF`);

    // Return HTML document for download (can be opened in browser and printed to PDF)
    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${type}-${documentData.invoice_no || documentData.id}.html"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function generateBrandedHTML(
  type: string,
  documentData: any,
  customerData: any,
  orderData: any,
  brandData: any
): string {
  const isInvoice = type === 'invoice';
  const primaryColor = brandData?.primary_color ? `hsl(${brandData.primary_color})` : '#000000';
  const date = new Date(documentData.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Helvetica', 'Arial', sans-serif;
          padding: 40px;
          color: #333;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 3px solid ${primaryColor};
        }
        .logo {
          max-width: 200px;
          max-height: 80px;
        }
        .brand-info {
          text-align: right;
          color: #666;
        }
        .brand-info h1 {
          color: ${primaryColor};
          font-size: 24px;
          margin-bottom: 10px;
        }
        .document-title {
          font-size: 32px;
          color: ${primaryColor};
          margin-bottom: 30px;
          font-weight: bold;
        }
        .info-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 40px;
        }
        .info-box {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
        }
        .info-box h3 {
          color: ${primaryColor};
          margin-bottom: 10px;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .info-box p {
          margin: 5px 0;
          font-size: 14px;
          line-height: 1.6;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 30px 0;
        }
        .items-table th {
          background: ${primaryColor};
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: 600;
        }
        .items-table td {
          padding: 12px;
          border-bottom: 1px solid #dee2e6;
        }
        .items-table tr:last-child td {
          border-bottom: none;
        }
        .totals {
          margin-top: 30px;
          text-align: right;
        }
        .totals table {
          margin-left: auto;
          width: 300px;
        }
        .totals td {
          padding: 8px 15px;
        }
        .totals .total-row {
          background: ${primaryColor};
          color: white;
          font-weight: bold;
          font-size: 18px;
        }
        .footer {
          margin-top: 60px;
          padding-top: 20px;
          border-top: 2px solid #dee2e6;
          text-align: center;
          color: #666;
          font-size: 12px;
        }
        .status-badge {
          display: inline-block;
          padding: 5px 15px;
          background: ${documentData.status === 'paid' ? '#28a745' : '#ffc107'};
          color: white;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          ${brandData?.logo_url ? `<img src="${brandData.logo_url}" alt="${brandData.name}" class="logo">` : `<h1 style="color: ${primaryColor}">${brandData?.name || 'Company'}</h1>`}
        </div>
        <div class="brand-info">
          <h1>${brandData?.name || 'Company Name'}</h1>
          ${brandData?.contact_email ? `<p>${brandData.contact_email}</p>` : ''}
          ${brandData?.contact_phone ? `<p>${brandData.contact_phone}</p>` : ''}
          ${brandData?.contact_address ? `<p>${brandData.contact_address}</p>` : ''}
        </div>
      </div>

      <div class="document-title">
        ${isInvoice ? 'INVOICE' : 'PAYMENT RECEIPT'}
      </div>

      <div class="info-section">
        <div class="info-box">
          <h3>Bill To</h3>
          <p><strong>${customerData.name}</strong></p>
          ${customerData.email ? `<p>${customerData.email}</p>` : ''}
          ${customerData.phone ? `<p>${customerData.phone}</p>` : ''}
          ${customerData.billing_address_line1 ? `
            <p>${customerData.billing_address_line1}</p>
            ${customerData.billing_address_line2 ? `<p>${customerData.billing_address_line2}</p>` : ''}
            <p>${customerData.billing_city}, ${customerData.billing_state} ${customerData.billing_zip}</p>
          ` : ''}
        </div>
        <div class="info-box">
          <h3>Document Details</h3>
          <p><strong>${isInvoice ? 'Invoice' : 'Receipt'} #:</strong> ${documentData.invoice_no || documentData.id.slice(0, 8).toUpperCase()}</p>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Order #:</strong> ${orderData.human_uid}</p>
          ${isInvoice ? `<p><strong>Status:</strong> <span class="status-badge">${documentData.status}</span></p>` : ''}
          ${!isInvoice ? `<p><strong>Payment Method:</strong> ${documentData.payment_method}</p>` : ''}
        </div>
      </div>

      ${isInvoice ? `
        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Order ${orderData.human_uid}</td>
              <td style="text-align: right">$${documentData.subtotal.toFixed(2)}</td>
            </tr>
            ${documentData.tax > 0 ? `
              <tr>
                <td>Tax</td>
                <td style="text-align: right">$${documentData.tax.toFixed(2)}</td>
              </tr>
            ` : ''}
          </tbody>
        </table>

        <div class="totals">
          <table>
            <tr>
              <td>Subtotal:</td>
              <td style="text-align: right">$${documentData.subtotal.toFixed(2)}</td>
            </tr>
            ${documentData.tax > 0 ? `
              <tr>
                <td>Tax:</td>
                <td style="text-align: right">$${documentData.tax.toFixed(2)}</td>
              </tr>
            ` : ''}
            <tr class="total-row">
              <td>Total:</td>
              <td style="text-align: right">$${documentData.total.toFixed(2)}</td>
            </tr>
          </table>
        </div>
      ` : `
        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Payment for Order ${orderData.human_uid}</td>
              <td style="text-align: right">$${documentData.amount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="totals">
          <table>
            <tr class="total-row">
              <td>Amount Paid:</td>
              <td style="text-align: right">$${documentData.amount.toFixed(2)}</td>
            </tr>
          </table>
        </div>
      `}

      <div class="footer">
        <p>Thank you for your business!</p>
        ${brandData?.contact_email ? `<p>Questions? Contact us at ${brandData.contact_email}</p>` : ''}
      </div>
    </body>
    </html>
  `;
}

async function generatePDFFromHTML(html: string, brandData: any): Promise<ArrayBuffer> {
  // Convert HTML to a simple PDF representation
  // In production, integrate with a PDF rendering service like Puppeteer Cloud or similar
  
  const encoder = new TextEncoder();
  const htmlBytes = encoder.encode(html);
  
  // Return as ArrayBuffer for proper Response body type
  return htmlBytes.buffer;
}
