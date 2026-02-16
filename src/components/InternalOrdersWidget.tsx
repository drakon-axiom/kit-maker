import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Package, Factory, Tag, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InternalOrder {
  id: string;
  human_uid: string;
  status: string;
  subtotal: number;
  created_at: string;
  brand: {
    name: string;
    slug: string;
  } | null;
  sales_order_lines: Array<{
    bottle_qty: number;
  }>;
  production_batches: Array<{
    status: string;
    qty_bottle_planned: number;
    qty_bottle_good: number;
  }>;
}

const statusColors: Record<string, string> = {
  in_queue: 'bg-blue-500',
  in_production: 'bg-yellow-500',
  in_labeling: 'bg-purple-500',
  in_packing: 'bg-orange-500',
  stocked: 'bg-teal-500',
  complete: 'bg-gray-500',
};

const statusLabels: Record<string, string> = {
  in_queue: 'Queued',
  in_production: 'Production',
  in_labeling: 'Labeling',
  in_packing: 'Packing',
  stocked: 'Stocked',
  complete: 'Complete',
};

const InternalOrdersWidget = () => {
  const [orders, setOrders] = useState<InternalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchInternalOrders();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('internal-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales_orders',
          filter: 'is_internal=eq.true'
        },
        () => {
          fetchInternalOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_batches'
        },
        () => {
          fetchInternalOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchInternalOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          id,
          human_uid,
          status,
          subtotal,
          created_at,
          brand:brands(name, slug),
          sales_order_lines(bottle_qty),
          production_batches(status, qty_bottle_planned, qty_bottle_good)
        `)
        .eq('is_internal', true)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const getTotalBottles = (order: InternalOrder) => {
    return order.sales_order_lines.reduce((sum, line) => sum + line.bottle_qty, 0);
  };

  const getProductionProgress = (order: InternalOrder) => {
    const batches = order.production_batches;
    if (batches.length === 0) return { progress: 0, text: 'Not started' };

    const totalPlanned = batches.reduce((sum, b) => sum + b.qty_bottle_planned, 0);
    const totalProduced = batches.reduce((sum, b) => sum + (b.qty_bottle_good || 0), 0);
    const completedBatches = batches.filter(b => b.status === 'complete').length;

    if (totalPlanned === 0) return { progress: 0, text: 'Planning' };
    
    const progress = Math.round((totalProduced / totalPlanned) * 100);
    return { 
      progress, 
      text: `${completedBatches}/${batches.length} batches • ${totalProduced}/${totalPlanned} bottles`
    };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Recent Internal Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Recent Internal Orders
          </CardTitle>
          <CardDescription>Production runs for retail stock</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Factory className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No internal orders yet</p>
            <Button onClick={() => navigate('/orders/internal/new')} size="sm">
              Create Internal Order
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Recent Internal Orders
            </CardTitle>
            <CardDescription>Production runs for retail stock</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/orders/internal/new')}
          >
            New Internal Order
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {orders.map((order) => {
            const totalBottles = getTotalBottles(order);
            const { progress, text } = getProductionProgress(order);

            return (
              <div
                key={order.id}
                className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{order.human_uid}</span>
                    <Badge className={statusColors[order.status] || 'bg-muted'}>
                      {statusLabels[order.status] || order.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {order.brand && (
                      <div className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        <span>{order.brand.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Boxes className="h-3 w-3" />
                      <span>{totalBottles} bottles</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Factory className="h-3 w-3" />
                      <span>{text}</span>
                    </div>
                  </div>

                  {order.production_batches.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground min-w-[3ch] text-right">
                        {progress}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-right ml-4">
                  <p className="text-sm font-medium">${order.subtotal.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default InternalOrdersWidget;
