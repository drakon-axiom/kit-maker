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

interface CapturePaymentRequest {
  paypalOrderId: string;
  orderId: string;
  orderNumber: string;
  type: 'deposit' | 'final';
  amount: number;
  brandId: string;
  customerEmail?: string;
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

async function capturePayPalOrder(accessToken: string, paypalOrderId: string, sandbox: boolean): Promise<any> {
  const baseUrl = sandbox 
    ? 'https://api-m.sandbox.paypal.com' 
    : 'https://api-m.paypal.com';
  
  const response = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('PayPal capture error:', errorText);
    throw new Error('Failed to capture PayPal payment');
  }

  return await response.json();
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Authenticate user
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

    const { paypalOrderId, orderId, orderNumber, type, brandId, customerEmail } =
      await req.json() as CapturePaymentRequest;

    if (!paypalOrderId || !orderId || !orderNumber || !type || !brandId) {
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
      .select('paypal_client_id, paypal_client_secret, paypal_checkout_enabled')
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

    // Determine sandbox mode
    const isSandbox = brand.paypal_client_id.startsWith('sb-') || 
                      brand.paypal_client_id.startsWith('AZ') === false;

    // Security: Verify order ownership
    const { data: orderData, error: orderCheckError } = await supabase
      .from('sales_orders')
      .select('id, subtotal, deposit_amount, customers(user_id)')
      .eq('id', orderId)
      .single();

    if (orderCheckError || !orderData) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orderCustomer = orderData.customers as any;
    const ownerUserId = Array.isArray(orderCustomer) ? orderCustomer[0]?.user_id : orderCustomer?.user_id;
    if (ownerUserId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Security: Determine amount server-side
    let amount: number;
    if (type === 'deposit') {
      amount = orderData.deposit_amount || 0;
    } else {
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('total')
        .eq('so_id', orderId)
        .eq('type', 'final')
        .eq('status', 'unpaid')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      amount = invoiceData?.total || orderData.subtotal;
    }

    console.log(`Capturing PayPal order ${paypalOrderId} for order ${orderNumber}`);

    // Get access token and capture payment
    const accessToken = await getPayPalAccessToken(
      brand.paypal_client_id, 
      brand.paypal_client_secret,
      isSandbox
    );

    const captureResult = await capturePayPalOrder(accessToken, paypalOrderId, isSandbox);

    if (captureResult.status !== 'COMPLETED') {
      console.error('Payment not completed:', captureResult.status);
      return new Response(
        JSON.stringify({ error: 'Payment was not completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const captureId = captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const payerEmail = captureResult.payer?.email_address || customerEmail || 'unknown@paypal.com';

    console.log(`Payment captured successfully: ${captureId}`);

    // Security: Idempotency check
    const { data: existingTx } = await supabase
      .from('payment_transactions')
      .select('id')
      .eq('stripe_payment_intent', captureId)
      .maybeSingle();

    if (existingTx) {
      console.log(`PayPal capture ${captureId} already recorded, skipping`);
      return new Response(
        JSON.stringify({ success: true, captureId, payerEmail, duplicate: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record the payment transaction
    const { error: txError } = await supabase
      .from('payment_transactions')
      .insert({
        so_id: orderId,
        amount: amount,
        payment_method: 'paypal',
        payment_type: type,
        status: 'completed',
        customer_email: payerEmail,
        stripe_payment_intent: captureId, // Reusing this field for PayPal capture ID
        metadata: {
          paypal_order_id: paypalOrderId,
          paypal_capture_id: captureId,
          payer_id: captureResult.payer?.payer_id,
        },
      });

    if (txError) {
      console.error('Error recording payment transaction:', txError);
      // Don't fail - payment was already captured
    }

    // Update order status based on payment type
    if (type === 'deposit') {
      // Update deposit status
      const { error: updateError } = await supabase
        .from('sales_orders')
        .update({ deposit_status: 'paid' })
        .eq('id', orderId);

      if (updateError) {
        console.error('Error updating deposit status:', updateError);
      }
    } else {
      // For final payment, find and update the invoice
      const { data: invoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('so_id', orderId)
        .eq('type', 'final')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (invoice) {
        await supabase
          .from('invoices')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', invoice.id);
      }
    }

    // Log to audit
    await supabase
      .from('audit_log')
      .insert({
        entity: 'payment',
        entity_id: orderId,
        action: 'paypal_payment_captured',
        after: {
          amount,
          type,
          paypal_order_id: paypalOrderId,
          capture_id: captureId,
        },
      });

    // Trigger payment confirmation email
    try {
      await supabase.functions.invoke('send-payment-confirmation', {
        body: {
          orderId,
          orderNumber,
          amount,
          paymentType: type,
          paymentMethod: 'paypal',
          customerEmail: payerEmail,
        },
      });
    } catch (emailError) {
      console.error('Error sending payment confirmation email:', emailError);
      // Don't fail the whole operation
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        captureId,
        payerEmail,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('Error capturing PayPal payment:', error);
    // Security: Generic error message
    return new Response(
      JSON.stringify({ error: 'Failed to capture PayPal payment' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
