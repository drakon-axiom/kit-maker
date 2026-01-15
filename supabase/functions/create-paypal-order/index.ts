import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateOrderRequest {
  orderId: string;
  orderNumber: string;
  type: 'deposit' | 'final';
  amount: number;
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
    const errorText = await response.text();
    console.error('PayPal auth error:', errorText);
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
    const errorText = await response.text();
    console.error('PayPal create order error:', errorText);
    throw new Error('Failed to create PayPal order');
  }

  const data = await response.json();
  console.log('PayPal order created:', data.id);
  return data.id;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, orderNumber, type, amount, brandId } = await req.json() as CreateOrderRequest;

    if (!orderId || !orderNumber || !type || !amount || !brandId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch brand's PayPal credentials
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('paypal_client_id, paypal_client_secret, paypal_checkout_enabled, name')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      console.error('Brand fetch error:', brandError);
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

    // Determine sandbox mode (check if client ID starts with sandbox prefix)
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

    // Log the creation
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
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
