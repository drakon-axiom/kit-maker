import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestEmailBody {
  to?: string;
  subject?: string;
  html?: string;
  // Brand-specific SMTP override
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  brand_name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, smtp_host, smtp_port, smtp_user, smtp_password, brand_name }: TestEmailBody = await req.json().catch(() => ({}));

    // Use brand-specific SMTP if provided, otherwise fall back to env vars
    const smtpHost = smtp_host || Deno.env.get("SMTP_HOST");
    const envPort = parseInt(Deno.env.get("SMTP_PORT") || "0");
    const smtpUser = smtp_user || Deno.env.get("SMTP_USER");
    const smtpPassword = smtp_password || Deno.env.get("SMTP_PASSWORD");
    
    // Determine port - for Proton Mail, always use 465 with implicit TLS
    const isProtonMail = smtpHost?.includes("proton");
    let effectivePort = smtp_port || envPort || 465;
    
    // Force port 465 for Proton Mail if user entered 587 (STARTTLS has issues)
    if (isProtonMail && effectivePort === 587) {
      console.log("Proton Mail detected with port 587 - switching to port 465 for better TLS compatibility");
      effectivePort = 465;
    }
    
    // Port 465 = implicit TLS, Port 587 = STARTTLS
    const useTls = effectivePort === 465;

    console.log(`Testing SMTP for brand: ${brand_name || 'default'}, host: ${smtpHost}, port: ${effectivePort}, tls: ${useTls}`);

    if (!smtpHost || !smtpUser || !smtpPassword) {
      throw new Error("SMTP configuration missing - host, user, or password not provided");
    }

    const toEmail = to || smtpUser;
    const displayName = brand_name || "Nexus Aminos";
    const emailSubject = subject || `${displayName}: SMTP Test Email`;
    const emailHtml = html || `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta http-equiv="x-ua-compatible" content="ie=edge" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${displayName} SMTP Test</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; background:#ffffff; color:#222; }
            .card { max-width:600px; margin:0 auto; padding:24px; border:1px solid #eee; border-radius:10px; }
            .brand { color:#0d6efd; font-weight:700; }
            .muted { color:#666; font-size:12px; margin-top:24px; }
            .success { color:#16a34a; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1 class="brand">${displayName}</h1>
            <h2 class="success">✓ SMTP Configuration Working</h2>
            <p>This test email confirms that your SMTP settings are correctly configured.</p>
            <p><strong>SMTP Host:</strong> ${smtpHost}<br/>
            <strong>Port:</strong> ${effectivePort}<br/>
            <strong>TLS:</strong> ${useTls ? 'Implicit (465)' : 'STARTTLS (587)'}</p>
          </div>
          <p class="muted">Automated test message · ${new Date().toISOString()}</p>
        </body>
      </html>
    `;

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: effectivePort,
        tls: useTls,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    });

    await client.send({
      from: `${displayName} <${smtpUser}>`,
      to: toEmail,
      subject: emailSubject,
      content: emailHtml,
      mimeContent: [{ mimeType: 'text/html', content: emailHtml, transferEncoding: '8bit' }],
    });

    await client.close();

    console.log(`SMTP test email sent successfully to ${toEmail}`);

    return new Response(JSON.stringify({ success: true, sentTo: toEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("email-test error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
