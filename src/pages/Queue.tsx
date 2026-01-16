import { useState, useEffect, useCallback } from 'react';
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

  const fetchDashboardData = useCallback(async () => {
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

      // Transform the data to handle nested Supabase response
      const transformedBatches = (activeBatchData || []).map((batch: any) => ({
        ...batch,
        sales_order: batch.sales_order || batch.sales_orders || null,
      }));
      setActiveBatches(transformedBatches);

    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Production Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Monitor active batches and workflow stages</p>
        </div>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Production Queue</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">Visual overview of current and upcoming production batches (FIFO)</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Queued</CardTitle>
            <Clock className="h-4 w-4 md:h-5 md:w-5 text-purple-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-3xl font-bold">
              {batchSummary.find(b => b.status === 'queued')?.count || 0}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">
              {batchSummary.find(b => b.status === 'queued')?.total_bottles || 0} bottles
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">In Progress</CardTitle>
            <PlayCircle className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-3xl font-bold">
              {batchSummary.find(b => b.status === 'wip')?.count || 0}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">
              {batchSummary.find(b => b.status === 'wip')?.total_bottles || 0} bottles
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Total Batches</CardTitle>
            <Package className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-3xl font-bold">
              {activeBatches.length}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">Active</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Total Bottles</CardTitle>
            <Box className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-3xl font-bold">
              {batchSummary.reduce((sum, b) => sum + b.total_bottles, 0)}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">Planned</p>
          </CardContent>
        </Card>
      </div>

      {/* Production Queue - FIFO Order */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Production Queue (FIFO)</CardTitle>
              <CardDescription>Batches ordered by priority and planned start date</CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              {activeBatches.length} Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {activeBatches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">No active batches</p>
              <p className="text-sm">Create orders to see production batches here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeBatches.map((batch, index) => (
                <div
                  key={batch.id}
                  className="relative flex items-center gap-4 p-4 border-2 rounded-lg hover:border-primary/50 transition-all"
                >
                  {/* Queue Position */}
                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-muted font-bold text-lg">
                    {index + 1}
                  </div>

                  {/* Batch Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono font-bold text-lg">{batch.human_uid}</span>
                      <Badge 
                        variant={batch.status === 'wip' ? 'default' : 'secondary'}
                        className={batch.status === 'wip' ? 'bg-primary' : 'bg-purple-500'}
                      >
                        {batch.status === 'wip' ? 'IN PROGRESS' : 'QUEUED'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Order:</span> {batch.sales_order?.human_uid}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Customer:</span> {batch.sales_order?.customer?.name}
                    </div>
                  </div>

                  {/* Production Stats */}
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {batch.qty_bottle_planned}
                      </div>
                      <div className="text-xs text-muted-foreground">Planned</div>
                    </div>
                    {batch.status === 'wip' && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {batch.qty_bottle_good}
                        </div>
                        <div className="text-xs text-muted-foreground">Completed</div>
                      </div>
                    )}
                  </div>

                  {/* Schedule Info */}
                  <div className="text-right min-w-[140px]">
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      {batch.actual_start ? 'Started' : 'Scheduled'}
                    </div>
                    <div className="text-sm font-medium">
                      {batch.actual_start 
                        ? new Date(batch.actual_start).toLocaleDateString()
                        : batch.planned_start
                        ? new Date(batch.planned_start).toLocaleDateString()
                        : 'Not scheduled'}
                    </div>
                    {batch.actual_start && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {Math.round((Date.now() - new Date(batch.actual_start).getTime()) / (1000 * 60 * 60))}h ago
                      </div>
                    )}
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