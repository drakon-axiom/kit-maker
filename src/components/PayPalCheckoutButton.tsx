import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Wallet, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PayPalCheckoutButtonProps {
  amount: number;
  orderId: string;
  orderNumber: string;
  type: 'deposit' | 'final';
  clientId: string;
  brandId: string;
  onSuccess?: () => void;
}

declare global {
  interface Window {
    paypal?: any;
  }
}

export const PayPalCheckoutButton = ({
  amount,
  orderId,
  orderNumber,
  type,
  clientId,
  brandId,
  onSuccess,
}: PayPalCheckoutButtonProps) => {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonsRendered = useRef(false);

  // Load PayPal SDK
  useEffect(() => {
    if (window.paypal) {
      setSdkLoaded(true);
      setLoading(false);
      return;
    }

    const existingScript = document.querySelector(`script[src*="paypal.com/sdk"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        setSdkLoaded(true);
        setLoading(false);
      });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&disable-funding=credit,card`;
    script.async = true;
    
    script.onload = () => {
      setSdkLoaded(true);
      setLoading(false);
    };
    
    script.onerror = () => {
      setError('Failed to load PayPal SDK');
      setLoading(false);
    };

    document.body.appendChild(script);

    return () => {
      // Don't remove the script on unmount to avoid reloading
    };
  }, [clientId]);

  // Create order handler
  const createOrder = useCallback(async () => {
    try {
      console.log('Creating PayPal order...');
      const { data, error } = await supabase.functions.invoke('create-paypal-order', {
        body: {
          orderId,
          orderNumber,
          type,
          amount,
          brandId,
        },
      });

      if (error) throw error;
      if (!data?.paypalOrderId) throw new Error('No PayPal order ID returned');

      console.log('PayPal order created:', data.paypalOrderId);
      return data.paypalOrderId;
    } catch (err: any) {
      console.error('Error creating PayPal order:', err);
      toast.error('Failed to create payment. Please try again.');
      throw err;
    }
  }, [orderId, orderNumber, type, amount, brandId]);

  // Capture order handler
  const onApprove = useCallback(async (data: { orderID: string }) => {
    setProcessing(true);
    try {
      console.log('Capturing PayPal payment...', data.orderID);
      const { data: captureData, error } = await supabase.functions.invoke('capture-paypal-payment', {
        body: {
          paypalOrderId: data.orderID,
          orderId,
          orderNumber,
          type,
          amount,
          brandId,
        },
      });

      if (error) throw error;
      if (!captureData?.success) throw new Error('Payment capture failed');

      console.log('Payment captured successfully');
      toast.success('Payment completed successfully!');
      onSuccess?.();
    } catch (err: any) {
      console.error('Error capturing payment:', err);
      toast.error('Payment capture failed. Please contact support.');
    } finally {
      setProcessing(false);
    }
  }, [orderId, orderNumber, type, amount, brandId, onSuccess]);

  // Render PayPal buttons
  useEffect(() => {
    if (!sdkLoaded || !containerRef.current || buttonsRendered.current || !window.paypal) {
      return;
    }

    buttonsRendered.current = true;

    try {
      window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal',
          height: 45,
        },
        createOrder,
        onApprove,
        onError: (err: any) => {
          console.error('PayPal error:', err);
          toast.error('PayPal encountered an error. Please try again.');
        },
        onCancel: () => {
          toast.info('Payment cancelled');
        },
      }).render(containerRef.current);
    } catch (err) {
      console.error('Error rendering PayPal buttons:', err);
      setError('Failed to render PayPal buttons');
    }
  }, [sdkLoaded, createOrder, onApprove]);

  if (error) {
    return (
      <div className="p-4 border rounded-lg bg-destructive/10 text-destructive flex items-center gap-2">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <Button variant="outline" disabled className="w-full h-12">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading PayPal...
      </Button>
    );
  }

  if (processing) {
    return (
      <div className="flex items-center justify-center p-4 border rounded-lg bg-muted">
        <Loader2 className="h-5 w-5 mr-2 animate-spin text-primary" />
        <span className="text-sm font-medium">Processing payment...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div 
        ref={containerRef} 
        className="min-h-[45px]"
        id={`paypal-button-container-${orderId}`}
      />
      <p className="text-xs text-center text-muted-foreground">
        Secure payment via PayPal
      </p>
    </div>
  );
};

export default PayPalCheckoutButton;
