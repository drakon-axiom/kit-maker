-- Add SMS notification preferences to notification_preferences table
ALTER TABLE notification_preferences
ADD COLUMN sms_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN sms_phone_number text,
ADD COLUMN sms_order_status boolean NOT NULL DEFAULT true,
ADD COLUMN sms_quote_approved boolean NOT NULL DEFAULT true,
ADD COLUMN sms_shipment_updates boolean NOT NULL DEFAULT true,
ADD COLUMN sms_payment_received boolean NOT NULL DEFAULT false;

-- Create production_photos table
CREATE TABLE production_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  so_id uuid REFERENCES sales_orders(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES production_batches(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  caption text,
  file_size_bytes integer,
  CONSTRAINT photo_linked_to_order_or_batch CHECK (
    (so_id IS NOT NULL AND batch_id IS NULL) OR 
    (so_id IS NULL AND batch_id IS NOT NULL) OR
    (so_id IS NOT NULL AND batch_id IS NOT NULL)
  )
);

-- Enable RLS on production_photos
ALTER TABLE production_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies for production_photos
CREATE POLICY "Admins can manage photos"
ON production_photos FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operators can manage photos"
ON production_photos FOR ALL
USING (has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Customers can view photos for their orders"
ON production_photos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sales_orders so
    JOIN customers c ON c.id = so.customer_id
    WHERE so.id = production_photos.so_id
    AND c.user_id = auth.uid()
  )
);

-- Create storage bucket for production photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'production-photos',
  'production-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
);

-- Storage policies for production-photos bucket
CREATE POLICY "Admins can upload photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'production-photos'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Operators can upload photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'production-photos'
  AND has_role(auth.uid(), 'operator'::app_role)
);

CREATE POLICY "Admins and operators can view all photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'production-photos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operator'::app_role)
  )
);

CREATE POLICY "Customers can view photos for their orders"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'production-photos'
  AND EXISTS (
    SELECT 1 FROM production_photos pp
    JOIN sales_orders so ON so.id = pp.so_id
    JOIN customers c ON c.id = so.customer_id
    WHERE pp.photo_url = name
    AND c.user_id = auth.uid()
  )
);

-- Create index for faster photo lookups
CREATE INDEX idx_production_photos_so_id ON production_photos(so_id);
CREATE INDEX idx_production_photos_batch_id ON production_photos(batch_id);