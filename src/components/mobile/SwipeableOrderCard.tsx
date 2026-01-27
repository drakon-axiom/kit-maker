import { useState, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Pencil, Phone, Mail, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  human_uid: string;
  status: string;
  customer?: {
    name: string;
    email?: string;
    phone?: string;
  };
  subtotal: number;
  consolidated_total?: number | null;
  deposit_required: boolean;
  deposit_status: string;
  created_at: string;
}

interface SwipeableOrderCardProps {
  order: Order;
  statusColors: Record<string, string>;
  formatStatus: (status: string) => string;
  onPrintLabel?: (order: Order, type: 'order' | 'shipping' | 'batch') => void;
}

export const SwipeableOrderCard = ({
  order,
  statusColors,
  formatStatus,
  onPrintLabel,
}: SwipeableOrderCardProps) => {
  const navigate = useNavigate();
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;
    
    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
      isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY);
    }
    
    if (isHorizontalSwipe.current) {
      e.preventDefault();
      // Limit swipe distance with resistance
      const maxSwipe = 160;
      const resistance = 0.6;
      const constrainedDiff = Math.max(-maxSwipe, Math.min(maxSwipe, diffX * resistance));
      setSwipeX(constrainedDiff);
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    isHorizontalSwipe.current = null;
    
    // Snap to action position or reset
    if (swipeX < -60) {
      setSwipeX(-140); // Show right actions
    } else if (swipeX > 60) {
      setSwipeX(140); // Show left actions
    } else {
      setSwipeX(0);
    }
  };

  const handleAction = (action: string) => {
    setSwipeX(0);
    switch (action) {
      case 'view':
        navigate(`/orders/${order.id}`);
        break;
      case 'edit':
        navigate(`/orders/${order.id}/edit`);
        break;
      case 'call':
        if (order.customer?.phone) {
          window.location.href = `tel:${order.customer.phone}`;
        }
        break;
      case 'email':
        if (order.customer?.email) {
          window.location.href = `mailto:${order.customer.email}`;
        }
        break;
      case 'print':
        onPrintLabel?.(order, 'order');
        break;
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg mb-3">
      {/* Left actions (revealed when swiping right) */}
      <div className="absolute inset-y-0 left-0 flex items-center">
        <button
          onClick={() => handleAction('call')}
          className={cn(
            "h-full w-[70px] flex flex-col items-center justify-center text-white transition-opacity",
            "bg-success",
            !order.customer?.phone && "opacity-50"
          )}
          disabled={!order.customer?.phone}
        >
          <Phone className="h-5 w-5 mb-1" />
          <span className="text-[10px]">Call</span>
        </button>
        <button
          onClick={() => handleAction('email')}
          className={cn(
            "h-full w-[70px] flex flex-col items-center justify-center text-white transition-opacity",
            "bg-primary",
            !order.customer?.email && "opacity-50"
          )}
          disabled={!order.customer?.email}
        >
          <Mail className="h-5 w-5 mb-1" />
          <span className="text-[10px]">Email</span>
        </button>
      </div>
      
      {/* Right actions (revealed when swiping left) */}
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          onClick={() => handleAction('print')}
          className="h-full w-[70px] flex flex-col items-center justify-center bg-muted-foreground text-white"
        >
          <Printer className="h-5 w-5 mb-1" />
          <span className="text-[10px]">Print</span>
        </button>
        <button
          onClick={() => handleAction('view')}
          className="h-full w-[70px] flex flex-col items-center justify-center bg-primary text-primary-foreground"
        >
          <Eye className="h-5 w-5 mb-1" />
          <span className="text-[10px]">View</span>
        </button>
      </div>
      
      {/* Card content */}
      <Card
        className={cn(
          "relative bg-card z-10 transition-shadow",
          swipeX !== 0 && "shadow-lg"
        )}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono font-bold text-sm">{order.human_uid}</span>
                <Badge className={cn(statusColors[order.status] || 'bg-muted', "text-[10px] px-1.5 py-0")} variant="secondary">
                  {formatStatus(order.status)}
                </Badge>
              </div>
              <p className="text-sm text-foreground truncate">
                {order.customer?.name || 'No customer'}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-sm">${(order.consolidated_total ?? order.subtotal).toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(order.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          {order.deposit_required && (
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-xs text-muted-foreground">Deposit</span>
              <Badge 
                variant={order.deposit_status === 'paid' ? 'default' : 'outline'} 
                className="text-[10px] h-5"
              >
                {order.deposit_status}
              </Badge>
            </div>
          )}
          
          {/* Swipe hint */}
          <p className="text-[10px] text-muted-foreground text-center mt-2 opacity-50">
            ← Swipe for actions →
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
