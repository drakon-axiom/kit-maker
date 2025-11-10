-- Create function for updating timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create email_templates table for managing multiple notification templates
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_type TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  custom_html TEXT,
  available_variables TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view templates"
ON public.email_templates
FOR SELECT
USING (is_authenticated_user());

CREATE POLICY "Admins can manage templates"
ON public.email_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default templates
INSERT INTO public.email_templates (template_type, name, description, subject, available_variables) VALUES
('quote', 'Quote Email', 'Email sent to customers with quote details', 'Quote from {{company_name}}', ARRAY['{{company_name}}', '{{customer_name}}', '{{quote_number}}', '{{date}}', '{{customer_email}}', '{{line_items}}', '{{subtotal}}', '{{deposit_info}}']),
('order_confirmation', 'Order Confirmation', 'Email sent when order is confirmed', 'Order Confirmation - {{quote_number}}', ARRAY['{{company_name}}', '{{customer_name}}', '{{order_number}}', '{{date}}', '{{line_items}}', '{{subtotal}}', '{{total}}']),
('shipment_notification', 'Shipment Notification', 'Email sent when order ships', 'Your Order Has Shipped - {{tracking_no}}', ARRAY['{{company_name}}', '{{customer_name}}', '{{order_number}}', '{{tracking_no}}', '{{carrier}}', '{{estimated_delivery}}']),
('deposit_reminder', 'Deposit Reminder', 'Reminder email for pending deposit payments', 'Deposit Payment Required - {{quote_number}}', ARRAY['{{company_name}}', '{{customer_name}}', '{{quote_number}}', '{{deposit_amount}}', '{{due_date}}']),
('order_status', 'Order Status Update', 'Email sent when order status changes', 'Order Status Update - {{order_number}}', ARRAY['{{company_name}}', '{{customer_name}}', '{{order_number}}', '{{status}}', '{{message}}']);

-- Create trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();