import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateLabelRequest {
  orderId: string;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  weightOz: number;
}

interface ShipStationOrder {
  orderNumber: string;
  orderDate: string;
  orderStatus: string;
  customerEmail: string;
  billTo: ShipStationAddress;
  shipTo: ShipStationAddress;
  items: ShipStationItem[];
  weight: {
    value: number;
    units: string;
  };
  dimensions: {
    length: number;
    width: number;
    height: number;
    units: string;
  };
  advancedOptions: {
    storeId: number;
  };
}

interface ShipStationAddress {
  name: string;
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
}

interface ShipStationItem {
  name: string;
  quantity: number;
  sku: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const shipstationApiKey = Deno.env.get("SHIPSTATION_API_KEY");
    const shipstationApiSecret = Deno.env.get("SHIPSTATION_API_SECRET");
    const shipstationStoreId = Deno.env.get("SHIPSTATION_STORE_ID");

    if (!shipstationApiKey || !shipstationApiSecret || !shipstationStoreId) {
      return new Response(
        JSON.stringify({ error: "ShipStation credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { orderId, dimensions, weightOz }: CreateLabelRequest = await req.json();

    if (!orderId || !dimensions || !weightOz) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: orderId, dimensions, weightOz" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .select(`
        id,
        human_uid,
        subtotal,
        created_at,
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
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // customers is a single object due to .single(), but TypeScript infers array
    const customer = order.customers as unknown as {
      id: string;
      name: string | null;
      email: string | null;
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

    // Fetch order lines
    const { data: orderLines } = await supabase
      .from("sales_order_lines")
      .select(`
        qty_entered,
        bottle_qty,
        skus (
          code,
          description
        )
      `)
      .eq("so_id", orderId);

    // Fetch carrier settings
    const { data: carrierSettings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["shipstation_carrier_code", "shipstation_service_code"]);

    const settingsMap = (carrierSettings || []).reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, string>);

    const carrierCode = settingsMap["shipstation_carrier_code"] || "ups";
    const serviceCode = settingsMap["shipstation_service_code"] || "ups_ground";

    // Build ShipStation order
    const shipToAddress: ShipStationAddress = {
      name: customer.name || "Customer",
      street1: customer.shipping_address_line1 || "",
      street2: customer.shipping_address_line2 || null,
      city: customer.shipping_city || "",
      state: customer.shipping_state || "",
      postalCode: customer.shipping_zip || "",
      country: customer.shipping_country || "US",
      phone: customer.phone || null,
    };

    const items: ShipStationItem[] = (orderLines || []).map((line: any) => ({
      name: line.skus?.description || "Product",
      quantity: line.bottle_qty || line.qty_entered,
      sku: line.skus?.code || "SKU",
    }));

    const shipstationOrder: ShipStationOrder = {
      orderNumber: order.human_uid,
      orderDate: order.created_at,
      orderStatus: "awaiting_shipment",
      customerEmail: customer.email || "",
      billTo: shipToAddress,
      shipTo: shipToAddress,
      items,
      weight: {
        value: weightOz,
        units: "ounces",
      },
      dimensions: {
        length: dimensions.length,
        width: dimensions.width,
        height: dimensions.height,
        units: "inches",
      },
      advancedOptions: {
        storeId: parseInt(shipstationStoreId),
      },
    };

    const authHeader = btoa(`${shipstationApiKey}:${shipstationApiSecret}`);

    // Create order in ShipStation
    console.log("Creating order in ShipStation:", order.human_uid);
    const createOrderResponse = await fetch("https://ssapi.shipstation.com/orders/createorder", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(shipstationOrder),
    });

    if (!createOrderResponse.ok) {
      const errorText = await createOrderResponse.text();
      console.error("ShipStation create order error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create order in ShipStation", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const createdOrder = await createOrderResponse.json();
    console.log("Order created in ShipStation:", createdOrder.orderId);

    // Create label for the order
    const labelRequest = {
      orderId: createdOrder.orderId,
      carrierCode: carrierCode,
      serviceCode: serviceCode,
      packageCode: "package",
      confirmation: "delivery",
      shipDate: new Date().toISOString().split("T")[0],
      weight: {
        value: weightOz,
        units: "ounces",
      },
      dimensions: {
        length: dimensions.length,
        width: dimensions.width,
        height: dimensions.height,
        units: "inches",
      },
      testLabel: false,
    };

    console.log("Creating label with request:", labelRequest);
    const createLabelResponse = await fetch("https://ssapi.shipstation.com/orders/createlabelfororder", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(labelRequest),
    });

    if (!createLabelResponse.ok) {
      const errorText = await createLabelResponse.text();
      console.error("ShipStation create label error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create shipping label", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const labelResult = await createLabelResponse.json();
    console.log("Label created:", labelResult.trackingNumber);

    // Check if shipment record already exists for this order
    const { data: existingShipment } = await supabase
      .from("shipments")
      .select("id")
      .eq("so_id", orderId)
      .maybeSingle();

    if (existingShipment) {
      // Update existing shipment
      await supabase
        .from("shipments")
        .update({
          tracking_no: labelResult.trackingNumber,
          carrier: carrierCode.toUpperCase(),
          label_url: labelResult.labelData ? `data:application/pdf;base64,${labelResult.labelData}` : null,
          shipped_at: new Date().toISOString(),
          shipstation_shipment_id: labelResult.shipmentId,
          voided_at: null, // Clear any previous void status
        })
        .eq("id", existingShipment.id);
    } else {
      // Create new shipment record
      await supabase.from("shipments").insert({
        so_id: orderId,
        tracking_no: labelResult.trackingNumber,
        carrier: carrierCode.toUpperCase(),
        label_url: labelResult.labelData ? `data:application/pdf;base64,${labelResult.labelData}` : null,
        shipped_at: new Date().toISOString(),
        shipstation_shipment_id: labelResult.shipmentId,
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
        trackingNumber: labelResult.trackingNumber,
        carrier: carrierCode.toUpperCase(),
        labelUrl: labelResult.labelData ? `data:application/pdf;base64,${labelResult.labelData}` : null,
        shipstationOrderId: createdOrder.orderId,
        shipstationShipmentId: labelResult.shipmentId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating shipping label:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
