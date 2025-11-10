import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateQuoteRequest {
  orderId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId }: GenerateQuoteRequest = await req.json();
    console.log("Generating quote for order:", orderId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch order details with customer and line items
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .select(`
        *,
        customers (
          name,
          email,
          phone,
          address
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

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const { width, height } = page.getSize();
    let yPosition = height - 50;
    
    // Header background
    page.drawRectangle({
      x: 0,
      y: height - 80,
      width: width,
      height: 80,
      color: rgb(0.76, 0.89, 0.98), // #c2e4fb
    });
    
    // Header text
    page.drawText("NEXUS AMINOS", {
      x: width / 2 - 80,
      y: height - 40,
      size: 24,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    
    page.drawText("Sales Quote", {
      x: width / 2 - 40,
      y: height - 65,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    yPosition = height - 110;
    
    // Quote Information
    page.drawText("Quote Information", { x: 50, y: yPosition, size: 14, font: fontBold });
    yPosition -= 20;
    page.drawText(`Quote #: ${order.human_uid}`, { x: 50, y: yPosition, size: 10, font: font });
    yPosition -= 15;
    page.drawText(`Date: ${new Date(order.created_at).toLocaleDateString()}`, { x: 50, y: yPosition, size: 10, font: font });
    yPosition -= 30;
    
    // Customer Information
    page.drawText("Customer Information", { x: 50, y: yPosition, size: 14, font: fontBold });
    yPosition -= 20;
    page.drawText(`Name: ${order.customers?.name || "N/A"}`, { x: 50, y: yPosition, size: 10, font: font });
    yPosition -= 15;
    page.drawText(`Email: ${order.customers?.email || "N/A"}`, { x: 50, y: yPosition, size: 10, font: font });
    if (order.customers?.phone) {
      yPosition -= 15;
      page.drawText(`Phone: ${order.customers.phone}`, { x: 50, y: yPosition, size: 10, font: font });
    }
    yPosition -= 30;
    
    // Line Items
    page.drawText("Line Items", { x: 50, y: yPosition, size: 14, font: fontBold });
    yPosition -= 20;
    
    // Table header
    page.drawRectangle({
      x: 50,
      y: yPosition - 5,
      width: width - 100,
      height: 20,
      color: rgb(0.94, 0.94, 0.94),
    });
    page.drawText("SKU", { x: 60, y: yPosition, size: 9, font: fontBold });
    page.drawText("Quantity", { x: 250, y: yPosition, size: 9, font: fontBold });
    page.drawText("Unit Price", { x: 350, y: yPosition, size: 9, font: fontBold });
    page.drawText("Total", { x: 480, y: yPosition, size: 9, font: fontBold });
    yPosition -= 25;
    
    // Table rows
    let subtotal = 0;
    for (const line of order.sales_order_lines) {
      const lineTotal = line.line_subtotal;
      subtotal += lineTotal;
      
      page.drawText(line.sku?.code || "N/A", { x: 60, y: yPosition, size: 9, font: font });
      page.drawText(`${line.qty_entered} (${line.bottle_qty} bottles)`, { x: 250, y: yPosition, size: 9, font: font });
      page.drawText(`$${line.unit_price.toFixed(2)}`, { x: 350, y: yPosition, size: 9, font: font });
      page.drawText(`$${lineTotal.toFixed(2)}`, { x: 480, y: yPosition, size: 9, font: font });
      yPosition -= 20;
    }
    
    // Totals
    yPosition -= 10;
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: width - 50, y: yPosition },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    yPosition -= 15;
    page.drawText(`Subtotal: $${subtotal.toFixed(2)}`, { x: 450, y: yPosition, size: 10, font: fontBold });
    
    if (order.deposit_required) {
      yPosition -= 15;
      const depositAmount = subtotal * 0.5;
      page.drawText(`Deposit Required (50%): $${depositAmount.toFixed(2)}`, { x: 380, y: yPosition, size: 10, font: font });
    }
    
    // Terms & Conditions
    yPosition -= 40;
    page.drawText("Terms & Conditions", { x: 50, y: yPosition, size: 12, font: fontBold });
    yPosition -= 18;
    
    const terms = [
      "• This quote is valid for 30 days from the date of issue",
      "• 50% deposit required before production begins (if applicable)",
      "• Payment terms: Net 30 days from invoice date",
      "• Lead time: 2-4 weeks from deposit receipt",
      "• All prices are in USD",
      "• Custom formulations may require additional time and cost"
    ];
    
    for (const term of terms) {
      page.drawText(term, { x: 50, y: yPosition, size: 9, font: font });
      yPosition -= 14;
    }
    
    // Footer
    page.drawRectangle({
      x: 0,
      y: 0,
      width: width,
      height: 50,
      color: rgb(0.76, 0.89, 0.98),
    });
    page.drawText("Nexus Aminos | info@nexusaminos.com", {
      x: width / 2 - 110,
      y: 30,
      size: 9,
      font: font,
      color: rgb(0, 0, 0),
    });
    page.drawText("Thank you for your business!", {
      x: width / 2 - 70,
      y: 15,
      size: 9,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    // Get PDF as base64
    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    // Send email with PDF attachment
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

    const customerEmail = order.customers?.email || "";
    const customerName = order.customers?.name || "Customer";

    await client.send({
      from: `Nexus Aminos <${smtpUser}>`,
      to: customerEmail,
      subject: `Quote ${order.human_uid} from Nexus Aminos`,
      html: `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: 'Open Sans', Arial, sans-serif; background: #ffffff; color: #222; margin: 0; padding: 0; }
              .header { background: #c2e4fb; padding: 30px; text-align: center; }
              .content { max-width: 600px; margin: 0 auto; padding: 30px 20px; }
              .footer { background: #c2e4fb; padding: 20px; text-align: center; margin-top: 40px; }
              h1 { color: #000; margin: 0; }
              .btn { display: inline-block; padding: 12px 30px; background: #0066cc; color: #fff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>NEXUS AMINOS</h1>
            </div>
            <div class="content">
              <h2>Hello ${customerName},</h2>
              <p>Thank you for your interest in Nexus Aminos. Please find your quote attached to this email.</p>
              <p><strong>Quote Number:</strong> ${order.human_uid}</p>
              <p>This quote is valid for 30 days. If you have any questions or would like to proceed with this order, please reply to this email or contact us.</p>
              ${order.deposit_required ? '<p><strong>Note:</strong> A 50% deposit is required before production begins.</p>' : ''}
              <p>We look forward to working with you!</p>
            </div>
            <div class="footer">
              <p>Nexus Aminos<br>info@nexusaminos.com</p>
              <p style="font-size: 12px; color: #666;">© ${new Date().getFullYear()} Nexus Aminos. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,
      attachments: [
        {
          filename: `Quote_${order.human_uid}.pdf`,
          content: pdfBase64,
          encoding: "base64",
          contentType: "application/pdf",
        },
      ],
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
