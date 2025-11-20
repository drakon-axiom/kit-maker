-- Insert default wholesale approval email template
INSERT INTO email_templates (
  template_type,
  name,
  description,
  subject,
  custom_html,
  available_variables
) VALUES (
  'wholesale_approval',
  'Wholesale Application Approved',
  'Welcome email sent when a wholesale application is approved with login credentials',
  'Welcome to {{company_name}} - Your Wholesale Account is Approved!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
    .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to {{company_name}}!</h1>
      <p>Your wholesale application has been approved</p>
    </div>
    <div class="content">
      <p>Dear {{contact_name}},</p>
      
      <p>Congratulations! We''re excited to inform you that your wholesale application for <strong>{{company_name_customer}}</strong> has been approved. You now have access to our wholesale management portal.</p>
      
      <div class="credentials">
        <h3>Your Login Credentials</h3>
        <p><strong>Email:</strong> {{email}}</p>
        <p><strong>Temporary Password:</strong> {{temp_password}}</p>
        <p><strong>Portal URL:</strong> <a href="{{portal_url}}">{{portal_url}}</a></p>
      </div>
      
      <div class="warning">
        <strong>⚠️ Important Security Notice:</strong><br>
        For your security, you will be required to change your password upon first login. Please choose a strong password that you haven''t used elsewhere.
      </div>
      
      <p>Once logged in, you can:</p>
      <ul>
        <li>Browse available products and pricing</li>
        <li>Submit new orders</li>
        <li>Track existing orders and shipments</li>
        <li>View invoices and payment history</li>
        <li>Manage your account settings</li>
      </ul>
      
      <div style="text-align: center;">
        <a href="{{portal_url}}" class="button">Access Wholesale Portal</a>
      </div>
      
      <p>If you have any questions or need assistance, please don''t hesitate to contact us.</p>
      
      <p>Best regards,<br>
      The {{company_name}} Team</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>',
  ARRAY['company_name', 'contact_name', 'company_name_customer', 'email', 'temp_password', 'portal_url']
)
ON CONFLICT (template_type) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  custom_html = EXCLUDED.custom_html,
  available_variables = EXCLUDED.available_variables;