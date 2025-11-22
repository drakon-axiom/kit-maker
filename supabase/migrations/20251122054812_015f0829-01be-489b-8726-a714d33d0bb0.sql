-- Restore UUID defaults on all affected tables after extension move
-- The CASCADE drop removed all default values using uuid_generate_v4

-- Restore defaults for all tables that use UUID primary keys
ALTER TABLE audit_log ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();
ALTER TABLE brands ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE categories ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE customer_access_requests ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE customer_category_access ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE customer_product_access ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE customers ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();
ALTER TABLE email_templates ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE invoice_payments ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();
ALTER TABLE invoices ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();
ALTER TABLE label_settings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE notification_preferences ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE order_comments ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE payment_transactions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE production_batch_items ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();
ALTER TABLE production_batches ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();
ALTER TABLE production_photos ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE quote_actions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE sales_order_lines ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();
ALTER TABLE sales_orders ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();
ALTER TABLE saved_addresses ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE settings ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();
ALTER TABLE shipments ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();
ALTER TABLE sku_pricing_tiers ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE sku_sizes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE skus ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();
ALTER TABLE sms_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE sms_templates ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE user_roles ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();
ALTER TABLE wholesale_applications ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE workflow_steps ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4();