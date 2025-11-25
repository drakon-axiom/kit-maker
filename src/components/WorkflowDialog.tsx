import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ChevronLeft, ChevronRight, AlertTriangle, Play, Pause, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface WorkflowStep {
  step: number;
  title: string;
  actions: string[];
}

interface WorkflowData {
  formula_name: string;
  batch_size_ml: number;
  preparation_steps: WorkflowStep[];
  safety_notes: string[];
  quality_checks: Array<{
    check: string;
    acceptance: string;
  }>;
}

interface WorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  batchNumber: string;
  productCode: string;
}

export const WorkflowDialog = ({ open, onOpenChange, batchId, batchNumber, productCode }: WorkflowDialogProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [workflowData, setWorkflowData] = useState<WorkflowData | null>(null);
  
  // Time tracking state
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [laborRate, setLaborRate] = useState("25.00");
  const [workflowStartTime, setWorkflowStartTime] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      // Load the workflow data
      fetch('/sop/lipo_c_bioboost_plus_sop_gui.json')
        .then(res => res.json())
        .then(data => setWorkflowData(data))
        .catch(err => console.error('Failed to load workflow:', err));
      
      // Reset timer and set start time when opening
      setElapsedSeconds(0);
      setIsTimerRunning(false);
      setWorkflowStartTime(new Date());
      setCompletedSteps(new Set());
      setCurrentStep(0);

      // Update batch status to 'wip' when workflow opens
      const updateBatchStatus = async () => {
        const { error } = await supabase
          .from('production_batches')
          .update({ status: 'wip' })
          .eq('id', batchId);
        
        if (error) {
          console.error('Error updating batch status:', error);
        }
      };
      updateBatchStatus();
    }
  }, [open, batchId]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateLaborCost = () => {
    const hours = elapsedSeconds / 3600;
    const rate = parseFloat(laborRate) || 0;
    return (hours * rate).toFixed(2);
  };

  const toggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const handleFinishWorkflow = async () => {
    if (!user || !workflowStartTime) {
      toast({
        title: "Error",
        description: "Unable to save workflow data",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const completedAt = new Date();
      const laborCost = parseFloat(calculateLaborCost());

      const { error } = await supabase
        .from('workflow_completions')
        .insert({
          batch_id: batchId,
          operator_id: user.id,
          started_at: workflowStartTime.toISOString(),
          completed_at: completedAt.toISOString(),
          elapsed_seconds: elapsedSeconds,
          labor_rate_per_hour: parseFloat(laborRate),
          labor_cost: laborCost,
          steps_completed: completedSteps.size
        });

      if (error) throw error;

      toast({
        title: "Workflow Completed",
        description: `Time: ${formatTime(elapsedSeconds)} • Cost: $${laborCost}`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving workflow completion:', error);
      toast({
        title: "Error",
        description: "Failed to save workflow completion data",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!workflowData) {
    return null;
  }

  const steps = workflowData.preparation_steps || [];
  const progress = steps.length > 0 ? (completedSteps.size / steps.length) * 100 : 0;

  const handleStepComplete = () => {
    const newCompleted = new Set(completedSteps);
    newCompleted.add(currentStep);
    setCompletedSteps(newCompleted);
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const currentStepData = steps[currentStep] || { step: 1, title: '', actions: [] };
  const isStepCompleted = completedSteps.has(currentStep);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {workflowData.formula_name}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-4 text-sm">
            <span>Batch: <strong>{batchNumber}</strong></span>
            <span>ID: <strong className="font-mono text-xs">{batchId}</strong></span>
            <span>Product: <strong>{productCode}</strong></span>
            <span>Batch Size: <strong>{workflowData.batch_size_ml} mL</strong></span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Time Tracking Section */}
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant={isTimerRunning ? "destructive" : "default"}
                  size="lg"
                  onClick={toggleTimer}
                  className="gap-2"
                >
                  {isTimerRunning ? (
                    <>
                      <Pause className="h-5 w-5" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5" />
                      Start
                    </>
                  )}
                </Button>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-mono font-bold">
                      {formatTime(elapsedSeconds)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isTimerRunning ? 'Timer running...' : 'Timer paused'}
                  </p>
                </div>
              </div>
              <div className="flex items-end gap-4">
                <div className="space-y-1">
                  <Label htmlFor="labor-rate" className="text-xs">
                    Labor Rate ($/hr)
                  </Label>
                  <Input
                    id="labor-rate"
                    type="number"
                    step="0.01"
                    value={laborRate}
                    onChange={(e) => setLaborRate(e.target.value)}
                    className="w-24"
                  />
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Labor Cost</p>
                  <p className="text-2xl font-bold text-primary">
                    ${calculateLaborCost()}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold">
                {completedSteps.size} / {steps.length} steps completed
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Safety Alert */}
          {workflowData.safety_notes && workflowData.safety_notes.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Safety Reminders:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {workflowData.safety_notes.slice(0, 3).map((note, idx) => (
                    <li key={idx} className="text-sm">{note}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Step Navigation Pills */}
          <div className="flex flex-wrap gap-2">
            {steps.map((_, idx) => (
              <Button
                key={idx}
                variant={idx === currentStep ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentStep(idx)}
                className="relative"
              >
                {completedSteps.has(idx) && (
                  <CheckCircle2 className="h-3 w-3 absolute -top-1 -right-1 text-green-500 bg-background rounded-full" />
                )}
                Step {idx + 1}
              </Button>
            ))}
          </div>

          {/* Current Step Card */}
          <Card className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="secondary" className="mb-2">
                  Step {currentStepData.step} of {steps.length}
                </Badge>
                <h3 className="text-2xl font-semibold">{currentStepData.title}</h3>
              </div>
              {isStepCompleted && (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              )}
            </div>

            <div className="space-y-3">
              <p className="font-medium text-muted-foreground">Actions to complete:</p>
              <ul className="space-y-2">
                {currentStepData.actions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-base">{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-2">
              {!isStepCompleted && (
                <Button onClick={handleStepComplete}>
                  Mark Complete
                  <CheckCircle2 className="h-4 w-4 ml-2" />
                </Button>
              )}
              {currentStep < steps.length - 1 && (
                <Button onClick={handleNext} variant="outline">
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
              {currentStep === steps.length - 1 && completedSteps.size === steps.length && (
                <Button onClick={handleFinishWorkflow} variant="default" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Finish Workflow'
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Quality Checks Section */}
          {currentStep === steps.length - 1 && workflowData.quality_checks && workflowData.quality_checks.length > 0 && (
            <Card className="p-4 bg-muted/50">
              <h4 className="font-semibold mb-3">Final Quality Checks</h4>
              <div className="space-y-2">
                {workflowData.quality_checks.map((check, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{check.check}:</span>
                    <span className="font-medium">{check.acceptance}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
