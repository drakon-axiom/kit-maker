import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Scan, 
  Play, 
  CheckCircle2, 
  Clock, 
  Package, 
  AlertCircle,
  Loader2
} from 'lucide-react';

interface WorkflowStep {
  id: string;
  step: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  operator_id: string | null;
  notes: string | null;
}

interface Batch {
  id: string;
  uid: string;
  human_uid: string;
  status: string;
  qty_bottle_planned: number;
  qty_bottle_good: number;
  qty_bottle_scrap: number;
  actual_start: string | null;
  actual_finish: string | null;
  sales_orders: {
    human_uid: string;
    customers: {
      name: string;
    } | null;
  };
}

const Operator = () => {
  const [batchUid, setBatchUid] = useState('');
  const [loading, setLoading] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [updatingStep, setUpdatingStep] = useState<string | null>(null);
  const [goodQty, setGoodQty] = useState('');
  const [scrapQty, setScrapQty] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!batch) return;

    // Set up real-time subscription for batch updates
    const batchChannel = supabase
      .channel('batch-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_batches',
          filter: `id=eq.${batch.id}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setBatch(prev => prev ? { ...prev, ...payload.new } : null);
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for workflow steps
    const stepsChannel = supabase
      .channel('workflow-steps-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_steps',
          filter: `batch_id=eq.${batch.id}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setWorkflowSteps(prev =>
              prev.map(step =>
                step.id === payload.new.id ? { ...step, ...payload.new } : step
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(batchChannel);
      supabase.removeChannel(stepsChannel);
    };
  }, [batch]);

  const loadBatch = async () => {
    if (!batchUid.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a batch UID',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Load batch details
      const { data: batchData, error: batchError } = await supabase
        .from('production_batches')
        .select(`
          *,
          sales_orders (
            human_uid,
            customers (
              name
            )
          )
        `)
        .eq('uid', batchUid.trim())
        .maybeSingle();

      if (batchError) throw batchError;

      if (!batchData) {
        toast({
          title: 'Not Found',
          description: 'Batch not found. Please check the UID.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      setBatch(batchData);
      setGoodQty(batchData.qty_bottle_good?.toString() || '0');
      setScrapQty(batchData.qty_bottle_scrap?.toString() || '0');

      // Load workflow steps
      const { data: stepsData, error: stepsError } = await supabase
        .from('workflow_steps')
        .select('*')
        .eq('batch_id', batchData.id)
        .order('created_at');

      if (stepsError) throw stepsError;

      setWorkflowSteps(stepsData || []);

      toast({
        title: 'Success',
        description: 'Batch loaded successfully',
      });
    } catch (error) {
      // Error handled silently
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const startStep = async (stepId: string) => {
    if (!user) return;
    
    setUpdatingStep(stepId);
    try {
      const { error } = await supabase
        .from('workflow_steps')
        .update({
          status: 'wip',
          started_at: new Date().toISOString(),
          operator_id: user.id,
        })
        .eq('id', stepId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Step started',
      });
    } catch (error) {
      // Error handled silently
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingStep(null);
    }
  };

  const completeStep = async (stepId: string) => {
    setUpdatingStep(stepId);
    try {
      const { error } = await supabase
        .from('workflow_steps')
        .update({
          status: 'done',
          finished_at: new Date().toISOString(),
        })
        .eq('id', stepId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Step completed',
      });
    } catch (error) {
      // Error handled silently
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingStep(null);
    }
  };

  const updateQuantities = async () => {
    if (!batch) return;

    const good = parseInt(goodQty) || 0;
    const scrap = parseInt(scrapQty) || 0;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('production_batches')
        .update({
          qty_bottle_good: good,
          qty_bottle_scrap: scrap,
        })
        .eq('id', batch.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Quantities updated',
      });
    } catch (error) {
      // Error handled silently
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-success text-success-foreground';
      case 'wip':
        return 'bg-primary text-primary-foreground';
      case 'pending':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const getBatchStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success text-success-foreground';
      case 'in_progress':
        return 'bg-primary text-primary-foreground';
      case 'queued':
        return 'bg-warning text-warning-foreground';
      case 'paused':
        return 'bg-warning text-warning-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatStepName = (step: string) => {
    return step
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Operator Console</h1>
        <p className="text-muted-foreground mt-1">Scan batches and update workflow steps</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan Batch</CardTitle>
          <CardDescription>Enter or scan a batch UID to begin</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batch-scan">Batch UID</Label>
              <div className="flex gap-2">
                <Input
                  id="batch-scan"
                  placeholder="BAT-YYYYMMDD-##"
                  className="font-mono"
                  value={batchUid}
                  onChange={(e) => setBatchUid(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      loadBatch();
                    }
                  }}
                />
                <Button onClick={loadBatch} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Scan className="mr-2 h-4 w-4" />
                  )}
                  Load
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {batch && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-mono">{batch.human_uid}</CardTitle>
                  <CardDescription>
                    Order: {batch.sales_orders.human_uid} • Customer: {batch.sales_orders.customers?.name || 'Internal Order'}
                  </CardDescription>
                </div>
                <Badge className={getBatchStatusColor(batch.status)}>
                  {batch.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Planned Quantity</Label>
                  <div className="text-2xl font-bold">{batch.qty_bottle_planned}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Good Bottles</Label>
                  <div className="text-2xl font-bold text-success">{batch.qty_bottle_good}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Scrap Bottles</Label>
                  <div className="text-2xl font-bold text-destructive">{batch.qty_bottle_scrap}</div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Update Quantities</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="good-qty">Good Bottles</Label>
                    <Input
                      id="good-qty"
                      type="number"
                      min="0"
                      value={goodQty}
                      onChange={(e) => setGoodQty(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scrap-qty">Scrap Bottles</Label>
                    <Input
                      id="scrap-qty"
                      type="number"
                      min="0"
                      value={scrapQty}
                      onChange={(e) => setScrapQty(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={updateQuantities} disabled={loading} className="w-full">
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Package className="mr-2 h-4 w-4" />
                      )}
                      Update
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workflow Steps</CardTitle>
              <CardDescription>Complete each step in order</CardDescription>
            </CardHeader>
            <CardContent>
              {workflowSteps.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No workflow steps found for this batch.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {workflowSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{formatStepName(step.step)}</div>
                          {step.started_at && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              Started: {new Date(step.started_at).toLocaleString()}
                            </div>
                          )}
                          {step.finished_at && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Completed: {new Date(step.finished_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <Badge className={getStatusColor(step.status)}>
                          {step.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      <div className="ml-4">
                        {step.status === 'pending' && (
                          <Button
                            onClick={() => startStep(step.id)}
                            disabled={updatingStep === step.id}
                          >
                            {updatingStep === step.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="mr-2 h-4 w-4" />
                            )}
                            Start
                          </Button>
                        )}
                        {step.status === 'wip' && (
                          <Button
                            onClick={() => completeStep(step.id)}
                            disabled={updatingStep === step.id}
                            variant="default"
                          >
                            {updatingStep === step.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                            )}
                            Complete
                          </Button>
                        )}
                        {step.status === 'done' && (
                          <Badge variant="outline" className="bg-success/10">
                            Done
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Operator;
