import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Split, Merge } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Batch {
  id: string;
  human_uid: string;
  qty_bottle_planned: number;
}

interface BatchSplitMergeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBatch: Batch;
  availableBatches: Batch[];
  onSplit: (quantities: number[]) => Promise<void>;
  onMerge: (batchIds: string[]) => Promise<void>;
}

const BatchSplitMerge = ({ 
  open, 
  onOpenChange, 
  currentBatch, 
  availableBatches,
  onSplit, 
  onMerge 
}: BatchSplitMergeProps) => {
  const [loading, setLoading] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [splitQuantities, setSplitQuantities] = useState<number[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);

  const handleSplitCountChange = (count: number) => {
    setSplitCount(count);
    const avgQty = Math.floor(currentBatch.qty_bottle_planned / count);
    const quantities = Array(count).fill(avgQty);
    // Adjust last quantity to account for remainder
    const remainder = currentBatch.qty_bottle_planned - (avgQty * count);
    quantities[count - 1] += remainder;
    setSplitQuantities(quantities);
  };

  const handleSplit = async () => {
    if (splitQuantities.length === 0) return;
    
    setLoading(true);
    try {
      await onSplit(splitQuantities);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (selectedBatches.length === 0) return;
    
    setLoading(true);
    try {
      await onMerge([currentBatch.id, ...selectedBatches]);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const totalMergeQty = selectedBatches.reduce((sum, batchId) => {
    const batch = availableBatches.find(b => b.id === batchId);
    return sum + (batch?.qty_bottle_planned || 0);
  }, currentBatch.qty_bottle_planned);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Split or Merge Batches</DialogTitle>
          <DialogDescription>
            Manage batch {currentBatch.human_uid} ({currentBatch.qty_bottle_planned} bottles)
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="split" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="split">
              <Split className="mr-2 h-4 w-4" />
              Split Batch
            </TabsTrigger>
            <TabsTrigger value="merge">
              <Merge className="mr-2 h-4 w-4" />
              Merge Batches
            </TabsTrigger>
          </TabsList>

          <TabsContent value="split" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Split into how many batches?</Label>
                <Input
                  type="number"
                  min="2"
                  max="10"
                  value={splitCount}
                  onChange={(e) => handleSplitCountChange(parseInt(e.target.value) || 2)}
                />
              </div>

              <div className="space-y-2">
                <Label>Quantities per batch:</Label>
                {splitQuantities.map((qty, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Label className="w-24">Batch {index + 1}:</Label>
                    <Input
                      type="number"
                      min="1"
                      value={qty}
                      onChange={(e) => {
                        const newQtys = [...splitQuantities];
                        newQtys[index] = parseInt(e.target.value) || 0;
                        setSplitQuantities(newQtys);
                      }}
                    />
                    <span className="text-sm text-muted-foreground">bottles</span>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  Total: {splitQuantities.reduce((sum, qty) => sum + qty, 0)} bottles
                  {splitQuantities.reduce((sum, qty) => sum + qty, 0) !== currentBatch.qty_bottle_planned && (
                    <span className="text-destructive ml-2">
                      (Must equal {currentBatch.qty_bottle_planned})
                    </span>
                  )}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button 
                onClick={handleSplit} 
                disabled={
                  loading || 
                  splitQuantities.reduce((sum, qty) => sum + qty, 0) !== currentBatch.qty_bottle_planned
                }
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Splitting...
                  </>
                ) : (
                  <>
                    <Split className="mr-2 h-4 w-4" />
                    Split Batch
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="merge" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select batches to merge with {currentBatch.human_uid}:</Label>
                <div className="border rounded-lg p-4 space-y-3 max-h-60 overflow-y-auto">
                  {availableBatches.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No other batches available to merge
                    </p>
                  ) : (
                    availableBatches.map((batch) => (
                      <div key={batch.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={batch.id}
                          checked={selectedBatches.includes(batch.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedBatches([...selectedBatches, batch.id]);
                            } else {
                              setSelectedBatches(selectedBatches.filter(id => id !== batch.id));
                            }
                          }}
                        />
                        <label
                          htmlFor={batch.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {batch.human_uid} ({batch.qty_bottle_planned} bottles)
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {selectedBatches.length > 0 && (
                <div className="p-3 bg-muted rounded-lg space-y-1">
                  <p className="text-sm font-medium">
                    Merging {selectedBatches.length + 1} batches
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total quantity: {totalMergeQty} bottles
                  </p>
                  <p className="text-xs text-muted-foreground">
                    The other batches will be deleted and their quantities combined into {currentBatch.human_uid}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button 
                onClick={handleMerge} 
                disabled={loading || selectedBatches.length === 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Merging...
                  </>
                ) : (
                  <>
                    <Merge className="mr-2 h-4 w-4" />
                    Merge Batches
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default BatchSplitMerge;
