-- Add default quote expiration days setting
INSERT INTO settings (key, value, description)
VALUES (
  'default_quote_expiration_days',
  '7',
  'Default number of days until quotes expire'
) ON CONFLICT (key) DO NOTHING;

-- Add quote expiration days field to customers table
ALTER TABLE customers
ADD COLUMN quote_expiration_days integer;

COMMENT ON COLUMN customers.quote_expiration_days IS 'Custom quote expiration period for this customer (overrides default setting)';

-- Add quote expiration days field to sales_orders table
ALTER TABLE sales_orders
ADD COLUMN quote_expiration_days integer;

COMMENT ON COLUMN sales_orders.quote_expiration_days IS 'Custom quote expiration period for this order (overrides customer and default settings)';