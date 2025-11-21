import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  orderNumber: string;
  amount: number;
  paymentType: "deposit" | "final";
  notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (!roles || !roles.some(r => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderNumber, amount, paymentType, notes }: PaymentRequest = await req.json();

    // Validate input
    if (!orderNumber || !amount || !paymentType) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: "Amount must be greater than 0" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create service role client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Look up order by human_uid (order number)
    const { data: order, error: orderError } = await supabaseAdmin
      .from("sales_orders")
      .select("*, customers(email, name)")
      .eq("human_uid", orderNumber)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get or create the invoice for this payment type
    let { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("so_id", order.id)
      .eq("type", paymentType)
      .maybeSingle();

    // If no invoice exists, create one
    if (!invoice) {
      const invoiceAmount = paymentType === "deposit" 
        ? (order.deposit_amount || order.subtotal * 0.5) 
        : order.subtotal;

      // Generate invoice number
      const invoicePrefix = paymentType === "deposit" ? "DEP" : "INV";
      const { data: maxInvoice } = await supabaseAdmin
        .from("invoices")
        .select("invoice_no")
        .like("invoice_no", `${invoicePrefix}-%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let invoiceNumber = `${invoicePrefix}-0001`;
      if (maxInvoice?.invoice_no) {
        const lastNum = parseInt(maxInvoice.invoice_no.split("-")[1]) || 0;
        invoiceNumber = `${invoicePrefix}-${String(lastNum + 1).padStart(4, "0")}`;
      }

      const { data: newInvoice, error: createError } = await supabaseAdmin
        .from("invoices")
        .insert({
          so_id: order.id,
          type: paymentType,
          invoice_no: invoiceNumber,
          subtotal: invoiceAmount,
          tax: 0,
          total: invoiceAmount,
          status: "unpaid",
        })
        .select()
        .single();

      if (createError || !newInvoice) {
        console.error("Error creating invoice:", createError);
        return new Response(JSON.stringify({ error: "Failed to create invoice" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      invoice = newInvoice;
    }

    // Validate amount doesn't exceed invoice total
    if (amount > invoice.total) {
      return new Response(
        JSON.stringify({ 
          error: `Amount exceeds ${paymentType} invoice total of $${invoice.total}`,
          invoiceTotal: invoice.total
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert payment record in invoice_payments table
    const { data: paymentRecord, error: paymentError } = await supabaseAdmin
      .from("invoice_payments")
      .insert({
        invoice_id: invoice.id,
        amount: amount,
        method: "other", // CashApp - using 'other' as it's not in the enum
        recorded_by: user.id,
        recorded_at: new Date().toISOString(),
        external_ref: `CASHAPP-${Date.now()}`,
        notes: notes || null,
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error inserting payment record:", paymentError);
      return new Response(JSON.stringify({ error: "Failed to record payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also insert into payment_transactions for compatibility
    await supabaseAdmin
      .from("payment_transactions")
      .insert({
        so_id: order.id,
        amount: amount,
        payment_method: "cashapp",
        payment_type: paymentType,
        status: "completed",
        customer_email: order.customers.email,
        metadata: {
          manual_entry: true,
          recorded_by: user.id,
          customer_name: order.customers.name,
          order_number: order.human_uid,
          notes: notes || null,
          invoice_payment_id: paymentRecord.id,
        },
      });

    // Update invoice status if amount matches total
    if (amount >= invoice.total) {
      await supabaseAdmin
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      // Update order deposit status if this is a deposit payment
      if (paymentType === "deposit") {
        await supabaseAdmin
          .from("sales_orders")
          .update({ deposit_status: "paid" })
          .eq("id", order.id);
      }
    } else {
      // Partial payment
      if (paymentType === "deposit") {
        await supabaseAdmin
          .from("sales_orders")
          .update({ deposit_status: "partial" })
          .eq("id", order.id);
      }
    }

    // Log to audit trail
    await supabaseAdmin.from("audit_log").insert({
      entity: "payment",
      entity_id: order.id,
      action: "manual_cashapp_payment_recorded",
      after: {
        amount,
        payment_type: paymentType,
        recorded_by: user.id,
        notes: notes || null,
      },
    });

    console.log(`Manual CashApp ${paymentType} payment recorded for order ${orderNumber}, amount: $${amount}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        orderId: order.id,
        orderNumber: order.human_uid,
        amount,
        paymentType,
        invoiceStatus: amount >= invoice.total ? "paid" : "partial",
        paymentId: paymentRecord.id, // Include payment ID for receipt generation
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing manual payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
