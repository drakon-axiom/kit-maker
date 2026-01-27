import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BTCPayInvoiceRequest {
  orderId: string;
  amount: number;
  paymentType: "deposit" | "final";
  customerEmail?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, amount, paymentType, customerEmail }: BTCPayInvoiceRequest = await req.json();

    if (!orderId || !amount || !paymentType) {
      throw new Error("orderId, amount, and paymentType are required");
    }

    console.log(`[create-btcpay-invoice] Creating invoice for order ${orderId}, amount: ${amount}, type: ${paymentType}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch order with brand details
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .select(`
        id,
        human_uid,
        brand_id,
        customer_id,
        customers (
          email,
          name
        ),
        brands (
          id,
          name,
          btcpay_server_url,
          btcpay_store_id,
          btcpay_api_key
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("[create-btcpay-invoice] Order fetch error:", orderError);
      throw new Error(`Order not found: ${orderError?.message || "Unknown error"}`);
    }

    // Get brand BTCPay config, fallback to default brand if not set
    const orderBrand = order.brands as any;
    let brand = orderBrand;
    if (!brand?.btcpay_server_url) {
      const { data: defaultBrand } = await supabase
        .from("brands")
        .select("id, name, btcpay_server_url, btcpay_store_id, btcpay_api_key")
        .eq("is_default", true)
        .single();
      brand = defaultBrand;
    }

    if (!brand?.btcpay_server_url || !brand?.btcpay_store_id || !brand?.btcpay_api_key) {
      throw new Error("BTCPay Server is not configured for this brand");
    }

    const btcpayUrl = brand.btcpay_server_url.replace(/\/$/, ""); // Remove trailing slash
    const storeId = brand.btcpay_store_id;
    const apiKey = brand.btcpay_api_key;
    const customer = order.customers as any;

    // Prepare the invoice request for BTCPay Server
    const invoiceData = {
      amount: amount.toString(),
      currency: "USD",
      metadata: {
        orderId: order.id,
        orderNumber: order.human_uid,
        paymentType: paymentType,
        buyerEmail: customerEmail || customer?.email || undefined,
      },
      checkout: {
        speedPolicy: "MediumSpeed",
        redirectURL: `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '')}/customer/orders/${orderId}`,
        redirectAutomatically: true,
        requiresRefundEmail: true,
      },
      receipt: {
        enabled: true,
        showPayments: true,
        showQR: true,
      },
    };

    console.log(`[create-btcpay-invoice] Creating BTCPay invoice at ${btcpayUrl}/api/v1/stores/${storeId}/invoices`);

    // Create invoice via BTCPay Server API
    const btcpayResponse = await fetch(`${btcpayUrl}/api/v1/stores/${storeId}/invoices`, {
      method: "POST",
      headers: {
        "Authorization": `token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(invoiceData),
    });

    if (!btcpayResponse.ok) {
      const errorText = await btcpayResponse.text();
      console.error("[create-btcpay-invoice] BTCPay API error:", errorText);
      throw new Error(`BTCPay Server error: ${btcpayResponse.status} - ${errorText}`);
    }

    const btcpayInvoice = await btcpayResponse.json();
    console.log("[create-btcpay-invoice] BTCPay invoice created:", btcpayInvoice.id);

    // Return the checkout URL
    return new Response(
      JSON.stringify({
        success: true,
        invoiceId: btcpayInvoice.id,
        checkoutUrl: btcpayInvoice.checkoutLink || `${btcpayUrl}/i/${btcpayInvoice.id}`,
        status: btcpayInvoice.status,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("[create-btcpay-invoice] Error:", error);
    const errMsg = error instanceof Error ? error.message : "Failed to create BTCPay invoice";
    return new Response(
      JSON.stringify({
        success: false,
        error: errMsg,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
