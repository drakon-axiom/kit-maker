import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UPSTrackingResponse {
  trackResponse?: {
    shipment?: Array<{
      package?: Array<{
        trackingNumber?: string;
        deliveryDate?: Array<{
          date?: string;
        }>;
        activity?: Array<{
          status?: {
            statusCode?: string;
            description?: string;
            type?: string;
          };
          location?: {
            address?: {
              city?: string;
              stateProvince?: string;
              country?: string;
            };
          };
          date?: string;
          time?: string;
        }>;
      }>;
    }>;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shipmentId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch shipment details
    const { data: shipment, error: shipmentError } = await supabase
      .from("shipments")
      .select("tracking_no, carrier")
      .eq("id", shipmentId)
      .single();

    if (shipmentError) throw shipmentError;

    // Get UPS credentials
    const upsClientId = Deno.env.get("UPS_CLIENT_ID");
    const upsClientSecret = Deno.env.get("UPS_CLIENT_SECRET");

    if (!upsClientId || !upsClientSecret) {
      throw new Error("UPS credentials not configured");
    }

    // Get OAuth token from UPS
    const tokenResponse = await fetch("https://onlinetools.ups.com/security/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${upsClientId}:${upsClientSecret}`)}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to get UPS OAuth token");
    }

    const { access_token } = await tokenResponse.json();

    // Get tracking information
    const trackingResponse = await fetch(
      `https://onlinetools.ups.com/api/track/v1/details/${shipment.tracking_no}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "transId": crypto.randomUUID(),
          "transactionSrc": "testing",
        },
      }
    );

    if (!trackingResponse.ok) {
      console.error("UPS API error:", await trackingResponse.text());
      throw new Error("Failed to fetch tracking information from UPS");
    }

    const trackingData: UPSTrackingResponse = await trackingResponse.json();

    // Parse tracking data
    const packageData = trackingData.trackResponse?.shipment?.[0]?.package?.[0];
    const latestActivity = packageData?.activity?.[0];
    const estimatedDelivery = packageData?.deliveryDate?.[0]?.date;

    const trackingEvents = packageData?.activity?.map((activity) => ({
      status: activity.status?.description || "",
      location: activity.location?.address 
        ? `${activity.location.address.city}, ${activity.location.address.stateProvince}`
        : "",
      date: activity.date || "",
      time: activity.time || "",
      description: activity.status?.description || "",
    })) || [];

    // Update shipment in database
    const { error: updateError } = await supabase
      .from("shipments")
      .update({
        tracking_status: latestActivity?.status?.description || null,
        tracking_location: latestActivity?.location?.address
          ? `${latestActivity.location.address.city}, ${latestActivity.location.address.stateProvince}`
          : null,
        estimated_delivery: estimatedDelivery || null,
        tracking_events: trackingEvents,
        last_tracking_update: new Date().toISOString(),
      })
      .eq("id", shipmentId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, trackingEvents }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error updating tracking:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
