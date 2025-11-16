import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Loader2, Package, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import OrderTimeline from '@/components/OrderTimeline';
import OrderComments from '@/components/OrderComments';
import ShipmentTracker from '@/components/ShipmentTracker';
import PaymentCard from '@/components/PaymentCard';
import OrderDocuments from '@/components/OrderDocuments';

interface Order {
  id: string;
  human_uid: string;
  status: string;
  subtotal: number;
  created_at: string;
  promised_date: string | null;
  deposit_required: boolean;
  deposit_amount: number | null;
  deposit_status: string;
}

interface OrderLine {
  id: string;
  sku_id: string;
  sell_mode: string;
  qty_entered: number;
  unit_price: number;
  bottle_qty: number;
  line_subtotal: number;
  skus: {
    code: string;
    description: string;
  };
}

interface Shipment {
  id: string;
  tracking_no: string;
  carrier: string | null;
  tracking_status: string | null;
  tracking_location: string | null;
  estimated_delivery: string | null;
  shipped_at: string | null;
  tracking_events: any;
}

export default function CustomerOrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      fetchOrderDetails();
    }
  }, [user, id]);

  const fetchOrderDetails = async () => {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('id', id)
        .single();

      if (orderError) throw orderError;

      const { data: linesData, error: linesError } = await supabase
        .from('sales_order_lines')
        .select(`
          *,
          skus (code, description)
        `)
        .eq('so_id', id);

      if (linesError) throw linesError;

      // Fetch shipment if exists
      const { data: shipmentData } = await supabase
        .from('shipments')
        .select('*')
        .eq('so_id', id)
        .maybeSingle();

      setOrder(orderData);
      setLines(linesData || []);
      setShipment(shipmentData);
    } catch (error: any) {
      toast.error('Failed to load order details');
      console.error(error);
      navigate('/customer');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      draft: 'bg-secondary',
      quoted: 'bg-blue-500',
      deposit_due: 'bg-yellow-500',
      in_queue: 'bg-purple-500',
      in_production: 'bg-orange-500',
      packed: 'bg-green-500',
      shipped: 'bg-emerald-500',
      cancelled: 'bg-destructive'
    };
    return statusColors[status] || 'bg-muted';
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Order not found</h3>
          <Button className="mt-4" onClick={() => navigate('/customer')}>
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/customer')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Order {order.human_uid}</h1>
            <p className="text-muted-foreground mt-1">
              Placed on {new Date(order.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Visual Progress Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Order Progress</CardTitle>
            <CardDescription>Track your order status in real-time</CardDescription>
          </CardHeader>
          <CardContent>
            <OrderTimeline 
              currentStatus={order.status}
              depositRequired={order.deposit_required}
              depositStatus={order.deposit_status}
            />
          </CardContent>
        </Card>

        {/* Payment Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Approval Pending Message */}
          {order.deposit_required && 
           (order.status === 'awaiting_approval' || order.status === 'draft' || order.status === 'quoted') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  Awaiting Approval
                </CardTitle>
                <CardDescription>
                  Payment will be available once your order is approved
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Deposit Amount</span>
                  <span className="text-3xl font-bold">${(order.deposit_amount || 0).toFixed(2)}</span>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-700">
                    Your order is currently under review. You'll receive an email notification once it's approved and ready for payment.
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">
                    <strong>What happens next?</strong><br/>
                    Once approved, you'll be able to pay the deposit to move your order into production.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Deposit Payment Card */}
          {order.deposit_required && 
           order.status !== 'shipped' && 
           order.status !== 'awaiting_approval' && 
           order.status !== 'draft' &&
           order.status !== 'quoted' && (
            <PaymentCard
              type="deposit"
              amount={order.deposit_amount || 0}
              status={order.deposit_status}
              orderId={order.id}
              orderNumber={order.human_uid}
            />
          )}
          
          {(['awaiting_payment', 'ready_to_ship'].includes(order.status)) && (
            <PaymentCard
              type="final"
              amount={order.subtotal}
              status="unpaid"
              orderId={order.id}
              orderNumber={order.human_uid}
            />
          )}
          
          {!order.deposit_required && !['awaiting_payment', 'ready_to_ship'].includes(order.status) && (
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${order.subtotal.toFixed(2)}</span>
                </div>
                {order.promised_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Promised Date</span>
                    <span className="font-medium">
                      {new Date(order.promised_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Shipment Tracking */}
        <ShipmentTracker shipment={shipment} />

        {/* Documents */}
        <OrderDocuments
          orderId={order.id}
          orderNumber={order.human_uid}
          status={order.status}
          hasQuote={order.status !== 'draft'}
          hasInvoice={['awaiting_payment', 'shipped'].includes(order.status)}
        />

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
            <CardDescription>Products included in this order</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Sell Mode</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Bottles</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-medium">{line.skus.code}</TableCell>
                    <TableCell>{line.skus.description}</TableCell>
                    <TableCell className="capitalize">{line.sell_mode}</TableCell>
                    <TableCell className="text-right">{line.qty_entered}</TableCell>
                    <TableCell className="text-right">${line.unit_price.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{line.bottle_qty}</TableCell>
                    <TableCell className="text-right">${line.line_subtotal.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Order Comments */}
        <OrderComments orderId={order.id} />
      </div>
    </div>
  );
}
