import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VoidLabelRequest {
  shipmentId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const shipstationApiKey = Deno.env.get("SHIPSTATION_API_KEY");

    if (!shipstationApiKey) {
      return new Response(
        JSON.stringify({ error: "ShipStation API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { shipmentId }: VoidLabelRequest = await req.json();

    if (!shipmentId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: shipmentId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch shipment details
    const { data: shipment, error: shipmentError } = await supabase
      .from("shipments")
      .select("id, shipstation_shipment_id, tracking_no, voided_at, so_id")
      .eq("id", shipmentId)
      .single();

    if (shipmentError || !shipment) {
      console.error("Shipment fetch error:", shipmentError);
      return new Response(
        JSON.stringify({ error: "Shipment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (shipment.voided_at) {
      return new Response(
        JSON.stringify({ error: "Label has already been voided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!shipment.shipstation_shipment_id) {
      // If no ShipStation shipment ID, just mark as voided locally
      await supabase
        .from("shipments")
        .update({
          voided_at: new Date().toISOString(),
          tracking_no: `VOIDED-${shipment.tracking_no}`,
        })
        .eq("id", shipmentId);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Shipment marked as voided (no ShipStation ID found)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Void the label using v2 API - PUT to cancel endpoint
    console.log("Voiding shipment via v2 API:", shipment.shipstation_shipment_id);
    
    const voidResponse = await fetch(
      `https://api.shipstation.com/v2/shipments/${shipment.shipstation_shipment_id}/cancel`,
      {
        method: "PUT",
        headers: {
          "api-key": shipstationApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!voidResponse.ok) {
      const errorText = await voidResponse.text();
      console.error("ShipStation v2 void error:", errorText);
      
      // Check if it's already voided or expired
      if (errorText.includes("already") || errorText.includes("cannot") || errorText.includes("void")) {
        // Mark as voided locally anyway
        await supabase
          .from("shipments")
          .update({
            voided_at: new Date().toISOString(),
          })
          .eq("id", shipmentId);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Label was already voided in ShipStation",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to void label in ShipStation", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const voidResult = await voidResponse.json();
    console.log("Void result:", voidResult);

    // Update shipment record
    await supabase
      .from("shipments")
      .update({
        voided_at: new Date().toISOString(),
        label_url: null,
      })
      .eq("id", shipmentId);

    // Update order status back to ready_to_ship if it was shipped
    const { data: order } = await supabase
      .from("sales_orders")
      .select("status")
      .eq("id", shipment.so_id)
      .single();

    if (order?.status === "shipped") {
      await supabase
        .from("sales_orders")
        .update({ status: "ready_to_ship" })
        .eq("id", shipment.so_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        approved: true,
        message: "Label voided successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error voiding label:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
