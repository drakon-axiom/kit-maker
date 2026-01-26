import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Package, ExternalLink, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { canCreateAddon } from '@/utils/orderAddons';

interface AddOn {
  id: string;
  status: string;
  reason: string | null;
  created_at: string;
  addon_order: {
    id: string;
    human_uid: string;
    status: string;
    subtotal: number;
  };
}

interface OrderAddOnsListProps {
  orderId: string;
  orderStatus: string;
  onCreateAddOn?: () => void;
  isAdmin?: boolean;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  approved: 'bg-green-500',
  rejected: 'bg-destructive',
  draft: 'bg-muted',
  quoted: 'bg-blue-500',
  in_queue: 'bg-purple-500',
  in_production: 'bg-primary',
  shipped: 'bg-muted-foreground',
};

export function OrderAddOnsList({ orderId, orderStatus, onCreateAddOn, isAdmin = false }: OrderAddOnsListProps) {
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAddOns = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('order_addons')
        .select(`
          id,
          status,
          reason,
          created_at,
          addon_order:sales_orders!order_addons_addon_so_id_fkey (
            id,
            human_uid,
            status,
            subtotal
          )
        `)
        .eq('parent_so_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddOns((data || []) as unknown as AddOn[]);
    } catch {
      // Non-critical error
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchAddOns();
  }, [fetchAddOns]);

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const canAdd = canCreateAddon(orderStatus);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Add-On Orders
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Add-On Orders
              {addOns.length > 0 && (
                <Badge variant="secondary" className="ml-2">{addOns.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Additional products linked to this order
            </CardDescription>
          </div>
          {isAdmin && canAdd && onCreateAddOn && (
            <Button size="sm" onClick={onCreateAddOn}>
              <Plus className="h-4 w-4 mr-1" />
              Create Add-On
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {addOns.length === 0 ? (
          <div className="text-center py-6">
            <Package className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No add-on orders</p>
            {isAdmin && canAdd && onCreateAddOn && (
              <Button variant="outline" size="sm" className="mt-3" onClick={onCreateAddOn}>
                <Plus className="h-4 w-4 mr-1" />
                Create Add-On Order
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {addOns.map((addon) => (
              <div
                key={addon.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/orders/${addon.addon_order.id}`}
                      className="font-mono font-medium text-primary hover:underline"
                    >
                      {addon.addon_order.human_uid}
                    </Link>
                    <Badge className={statusColors[addon.addon_order.status] || 'bg-muted'}>
                      {formatStatus(addon.addon_order.status)}
                    </Badge>
                  </div>
                  {addon.reason && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {addon.reason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    ${addon.addon_order.subtotal.toFixed(2)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                  >
                    <Link to={`/orders/${addon.addon_order.id}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
