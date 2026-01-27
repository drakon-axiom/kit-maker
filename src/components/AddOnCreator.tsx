import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Minus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { validateAddonSize, getAddonBlockedReason } from '@/utils/orderAddons';
import { recalculateConsolidatedTotal, updateUnpaidFinalInvoice } from '@/utils/consolidatedOrder';

interface SKU {
  id: string;
  code: string;
  description: string;
  price_per_kit: number;
  price_per_piece: number;
}

interface AddOnCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentOrderId: string;
  parentOrderNumber: string;
  parentOrderTotal: number;
  parentOrderStatus: string;
  customerId: string | null;
  brandId: string | null;
  onSuccess: () => void;
  isOverride?: boolean;
  overrideNote?: string;
}

export function AddOnCreator({
  open,
  onOpenChange,
  parentOrderId,
  parentOrderNumber,
  parentOrderTotal,
  parentOrderStatus,
  customerId,
  brandId,
  onSuccess,
  isOverride = false,
  overrideNote = '',
}: AddOnCreatorProps) {
  const { user } = useAuth();
  const [skus, setSkus] = useState<SKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [reason, setReason] = useState('');
  const [lineItems, setLineItems] = useState<Record<string, { qty: number; sellMode: 'kit' | 'piece' }>>({});
  const [settings, setSettings] = useState({ maxPercent: 100 });

  const fetchData = useCallback(async () => {
    if (!customerId) return;
    
    setLoading(true);
    try {
      // Fetch customer's accessible SKUs
      const { data: productAccess } = await supabase
        .from('customer_product_access')
        .select('sku_id')
        .eq('customer_id', customerId);

      const { data: categoryAccess } = await supabase
        .from('customer_category_access')
        .select('category_id')
        .eq('customer_id', customerId);

      let skuQuery = supabase
        .from('skus')
        .select('id, code, description, price_per_kit, price_per_piece, category_id')
        .eq('active', true);

      // If customer has specific product or category access, filter by those
      const productIds = productAccess?.map(p => p.sku_id) || [];
      const categoryIds = categoryAccess?.map(c => c.category_id) || [];

      if (productIds.length > 0 || categoryIds.length > 0) {
        // Build OR filter for product IDs and category IDs
        const filters: string[] = [];
        if (productIds.length > 0) {
          filters.push(`id.in.(${productIds.join(',')})`);
        }
        if (categoryIds.length > 0) {
          filters.push(`category_id.in.(${categoryIds.join(',')})`);
        }
        skuQuery = skuQuery.or(filters.join(','));
      }

      const { data: skuData, error } = await skuQuery;
      if (error) throw error;

      setSkus(skuData || []);

      // Fetch settings
      const { data: settingsData } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['addon_max_percent']);

      const settingsMap = Object.fromEntries(
        (settingsData || []).map(s => [s.key, s.value])
      );

      setSettings({
        maxPercent: parseInt(settingsMap.addon_max_percent || '100', 10),
      });
    } catch (error) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (open) {
      fetchData();
      setLineItems({});
      setReason('');
    }
  }, [open, fetchData]);

  const updateQuantity = (skuId: string, delta: number) => {
    setLineItems(prev => {
      const current = prev[skuId] || { qty: 0, sellMode: 'kit' as const };
      const newQty = Math.max(0, current.qty + delta);
      
      if (newQty === 0) {
        const { [skuId]: _, ...rest } = prev;
        return rest;
      }
      
      return { ...prev, [skuId]: { ...current, qty: newQty } };
    });
  };

  const setQuantity = (skuId: string, qty: number) => {
    setLineItems(prev => {
      if (qty <= 0) {
        const { [skuId]: _, ...rest } = prev;
        return rest;
      }
      const current = prev[skuId] || { qty: 0, sellMode: 'kit' as const };
      return { ...prev, [skuId]: { ...current, qty } };
    });
  };

  const calculateTotal = () => {
    return Object.entries(lineItems).reduce((sum, [skuId, item]) => {
      const sku = skus.find(s => s.id === skuId);
      if (!sku) return sum;
      const price = item.sellMode === 'kit' ? sku.price_per_kit : sku.price_per_piece;
      return sum + price * item.qty;
    }, 0);
  };

  const addonTotal = calculateTotal();
  const sizeValidation = validateAddonSize(addonTotal, parentOrderTotal, settings.maxPercent);

  const handleCreate = async () => {
    if (Object.keys(lineItems).length === 0) {
      toast.error('Please add at least one product');
      return;
    }

    if (!sizeValidation.valid) {
      toast.error(sizeValidation.message);
      return;
    }

    setCreating(true);
    try {
      // Generate order number
      const { data: orderNumber, error: orderNumError } = await supabase
        .rpc('generate_order_number', { order_prefix: 'AO' });

      if (orderNumError) throw orderNumError;

      // Create the add-on sales order
      const { data: newOrder, error: orderError } = await supabase
        .from('sales_orders')
        .insert({
          uid: orderNumber,
          human_uid: orderNumber,
          customer_id: customerId,
          brand_id: brandId,
          parent_order_id: parentOrderId,
          status: isOverride ? parentOrderStatus as any : 'in_queue', // Override: match parent status
          subtotal: addonTotal,
          deposit_required: false,
          label_required: false,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order lines
      const orderLines = Object.entries(lineItems).map(([skuId, item]) => {
        const sku = skus.find(s => s.id === skuId)!;
        const price = item.sellMode === 'kit' ? sku.price_per_kit : sku.price_per_piece;
        const bottleQty = item.sellMode === 'kit' ? item.qty * 10 : item.qty; // Assuming 10 bottles per kit
        
        return {
          so_id: newOrder.id,
          sku_id: skuId,
          sell_mode: item.sellMode,
          qty_entered: item.qty,
          bottle_qty: bottleQty,
          unit_price: price,
          line_subtotal: price * item.qty,
        };
      });

      const { error: linesError } = await supabase
        .from('sales_order_lines')
        .insert(orderLines);

      if (linesError) throw linesError;

      // Create the add-on link with override note if applicable
      const { error: addonError } = await supabase
        .from('order_addons')
        .insert({
          parent_so_id: parentOrderId,
          addon_so_id: newOrder.id,
          created_by: user?.id,
          reason: reason || `Add-on for ${parentOrderNumber}`,
          admin_notes: isOverride ? overrideNote : null,
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        });

      if (addonError) throw addonError;

      // If this is an override, recalculate consolidated total and update invoice
      let newConsolidatedTotal: number | null = null;
      let invoiceUpdated = false;
      
      if (isOverride) {
        newConsolidatedTotal = await recalculateConsolidatedTotal(parentOrderId);
        invoiceUpdated = await updateUnpaidFinalInvoice(parentOrderId, newConsolidatedTotal);
      }

      // Audit log - different action for override
      await supabase.from('audit_log').insert({
        entity: 'order_addon',
        entity_id: newOrder.id,
        action: isOverride ? 'created_override' : 'created',
        actor_id: user?.id,
        before: isOverride ? {
          parent_status: parentOrderStatus,
          blocked_reason: getAddonBlockedReason(parentOrderStatus)
        } : null,
        after: {
          parent_order: parentOrderNumber,
          addon_order: orderNumber,
          total: addonTotal,
          ...(isOverride && {
            override_note: overrideNote,
            new_consolidated_total: newConsolidatedTotal,
            invoice_updated: invoiceUpdated
          })
        },
      });

      const successMessage = isOverride
        ? `Add-on order ${orderNumber} created via override. ${invoiceUpdated ? 'Invoice updated.' : ''}`
        : `Add-on order ${orderNumber} created successfully`;
      toast.success(successMessage);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create add-on order');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isOverride ? 'Create Add-On Order (Override)' : 'Create Add-On Order'}
          </DialogTitle>
          <DialogDescription>
            Add products to order {parentOrderNumber}. These will be produced and shipped together.
          </DialogDescription>
        </DialogHeader>

        {isOverride && (
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <p className="text-sm font-medium text-warning">
              Override Mode: This add-on bypasses the normal window.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Consolidated total will be recalculated. Any unpaid final invoice will be updated.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Reason for Add-On</Label>
              <Textarea
                placeholder="Customer requested additional products..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Price/Kit</TableHead>
                    <TableHead className="text-center w-[140px]">Quantity</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skus.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No products available for this customer
                      </TableCell>
                    </TableRow>
                  ) : (
                    skus.map((sku) => {
                      const item = lineItems[sku.id];
                      const qty = item?.qty || 0;
                      const subtotal = qty * sku.price_per_kit;
                      
                      return (
                        <TableRow key={sku.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{sku.code}</p>
                              <p className="text-xs text-muted-foreground">{sku.description}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${sku.price_per_kit.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(sku.id, -1)}
                                disabled={qty === 0}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input
                                type="number"
                                min="0"
                                value={qty}
                                onChange={(e) => setQuantity(sku.id, parseInt(e.target.value) || 0)}
                                className="w-16 h-8 text-center"
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(sku.id, 1)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {qty > 0 ? `$${subtotal.toFixed(2)}` : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Add-On Total</p>
                {!sizeValidation.valid && (
                  <div className="flex items-center gap-1 text-destructive text-xs mt-1">
                    <AlertTriangle className="h-3 w-3" />
                    {sizeValidation.message}
                  </div>
                )}
              </div>
              <p className="text-2xl font-bold">${addonTotal.toFixed(2)}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || Object.keys(lineItems).length === 0 || !sizeValidation.valid}
          >
            {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Add-On Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
