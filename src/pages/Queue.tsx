import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const Queue = () => {
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Placeholder for queue fetching
    setLoading(false);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Production Queue</h1>
        <p className="text-muted-foreground mt-1">Manage batch priorities and production schedule</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue Management</CardTitle>
          <CardDescription>Drag and drop to reorder batches</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Production queue coming soon. Create orders first to see batches here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Queue;