import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, Mail, Shield, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  default_terms: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  billing_country: string | null;
  billing_same_as_shipping: boolean | null;
  notes: string | null;
  quote_expiration_days: number | null;
  created_at: string;
}

interface SwipeableCustomerCardProps {
  customer: Customer;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  onManageAccess: (customerId: string) => void;
}

export const SwipeableCustomerCard = ({
  customer,
  onEdit,
  onDelete,
  onManageAccess,
}: SwipeableCustomerCardProps) => {
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
      case 'call':
        if (customer.phone) {
          window.location.href = `tel:${customer.phone}`;
        }
        break;
      case 'email':
        if (customer.email) {
          window.location.href = `mailto:${customer.email}`;
        }
        break;
      case 'access':
        onManageAccess(customer.id);
        break;
      case 'edit':
        onEdit(customer);
        break;
      case 'delete':
        onDelete(customer);
        break;
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg mb-3">
      {/* Left actions (revealed when swiping right) - Quick Contact */}
      <div className="absolute inset-y-0 left-0 flex items-center">
        <button
          onClick={() => handleAction('call')}
          className={cn(
            "h-full w-[70px] flex flex-col items-center justify-center text-white transition-opacity",
            "bg-success",
            !customer.phone && "opacity-50"
          )}
          disabled={!customer.phone}
        >
          <Phone className="h-5 w-5 mb-1" />
          <span className="text-[10px]">Call</span>
        </button>
        <button
          onClick={() => handleAction('email')}
          className={cn(
            "h-full w-[70px] flex flex-col items-center justify-center text-white transition-opacity",
            "bg-primary",
            !customer.email && "opacity-50"
          )}
          disabled={!customer.email}
        >
          <Mail className="h-5 w-5 mb-1" />
          <span className="text-[10px]">Email</span>
        </button>
      </div>
      
      {/* Right actions (revealed when swiping left) - Edit/Delete */}
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          onClick={() => handleAction('access')}
          className="h-full w-[70px] flex flex-col items-center justify-center bg-secondary text-secondary-foreground"
        >
          <Shield className="h-5 w-5 mb-1" />
          <span className="text-[10px]">Access</span>
        </button>
        <button
          onClick={() => handleAction('edit')}
          className="h-full w-[70px] flex flex-col items-center justify-center bg-primary text-primary-foreground"
        >
          <Pencil className="h-5 w-5 mb-1" />
          <span className="text-[10px]">Edit</span>
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
              <h3 className="font-semibold text-sm truncate">{customer.name}</h3>
              {customer.email && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Mail className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Phone className="h-3 w-3 flex-shrink-0" />
                  <span>{customer.phone}</span>
                </div>
              )}
            </div>
          </div>
          
          {customer.default_terms && (
            <div className="pt-2 border-t border-border/50">
              <span className="text-[10px] text-muted-foreground">Terms: {customer.default_terms}</span>
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
