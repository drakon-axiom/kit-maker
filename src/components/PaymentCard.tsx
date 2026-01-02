import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, CreditCard, AlertCircle, Loader2, Wallet, Building2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PaymentCardProps {
  type: 'deposit' | 'final';
  amount: number;
  status: string;
  orderId: string;
  orderNumber: string;
}

const PaymentCard = ({ type, amount, status, orderId, orderNumber }: PaymentCardProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string>('');

  const handleStripePayment = async () => {
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
        window.open(data.url, '_blank');
        toast.success('Opening payment checkout...');
      }
    } catch (error) {
      // Error handled silently
      toast.error('Failed to initiate payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentMethodSelect = (method: string) => {
    setSelectedMethod(method);
    if (method === 'stripe') {
      setShowPaymentDialog(false);
      handleStripePayment();
    } else {
      setShowPaymentDialog(true);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedField(''), 2000);
  };

  const paymentMethods = {
    cashapp: {
      name: 'CashApp',
      icon: Wallet,
      details: {
        cashtag: '$YourBusinessCashTag',
        note: `Order ${orderNumber} - ${type} payment`,
      },
    },
    paypal: {
      name: 'PayPal',
      icon: Wallet,
      details: {
        email: 'payments@yourbusiness.com',
        note: `Order ${orderNumber} - ${type} payment`,
      },
    },
    wire: {
      name: 'Wire Transfer',
      icon: Building2,
      details: {
        bankName: 'Your Bank Name',
        accountNumber: 'XXXX-XXXX-XXXX-1234',
        routingNumber: '123456789',
        accountName: 'Your Business Name',
        reference: `Order ${orderNumber}`,
      },
    },
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
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                {type === 'deposit' 
                  ? 'Your order will move to production once the deposit is received.' 
                  : 'Final payment is required before shipment.'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => handlePaymentMethodSelect('stripe')} 
                variant="outline"
                size="lg"
                disabled={isProcessing}
                className="h-auto py-4 flex flex-col gap-2"
              >
                <CreditCard className="h-5 w-5" />
                <span className="text-xs">Credit Card</span>
              </Button>

              <Button 
                onClick={() => handlePaymentMethodSelect('cashapp')} 
                variant="outline"
                size="lg"
                className="h-auto py-4 flex flex-col gap-2"
              >
                <Wallet className="h-5 w-5" />
                <span className="text-xs">CashApp</span>
              </Button>

              <Button 
                onClick={() => handlePaymentMethodSelect('paypal')} 
                variant="outline"
                size="lg"
                className="h-auto py-4 flex flex-col gap-2"
              >
                <Wallet className="h-5 w-5" />
                <span className="text-xs">PayPal</span>
              </Button>

              <Button 
                onClick={() => handlePaymentMethodSelect('wire')} 
                variant="outline"
                size="lg"
                className="h-auto py-4 flex flex-col gap-2"
              >
                <Building2 className="h-5 w-5" />
                <span className="text-xs">Wire Transfer</span>
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Choose your preferred payment method
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

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedMethod && paymentMethods[selectedMethod as keyof typeof paymentMethods]?.name} Payment
            </DialogTitle>
            <DialogDescription>
              Send ${amount.toFixed(2)} using the details below
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedMethod === 'cashapp' && (
              <div className="space-y-3">
                <div className="p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">CashTag</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(paymentMethods.cashapp.details.cashtag, 'cashtag')}
                    >
                      {copiedField === 'cashtag' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-lg font-mono">{paymentMethods.cashapp.details.cashtag}</p>
                </div>
                <div className="p-4 border rounded-lg bg-muted/50">
                  <span className="text-sm font-medium block mb-2">Note</span>
                  <p className="text-sm text-muted-foreground">{paymentMethods.cashapp.details.note}</p>
                </div>
              </div>
            )}

            {selectedMethod === 'paypal' && (
              <div className="space-y-3">
                <div className="p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">PayPal Email</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(paymentMethods.paypal.details.email, 'email')}
                    >
                      {copiedField === 'email' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-lg font-mono">{paymentMethods.paypal.details.email}</p>
                </div>
                <div className="p-4 border rounded-lg bg-muted/50">
                  <span className="text-sm font-medium block mb-2">Note</span>
                  <p className="text-sm text-muted-foreground">{paymentMethods.paypal.details.note}</p>
                </div>
              </div>
            )}

            {selectedMethod === 'wire' && (
              <div className="space-y-3">
                {Object.entries(paymentMethods.wire.details).map(([key, value]) => (
                  <div key={key} className="p-3 border rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(value, key)}
                      >
                        {copiedField === key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-sm font-mono">{value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 border-l-4 border-primary bg-primary/5 rounded">
              <p className="text-sm text-muted-foreground">
                After completing the payment, please email your receipt or confirmation to{' '}
                <span className="font-medium text-foreground">payments@yourbusiness.com</span> with order number{' '}
                <span className="font-medium text-foreground">{orderNumber}</span>
              </p>
            </div>

            <Button onClick={() => setShowPaymentDialog(false)} className="w-full">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PaymentCard;
