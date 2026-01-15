import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const hookSecret = Deno.env.get('SEND_VERIFICATION_EMAIL_HOOK_SECRET') as string;

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

// Helper function to get SMTP config: brand-specific first, then global fallback
async function getSmtpConfig(supabase: any, brandId?: string | null): Promise<SmtpConfig | null> {
  // Try brand-specific SMTP first
  if (brandId) {
    const { data: brand } = await supabase
      .from('brands')
      .select('smtp_host, smtp_port, smtp_user, smtp_password')
      .eq('id', brandId)
      .single();

    if (brand?.smtp_host && brand?.smtp_user && brand?.smtp_password) {
      console.log('Using brand-specific SMTP configuration');
      return {
        host: brand.smtp_host,
        port: brand.smtp_port || 465,
        user: brand.smtp_user,
        password: brand.smtp_password,
      };
    }
  }

  // Fallback to global SMTP from environment variables
  const smtpHost = Deno.env.get('SMTP_HOST');
  const smtpUser = Deno.env.get('SMTP_USER');
  const smtpPassword = Deno.env.get('SMTP_PASSWORD');

  if (smtpHost && smtpUser && smtpPassword) {
    console.log('Using global SMTP configuration');
    return {
      host: smtpHost,
      port: parseInt(Deno.env.get('SMTP_PORT') || '465'),
      user: smtpUser,
      password: smtpPassword,
    };
  }

  return null;
}

const generateVerificationEmailHTML = (verificationUrl: string) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; background-color: #ffffff;">
    <div style="max-width: 580px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #ffffff; padding: 40px 20px; text-align: center;">
        <h1 style="color: #1a1a1a; font-size: 32px; font-weight: bold; margin: 40px 0; padding: 0;">
          Welcome!
        </h1>
        <p style="color: #444; font-size: 16px; line-height: 26px; margin: 16px 0;">
          Thank you for signing up. Please verify your email address to activate your customer account.
        </p>
        <div style="margin: 32px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #000; border-radius: 8px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; display: inline-block; padding: 14px 30px;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #444; font-size: 14px; line-height: 24px; margin: 24px 0;">
          Or, copy and paste this URL into your browser:
        </p>
        <p style="color: #2754C5; font-size: 14px; word-break: break-all; margin: 16px 0;">
          ${verificationUrl}
        </p>
        <p style="color: #ababab; font-size: 14px; line-height: 24px; margin: 32px 0 16px;">
          If you didn't create an account, you can safely ignore this email.
        </p>
        <p style="color: #898989; font-size: 12px; line-height: 22px; margin: 32px 0; text-align: center;">
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    </div>
  </body>
</html>
`;

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);
    const wh = new Webhook(hookSecret);

    const {
      user,
      email_data: { token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: {
        email: string;
        user_metadata?: {
          brand_id?: string;
        };
      };
      email_data: {
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
      };
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const verificationUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`;
    
    const html = generateVerificationEmailHTML(verificationUrl);

    // Try to get brand_id from user metadata or find customer's brand
    let brandId = user.user_metadata?.brand_id;
    
    if (!brandId) {
      // Try to find customer by email to get their brand_id
      const { data: customer } = await supabase
        .from('customers')
        .select('brand_id')
        .eq('email', user.email)
        .single();
      
      if (customer?.brand_id) {
        brandId = customer.brand_id;
      }
    }

    // Get SMTP configuration (brand-specific or global fallback)
    const smtpConfig = await getSmtpConfig(supabase, brandId);

    if (!smtpConfig) {
      throw new Error('SMTP configuration not available');
    }

    const effectivePort = smtpConfig.host.includes("protonmail") ? 465 : smtpConfig.port;
    const useTls = effectivePort === 465;

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

    await client.send({
      from: smtpConfig.user,
      to: user.email,
      subject: 'Verify your email address',
      content: html,
      mimeContent: [{ mimeType: 'text/html', content: html, transferEncoding: '8bit' }],
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending verification email:', error);
    return new Response(
      JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
