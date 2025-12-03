import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Maximize, Minimize, Home, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow, differenceInHours } from "date-fns";
import { WorkflowDialog } from "@/components/WorkflowDialog";
import { cn } from "@/lib/utils";

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
  workflow_steps?: Array<{
    status: string;
    operator_id: string | null;
  }>;
};

const ProductionDisplay = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedBatch, setSelectedBatch] = useState<{ batchId: string; batchNumber: string; productCode: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  const { data: operatorProfiles } = useQuery({
    queryKey: ["operator-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name");

      if (error) throw error;
      return data as Array<{ id: string; full_name: string | null }>;
    },
  });

  const { data: batches, refetch } = useQuery({
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
          ),
          workflow_steps (
            status,
            operator_id
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

  // Real-time subscription for batch and workflow step updates
  useEffect(() => {
    const batchChannel = supabase
      .channel('production-display-batch-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_batches'
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    const stepsChannel = supabase
      .channel('production-display-step-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_steps'
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(batchChannel);
      supabase.removeChannel(stepsChannel);
    };
  }, [refetch]);

  const queuedBatches = batches?.filter(b => b.status === "queued") || [];
  const inProgressBatches = batches?.filter(b => b.status === "wip") || [];

  const getOperatorName = (operatorId: string | null) => {
    if (!operatorId || !operatorProfiles) return null;
    const profile = operatorProfiles.find(p => p.id === operatorId);
    return profile?.full_name || "Unknown Operator";
  };

  const getProgressBarColor = (elapsedHours: number) => {
    if (elapsedHours >= 4) return "[&>div]:bg-red-500"; // Critical - stalled
    if (elapsedHours >= 2) return "[&>div]:bg-yellow-500"; // Warning - slow
    return "[&>div]:bg-green-500"; // Normal - on track
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        <div className="text-center space-y-2 relative">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="absolute left-0 top-0 opacity-50 hover:opacity-100 transition-opacity"
          >
            <Link to="/">
              <Home className="h-5 w-5" />
            </Link>
          </Button>
          <Button
            onClick={toggleFullscreen}
            variant="outline"
            size="icon"
            className="absolute right-0 top-0 hidden md:flex"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Button>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground px-10 md:px-0">Production Floor</h1>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground">Live Batch Queue</p>
        </div>

        {inProgressBatches.length > 0 && (
          <div className="space-y-3 md:space-y-4">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-foreground flex items-center gap-2 md:gap-3">
              <span className="w-2 h-2 md:w-3 md:h-3 bg-blue-500 rounded-full animate-pulse"></span>
              In Progress
            </h2>
            <div className="space-y-3">
              {inProgressBatches.map((batch) => {
                const sku = batch.production_batch_items?.[0]?.sales_order_lines?.skus;
                const startTime = batch.actual_start ? new Date(batch.actual_start) : null;
                const elapsedTime = startTime ? formatDistanceToNow(startTime, { includeSeconds: true }) : null;
                const elapsedHours = startTime ? differenceInHours(currentTime, startTime) : 0;
                
                // Determine alert level based on elapsed time
                const isWarning = elapsedHours >= 2 && elapsedHours < 4;
                const isCritical = elapsedHours >= 4;
                
                const borderColor = isCritical 
                  ? "border-red-500" 
                  : isWarning 
                  ? "border-yellow-500" 
                  : "border-blue-500";
                  
                const bgColor = isCritical 
                  ? "bg-red-500/10" 
                  : isWarning 
                  ? "bg-yellow-500/10" 
                  : "bg-blue-500/10";
                
                return (
                  <div
                    key={batch.id}
                    className={`${bgColor} border-2 ${borderColor} rounded-lg p-4 md:p-6 space-y-3 md:space-y-4 cursor-pointer hover:shadow-lg transition-shadow`}
                    onClick={() => setSelectedBatch({ batchId: batch.id, batchNumber: batch.human_uid, productCode: sku?.code || "N/A" })}
                  >
                    {(isWarning || isCritical) && (
                      <Alert variant={isCritical ? "destructive" : "default"} className="mb-2 md:mb-4">
                        {isCritical ? (
                          <AlertCircle className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                        <AlertDescription className="text-xs md:text-sm">
                          {isCritical 
                            ? `CRITICAL: Batch running for ${elapsedHours}h - over time!`
                            : `WARNING: Batch running for ${elapsedHours}h - approaching limit.`
                          }
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-6">
                      <div>
                        <div className="text-xs md:text-sm text-muted-foreground mb-1">Batch</div>
                        <div className="text-lg sm:text-xl md:text-3xl font-bold text-foreground">{batch.human_uid}</div>
                      </div>
                      <div>
                        <div className="text-xs md:text-sm text-muted-foreground mb-1">Product</div>
                        <div className="text-base sm:text-lg md:text-2xl font-semibold text-foreground">
                          {sku?.code || "N/A"}
                        </div>
                        <div className="text-sm md:text-lg text-muted-foreground truncate">{sku?.description}</div>
                      </div>
                      <div>
                        <div className="text-xs md:text-sm text-muted-foreground mb-1">Size</div>
                        <div className="text-lg sm:text-xl md:text-3xl font-bold text-foreground">
                          {batch.qty_bottle_planned}
                        </div>
                      </div>
                      <div className="hidden md:block">
                        <div className="text-xs md:text-sm text-muted-foreground mb-1">Started</div>
                        <div className="text-base md:text-xl font-semibold text-foreground">
                          {startTime ? format(startTime, "h:mm a") : "N/A"}
                        </div>
                        <div className="text-xs md:text-sm text-muted-foreground">
                          {startTime ? format(startTime, "MMM d") : ""}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs md:text-sm text-muted-foreground mb-1">Elapsed</div>
                        <div className={`text-base sm:text-lg md:text-2xl font-bold ${
                          isCritical ? "text-red-500" : isWarning ? "text-yellow-500" : "text-blue-500"
                        }`}>
                          {elapsedTime || "N/A"}
                        </div>
                      </div>
                    </div>
                    
                    {/* Workflow Progress */}
                    {batch.workflow_steps && batch.workflow_steps.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium text-foreground">Workflow Progress</span>
                            {(() => {
                              const activeStep = batch.workflow_steps.find(s => s.status === 'wip');
                              const operatorName = activeStep ? getOperatorName(activeStep.operator_id) : null;
                              return operatorName ? (
                                <span className="text-xs text-muted-foreground ml-2">
                                  • {operatorName}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <span className="text-sm font-semibold text-foreground">
                            {batch.workflow_steps.filter(s => s.status === 'done').length} / {batch.workflow_steps.length} steps
                          </span>
                        </div>
                        <Progress 
                          value={(batch.workflow_steps.filter(s => s.status === 'done').length / batch.workflow_steps.length) * 100} 
                          className={cn("h-2", getProgressBarColor(elapsedHours))}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-3 md:space-y-4">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-foreground flex items-center gap-2 md:gap-3">
            <span className="w-2 h-2 md:w-3 md:h-3 bg-yellow-500 rounded-full"></span>
            Up Next
          </h2>
          <div className="space-y-3">
            {queuedBatches.length === 0 ? (
              <div className="text-center py-8 md:py-12 text-muted-foreground text-base md:text-xl">
                No batches queued
              </div>
            ) : (
              queuedBatches.map((batch, index) => {
                const sku = batch.production_batch_items?.[0]?.sales_order_lines?.skus;
                return (
                  <div
                    key={batch.id}
                    className="bg-card border border-border rounded-lg p-4 md:p-6 hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedBatch({ batchId: batch.id, batchNumber: batch.human_uid, productCode: sku?.code || "N/A" })}
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 items-center">
                      <div className="flex items-center gap-2 md:gap-4">
                        <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-base md:text-xl font-bold shrink-0">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground mb-1">Batch</div>
                          <div className="text-base sm:text-lg md:text-2xl font-bold text-foreground truncate">{batch.human_uid}</div>
                        </div>
                      </div>
                      <div className="md:col-span-2 min-w-0">
                        <div className="text-xs text-muted-foreground mb-1">Product</div>
                        <div className="text-base md:text-xl font-semibold text-foreground truncate">
                          {sku?.code || "N/A"}
                        </div>
                        <div className="text-sm md:text-base text-muted-foreground truncate">{sku?.description}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Size</div>
                        <div className="text-base sm:text-lg md:text-2xl font-bold text-foreground">
                          {batch.qty_bottle_planned}
                        </div>
                      </div>
                    </div>
                    
                    {/* Workflow Progress */}
                    {batch.workflow_steps && batch.workflow_steps.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            <span className="text-xs font-medium text-foreground">Workflow Progress</span>
                          </div>
                          <span className="text-xs font-semibold text-foreground">
                            {batch.workflow_steps.filter(s => s.status === 'done').length} / {batch.workflow_steps.length} steps
                          </span>
                        </div>
                        <Progress 
                          value={(batch.workflow_steps.filter(s => s.status === 'done').length / batch.workflow_steps.length) * 100} 
                          className="h-2"
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <WorkflowDialog
        open={!!selectedBatch}
        onOpenChange={(open) => !open && setSelectedBatch(null)}
        batchId={selectedBatch?.batchId || ""}
        batchNumber={selectedBatch?.batchNumber || ""}
        productCode={selectedBatch?.productCode || ""}
      />
    </div>
  );
};

export default ProductionDisplay;
