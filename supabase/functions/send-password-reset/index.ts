import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password: string | null;
  contact_email: string | null;
}

// Generate a secure random token
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  // Convert Uint8Array to regular array buffer for base64 encoding
  const buffer = array.buffer;
  return base64Encode(buffer).replace(/[+/=]/g, (c) =>
    c === '+' ? '-' : c === '/' ? '_' : ''
  );
}

// Get SMTP config: brand-specific first, then global fallback
async function getSmtpConfig(supabase: any, brandId?: string | null): Promise<SmtpConfig | null> {
  // Try brand-specific SMTP first
  if (brandId) {
    console.log(`Looking up SMTP config for brand: ${brandId}`);
    const { data: brand, error } = await supabase
      .from('brands')
      .select('smtp_host, smtp_port, smtp_user, smtp_password')
      .eq('id', brandId)
      .single();

    if (error) {
      console.log(`Error fetching brand SMTP: ${error.message}`);
    }

    if (brand?.smtp_host && brand?.smtp_user && brand?.smtp_password) {
      console.log(`Using brand-specific SMTP: ${brand.smtp_host}:${brand.smtp_port || 465}`);
      return {
        host: brand.smtp_host,
        port: brand.smtp_port || 465,
        user: brand.smtp_user,
        password: brand.smtp_password,
      };
    } else {
      console.log('Brand SMTP not fully configured:', {
        hasHost: !!brand?.smtp_host,
        hasUser: !!brand?.smtp_user,
        hasPassword: !!brand?.smtp_password
      });
    }
  } else {
    console.log('No brand ID provided for SMTP lookup');
  }

  // Fallback to global SMTP from environment variables
  const smtpHost = Deno.env.get('SMTP_HOST');
  const smtpUser = Deno.env.get('SMTP_USER');
  const smtpPassword = Deno.env.get('SMTP_PASSWORD');

  console.log('Checking global SMTP environment variables:', {
    hasHost: !!smtpHost,
    hasUser: !!smtpUser,
    hasPassword: !!smtpPassword
  });

  if (smtpHost && smtpUser && smtpPassword) {
    const port = parseInt(Deno.env.get('SMTP_PORT') || '465');
    console.log(`Using global SMTP: ${smtpHost}:${port}`);
    return {
      host: smtpHost,
      port,
      user: smtpUser,
      password: smtpPassword,
    };
  }

  console.log('No SMTP configuration available');
  return null;
}

function generatePasswordResetEmail(
  brand: Brand,
  resetLink: string,
  userEmail: string
): { subject: string; html: string } {
  const brandName = brand.name || 'Our Company';
  const logoHtml = brand.logo_url
    ? `<img src="${brand.logo_url}" alt="${brandName}" style="max-height: 60px; max-width: 200px;" />`
    : `<h1 style="color: #333; margin: 0; font-size: 24px;">${brandName}</h1>`;

  const primaryColor = brand.primary_color || '222 47% 11%';
  // Convert HSL to a usable color (simplified - just use a default if complex)
  const buttonColor = '#2563eb'; // Default blue

  const subject = `Reset Your Password - ${brandName}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              ${logoHtml}
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">
                Password Reset Request
              </h2>

              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                We received a request to reset the password for your account associated with <strong>${userEmail}</strong>.
              </p>

              <p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Click the button below to reset your password. This link will expire in 1 hour.
              </p>

              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display: inline-block; background-color: ${buttonColor}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.
              </p>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />

              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0; color: #6b7280; font-size: 12px; word-break: break-all;">
                ${resetLink}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                © ${new Date().getFullYear()} ${brandName}. All rights reserved.
              </p>
              <p style="margin: 8px 0 0; color: #9ca3af; font-size: 11px;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { email, redirectTo } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the user by email using pagination to handle large user bases
    let user = null;
    let page = 1;
    const perPage = 1000;

    while (!user) {
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers({
        page,
        perPage
      });

      if (userError) {
        console.error("Error listing users:", userError);
        throw new Error("Failed to lookup user");
      }

      user = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

      // If we found the user or there are no more users to check, break
      if (user || userData.users.length < perPage) {
        break;
      }

      page++;

      // Safety limit to prevent infinite loops
      if (page > 100) {
        console.error("Too many pages of users, stopping search");
        break;
      }
    }

    if (!user) {
      // Don't reveal if user exists - return success anyway for security
      console.log("User not found, returning success for security");
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset email has been sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the user's brand (via customer record or user_roles for admins)
    const { data: customer } = await supabase
      .from('customers')
      .select('brand_id')
      .eq('user_id', user.id)
      .single();

    console.log(`User ${user.id} customer record:`, customer);

    let brand: Brand | null = null;

    if (customer?.brand_id) {
      const { data: brandData } = await supabase
        .from('brands')
        .select('*')
        .eq('id', customer.brand_id)
        .single();
      brand = brandData;
      console.log(`Found customer brand: ${brand?.name}`);
    }

    // If no customer brand, get default brand
    if (!brand) {
      console.log('No customer brand found, looking for default brand');
      const { data: defaultBrand } = await supabase
        .from('brands')
        .select('*')
        .eq('is_default', true)
        .single();
      brand = defaultBrand;
      console.log(`Default brand: ${brand?.name}`);
    }

    // If still no brand, create a minimal brand object
    if (!brand) {
      console.log('No brands found in database, using fallback');
      brand = {
        id: '',
        name: 'Axiom Collective',
        slug: 'axiom-collective',
        logo_url: null,
        primary_color: '222 47% 11%',
        smtp_host: null,
        smtp_port: null,
        smtp_user: null,
        smtp_password: null,
        contact_email: null,
      };
    }

    // Get SMTP configuration
    const smtpConfig = await getSmtpConfig(supabase, brand.id || null);

    if (!smtpConfig) {
      console.error("No SMTP configuration available");
      throw new Error("Email service not configured");
    }

    // Generate a secure reset token
    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store the token
    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token: token,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error("Error storing reset token:", tokenError);
      throw new Error("Failed to generate reset token");
    }

    // Build the reset link
    const baseUrl = redirectTo || `${supabaseUrl.replace('.supabase.co', '.vercel.app')}`;
    const resetLink = `${baseUrl}?reset_token=${token}`;

    // Generate email content
    const { subject, html } = generatePasswordResetEmail(brand, resetLink, email);

    // Send the email
    // Use TLS for port 465, STARTTLS for port 587
    // ProtonMail SMTP often requires implicit TLS on 465. If a brand is configured with 587,
    // denomailer can fail in edge runtime; force 465 for protonmail hosts.
    const effectivePort = smtpConfig.host.includes("protonmail") ? 465 : (smtpConfig.port || 465);
    const useTls = effectivePort === 465;

    console.log(`Connecting to SMTP: ${smtpConfig.host}:${effectivePort} (TLS: ${useTls})`);

    const client = new SMTPClient({
      connection: {
        hostname: smtpConfig.host,
        port: effectivePort,
        tls: useTls,
        auth: {
          username: smtpConfig.user,
          password: smtpConfig.password,
        },
      },
    });

    // SMTP providers require sender to match authenticated user
    const fromEmail = smtpConfig.user;
    const fromName = brand.name || 'Password Reset';

    console.log(`Sending email from: ${fromName} <${fromEmail}> to: ${email}`);

    await client.send({
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject: subject,
      content: "Please view this email in an HTML-capable email client.",
      mimeContent: [{ mimeType: 'text/html', content: html, transferEncoding: '8bit' }],
    });

    await client.close();

    console.log(`Password reset email sent to ${email} using ${brand.name} SMTP`);

    return new Response(
      JSON.stringify({ success: true, message: "Password reset email sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-password-reset:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send password reset email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
