import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UPSTrackingResponse {
  trackResponse: {
    shipment: Array<{
      package: Array<{
        trackingNumber: string;
        deliveryDate: Array<{
          date: string;
        }>;
        activity: Array<{
          date: string;
          time: string;
          status: {
            type: string;
            description: string;
            code: string;
          };
          location?: {
            address?: {
              city?: string;
              stateProvince?: string;
              country?: string;
            };
          };
        }>;
      }>;
    }>;
  };
}

async function getUPSAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch('https://onlinetools.ups.com/security/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('UPS OAuth error:', error);
    throw new Error(`Failed to get UPS access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function getUPSTracking(trackingNumber: string, accessToken: string): Promise<UPSTrackingResponse> {
  // Generate a unique transaction ID
  const transId = crypto.randomUUID();
  
  const response = await fetch(
    `https://onlinetools.ups.com/api/track/v1/details/${trackingNumber}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'transId': transId,
        'transactionSrc': 'AxiomMFG',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`UPS tracking error for ${trackingNumber}:`, error);
    throw new Error(`Failed to get tracking info: ${response.status}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const upsClientId = Deno.env.get('UPS_CLIENT_ID');
    const upsClientSecret = Deno.env.get('UPS_CLIENT_SECRET');

    if (!upsClientId || !upsClientSecret) {
      throw new Error('UPS credentials not configured');
    }

    // Get access token
    console.log('Getting UPS access token...');
    const accessToken = await getUPSAccessToken(upsClientId, upsClientSecret);

    // Get all shipments that need tracking updates (not delivered)
    const { data: shipments, error: fetchError } = await supabase
      .from('shipments')
      .select('id, tracking_no, carrier')
      .or('tracking_status.is.null,tracking_status.neq.Delivered')
      .ilike('carrier', '%ups%');

    if (fetchError) {
      console.error('Error fetching shipments:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${shipments?.length || 0} UPS shipments to update`);

    const updates = [];
    const errors = [];

    for (const shipment of shipments || []) {
      try {
        console.log(`Fetching tracking for ${shipment.tracking_no}...`);
        const trackingData = await getUPSTracking(shipment.tracking_no, accessToken);

        const pkg = trackingData.trackResponse.shipment[0]?.package[0];
        if (!pkg) {
          console.log(`No package data for ${shipment.tracking_no}`);
          continue;
        }

        const latestActivity = pkg.activity[0];
        const trackingEvents = pkg.activity.map(activity => ({
          date: activity.date,
          time: activity.time,
          status: activity.status.description,
          location: activity.location?.address
            ? `${activity.location.address.city || ''}, ${activity.location.address.stateProvince || ''}, ${activity.location.address.country || ''}`
            : null,
        }));

        const estimatedDelivery = pkg.deliveryDate?.[0]?.date || null;

        const updateData = {
          tracking_status: latestActivity.status.description,
          tracking_location: latestActivity.location?.address
            ? `${latestActivity.location.address.city || ''}, ${latestActivity.location.address.stateProvince || ''}`
            : null,
          tracking_events: trackingEvents,
          estimated_delivery: estimatedDelivery,
          last_tracking_update: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from('shipments')
          .update(updateData)
          .eq('id', shipment.id);

        if (updateError) {
          console.error(`Error updating shipment ${shipment.id}:`, updateError);
          errors.push({ tracking_no: shipment.tracking_no, error: updateError.message });
        } else {
          console.log(`Updated tracking for ${shipment.tracking_no}`);
          updates.push(shipment.tracking_no);
        }

        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing ${shipment.tracking_no}:`, error);
        errors.push({ tracking_no: shipment.tracking_no, error: errorMessage });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated: updates.length,
        errors: errors.length,
        details: { updates, errors },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in update-tracking function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
