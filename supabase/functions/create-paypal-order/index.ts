import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface CreateOrderRequest {
  orderId: string;
  orderNumber: string;
  type: 'deposit' | 'final';
  brandId: string;
}

async function getPayPalAccessToken(clientId: string, clientSecret: string, sandbox: boolean): Promise<string> {
  const baseUrl = sandbox
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate with PayPal');
  }

  const data = await response.json();
  return data.access_token;
}

async function createPayPalOrder(
  accessToken: string,
  amount: number,
  orderNumber: string,
  type: string,
  sandbox: boolean
): Promise<string> {
  const baseUrl = sandbox
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

  const description = `Order ${orderNumber} - ${type === 'deposit' ? 'Deposit' : 'Final'} Payment`;

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderNumber,
        description: description,
        amount: {
          currency_code: 'USD',
          value: amount.toFixed(2),
        },
      }],
      application_context: {
        brand_name: 'Order Payment',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create PayPal order');
  }

  const data = await response.json();
  return data.id;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Authenticate user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAnonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseAnonClient.auth.getUser(token);
    const user = userData.user;
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { orderId, orderNumber, type, brandId } = await req.json() as CreateOrderRequest;

    if (!orderId || !orderNumber || !type || !brandId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Security: Verify order ownership
    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('id, human_uid, subtotal, deposit_amount, customer_id, customers(user_id)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customer = order.customers as any;
    const customerUserId = Array.isArray(customer) ? customer[0]?.user_id : customer?.user_id;
    if (customerUserId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Security: Determine amount server-side
    let amount: number;
    if (type === 'deposit') {
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
        JSON.stringify({ error: 'No amount due' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch brand's PayPal credentials
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('paypal_client_id, paypal_client_secret, paypal_checkout_enabled, name')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!brand.paypal_checkout_enabled || !brand.paypal_client_id || !brand.paypal_client_secret) {
      return new Response(
        JSON.stringify({ error: 'PayPal checkout is not configured for this brand' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine sandbox mode
    const isSandbox = brand.paypal_client_id.startsWith('sb-') ||
                      brand.paypal_client_id.startsWith('AZ') === false;

    console.log(`Creating PayPal order for ${orderNumber}, amount: $${amount}, sandbox: ${isSandbox}`);

    // Get access token
    const accessToken = await getPayPalAccessToken(
      brand.paypal_client_id,
      brand.paypal_client_secret,
      isSandbox
    );

    // Create PayPal order
    const paypalOrderId = await createPayPalOrder(
      accessToken,
      amount,
      orderNumber,
      type,
      isSandbox
    );

    console.log(`PayPal order ${paypalOrderId} created for order ${orderNumber}`);

    return new Response(
      JSON.stringify({
        paypalOrderId,
        success: true
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: unknown) {
    console.error('Error creating PayPal order:', error);
    // Security: Generic error message
    return new Response(
      JSON.stringify({ error: 'Failed to create PayPal order' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
