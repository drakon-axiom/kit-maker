import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Package, CalendarIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface OrderLine {
  id: string;
  bottle_qty: number;
  sku: {
    code: string;
    description: string;
  };
}

interface BatchPlan {
  lineId: string;
  quantity: number;
  plannedStart?: Date;
}

interface BatchPlannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderLines: OrderLine[];
  existingAllocations: Record<string, number>; // lineId -> allocated quantity
  onCreateBatches: (plans: BatchPlan[]) => Promise<void>;
}

const BatchPlanner = ({
  open,
  onOpenChange,
  orderLines,
  existingAllocations,
  onCreateBatches,
}: BatchPlannerProps) => {
  const [batchPlans, setBatchPlans] = useState<BatchPlan[]>([]);
  const [loading, setLoading] = useState(false);

  const addBatch = (lineId: string, defaultQty?: number) => {
    const remaining = getRemainingQuantity(lineId);
    setBatchPlans([...batchPlans, { lineId, quantity: defaultQty || remaining }]);
  };

  const removeBatch = (index: number) => {
    setBatchPlans(batchPlans.filter((_, i) => i !== index));
  };

  const updateBatchQuantity = (index: number, quantity: number) => {
    const updated = [...batchPlans];
    updated[index].quantity = quantity;
    setBatchPlans(updated);
  };

  const updateBatchDate = (index: number, date: Date | undefined) => {
    const updated = [...batchPlans];
    updated[index].plannedStart = date;
    setBatchPlans(updated);
  };

  const getRemainingQuantity = (lineId: string) => {
    const line = orderLines.find(l => l.id === lineId);
    if (!line) return 0;
    
    const allocated = existingAllocations[lineId] || 0;
    const planned = batchPlans
      .filter(p => p.lineId === lineId)
      .reduce((sum, p) => sum + p.quantity, 0);
    
    return line.bottle_qty - allocated - planned;
  };

  const getTotalRemaining = (lineId: string) => {
    const line = orderLines.find(l => l.id === lineId);
    if (!line) return 0;
    return line.bottle_qty - (existingAllocations[lineId] || 0);
  };

  const isValid = () => {
    // Check all quantities are positive
    if (batchPlans.some(p => p.quantity <= 0)) return false;
    
    // Check no line is over-allocated
    for (const line of orderLines) {
      if (getRemainingQuantity(line.id) < 0) return false;
    }
    
    return batchPlans.length > 0;
  };

  const handleCreate = async () => {
    if (!isValid()) return;
    
    setLoading(true);
    try {
      await onCreateBatches(batchPlans);
      setBatchPlans([]);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPlan = () => {
    const plans: BatchPlan[] = [];
    for (const line of orderLines) {
      const remaining = getTotalRemaining(line.id);
      if (remaining > 0) {
        plans.push({ lineId: line.id, quantity: remaining });
      }
    }
    setBatchPlans(plans);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan Production Batches</DialogTitle>
          <DialogDescription>
            Create batches for each SKU. Different SKUs must be produced in separate batches.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* SKU Summary */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Order Line Items</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleQuickPlan}
                disabled={orderLines.every(line => getTotalRemaining(line.id) === 0)}
              >
                <Package className="mr-2 h-4 w-4" />
                Quick Plan All
              </Button>
            </div>
            {orderLines.map((line) => {
              const remaining = getTotalRemaining(line.id);
              const currentRemaining = getRemainingQuantity(line.id);
              
              return (
                <Card key={line.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-mono font-medium">{line.sku.code}</div>
                        <div className="text-sm text-muted-foreground">{line.sku.description}</div>
                        <div className="flex items-center gap-3 mt-2">
                          <Badge variant="outline">
                            Total: {line.bottle_qty} bottles
                          </Badge>
                          {existingAllocations[line.id] > 0 && (
                            <Badge variant="secondary">
                              Batched: {existingAllocations[line.id]}
                            </Badge>
                          )}
                          {currentRemaining !== remaining && (
                            <Badge variant="default">
                              Planning: {remaining - currentRemaining}
                            </Badge>
                          )}
                          {currentRemaining > 0 ? (
                            <Badge className="bg-warning text-warning-foreground">
                              Remaining: {currentRemaining}
                            </Badge>
                          ) : (
                            <Badge className="bg-success text-success-foreground">
                              Fully Planned
                            </Badge>
                          )}
                        </div>
                      </div>
                      {currentRemaining > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addBatch(line.id, currentRemaining)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Batch
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Batch Plans */}
          {batchPlans.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Planned Batches ({batchPlans.length})</h3>
                {batchPlans.map((plan, index) => {
                  const line = orderLines.find(l => l.id === plan.lineId);
                  if (!line) return null;
                  
                  const remaining = getRemainingQuantity(line.id);
                  const isOverAllocated = remaining < 0;
                  
                  return (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-lg flex-wrap">
                      <div className="flex-1 min-w-[120px]">
                        <div className="font-mono text-sm">{line.sku.code}</div>
                        <div className="text-xs text-muted-foreground">{line.sku.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`batch-${index}`} className="text-sm text-muted-foreground">
                          Bottles:
                        </Label>
                        <Input
                          id={`batch-${index}`}
                          type="number"
                          min="1"
                          value={plan.quantity}
                          onChange={(e) => updateBatchQuantity(index, parseInt(e.target.value) || 0)}
                          className={`w-24 ${isOverAllocated ? 'border-destructive' : ''}`}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                'w-[150px] justify-start text-left font-normal text-xs',
                                !plan.plannedStart && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-1 h-3 w-3" />
                              {plan.plannedStart ? format(plan.plannedStart, 'MMM d, yyyy') : 'Schedule'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={plan.plannedStart}
                              onSelect={(d) => updateBatchDate(index, d)}
                              initialFocus
                              disabled={(date) => date < new Date()}
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeBatch(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!isValid() || loading}>
            {loading ? 'Creating...' : `Create ${batchPlans.length} Batch${batchPlans.length !== 1 ? 'es' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BatchPlanner;
