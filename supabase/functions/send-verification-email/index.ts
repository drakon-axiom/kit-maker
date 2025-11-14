import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const hookSecret = Deno.env.get('SEND_VERIFICATION_EMAIL_HOOK_SECRET') as string;

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
      };
      email_data: {
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
      };
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const verificationUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`;
    
    const html = generateVerificationEmailHTML(verificationUrl);

    // Get SMTP configuration from environment
    const smtpHost = Deno.env.get('SMTP_HOST') as string;
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587');
    const smtpUser = Deno.env.get('SMTP_USER') as string;
    const smtpPassword = Deno.env.get('SMTP_PASSWORD') as string;

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    });

    await client.send({
      from: smtpUser,
      to: user.email,
      subject: 'Verify your email address',
      html,
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
