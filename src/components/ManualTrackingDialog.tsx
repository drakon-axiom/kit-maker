import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';

interface ManualTrackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  onSuccess?: () => void;
}

const CARRIERS = [
  { value: 'UPS', label: 'UPS' },
  { value: 'FedEx', label: 'FedEx' },
  { value: 'USPS', label: 'USPS' },
  { value: 'DHL', label: 'DHL' },
  { value: 'Other', label: 'Other' },
];

export function ManualTrackingDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  onSuccess,
}: ManualTrackingDialogProps) {
  const [saving, setSaving] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const handleSave = async () => {
    if (!trackingNumber.trim()) {
      toast.error('Please enter a tracking number');
      return;
    }

    if (!carrier) {
      toast.error('Please select a carrier');
      return;
    }

    setSaving(true);
    try {
      // Insert shipment record
      const { error: shipmentError } = await supabase
        .from('shipments')
        .insert({
          so_id: orderId,
          tracking_no: trackingNumber.trim(),
          carrier: carrier,
          shipped_at: new Date().toISOString(),
        });

      if (shipmentError) throw shipmentError;

      // Update order status to shipped
      const { error: orderError } = await supabase
        .from('sales_orders')
        .update({ status: 'shipped' })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // Log audit
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_log').insert({
        entity: 'sales_order',
        entity_id: orderId,
        action: 'manual_tracking_added',
        actor_id: user?.id,
        after: {
          tracking_no: trackingNumber.trim(),
          carrier: carrier,
          status: 'shipped',
        },
      });

      toast.success(`Tracking added for ${orderNumber}`);
      onSuccess?.();
      onOpenChange(false);
      
      // Reset form
      setCarrier('');
      setTrackingNumber('');
    } catch (error) {
      console.error('Error adding tracking:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add tracking');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setCarrier('');
      setTrackingNumber('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Add Tracking Manually
          </DialogTitle>
          <DialogDescription>
            Add tracking information for order {orderNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="carrier">Carrier</Label>
            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger>
                <SelectValue placeholder="Select carrier..." />
              </SelectTrigger>
              <SelectContent>
                {CARRIERS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tracking">Tracking Number</Label>
            <Input
              id="tracking"
              placeholder="Enter tracking number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !trackingNumber.trim() || !carrier}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Tracking & Mark Shipped
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
