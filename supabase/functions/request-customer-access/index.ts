import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schema
const RequestBodySchema = z.object({
  customerId: z.string().uuid("Invalid customer ID format"),
});

type RequestBody = z.infer<typeof RequestBodySchema>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authentication required");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with user's auth token for authorization checks
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Invalid authentication token");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.json();
    
    // Validate input
    const validationResult = RequestBodySchema.safeParse(rawBody);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid request data", details: validationResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { customerId }: RequestBody = validationResult.data;

    // Get customer details
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, email, created_at, user_id')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      throw new Error('Customer not found');
    }

    // Verify the authenticated user owns this customer
    if (customer.user_id !== user.id) {
      console.error("Authorization failed: user does not own this customer");
      throw new Error("You are not authorized to request access for this customer");
    }

    // Check if customer was created more than 24 hours ago
    const createdAt = new Date(customer.created_at);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCreation < 24) {
      return new Response(
        JSON.stringify({ 
          error: 'Access request can only be submitted after 24 hours of signup',
          hoursRemaining: Math.ceil(24 - hoursSinceCreation)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: Check for recent requests (within 24 hours)
    const { data: recentRequests } = await supabase
      .from('customer_access_requests')
      .select('requested_at')
      .eq('customer_id', customerId)
      .order('requested_at', { ascending: false })
      .limit(1);

    if (recentRequests && recentRequests.length > 0) {
      const lastRequestTime = new Date(recentRequests[0].requested_at);
      const hoursSinceLastRequest = (now.getTime() - lastRequestTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastRequest < 24) {
        return new Response(
          JSON.stringify({ 
            error: 'Please wait 24 hours between access requests',
            nextAllowedRequest: new Date(lastRequestTime.getTime() + 24 * 60 * 60 * 1000).toISOString()
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if there's already a pending request
    const { data: existingRequest } = await supabase
      .from('customer_access_requests')
      .select('id, status')
      .eq('customer_id', customerId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingRequest) {
      return new Response(
        JSON.stringify({ message: 'Access request already submitted' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create access request
    const { error: insertError } = await supabase
      .from('customer_access_requests')
      .insert({
        customer_id: customerId,
        requested_at: now.toISOString(),
        status: 'pending'
      });

    if (insertError) {
      throw insertError;
    }

    // Get all admin emails
    const { data: adminRoles, error: adminError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (adminError) {
      console.error('Error fetching admin roles:', adminError);
    }

    const adminUserIds = adminRoles?.map(r => r.user_id) || [];
    
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('email')
      .in('id', adminUserIds);

    const adminEmails = adminProfiles?.map(p => p.email) || [];

    // Send email notification to admins
    if (adminEmails.length > 0) {
      const smtpHost = Deno.env.get('SMTP_HOST');
      const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587');
      const smtpUser = Deno.env.get('SMTP_USER');
      const smtpPassword = Deno.env.get('SMTP_PASSWORD');

      if (smtpHost && smtpUser && smtpPassword) {
        try {
          // Create SMTP connection
          const conn = await Deno.connect({
            hostname: smtpHost,
            port: smtpPort,
          });

          const textEncoder = new TextEncoder();
          const textDecoder = new TextDecoder();

          // Simple SMTP communication
          const reader = conn.readable.getReader();
          const writer = conn.writable.getWriter();

          // Read greeting
          await reader.read();

          // EHLO
          await writer.write(textEncoder.encode(`EHLO ${smtpHost}\r\n`));
          await reader.read();

          // AUTH LOGIN
          await writer.write(textEncoder.encode('AUTH LOGIN\r\n'));
          await reader.read();

          // Username
          await writer.write(textEncoder.encode(btoa(smtpUser) + '\r\n'));
          await reader.read();

          // Password
          await writer.write(textEncoder.encode(btoa(smtpPassword) + '\r\n'));
          await reader.read();

          // MAIL FROM
          await writer.write(textEncoder.encode(`MAIL FROM:<${smtpUser}>\r\n`));
          await reader.read();

          // RCPT TO for each admin
          for (const email of adminEmails) {
            await writer.write(textEncoder.encode(`RCPT TO:<${email}>\r\n`));
            await reader.read();
          }

          // DATA
          await writer.write(textEncoder.encode('DATA\r\n'));
          await reader.read();

          const subject = `Customer Access Request - ${customer.name}`;
          const body = `
A customer has requested access to products:

Customer Name: ${customer.name}
Customer Email: ${customer.email}
Request Date: ${now.toLocaleString()}
Account Created: ${createdAt.toLocaleString()}

Please log in to the admin panel to assign product or category access to this customer.
          `.trim();

          const emailContent = [
            `From: ${smtpUser}`,
            `To: ${adminEmails.join(', ')}`,
            `Subject: ${subject}`,
            'Content-Type: text/plain; charset=utf-8',
            '',
            body,
            '.',
          ].join('\r\n');

          await writer.write(textEncoder.encode(emailContent + '\r\n'));
          await reader.read();

          // QUIT
          await writer.write(textEncoder.encode('QUIT\r\n'));
          await reader.read();

          conn.close();
          
          console.log('Email sent successfully to admins');
        } catch (emailError) {
          console.error('Error sending email:', emailError);
          // Don't fail the request if email fails
        }
      }
    }

    return new Response(
      JSON.stringify({ message: 'Access request submitted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
