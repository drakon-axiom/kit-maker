import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

interface ApprovalRequest {
  applicationId: string;
  reviewNotes?: string;
  siteUrl?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Require authenticated admin/operator (no shared secret header)
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // IMPORTANT: pass the JWT explicitly to avoid "AuthSessionMissingError" in edge runtime
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    const caller = userData?.user;

    if (userError || !caller) {
      console.error('Unauthorized caller:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .in('role', ['admin', 'operator']);

    if (rolesError || !roles || roles.length === 0) {
      console.error('Forbidden: caller lacks admin/operator role', rolesError);
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { applicationId, reviewNotes, siteUrl }: ApprovalRequest = await req.json();
    console.log('Processing application approval:', applicationId, 'siteUrl:', siteUrl);

    // Helper to log failures to audit_log
    const logFailure = async (action: string, errorDetails: unknown) => {
      try {
        await supabase.from('audit_log').insert({
          action,
          entity: 'wholesale_application',
          entity_id: applicationId,
          actor_id: caller.id,
          before: null,
          after: { error: errorDetails },
        });
      } catch (logErr) {
        console.error('Failed to write audit log:', logErr);
      }
    };

    // Get application details
    const { data: application, error: appError } = await supabase
      .from('wholesale_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      console.error('Application not found:', appError);
      await logFailure('wholesale_approval_failed', { stage: 'fetch_application', error: appError });
      return new Response(JSON.stringify({ error: 'Application not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate temporary password (12 chars, mix of letters and numbers)
    const tempPassword = Array.from({ length: 12 }, () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      return chars.charAt(Math.floor(Math.random() * chars.length));
    }).join('');

    console.log('Creating user account for:', application.email);

    // Create user account
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: application.email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: application.contact_name,
        requires_password_change: true,
      },
    });

    if (authError || !authData.user) {
      console.error('Error creating user:', authError);
      await logFailure('wholesale_approval_failed', { stage: 'create_user', email: application.email, error: authError });
      return new Response(JSON.stringify({ error: 'Failed to create user account', details: authError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User created:', authData.user.id);

    // Create customer record
    const { error: customerError } = await supabase
      .from('customers')
      .insert({
        user_id: authData.user.id,
        name: application.company_name,
        email: application.email,
        phone: application.phone,
        default_terms: 'Net 30',
        shipping_address_line1: application.shipping_address_line1,
        shipping_address_line2: application.shipping_address_line2,
        shipping_city: application.shipping_city,
        shipping_state: application.shipping_state,
        shipping_zip: application.shipping_zip,
        shipping_country: application.shipping_country,
        billing_address_line1: application.billing_address_line1,
        billing_address_line2: application.billing_address_line2,
        billing_city: application.billing_city,
        billing_state: application.billing_state,
        billing_zip: application.billing_zip,
        billing_country: application.billing_country,
        billing_same_as_shipping: application.billing_same_as_shipping,
      });

    if (customerError) {
      console.error('Error creating customer:', customerError);
      await logFailure('wholesale_approval_failed', { stage: 'create_customer', userId: authData.user.id, error: customerError });
      // Clean up user if customer creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return new Response(JSON.stringify({ error: 'Failed to create customer record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Customer created successfully');

    // Assign customer role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'customer',
      });

    if (roleError) {
      console.error('Error assigning role:', roleError);
    }

    // Send welcome email with credentials
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPassword = Deno.env.get('SMTP_PASSWORD');

    if (smtpHost && smtpUser && smtpPassword) {
      try {
        console.log('Sending welcome email to:', application.email);
        
        const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f4f4f4; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #fff; }
    .credentials { background: #f9f9f9; border: 1px solid #ddd; padding: 15px; margin: 20px 0; border-radius: 5px; }
    .warning { color: #d63031; font-weight: bold; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Our Wholesale Portal!</h1>
    </div>
    <div class="content">
      <p>Dear ${application.contact_name},</p>
      
      <p>Congratulations! Your wholesale application for <strong>${application.company_name}</strong> has been approved.</p>
      
      <p>Your account has been created and you can now access our wholesale portal using the credentials below:</p>
      
      <div class="credentials">
        <p><strong>Login URL:</strong> ${siteUrl || 'https://b2b.nexusaminos.com'}/auth</p>
        <p><strong>Email:</strong> ${application.email}</p>
        <p><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
      </div>
      
      <p class="warning">⚠️ IMPORTANT: You will be required to change this temporary password when you first log in.</p>
      
      <p>Once logged in, you'll be able to:</p>
      <ul>
        <li>Browse our wholesale product catalog</li>
        <li>Place orders directly through the portal</li>
        <li>Track order status and shipments</li>
        <li>View invoices and payment history</li>
        <li>Access production photos and updates</li>
      </ul>
      
      ${reviewNotes ? `<p><strong>Admin Notes:</strong> ${reviewNotes}</p>` : ''}
      
      <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
      
      <p>Best regards,<br>The Wholesale Team</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;

        // Simple SMTP implementation using fetch
        const response = await fetch(`https://${smtpHost}:${smtpPort}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: smtpUser,
            to: application.email,
            subject: 'Wholesale Account Approved - Login Credentials',
            html: emailBody,
          }),
        }).catch(err => {
          console.error('SMTP error:', err);
          return null;
        });

        if (response) {
          console.log('Welcome email sent successfully');
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Don't fail the whole operation if email fails
      }
    }

    console.log('Application approval complete');

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authData.user.id,
        tempPassword, // Return this for admin reference
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in approve-wholesale-application:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Attempt to log unhandled errors (may not have supabase or applicationId in scope)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseFallback = createClient(supabaseUrl, supabaseServiceKey);
        await supabaseFallback.from('audit_log').insert({
          action: 'wholesale_approval_failed',
          entity: 'wholesale_application',
          entity_id: null,
          actor_id: null,
          before: null,
          after: { stage: 'unhandled_exception', error: errorMessage },
        });
      }
    } catch (_) {
      // ignore logging failure
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});