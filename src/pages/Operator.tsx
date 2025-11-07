import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Scan } from 'lucide-react';

const Operator = () => {
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
                />
                <Button>
                  <Scan className="mr-2 h-4 w-4" />
                  Load
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground mt-8 text-center py-8">
              Workflow execution interface coming soon
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Operator;