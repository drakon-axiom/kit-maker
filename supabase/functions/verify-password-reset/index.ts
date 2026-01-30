import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { token, newPassword } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Reset token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!newPassword) {
      return new Response(
        JSON.stringify({ error: "New password is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the token
    console.log(`Looking up token: ${token.substring(0, 8)}...`);
    const { data: tokenData, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single();

    if (tokenError) {
      console.error("Token lookup error:", tokenError.message, tokenError.details);
    }

    if (tokenError || !tokenData) {
      console.log("Token not found or already used");
      return new Response(
        JSON.stringify({ error: "Invalid or expired reset token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Token found for user: ${tokenData.user_id}`);

    // Check if token is expired
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      return new Response(
        JSON.stringify({ error: "Reset token has expired. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the user's password and clear requires_password_change flag
    console.log(`Updating password for user: ${tokenData.user_id}`);
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      tokenData.user_id,
      {
        password: newPassword,
        user_metadata: { requires_password_change: false }
      }
    );

    if (updateError) {
      console.error("Password update error:", updateError.message, updateError);
      throw new Error("Failed to update password: " + updateError.message);
    }

    console.log('Password updated successfully, marking token as used');

    // Mark the token as used
    const { error: markError } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenData.id);

    if (markError) {
      console.error("Error marking token as used:", markError);
    }

    // Invalidate any other unused tokens for this user
    const { error: invalidateError } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', tokenData.user_id)
      .is('used_at', null);

    if (invalidateError) {
      console.error("Error invalidating other tokens:", invalidateError);
    }

    console.log(`Password reset completed successfully for user ${tokenData.user_id}`);

    return new Response(
      JSON.stringify({ success: true, message: "Password updated successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in verify-password-reset:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to reset password" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
