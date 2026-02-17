import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

interface BTCPayInvoiceRequest {
  orderId: string;
  paymentType: "deposit" | "final";
  customerEmail?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Authenticate user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAnonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseAnonClient.auth.getUser(token);
    const user = userData.user;
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { orderId, paymentType, customerEmail }: BTCPayInvoiceRequest = await req.json();

    if (!orderId || !paymentType) {
      return new Response(
        JSON.stringify({ success: false, error: "orderId and paymentType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
        subtotal,
        deposit_amount,
        customers (
          email,
          name,
          user_id
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
      return new Response(
        JSON.stringify({ success: false, error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Security: Verify user owns this order
    const customerData = order.customers as any;
    const customerUserId = Array.isArray(customerData) ? customerData[0]?.user_id : customerData?.user_id;
    if (customerUserId !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Security: Determine amount server-side
    let amount: number;
    if (paymentType === 'deposit') {
      amount = order.deposit_amount || 0;
    } else {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('total')
        .eq('so_id', orderId)
        .eq('type', 'final')
        .eq('status', 'unpaid')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      amount = invoice?.total || order.subtotal;
    }

    if (amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No amount due" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      return new Response(
        JSON.stringify({ success: false, error: "BTCPay Server is not configured for this brand" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const btcpayUrl = brand.btcpay_server_url.replace(/\/$/, "");
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

    // Create invoice via BTCPay Server API
    let btcpayResponse: Response;
    try {
      btcpayResponse = await fetch(`${btcpayUrl}/api/v1/stores/${storeId}/invoices`, {
        method: "POST",
        headers: {
          "Authorization": `token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invoiceData),
      });
    } catch (fetchError) {
      console.error("[create-btcpay-invoice] Network error:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Cannot reach BTCPay Server. Please try again later." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!btcpayResponse.ok) {
      console.error("[create-btcpay-invoice] BTCPay API error, status:", btcpayResponse.status);
      // Security: Generic error messages
      if (btcpayResponse.status === 502 || btcpayResponse.status === 503 || btcpayResponse.status === 504) {
        return new Response(
          JSON.stringify({ success: false, error: "BTCPay Server is currently unavailable. Please try again later." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create BTCPay invoice" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const btcpayInvoice = await btcpayResponse.json();

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
    // Security: Generic error message
    return new Response(
      JSON.stringify({ success: false, error: "Failed to create BTCPay invoice" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
