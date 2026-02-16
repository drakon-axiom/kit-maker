import { Check, Clock, Package, Truck, DollarSign, FileCheck, Boxes, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TimelineStep {
  status: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

interface OrderTimelineProps {
  currentStatus: string;
  depositRequired: boolean;
  depositStatus: string;
}

const OrderTimeline = ({ currentStatus, depositRequired, depositStatus }: OrderTimelineProps) => {
  const isMobile = useIsMobile();
  
  const allSteps: TimelineStep[] = [
    { status: 'draft', label: 'Draft', icon: FileCheck, description: 'Order created' },
    { status: 'quoted', label: 'Quoted', icon: FileCheck, description: 'Quote sent' },
    { status: 'awaiting_approval', label: 'Awaiting Approval', icon: Clock, description: 'Admin review required' },
  ];

  if (depositRequired) {
    allSteps.push({ status: 'deposit_due', label: 'Deposit Due', icon: DollarSign, description: 'Payment required' });
  }

  allSteps.push(
    { status: 'in_queue', label: 'In Queue', icon: Clock, description: 'Waiting for production' },
    { status: 'in_production', label: 'In Production', icon: Package, description: 'Being manufactured' },
    { status: 'in_labeling', label: 'Labeling', icon: Package, description: 'Labels being applied' },
    { status: 'in_packing', label: 'Packing', icon: Boxes, description: 'Being packed' },
    { status: 'awaiting_invoice', label: 'Invoicing', icon: FileCheck, description: 'Invoice being prepared' },
    { status: 'awaiting_payment', label: 'Payment Due', icon: DollarSign, description: 'Final payment required' },
    { status: 'ready_to_ship', label: 'Ready to Ship', icon: Truck, description: 'Preparing for shipment' },
    { status: 'shipped', label: 'Shipped', icon: Truck, description: 'On its way!' }
  );

  const currentStepIndex = allSteps.findIndex(step => step.status === currentStatus);
  const isCancelled = currentStatus === 'cancelled';
  const isOnHold = currentStatus === 'on_hold';

  const getStepStatus = (index: number) => {
    if (isCancelled) return 'cancelled';
    if (isOnHold) return 'hold';
    if (index < currentStepIndex) return 'completed';
    if (index === currentStepIndex) return 'current';
    return 'upcoming';
  };

  const currentStep = currentStepIndex >= 0 ? allSteps[currentStepIndex] : null;
  const previousStep = currentStepIndex > 0 ? allSteps[currentStepIndex - 1] : null;
  const nextStep = currentStepIndex < allSteps.length - 1 ? allSteps[currentStepIndex + 1] : null;

  // Mobile compact view
  if (isMobile) {
    const CurrentIcon = currentStep?.icon || Clock;
    
    return (
      <div className="py-4">
        {/* Progress bar */}
        <div className="relative h-2 bg-muted rounded-full mb-4 overflow-hidden">
          <div 
            className={cn(
              "absolute top-0 left-0 h-full rounded-full transition-all duration-500",
              isCancelled ? "bg-destructive" : isOnHold ? "bg-yellow-500" : "bg-primary"
            )}
            style={{ width: `${((currentStepIndex + 1) / allSteps.length) * 100}%` }}
          />
        </div>

        {/* Current stage card */}
        <div className="flex items-center justify-between gap-2">
          {/* Previous step tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors",
                  previousStep ? "text-muted-foreground bg-muted cursor-pointer" : "text-transparent"
                )}>
                  <ChevronLeft className="h-3 w-3" />
                  <span className="hidden xs:inline">Prev</span>
                </div>
              </TooltipTrigger>
              {previousStep && (
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <div className="text-center">
                    <p className="font-medium text-primary flex items-center gap-1 justify-center">
                      <Check className="h-3 w-3" /> Completed
                    </p>
                    <p className="font-semibold">{previousStep.label}</p>
                    <p className="text-xs text-muted-foreground">{previousStep.description}</p>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {/* Current stage */}
          <div className="flex-1 flex flex-col items-center">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all duration-300 mb-2",
                isCancelled && "border-destructive bg-destructive text-destructive-foreground",
                isOnHold && "border-yellow-500 bg-yellow-500 text-white",
                !isCancelled && !isOnHold && "border-primary bg-primary/10 text-primary"
              )}
            >
              <CurrentIcon className="h-7 w-7 animate-pulse" />
            </div>
            <div className="text-center">
              <div className={cn(
                "text-sm font-semibold",
                isCancelled && "text-destructive",
                isOnHold && "text-yellow-600",
                !isCancelled && !isOnHold && "text-primary"
              )}>
                {isCancelled ? 'Cancelled' : isOnHold ? 'On Hold' : currentStep?.label || 'Unknown'}
              </div>
              <div className="text-xs text-muted-foreground">
                {currentStep?.description}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Step {currentStepIndex + 1} of {allSteps.length}
              </div>
            </div>
          </div>

          {/* Next step tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors",
                  nextStep ? "text-muted-foreground bg-muted cursor-pointer" : "text-transparent"
                )}>
                  <span className="hidden xs:inline">Next</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
              </TooltipTrigger>
              {nextStep && (
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <div className="text-center">
                    <p className="font-medium text-muted-foreground">Up Next</p>
                    <p className="font-semibold">{nextStep.label}</p>
                    <p className="text-xs text-muted-foreground">{nextStep.description}</p>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Status messages */}
        {isCancelled && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">
            This order has been cancelled
          </div>
        )}
        {isOnHold && (
          <div className="mt-4 rounded-lg bg-yellow-500/10 p-3 text-center text-sm text-yellow-700">
            This order is currently on hold
          </div>
        )}
      </div>
    );
  }

  // Desktop full timeline view
  return (
    <div className="py-6">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-border" />
        <div 
          className={cn(
            "absolute top-5 left-0 h-0.5 transition-all duration-500",
            isCancelled ? "bg-destructive" : isOnHold ? "bg-yellow-500" : "bg-primary"
          )}
          style={{ width: `${(currentStepIndex / (allSteps.length - 1)) * 100}%` }}
        />

        {/* Timeline steps */}
        <div className="relative flex justify-between">
          {allSteps.map((step, index) => {
            const status = getStepStatus(index);
            const Icon = step.icon;

            return (
              <div key={step.status} className="flex flex-col items-center" style={{ flex: 1 }}>
                {/* Icon circle */}
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background transition-all duration-300",
                    status === 'completed' && "border-primary bg-primary text-primary-foreground",
                    status === 'current' && "border-primary bg-background text-primary scale-110 shadow-lg",
                    status === 'upcoming' && "border-muted text-muted-foreground",
                    status === 'cancelled' && "border-destructive bg-destructive text-destructive-foreground",
                    status === 'hold' && "border-yellow-500 bg-yellow-500 text-yellow-foreground"
                  )}
                >
                  {status === 'completed' ? (
                    <Check className="h-5 w-5" />
                  ) : status === 'current' ? (
                    <Icon className="h-5 w-5 animate-pulse" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>

                {/* Label */}
                <div className="mt-3 text-center">
                  <div
                    className={cn(
                      "text-xs font-medium transition-colors",
                      status === 'completed' && "text-primary",
                      status === 'current' && "text-primary font-semibold",
                      status === 'upcoming' && "text-muted-foreground",
                      status === 'cancelled' && "text-destructive",
                      status === 'hold' && "text-yellow-600"
                    )}
                  >
                    {step.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 max-w-[100px]">
                    {step.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status message */}
      {isCancelled && (
        <div className="mt-6 rounded-lg bg-destructive/10 p-4 text-center text-sm text-destructive">
          This order has been cancelled
        </div>
      )}
      {isOnHold && (
        <div className="mt-6 rounded-lg bg-yellow-500/10 p-4 text-center text-sm text-yellow-700">
          This order is currently on hold
        </div>
      )}
    </div>
  );
};

export default OrderTimeline;
