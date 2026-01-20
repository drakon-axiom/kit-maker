import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, Package, Factory, CheckCircle2, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

interface WorkflowStep {
  id: string;
  step: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
}

interface ProductionBatch {
  id: string;
  human_uid: string;
  status: string;
  qty_bottle_planned: number;
  qty_bottle_good: number | null;
  planned_start: string | null;
  actual_start: string | null;
  actual_finish: string | null;
  workflow_steps?: WorkflowStep[];
}

interface OrderWithBatches {
  id: string;
  human_uid: string;
  status: string;
  created_at: string;
  promised_date: string | null;
  subtotal: number;
  production_batches?: ProductionBatch[];
}

const WORKFLOW_STEP_LABELS: Record<string, string> = {
  produce: 'Production',
  bottle_cap: 'Bottle & Cap',
  label: 'Labeling',
  pack: 'Packing',
};

const WORKFLOW_STEP_ORDER = ['produce', 'bottle_cap', 'label', 'pack'];

export default function CustomerProductionProgress() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [orders, setOrders] = useState<OrderWithBatches[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProductionData = useCallback(async () => {
    try {
      // Get customer ID first
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!customer) {
        setLoading(false);
        return;
      }

      // Fetch orders that are in production-related statuses
      const productionStatuses: Array<'in_queue' | 'in_production' | 'in_labeling' | 'in_packing' | 'packed' | 'ready_to_ship' | 'shipped'> = [
        'in_queue',
        'in_production',
        'in_labeling',
        'in_packing',
        'packed',
        'ready_to_ship',
        'shipped'
      ];

      const { data: ordersData, error: ordersError } = await supabase
        .from('sales_orders')
        .select(`
          id,
          human_uid,
          status,
          created_at,
          promised_date,
          subtotal,
          production_batches (
            id,
            human_uid,
            status,
            qty_bottle_planned,
            qty_bottle_good,
            planned_start,
            actual_start,
            actual_finish,
            workflow_steps (
              id,
              step,
              status,
              started_at,
              finished_at
            )
          )
        `)
        .eq('customer_id', customer.id)
        .in('status', productionStatuses)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      setOrders(ordersData || []);
    } catch (error) {
      toast.error('Failed to load production data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProductionData();
    }
  }, [user, fetchProductionData]);

  const getStepProgress = (steps: WorkflowStep[] | undefined) => {
    if (!steps || steps.length === 0) return { completed: 0, total: 4, percentage: 0 };
    
    const completed = steps.filter(s => s.status === 'done').length;
    const total = steps.length;
    return {
      completed,
      total,
      percentage: (completed / total) * 100
    };
  };

  const getBatchStatusInfo = (status: string) => {
    switch (status) {
      case 'queued':
        return { label: 'Queued', color: 'bg-muted text-muted-foreground', icon: Clock };
      case 'wip':
        return { label: 'In Progress', color: 'bg-orange-500 text-white', icon: Factory };
      case 'hold':
        return { label: 'On Hold', color: 'bg-yellow-500 text-white', icon: AlertCircle };
      case 'complete':
        return { label: 'Complete', color: 'bg-green-500 text-white', icon: CheckCircle2 };
      default:
        return { label: status, color: 'bg-muted text-muted-foreground', icon: Package };
    }
  };

  const getOrderStatusInfo = (status: string) => {
    switch (status) {
      case 'in_queue':
        return { label: 'In Queue', color: 'bg-purple-500' };
      case 'in_production':
        return { label: 'In Production', color: 'bg-orange-500' };
      case 'in_labeling':
        return { label: 'Labeling', color: 'bg-blue-500' };
      case 'in_packing':
        return { label: 'Packing', color: 'bg-indigo-500' };
      case 'packed':
        return { label: 'Packed', color: 'bg-green-500' };
      case 'ready_to_ship':
        return { label: 'Ready to Ship', color: 'bg-teal-500' };
      case 'shipped':
        return { label: 'Shipped', color: 'bg-emerald-500' };
      default:
        return { label: status.replace(/_/g, ' '), color: 'bg-muted' };
    }
  };

  const getCurrentStep = (steps: WorkflowStep[] | undefined) => {
    if (!steps || steps.length === 0) return null;
    
    // Find the step that's in progress
    const wipStep = steps.find(s => s.status === 'wip');
    if (wipStep) return wipStep.step;
    
    // Find the next pending step
    const orderedSteps = WORKFLOW_STEP_ORDER.filter(step => 
      steps.some(s => s.step === step)
    );
    
    for (const step of orderedSteps) {
      const stepData = steps.find(s => s.step === step);
      if (stepData?.status === 'pending') return step;
    }
    
    // All done
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Production Progress</h1>
        <p className="text-muted-foreground mt-1">Track your orders through production</p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Factory className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No orders in production</h3>
            <p className="text-muted-foreground text-center text-sm mb-4">
              Orders will appear here once they enter production.
            </p>
            <Button onClick={() => navigate('/customer')}>View All Orders</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const orderStatus = getOrderStatusInfo(order.status);
            const batches = order.production_batches || [];
            const totalBottles = batches.reduce((sum, b) => sum + b.qty_bottle_planned, 0);
            const completedBottles = batches.reduce((sum, b) => sum + (b.qty_bottle_good || 0), 0);
            const overallProgress = totalBottles > 0 ? (completedBottles / totalBottles) * 100 : 0;

            return (
              <Card key={order.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="truncate">Order {order.human_uid}</span>
                        <Badge className={`${orderStatus.color} text-white shrink-0`}>
                          {orderStatus.label}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {order.promised_date && (
                          <span>Expected: {new Date(order.promised_date).toLocaleDateString()}</span>
                        )}
                      </CardDescription>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => navigate(`/customer/orders/${order.id}`)}
                    >
                      <span className="hidden sm:inline mr-1">Details</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Overall Progress */}
                  {batches.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Overall Progress</span>
                        <span className="font-medium">
                          {completedBottles.toLocaleString()} / {totalBottles.toLocaleString()} bottles
                        </span>
                      </div>
                      <Progress value={overallProgress} className="h-2" />
                    </div>
                  )}

                  {/* Batch Cards */}
                  {batches.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">Production Batches</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {batches.map((batch) => {
                          const batchStatus = getBatchStatusInfo(batch.status);
                          const BatchIcon = batchStatus.icon;
                          const steps = batch.workflow_steps;
                          const progress = getStepProgress(steps);
                          const currentStep = getCurrentStep(steps);

                          return (
                            <div
                              key={batch.id}
                              className="border rounded-lg p-3 space-y-3 bg-card"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <BatchIcon className="h-4 w-4 shrink-0" />
                                  <span className="font-medium text-sm truncate">
                                    {batch.human_uid}
                                  </span>
                                </div>
                                <Badge className={`${batchStatus.color} shrink-0 text-xs`}>
                                  {batchStatus.label}
                                </Badge>
                              </div>

                              {/* Workflow Steps Progress */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">
                                    {currentStep 
                                      ? `Current: ${WORKFLOW_STEP_LABELS[currentStep]}`
                                      : batch.status === 'complete' 
                                        ? 'All steps complete'
                                        : 'Waiting to start'
                                    }
                                  </span>
                                  <span className="font-medium">
                                    {progress.completed}/{progress.total} steps
                                  </span>
                                </div>
                                <Progress value={progress.percentage} className="h-1.5" />
                                
                                {/* Step indicators */}
                                <div className="flex gap-1">
                                  {WORKFLOW_STEP_ORDER.map((stepType) => {
                                    const stepData = steps?.find(s => s.step === stepType);
                                    if (!stepData) return null;
                                    
                                    const isDone = stepData.status === 'done';
                                    const isWip = stepData.status === 'wip';
                                    
                                    return (
                                      <div
                                        key={stepType}
                                        className={`flex-1 h-1 rounded-full ${
                                          isDone 
                                            ? 'bg-green-500' 
                                            : isWip 
                                              ? 'bg-orange-500' 
                                              : 'bg-muted'
                                        }`}
                                        title={`${WORKFLOW_STEP_LABELS[stepType]}: ${stepData.status}`}
                                      />
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Quantity info */}
                              <div className="text-xs text-muted-foreground">
                                {batch.qty_bottle_planned.toLocaleString()} bottles planned
                                {batch.qty_bottle_good !== null && batch.qty_bottle_good > 0 && (
                                  <span className="text-green-600 ml-2">
                                    • {batch.qty_bottle_good.toLocaleString()} completed
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Batches will be scheduled soon</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
