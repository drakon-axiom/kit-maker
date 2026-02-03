import { useState, useEffect } from 'react';
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
import { Loader2, Truck, Plus, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';

interface ManualTrackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  onSuccess?: () => void;
}

interface PackageTracking {
  id: string;
  carrier: string;
  trackingNumber: string;
  packageNumber?: number;
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
  const [loading, setLoading] = useState(false);
  const [packageCount, setPackageCount] = useState(0);
  const [packages, setPackages] = useState<PackageTracking[]>([
    { id: crypto.randomUUID(), carrier: '', trackingNumber: '', packageNumber: 1 },
  ]);

  // Fetch package count when dialog opens
  useEffect(() => {
    if (open && orderId) {
      fetchPackageCount();
    }
  }, [open, orderId]);

  const fetchPackageCount = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_packages')
        .select('package_number')
        .eq('so_id', orderId)
        .order('package_number', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setPackageCount(data.length);
        // Pre-populate with package numbers
        setPackages(
          data.map((pkg, idx) => ({
            id: crypto.randomUUID(),
            carrier: '',
            trackingNumber: '',
            packageNumber: pkg.package_number || idx + 1,
          }))
        );
      } else {
        setPackageCount(0);
        setPackages([{ id: crypto.randomUUID(), carrier: '', trackingNumber: '', packageNumber: 1 }]);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      // Default to single package
      setPackages([{ id: crypto.randomUUID(), carrier: '', trackingNumber: '', packageNumber: 1 }]);
    } finally {
      setLoading(false);
    }
  };

  const addPackage = () => {
    const nextNumber = packages.length + 1;
    setPackages([
      ...packages,
      { id: crypto.randomUUID(), carrier: '', trackingNumber: '', packageNumber: nextNumber },
    ]);
  };

  const removePackage = (id: string) => {
    if (packages.length > 1) {
      setPackages(packages.filter((p) => p.id !== id));
    }
  };

  const updatePackage = (id: string, field: 'carrier' | 'trackingNumber', value: string) => {
    setPackages(packages.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleSave = async () => {
    // Validate all packages have tracking info
    const invalidPackages = packages.filter((p) => !p.trackingNumber.trim() || !p.carrier);
    if (invalidPackages.length > 0) {
      toast.error('Please fill in carrier and tracking number for all packages');
      return;
    }

    setSaving(true);
    try {
      // Insert all shipment records
      const shipmentInserts = packages.map((pkg, idx) => ({
        so_id: orderId,
        tracking_no: pkg.trackingNumber.trim(),
        carrier: pkg.carrier,
        shipped_at: new Date().toISOString(),
        notes: packages.length > 1 ? `Package ${idx + 1} of ${packages.length}` : null,
      }));

      const { error: shipmentError } = await supabase
        .from('shipments')
        .insert(shipmentInserts);

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
          packages: packages.map((p, idx) => ({
            package: idx + 1,
            tracking_no: p.trackingNumber.trim(),
            carrier: p.carrier,
          })),
          status: 'shipped',
        },
      });

      toast.success(
        packages.length > 1
          ? `${packages.length} tracking numbers added for ${orderNumber}`
          : `Tracking added for ${orderNumber}`
      );
      onSuccess?.();
      onOpenChange(false);

      // Reset form
      setPackages([{ id: crypto.randomUUID(), carrier: '', trackingNumber: '', packageNumber: 1 }]);
    } catch (error) {
      console.error('Error adding tracking:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add tracking');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setPackages([{ id: crypto.randomUUID(), carrier: '', trackingNumber: '', packageNumber: 1 }]);
      onOpenChange(false);
    }
  };

  const allValid = packages.every((p) => p.trackingNumber.trim() && p.carrier);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Add Tracking Manually
          </DialogTitle>
          <DialogDescription>
            Add tracking information for order {orderNumber}
            {packageCount > 0 && (
              <span className="block text-xs mt-1">
                This order has {packageCount} package{packageCount > 1 ? 's' : ''} recorded
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {packages.map((pkg, index) => (
              <div
                key={pkg.id}
                className="space-y-3 p-3 border rounded-lg bg-muted/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Package className="h-4 w-4" />
                    Package {pkg.packageNumber || index + 1}
                  </div>
                  {packages.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removePackage(pkg.id)}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Carrier</Label>
                    <Select
                      value={pkg.carrier}
                      onValueChange={(v) => updatePackage(pkg.id, 'carrier', v)}
                      disabled={saving}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select..." />
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

                  <div className="space-y-1.5">
                    <Label className="text-xs">Tracking Number</Label>
                    <Input
                      className="h-9"
                      placeholder="Enter tracking #"
                      value={pkg.trackingNumber}
                      onChange={(e) => updatePackage(pkg.id, 'trackingNumber', e.target.value)}
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={addPackage}
              disabled={saving}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Package
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !allValid || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {packages.length > 1
              ? `Add ${packages.length} Tracking Numbers & Ship`
              : 'Add Tracking & Mark Shipped'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
