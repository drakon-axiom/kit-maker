import { Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface QuoteCountdownProps {
  expiresAt: string | null;
  createdAt: string;
  expirationDays: number | null;
}

const QuoteCountdown = ({ expiresAt, createdAt, expirationDays }: QuoteCountdownProps) => {
  if (!expiresAt) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Clock className="h-4 w-4" />
        <span>No expiration set</span>
      </div>
    );
  }

  const now = new Date();
  const expirationDate = new Date(expiresAt);
  const creationDate = new Date(createdAt);
  const isExpired = expirationDate < now;

  // Calculate days
  const totalDuration = expirationDate.getTime() - creationDate.getTime();
  const elapsed = now.getTime() - creationDate.getTime();
  const remaining = expirationDate.getTime() - now.getTime();
  
  const daysRemaining = Math.ceil(remaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.ceil(remaining / (1000 * 60 * 60));
  const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

  // Determine status
  const getStatus = () => {
    if (isExpired) {
      return {
        icon: XCircle,
        label: 'Expired',
        variant: 'destructive' as const,
        color: 'text-destructive',
      };
    }
    if (daysRemaining <= 3) {
      return {
        icon: AlertTriangle,
        label: `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`,
        variant: 'destructive' as const,
        color: 'text-destructive',
      };
    }
    if (daysRemaining <= 7) {
      return {
        icon: Clock,
        label: `${daysRemaining} days left`,
        variant: 'outline' as const,
        color: 'text-warning',
      };
    }
    return {
      icon: CheckCircle2,
      label: `${daysRemaining} days left`,
      variant: 'outline' as const,
      color: 'text-success',
    };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 ${status.color}`} />
          <Badge variant={status.variant} className="font-mono">
            {status.label}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {isExpired ? 'Expired' : 'Expires'} {expirationDate.toLocaleDateString()}
        </span>
      </div>

      <div className="space-y-1.5">
        <Progress 
          value={progress} 
          className={`h-2 ${
            isExpired ? '[&>div]:bg-destructive' : 
            daysRemaining <= 3 ? '[&>div]:bg-destructive' : 
            daysRemaining <= 7 ? '[&>div]:bg-warning' : 
            '[&>div]:bg-success'
          }`}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Created {creationDate.toLocaleDateString()}</span>
          {!isExpired && hoursRemaining < 48 && (
            <span className="font-medium text-destructive">
              {hoursRemaining} hours left
            </span>
          )}
        </div>
      </div>

      {isExpired && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
          This quote has expired. Renew to extend the expiration date and notify the customer.
        </div>
      )}
      
      {!isExpired && daysRemaining <= 3 && (
        <div className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-md p-2">
          ⚠️ Quote expires soon! Consider renewing to give the customer more time.
        </div>
      )}
    </div>
  );
};

export default QuoteCountdown;
