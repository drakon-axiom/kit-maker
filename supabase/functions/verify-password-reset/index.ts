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

    // Atomically claim the token by marking it as used in a single operation
    // This prevents race conditions where multiple requests could use the same token
    console.log(`Attempting to claim token...`);
    const now = new Date().toISOString();
    const { data: claimedToken, error: claimError } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: now })
      .eq('token', token)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('*')
      .single();

    if (claimError || !claimedToken) {
      // Token not found, already used, or expired
      console.log("Token claim failed - invalid, already used, or expired");
      return new Response(
        JSON.stringify({ error: "Invalid or expired reset token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Token claimed successfully for user: ${claimedToken.user_id}`);

    // Update the user's password and clear requires_password_change flag
    console.log(`Updating password for user: ${claimedToken.user_id}`);
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      claimedToken.user_id,
      {
        password: newPassword,
        user_metadata: { requires_password_change: false }
      }
    );

    if (updateError) {
      console.error("Password update error:", updateError.message, updateError);
      // Token is already marked as used, user will need to request a new reset
      throw new Error("Failed to update password. Please request a new reset link.");
    }

    console.log('Password updated successfully');

    // Invalidate any other unused tokens for this user
    const { error: invalidateError } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: now })
      .eq('user_id', claimedToken.user_id)
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
