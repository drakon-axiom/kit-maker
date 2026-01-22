import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateLabelRequest {
  orderId: string;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  weightOz?: number;
}

interface ShipStationV2Address {
  name: string;
  address_line1: string;
  address_line2?: string;
  city_locality: string;
  state_province: string;
  postal_code: string;
  country_code: string;
  phone?: string;
}

interface ShipStationV2Package {
  weight: { value: number; unit: "ounce" | "pound" | "gram" | "kilogram" };
  dimensions?: { length: number; width: number; height: number; unit: "inch" | "centimeter" };
}

interface ShipStationV2LabelRequest {
  shipment: {
    carrier_id: string;
    service_code: string;
    ship_to: ShipStationV2Address;
    ship_from: ShipStationV2Address;
    packages: ShipStationV2Package[];
    validate_address?: "no_validation" | "validate_only" | "validate_and_clean";
  };
  label_format?: "pdf" | "png" | "zpl";
  label_layout?: "4x6" | "letter";
}

// Convert country names/codes to 2-char ISO codes
function getCountryCode(country: string | null): string {
  if (!country) return "US";
  
  // If already a 2-character code, return it uppercase
  if (country.length === 2) return country.toUpperCase();
  
  // If it's a 3-character code like "USA", convert it
  if (country.length === 3) {
    const threeCharMap: Record<string, string> = {
      "usa": "US",
      "can": "CA",
      "mex": "MX",
      "gbr": "GB",
      "aus": "AU",
      "deu": "DE",
      "fra": "FR",
    };
    const code = threeCharMap[country.toLowerCase()];
    if (code) return code;
  }
  
  const countryMap: Record<string, string> = {
    "united states": "US",
    "united states of america": "US",
    "usa": "US",
    "u.s.a.": "US",
    "u.s.": "US",
    "america": "US",
    "canada": "CA",
    "mexico": "MX",
    "united kingdom": "GB",
    "great britain": "GB",
    "england": "GB",
    "australia": "AU",
    "germany": "DE",
    "france": "FR",
    "italy": "IT",
    "spain": "ES",
    "netherlands": "NL",
    "belgium": "BE",
    "switzerland": "CH",
    "austria": "AT",
    "japan": "JP",
    "china": "CN",
    "india": "IN",
    "brazil": "BR",
    "ireland": "IE",
    "new zealand": "NZ",
    "puerto rico": "PR",
    "virgin islands": "VI",
    "guam": "GU",
  };
  
  const normalized = country.toLowerCase().trim();
  return countryMap[normalized] || "US";
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

    const { orderId, dimensions, weightOz }: CreateLabelRequest = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: orderId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order with customer details
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .select(`
        id,
        human_uid,
        status,
        customer_id,
        customers (
          id,
          name,
          email,
          phone,
          shipping_address_line1,
          shipping_address_line2,
          shipping_city,
          shipping_state,
          shipping_zip,
          shipping_country
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order fetch error:", orderError);
      return new Response(
        JSON.stringify({ error: "Order not found", details: orderError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customer = order.customers as unknown as {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      shipping_address_line1: string | null;
      shipping_address_line2: string | null;
      shipping_city: string | null;
      shipping_state: string | null;
      shipping_zip: string | null;
      shipping_country: string | null;
    } | null;

    if (!customer) {
      return new Response(
        JSON.stringify({ error: "Customer not found for this order" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required shipping address fields
    const missingFields: string[] = [];
    if (!customer.shipping_address_line1?.trim()) missingFields.push("Shipping Address Line 1");
    if (!customer.shipping_city?.trim()) missingFields.push("City");
    if (!customer.shipping_zip?.trim()) missingFields.push("ZIP Code");
    
    const countryCode = getCountryCode(customer.shipping_country);
    if ((countryCode === "US" || countryCode === "CA") && !customer.shipping_state?.trim()) {
      missingFields.push("State/Province");
    }

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: "Incomplete shipping address", 
          details: `Missing required fields: ${missingFields.join(", ")}`,
          missingFields 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch carrier and warehouse settings from database
    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "shipstation_carrier_code",
        "shipstation_service_code",
        "shipstation_warehouse_name",
        "shipstation_warehouse_address1",
        "shipstation_warehouse_address2",
        "shipstation_warehouse_city",
        "shipstation_warehouse_state",
        "shipstation_warehouse_zip",
        "shipstation_warehouse_country",
        "shipstation_warehouse_phone",
      ]);

    const settingsMap: Record<string, string> = {};
    settings?.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    const carrierCode = settingsMap.shipstation_carrier_code || "ups";
    const serviceCode = settingsMap.shipstation_service_code || "ups_ground";

    // Validate warehouse/ship-from address
    if (!settingsMap.shipstation_warehouse_address1?.trim() || 
        !settingsMap.shipstation_warehouse_city?.trim() || 
        !settingsMap.shipstation_warehouse_zip?.trim()) {
      return new Response(
        JSON.stringify({ 
          error: "Warehouse address not configured", 
          details: "Please configure the ship-from warehouse address in Settings → Shipping Settings"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build ship-from address (warehouse)
    const shipFrom: ShipStationV2Address = {
      name: settingsMap.shipstation_warehouse_name || "Warehouse",
      address_line1: settingsMap.shipstation_warehouse_address1,
      address_line2: settingsMap.shipstation_warehouse_address2 || undefined,
      city_locality: settingsMap.shipstation_warehouse_city,
      state_province: settingsMap.shipstation_warehouse_state || "",
      postal_code: settingsMap.shipstation_warehouse_zip,
      country_code: getCountryCode(settingsMap.shipstation_warehouse_country || "US"),
      phone: settingsMap.shipstation_warehouse_phone || undefined,
    };

    // Build ship-to address (customer)
    const shipTo: ShipStationV2Address = {
      name: customer.name || "Customer",
      address_line1: customer.shipping_address_line1!,
      address_line2: customer.shipping_address_line2 || undefined,
      city_locality: customer.shipping_city!,
      state_province: customer.shipping_state || "",
      postal_code: customer.shipping_zip!,
      country_code: countryCode,
      phone: customer.phone || undefined,
    };

    // Build packages array
    const packages: ShipStationV2Package[] = [{
      weight: {
        value: weightOz || 16,
        unit: "ounce",
      },
      dimensions: dimensions ? {
        length: dimensions.length,
        width: dimensions.width,
        height: dimensions.height,
        unit: "inch",
      } : undefined,
    }];

    // Build v2 label request
    const labelRequest: ShipStationV2LabelRequest = {
      shipment: {
        carrier_id: `se-${carrierCode}`,
        service_code: serviceCode,
        ship_to: shipTo,
        ship_from: shipFrom,
        packages: packages,
        validate_address: "validate_and_clean",
      },
      label_format: "pdf",
      label_layout: "4x6",
    };

    console.log("Creating label with v2 API:", JSON.stringify(labelRequest, null, 2));

    // Create label using v2 API (single call creates shipment + label)
    const labelResponse = await fetch(
      "https://api.shipstation.com/v2/labels",
      {
        method: "POST",
        headers: {
          "api-key": shipstationApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(labelRequest),
      }
    );

    if (!labelResponse.ok) {
      const errorText = await labelResponse.text();
      console.error("ShipStation v2 API error:", errorText);
      
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.message || errorJson.errors?.join(", ") || errorText;
      } catch {
        // Keep as text
      }
      
      return new Response(
        JSON.stringify({ 
          error: "Failed to create label via ShipStation", 
          details: errorDetails,
          request: labelRequest
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const labelResult = await labelResponse.json();
    console.log("Label created:", JSON.stringify(labelResult, null, 2));

    // Extract label data from v2 response
    const labelUrl = labelResult.label_download?.pdf || labelResult.label_download?.href;
    const trackingNumber = labelResult.tracking_number;
    const shipmentId = labelResult.shipment_id;

    if (!trackingNumber) {
      return new Response(
        JSON.stringify({ 
          error: "Label created but missing tracking number", 
          details: labelResult 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create or update shipment record in database
    const { data: existingShipment } = await supabase
      .from("shipments")
      .select("id")
      .eq("so_id", orderId)
      .is("voided_at", null)
      .maybeSingle();

    if (existingShipment) {
      // Update existing shipment
      await supabase
        .from("shipments")
        .update({
          carrier: carrierCode.toUpperCase(),
          tracking_no: trackingNumber,
          label_url: labelUrl,
          shipstation_shipment_id: shipmentId,
          shipped_at: new Date().toISOString(),
          voided_at: null,
        })
        .eq("id", existingShipment.id);
    } else {
      // Create new shipment
      await supabase
        .from("shipments")
        .insert({
          so_id: orderId,
          carrier: carrierCode.toUpperCase(),
          tracking_no: trackingNumber,
          label_url: labelUrl,
          shipstation_shipment_id: shipmentId,
          shipped_at: new Date().toISOString(),
        });
    }

    // Update order status to shipped
    await supabase
      .from("sales_orders")
      .update({ status: "shipped" })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({
        success: true,
        trackingNumber,
        labelUrl,
        shipmentId,
        carrier: carrierCode.toUpperCase(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating label:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
