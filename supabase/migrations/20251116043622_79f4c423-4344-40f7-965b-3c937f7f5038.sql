-- Create SMS templates table
CREATE TABLE sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type text NOT NULL UNIQUE,
  name text NOT NULL,
  message_template text NOT NULL,
  available_variables text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage SMS templates"
ON sms_templates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view SMS templates"
ON sms_templates FOR SELECT
USING (is_authenticated_user());

-- Insert default templates
INSERT INTO sms_templates (template_type, name, message_template, available_variables) VALUES
  ('order_status', 'Order Status Update', 'Hi {{customer_name}}, your order {{order_number}} status is now: {{status}}', ARRAY['customer_name', 'order_number', 'status']),
  ('quote_approved', 'Quote Approved', 'Hi {{customer_name}}, your quote {{order_number}} has been approved!', ARRAY['customer_name', 'order_number']),
  ('shipment_update', 'Shipment Update', 'Hi {{customer_name}}, your order {{order_number}} has shipped! Tracking: {{tracking_number}}', ARRAY['customer_name', 'order_number', 'tracking_number']),
  ('shipment_delivered', 'Shipment Delivered', 'Hi {{customer_name}}, your order {{order_number}} has been delivered!', ARRAY['customer_name', 'order_number']),
  ('payment_received', 'Payment Received', 'Hi {{customer_name}}, payment received for order {{order_number}}. Thank you!', ARRAY['customer_name', 'order_number']),
  ('custom', 'Custom Message', '{{message}}', ARRAY['message']);

-- Create SMS log table for tracking
CREATE TABLE sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  so_id uuid REFERENCES sales_orders(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  message text NOT NULL,
  template_type text,
  status text NOT NULL DEFAULT 'pending',
  sent_by uuid,
  textbelt_response jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can view all SMS logs"
ON sms_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert SMS logs"
ON sms_logs FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_sms_logs_customer_id ON sms_logs(customer_id);
CREATE INDEX idx_sms_logs_so_id ON sms_logs(so_id);
CREATE INDEX idx_sms_logs_created_at ON sms_logs(created_at DESC);