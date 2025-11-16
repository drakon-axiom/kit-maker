-- Add awaiting_approval status to order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_approval';

-- Insert email templates for order approval and rejection
INSERT INTO email_templates (template_type, name, subject, description, available_variables)
VALUES 
  ('order_approval', 'Order Approval', 'Your Order Has Been Approved', 'Sent when an admin approves a customer order', ARRAY['{{customer_name}}', '{{order_number}}', '{{order_total}}', '{{company_name}}', '{{deposit_required}}', '{{deposit_amount}}']),
  ('order_rejection', 'Order Rejection', 'Order Status Update', 'Sent when an admin rejects a customer order', ARRAY['{{customer_name}}', '{{order_number}}', '{{rejection_reason}}', '{{company_name}}'])
ON CONFLICT DO NOTHING;