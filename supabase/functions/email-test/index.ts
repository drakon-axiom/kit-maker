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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html }: TestEmailBody = await req.json().catch(() => ({}));

    const smtpHost = Deno.env.get("SMTP_HOST");
    const envPort = parseInt(Deno.env.get("SMTP_PORT") || "0");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const effectivePort = smtpHost?.includes("protonmail") ? 465 : (envPort || 465);
    const useTls = effectivePort === 465;

    if (!smtpHost || !smtpUser || !smtpPassword) {
      throw new Error("SMTP configuration missing");
    }

    const toEmail = to || "scotthawks@outlook.com";
    const emailSubject = subject || "Nexus Aminos: Test Email";
    const emailHtml = html || `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta http-equiv="x-ua-compatible" content="ie=edge" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Nexus Aminos Test</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; background:#ffffff; color:#222; }
            .card { max-width:600px; margin:0 auto; padding:24px; border:1px solid #eee; border-radius:10px; }
            .brand { color:#0d6efd; font-weight:700; }
            .muted { color:#666; font-size:12px; margin-top:24px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1 class="brand">Nexus Aminos</h1>
            <h2>HTML Email Test</h2>
            <p>This is a <strong>basic HTML</strong> test email sent via Proton SMTP.</p>
            <p>If you see this formatted correctly (no '=20' artifacts), HTML delivery works.</p>
          </div>
          <p class="muted">Automated message · Do not reply</p>
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
      from: `Nexus Aminos <${smtpUser}>`,
      to: toEmail,
      subject: emailSubject,
      html: emailHtml,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
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
