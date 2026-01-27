import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { getAddonBlockedReason } from '@/utils/orderAddons';

interface AddOnOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderStatus: string;
  onConfirm: (justification: string) => void;
  loading?: boolean;
}

export function AddOnOverrideDialog({
  open,
  onOpenChange,
  orderStatus,
  onConfirm,
  loading = false,
}: AddOnOverrideDialogProps) {
  const [justification, setJustification] = useState('');
  
  const blockedReason = getAddonBlockedReason(orderStatus);
  const isValid = justification.trim().length >= 10;

  const handleConfirm = () => {
    if (isValid) {
      onConfirm(justification.trim());
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setJustification('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Override Add-On Block
          </DialogTitle>
          <DialogDescription>
            Adding items at this stage requires special approval
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <p className="text-sm font-medium text-warning">
              {blockedReason || 'Add-ons are currently blocked for this order'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Adding items will require:
            </p>
            <ul className="text-xs text-muted-foreground mt-1 list-disc list-inside space-y-0.5">
              <li>Re-calculating consolidated total</li>
              <li>Updating final invoice (if unpaid)</li>
              <li>Audit trail logging</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="justification">
              Justification Required <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="justification"
              placeholder="Explain why this override is needed (e.g., Customer forgot to include items, last-minute request...)"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              disabled={loading}
            />
            {justification.length > 0 && justification.length < 10 && (
              <p className="text-xs text-destructive">
                Please provide at least 10 characters
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              This will be logged to the audit trail.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Proceed to Add Items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
