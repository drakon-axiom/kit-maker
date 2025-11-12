import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Maximize, Minimize } from "lucide-react";
import { useState } from "react";

type Batch = Database["public"]["Tables"]["production_batches"]["Row"] & {
  sales_orders?: {
    human_uid: string;
    customer_id: string;
    customers?: {
      name: string;
    };
  };
  production_batch_items?: Array<{
    sales_order_lines?: {
      skus?: {
        code: string;
        description: string;
      };
    };
  }>;
};

const ProductionDisplay = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  const { data: batches } = useQuery({
    queryKey: ["production-display-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_batches")
        .select(`
          *,
          sales_orders!inner (
            human_uid,
            customer_id,
            customers (name)
          ),
          production_batch_items (
            sales_order_lines (
              skus (code, description)
            )
          )
        `)
        .in("status", ["queued", "wip"])
        .order("priority_index", { ascending: false })
        .order("planned_start", { ascending: true });

      if (error) throw error;
      return data as Batch[];
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const queuedBatches = batches?.filter(b => b.status === "queued") || [];
  const inProgressBatches = batches?.filter(b => b.status === "wip") || [];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2 relative">
          <Button
            onClick={toggleFullscreen}
            variant="outline"
            size="icon"
            className="absolute right-0 top-0"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Button>
          <h1 className="text-5xl font-bold text-foreground">Production Floor</h1>
          <p className="text-2xl text-muted-foreground">Live Batch Queue</p>
        </div>

        {inProgressBatches.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold text-foreground flex items-center gap-3">
              <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></span>
              In Progress
            </h2>
            <div className="space-y-3">
              {inProgressBatches.map((batch) => {
                const sku = batch.production_batch_items?.[0]?.sales_order_lines?.skus;
                return (
                  <div
                    key={batch.id}
                    className="bg-blue-500/10 border-2 border-blue-500 rounded-lg p-6"
                  >
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Batch Number</div>
                        <div className="text-3xl font-bold text-foreground">{batch.human_uid}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Product</div>
                        <div className="text-2xl font-semibold text-foreground">
                          {sku?.code || "N/A"}
                        </div>
                        <div className="text-lg text-muted-foreground">{sku?.description}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Batch Size</div>
                        <div className="text-3xl font-bold text-foreground">
                          {batch.qty_bottle_planned} bottles
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-3xl font-semibold text-foreground flex items-center gap-3">
            <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
            Up Next
          </h2>
          <div className="space-y-3">
            {queuedBatches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xl">
                No batches queued
              </div>
            ) : (
              queuedBatches.map((batch, index) => {
                const sku = batch.production_batch_items?.[0]?.sales_order_lines?.skus;
                return (
                  <div
                    key={batch.id}
                    className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
                  >
                    <div className="grid grid-cols-4 gap-6 items-center">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Batch Number</div>
                          <div className="text-2xl font-bold text-foreground">{batch.human_uid}</div>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-muted-foreground mb-1">Product</div>
                        <div className="text-xl font-semibold text-foreground">
                          {sku?.code || "N/A"}
                        </div>
                        <div className="text-base text-muted-foreground">{sku?.description}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Batch Size</div>
                        <div className="text-2xl font-bold text-foreground">
                          {batch.qty_bottle_planned} bottles
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionDisplay;
