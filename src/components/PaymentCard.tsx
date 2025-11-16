import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, CreditCard, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentCardProps {
  type: 'deposit' | 'final';
  amount: number;
  status: string;
  orderId: string;
  orderNumber: string;
}

const PaymentCard = ({ type, amount, status, orderId, orderNumber }: PaymentCardProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data, error } = await supabase.functions.invoke('create-payment-checkout', {
        body: {
          orderId,
          orderNumber,
          type,
          amount,
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Open Stripe checkout in new tab
        window.open(data.url, '_blank');
        toast.success('Opening payment checkout...');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error('Failed to initiate payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isPaid = status === 'paid';
  const isPartial = status === 'partial';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {type === 'deposit' ? 'Deposit Payment' : 'Final Payment'}
          </span>
          <Badge className={isPaid ? 'bg-green-500' : isPartial ? 'bg-yellow-500' : 'bg-red-500'}>
            {isPaid ? 'Paid' : isPartial ? 'Partial' : 'Due'}
          </Badge>
        </CardTitle>
        <CardDescription>
          {type === 'deposit' 
            ? 'Required before production begins' 
            : 'Final payment for completed order'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Amount {isPaid ? 'Paid' : 'Due'}</span>
          <span className="text-3xl font-bold">${amount.toFixed(2)}</span>
        </div>

        {!isPaid && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                {type === 'deposit' 
                  ? 'Your order will move to production once the deposit is received.' 
                  : 'Final payment is required before shipment.'}
              </div>
            </div>

            <Button 
              onClick={handlePayment} 
              className="w-full"
              size="lg"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay ${amount.toFixed(2)}
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Secure payment powered by Stripe
            </p>
          </div>
        )}

        {isPaid && (
          <div className="p-4 rounded-lg bg-green-500/10 text-center">
            <p className="text-sm font-medium text-green-700">
              ✓ Payment received - Thank you!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PaymentCard;
