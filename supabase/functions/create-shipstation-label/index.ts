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

// ShipStation v1 Order types
interface ShipStationV1OrderItem {
  lineItemKey: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  weight?: { value: number; units: "ounces" | "pounds" | "grams" };
}

interface ShipStationV1Address {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

interface ShipStationV1Order {
  orderNumber: string;
  orderKey: string;
  orderDate: string;
  orderStatus: "awaiting_shipment" | "shipped" | "on_hold" | "cancelled";
  customerEmail?: string;
  billTo: ShipStationV1Address;
  shipTo: ShipStationV1Address;
  items: ShipStationV1OrderItem[];
  amountPaid?: number;
  carrierCode?: string;
  serviceCode?: string;
  weight?: { value: number; units: "ounces" | "pounds" };
  dimensions?: { length: number; width: number; height: number; units: "inches" | "centimeters" };
  advancedOptions?: {
    storeId?: number;
    warehouseId?: number;
  };
}

type ShipStationV2Carrier = {
  carrier_id?: string;
  carrier_code?: string;
  code?: string;
  name?: string;
};

async function resolveCarrierId(
  shipstationApiKey: string,
  carrierInput: string,
): Promise<string> {
  const raw = (carrierInput || "").trim();
  if (!raw) {
    throw new Error(
      "ShipStation carrier not configured. Set ShipStation Configuration → Default Carrier Code (use carrier_id like se-1234567 or a code like ups).",
    );
  }

  // If already looks like a v2 carrier_id, keep it
  if (/^se-\d+$/i.test(raw)) return raw;

  // Allow numeric-only input and normalize to se-123
  if (/^\d+$/i.test(raw)) return `se-${raw}`;

  // Otherwise treat as a carrier code (e.g. "ups") and resolve via API.
  const carriersRes = await fetch("https://api.shipstation.com/v2/carriers", {
    headers: {
      "api-key": shipstationApiKey,
      "Content-Type": "application/json",
    },
  });

  if (!carriersRes.ok) {
    const text = await carriersRes.text();
    throw new Error(`Failed to fetch carriers from ShipStation: ${text}`);
  }

  const carriersJson = await carriersRes.json();
  const carriers: ShipStationV2Carrier[] = Array.isArray(carriersJson)
    ? carriersJson
    : (carriersJson.carriers || carriersJson.data || []);

  const normalized = raw.toLowerCase();
  const match = carriers.find((c) =>
    (c.carrier_code || c.code || "").toLowerCase() === normalized
  );

  const carrierId = match?.carrier_id;
  if (!carrierId) {
    throw new Error(
      `Unknown ShipStation carrier code "${raw}". Please set the carrier_id (looks like se-1234567) from ShipStation → Carriers.`
    );
  }

  return carrierId;
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

// Create order in ShipStation v1 API
async function createShipStationOrder(
  shipstationApiKey: string,
  order: ShipStationV1Order
): Promise<{ orderId: number; orderNumber: string }> {
  console.log("Creating ShipStation order:", JSON.stringify(order, null, 2));
  
  const response = await fetch("https://ssapi.shipstation.com/orders/createorder", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(shipstationApiKey + ":")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(order),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("ShipStation v1 order creation error:", errorText);
    throw new Error(`Failed to create ShipStation order: ${errorText}`);
  }

  const result = await response.json();
  console.log("ShipStation order created:", JSON.stringify(result, null, 2));
  
  return {
    orderId: result.orderId,
    orderNumber: result.orderNumber,
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const shipstationApiKey = Deno.env.get("SHIPSTATION_API_KEY");
    const storeId = Deno.env.get("SHIPSTATION_STORE_ID");

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

    // Fetch order with customer details AND line items with SKU info
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .select(`
        id,
        human_uid,
        status,
        subtotal,
        created_at,
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
          shipping_country,
          billing_address_line1,
          billing_address_line2,
          billing_city,
          billing_state,
          billing_zip,
          billing_country,
          billing_same_as_shipping
        ),
        sales_order_lines (
          id,
          bottle_qty,
          unit_price,
          line_subtotal,
          skus (
            id,
            code,
            description
          )
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
      billing_address_line1: string | null;
      billing_address_line2: string | null;
      billing_city: string | null;
      billing_state: string | null;
      billing_zip: string | null;
      billing_country: string | null;
      billing_same_as_shipping: boolean | null;
    } | null;

    if (!customer) {
      return new Response(
        JSON.stringify({ error: "Customer not found for this order" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract order lines with SKU info
    const orderLines = (order.sales_order_lines || []) as unknown as Array<{
      id: string;
      bottle_qty: number;
      unit_price: number;
      line_subtotal: number;
      skus: {
        id: string;
        code: string;
        description: string;
      } | null;
    }>;

    console.log(`Order ${order.human_uid} has ${orderLines.length} line items`);

    // Validate required shipping address fields
    const missingFields: string[] = [];
    if (!customer.shipping_address_line1?.trim()) missingFields.push("Shipping Address Line 1");
    if (!customer.shipping_city?.trim()) missingFields.push("City");
    if (!customer.shipping_zip?.trim()) missingFields.push("ZIP Code");
    if (!customer.phone?.trim()) missingFields.push("Phone");
    
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

    const carrierId = await resolveCarrierId(shipstationApiKey, carrierCode);

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

    // ===============================================
    // STEP 1: Create Order in ShipStation (v1 API)
    // ===============================================
    
    // Build ship-to address for v1 API
    const v1ShipTo: ShipStationV1Address = {
      name: customer.name || "Customer",
      street1: customer.shipping_address_line1!,
      street2: customer.shipping_address_line2 || undefined,
      city: customer.shipping_city!,
      state: customer.shipping_state || "",
      postalCode: customer.shipping_zip!,
      country: countryCode,
      phone: customer.phone || undefined,
    };

    // Build bill-to address (use billing if different, otherwise same as shipping)
    const useBillingAddress = !customer.billing_same_as_shipping && customer.billing_address_line1;
    const v1BillTo: ShipStationV1Address = useBillingAddress ? {
      name: customer.name || "Customer",
      street1: customer.billing_address_line1!,
      street2: customer.billing_address_line2 || undefined,
      city: customer.billing_city || customer.shipping_city!,
      state: customer.billing_state || customer.shipping_state || "",
      postalCode: customer.billing_zip || customer.shipping_zip!,
      country: getCountryCode(customer.billing_country),
      phone: customer.phone || undefined,
    } : v1ShipTo;

    // Build line items from actual order data
    const v1Items: ShipStationV1OrderItem[] = orderLines.map((line) => ({
      lineItemKey: line.id,
      sku: line.skus?.code || "UNKNOWN",
      name: line.skus?.description || "Product",
      quantity: line.bottle_qty,
      unitPrice: line.unit_price,
      weight: { value: 1, units: "ounces" as const }, // Per-item weight estimate
    }));

    // Log the line items being sent
    console.log("Order line items:", JSON.stringify(v1Items, null, 2));

    // Build v1 order payload
    const v1OrderPayload: ShipStationV1Order = {
      orderNumber: order.human_uid,
      orderKey: order.id, // UUID ensures idempotency
      orderDate: order.created_at,
      orderStatus: "awaiting_shipment",
      customerEmail: customer.email || undefined,
      billTo: v1BillTo,
      shipTo: v1ShipTo,
      items: v1Items,
      amountPaid: order.subtotal,
      carrierCode: carrierCode,
      serviceCode: serviceCode,
      weight: weightOz ? { value: weightOz, units: "ounces" } : undefined,
      dimensions: dimensions ? {
        length: dimensions.length,
        width: dimensions.width,
        height: dimensions.height,
        units: "inches",
      } : undefined,
      advancedOptions: storeId ? {
        storeId: parseInt(storeId),
      } : undefined,
    };

    let shipstationOrderId: number | null = null;
    try {
      const orderResult = await createShipStationOrder(shipstationApiKey, v1OrderPayload);
      shipstationOrderId = orderResult.orderId;
      console.log(`ShipStation order created with ID: ${shipstationOrderId}`);
    } catch (orderError) {
      console.error("Failed to create ShipStation order:", orderError);
      // Continue with label creation even if order creation fails
      // The order might already exist (idempotent via orderKey)
    }

    // ===============================================
    // STEP 2: Create Label (v2 API)
    // ===============================================

    // Build ship-from address (warehouse) for v2 API
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

    // Build ship-to address (customer) for v2 API
    const shipTo: ShipStationV2Address = {
      name: customer.name || "Customer",
      address_line1: customer.shipping_address_line1!,
      address_line2: customer.shipping_address_line2 || undefined,
      city_locality: customer.shipping_city!,
      state_province: customer.shipping_state || "",
      postal_code: customer.shipping_zip!,
      country_code: countryCode,
      phone: customer.phone!,
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
        carrier_id: carrierId,
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
      
      let errorDetails: string = errorText;
      let parsedErrors: unknown = null;
      try {
        const errorJson = JSON.parse(errorText);
        parsedErrors = errorJson.errors ?? null;
        if (typeof errorJson.message === "string" && errorJson.message.trim()) {
          errorDetails = errorJson.message;
        } else if (Array.isArray(errorJson.errors)) {
          errorDetails = errorJson.errors
            .map((e: any) => e?.message || e?.error_message || JSON.stringify(e))
            .join("; ");
        }
      } catch {
        // Keep as text
      }
      
      return new Response(
        JSON.stringify({ 
          error: "Failed to create label via ShipStation", 
          details: errorDetails,
          errors: parsedErrors,
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
          shipstation_order_id: shipstationOrderId?.toString() || null,
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
          shipstation_order_id: shipstationOrderId?.toString() || null,
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
        shipstationOrderId,
        carrier: carrierCode.toUpperCase(),
        lineItemsProcessed: orderLines.length,
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
