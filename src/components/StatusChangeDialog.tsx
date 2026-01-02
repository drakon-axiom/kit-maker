import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type OrderStatus = Database["public"]["Enums"]["order_status"];

interface ValidationResult {
  valid: boolean;
  current_status: string;
  new_status: string;
  warnings: string[];
  blockers: string[];
  requires_override: boolean;
}

interface StatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  currentStatus: OrderStatus;
  newStatus: OrderStatus;
  onConfirm: (overrideNote?: string) => Promise<void>;
}

export function StatusChangeDialog({
  open,
  onOpenChange,
  orderId,
  currentStatus,
  newStatus,
  onConfirm,
}: StatusChangeDialogProps) {
  const { toast } = useToast();
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [overrideNote, setOverrideNote] = useState("");

  useEffect(() => {
    if (open) {
      validateTransition();
      setOverrideNote("");
    }
  }, [open, orderId, newStatus]);

  const validateTransition = async () => {
    setValidating(true);
    try {
      const { data, error } = await supabase.rpc("validate_order_status_transition", {
        _order_id: orderId,
        _new_status: newStatus,
      });

      if (error) throw error;

      setValidation(data as unknown as ValidationResult);
    } catch (error) {
      // Error handled silently
      toast({
        title: "Validation failed",
        description: "Could not validate status transition",
        variant: "destructive",
      });
    } finally {
      setValidating(false);
    }
  };

  const handleConfirm = async () => {
    // Check if override note is required
    if (validation?.requires_override && !overrideNote.trim()) {
      toast({
        title: "Justification required",
        description: "Please provide a justification note for this override",
        variant: "destructive",
      });
      return;
    }

    // Check for blockers
    if (validation?.blockers && validation.blockers.length > 0) {
      toast({
        title: "Cannot proceed",
        description: "Please resolve all blocking issues before changing status",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm(overrideNote.trim() || undefined);
      onOpenChange(false);
    } catch (error) {
      // Error handled silently
    } finally {
      setSubmitting(false);
    }
  };

  const hasWarnings = validation?.warnings && validation.warnings.length > 0;
  const hasBlockers = validation?.blockers && validation.blockers.length > 0;
  const canProceed = validation?.valid || (hasWarnings && !hasBlockers);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background">
        <DialogHeader>
          <DialogTitle>Change Order Status</DialogTitle>
          <DialogDescription>
            Changing status from <span className="font-semibold">{currentStatus}</span> to{" "}
            <span className="font-semibold">{newStatus}</span>
          </DialogDescription>
        </DialogHeader>

        {validating ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Blockers */}
            {hasBlockers && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Cannot Proceed - Blocking Issues:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {validation.blockers.map((blocker, idx) => (
                      <li key={idx} className="text-sm">
                        {blocker}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings */}
            {hasWarnings && !hasBlockers && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Warning - Unusual Transition:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {validation.warnings.map((warning, idx) => (
                      <li key={idx} className="text-sm">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Success - No Issues */}
            {validation?.valid && !hasWarnings && !hasBlockers && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  This status transition is valid and follows the expected workflow.
                </AlertDescription>
              </Alert>
            )}

            {/* Override Note */}
            {validation?.requires_override && canProceed && (
              <div className="space-y-2">
                <Label htmlFor="overrideNote" className="text-destructive">
                  Justification Required *
                </Label>
                <Textarea
                  id="overrideNote"
                  placeholder="Explain why you're overriding the normal workflow..."
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  rows={3}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  This note will be logged to the audit trail
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canProceed || validating || submitting || hasBlockers}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Changing Status...
              </>
            ) : (
              "Confirm Change"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
