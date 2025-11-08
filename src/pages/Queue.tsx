import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Package, Clock, PlayCircle, CheckCircle, Tag, Box } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BatchSummary {
  status: string;
  count: number;
  total_bottles: number;
}

interface OrderSummary {
  status: string;
  count: number;
}

interface ActiveBatch {
  id: string;
  human_uid: string;
  status: string;
  qty_bottle_planned: number;
  qty_bottle_good: number;
  planned_start: string;
  actual_start: string;
  so_id: string;
  sales_order: {
    human_uid: string;
    customer: {
      name: string;
    };
  };
}

const statusColors: Record<string, string> = {
  queued: 'bg-purple-500',
  wip: 'bg-primary',
  complete: 'bg-success',
  hold: 'bg-warning',
  in_queue: 'bg-purple-500',
  in_production: 'bg-primary',
  in_labeling: 'bg-indigo-500',
  in_packing: 'bg-cyan-500',
  packed: 'bg-success',
  ready_to_ship: 'bg-success',
};

const Queue = () => {
  const [loading, setLoading] = useState(true);
  const [batchSummary, setBatchSummary] = useState<BatchSummary[]>([]);
  const [orderSummary, setOrderSummary] = useState<OrderSummary[]>([]);
  const [activeBatches, setActiveBatches] = useState<ActiveBatch[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch batch summary
      const { data: batches, error: batchError } = await supabase
        .from('production_batches')
        .select('status, qty_bottle_planned')
        .in('status', ['queued', 'wip']);

      if (batchError) throw batchError;

      // Aggregate batch data
      const batchAgg = batches?.reduce((acc: Record<string, BatchSummary>, batch) => {
        if (!acc[batch.status]) {
          acc[batch.status] = { status: batch.status, count: 0, total_bottles: 0 };
        }
        acc[batch.status].count++;
        acc[batch.status].total_bottles += batch.qty_bottle_planned || 0;
        return acc;
      }, {});
      setBatchSummary(Object.values(batchAgg || {}));

      // Fetch order summary
      const { data: orders, error: orderError } = await supabase
        .from('sales_orders')
        .select('status')
        .in('status', ['in_queue', 'in_production', 'in_labeling', 'in_packing', 'packed', 'ready_to_ship']);

      if (orderError) throw orderError;

      // Aggregate order data
      const orderAgg = orders?.reduce((acc: Record<string, OrderSummary>, order) => {
        if (!acc[order.status]) {
          acc[order.status] = { status: order.status, count: 0 };
        }
        acc[order.status].count++;
        return acc;
      }, {});
      setOrderSummary(Object.values(orderAgg || {}));

      // Fetch active batches
      const { data: activeBatchData, error: activeBatchError } = await supabase
        .from('production_batches')
        .select(`
          id,
          human_uid,
          status,
          qty_bottle_planned,
          qty_bottle_good,
          planned_start,
          actual_start,
          so_id,
          sales_order:sales_orders(
            human_uid,
            customer:customers(name)
          )
        `)
        .in('status', ['queued', 'wip'])
        .order('priority_index', { ascending: false })
        .order('planned_start', { ascending: true })
        .limit(10);

      if (activeBatchError) throw activeBatchError;
      setActiveBatches(activeBatchData as any || []);

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Production Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor active batches and workflow stages</p>
        </div>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Production Dashboard</h1>
        <p className="text-muted-foreground mt-1">Monitor active batches and workflow stages</p>
      </div>

      {/* Batch Summary */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Production Batches</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Queued Batches</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {batchSummary.find(b => b.status === 'queued')?.count || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {batchSummary.find(b => b.status === 'queued')?.total_bottles || 0} bottles planned
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <PlayCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {batchSummary.find(b => b.status === 'wip')?.count || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {batchSummary.find(b => b.status === 'wip')?.total_bottles || 0} bottles in production
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Order Workflow Stages */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Order Workflow Stages</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Queue</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {orderSummary.find(o => o.status === 'in_queue')?.count || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Production</CardTitle>
              <PlayCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {orderSummary.find(o => o.status === 'in_production')?.count || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Labeling</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {orderSummary.find(o => o.status === 'in_labeling')?.count || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Packing</CardTitle>
              <Box className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {orderSummary.find(o => o.status === 'in_packing')?.count || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Packed</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {orderSummary.find(o => o.status === 'packed')?.count || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ready to Ship</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {orderSummary.find(o => o.status === 'ready_to_ship')?.count || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Active Batches List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Batches</CardTitle>
          <CardDescription>Currently queued and in-progress batches</CardDescription>
        </CardHeader>
        <CardContent>
          {activeBatches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active batches. Create orders to see production batches here.
            </div>
          ) : (
            <div className="space-y-3">
              {activeBatches.map((batch) => (
                <div
                  key={batch.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-medium">{batch.human_uid}</span>
                      <Badge className={statusColors[batch.status] || 'bg-muted'}>
                        {formatStatus(batch.status)}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Order: {batch.sales_order?.human_uid} • {batch.sales_order?.customer?.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {batch.qty_bottle_good || 0} / {batch.qty_bottle_planned} bottles
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {batch.actual_start 
                        ? `Started ${new Date(batch.actual_start).toLocaleDateString()}`
                        : batch.planned_start
                        ? `Planned ${new Date(batch.planned_start).toLocaleDateString()}`
                        : 'Not scheduled'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Queue;