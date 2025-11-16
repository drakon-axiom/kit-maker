import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TEXTBELT_API_KEY = Deno.env.get("TEXTBELT_API_KEY");

    if (!TEXTBELT_API_KEY) {
      throw new Error("TEXTBELT_API_KEY not configured");
    }

    // Fetch quota from Textbelt
    const quotaResponse = await fetch(`https://textbelt.com/quota/${TEXTBELT_API_KEY}`);
    const quotaData = await quotaResponse.json();

    return new Response(JSON.stringify(quotaData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching Textbelt quota:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
