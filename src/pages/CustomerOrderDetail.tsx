import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Loader2, Package, AlertCircle, Edit, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import OrderTimeline from '@/components/OrderTimeline';
import OrderComments from '@/components/OrderComments';
import ShipmentTracker from '@/components/ShipmentTracker';
import PaymentCard from '@/components/PaymentCard';
import OrderDocuments from '@/components/OrderDocuments';
import OrderRequestHistory from '@/components/OrderRequestHistory';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Link } from 'react-router-dom';

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
  const [modificationRequest, setModificationRequest] = useState('');
  const [modificationDialogOpen, setModificationDialogOpen] = useState(false);
  const [submittingModification, setSubmittingModification] = useState(false);
  const [requestHistoryKey, setRequestHistoryKey] = useState(0);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

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

  const canRequestModification = (status: string) => {
    return ['draft', 'quoted', 'deposit_due', 'awaiting_approval', 'in_queue'].includes(status);
  };

  const handleModificationRequest = async () => {
    if (!modificationRequest.trim()) {
      toast.error('Please enter modification details');
      return;
    }

    setSubmittingModification(true);
    try {
      const { error } = await supabase
        .from('order_comments')
        .insert({
          so_id: id,
          user_id: user?.id,
          comment: modificationRequest,
          comment_type: 'modification_request',
          request_status: 'pending',
          is_internal: false,
        });

      if (error) throw error;

      toast.success('Modification request submitted successfully');
      setModificationRequest('');
      setModificationDialogOpen(false);
      setRequestHistoryKey(prev => prev + 1);
    } catch (error: any) {
      toast.error('Failed to submit modification request');
      console.error(error);
    } finally {
      setSubmittingModification(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const jsPDFModule = await import('jspdf');
      const JsPDFCtor = (jsPDFModule as any).default || (jsPDFModule as any).jsPDF;
      const doc = new JsPDFCtor();
      
      // Header
      doc.setFontSize(20);
      doc.text('Order Confirmation', 20, 20);
      doc.setFontSize(10);
      doc.text(`Order #: ${order?.human_uid}`, 20, 30);
      doc.text(`Date: ${order?.created_at ? format(new Date(order.created_at), 'MMM dd, yyyy') : ''}`, 20, 36);
      doc.text(`Status: ${order?.status.replace(/_/g, ' ').toUpperCase()}`, 20, 42);
      
      // Line items
      doc.setFontSize(12);
      doc.text('Order Items', 20, 55);
      doc.setFontSize(10);
      
      let yPos = 65;
      lines.forEach((line, index) => {
        doc.text(`${index + 1}. ${line.skus.description}`, 20, yPos);
        doc.text(`   Qty: ${line.qty_entered} ${line.sell_mode === 'kit' ? 'kits' : 'pieces'}`, 20, yPos + 5);
        doc.text(`   Price: $${line.unit_price.toFixed(2)}`, 20, yPos + 10);
        doc.text(`   Subtotal: $${line.line_subtotal.toFixed(2)}`, 20, yPos + 15);
        yPos += 25;
      });
      
      // Total
      yPos += 10;
      doc.setFontSize(12);
      doc.text(`Total: $${order?.subtotal.toFixed(2)}`, 20, yPos);
      
      doc.save(`order-${order?.human_uid}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloadingPdf(false);
    }
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
    <div className="p-6 space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/customer">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/customer">My Orders</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Order #{order.human_uid}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Order {order.human_uid}</h1>
          <p className="text-muted-foreground mt-1">
            Placed on {new Date(order.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/customer')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {(order.status === 'quoted' || order.status === 'deposit_due' || ['in_queue', 'in_production', 'packed', 'shipped', 'awaiting_payment', 'awaiting_invoice'].includes(order.status)) && (
            <Button variant="outline" onClick={handleDownloadPdf} disabled={downloadingPdf}>
              {downloadingPdf ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download PDF
            </Button>
           )}
          {canRequestModification(order.status) && (
            <Dialog open={modificationDialogOpen} onOpenChange={setModificationDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Request Modification
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request Order Modification</DialogTitle>
                  <DialogDescription>
                    Describe the changes you'd like to make to this order. Our team will review your request.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Textarea
                    placeholder="Please describe the modifications you'd like..."
                    value={modificationRequest}
                    onChange={(e) => setModificationRequest(e.target.value)}
                    rows={5}
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setModificationDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleModificationRequest}
                    disabled={!modificationRequest.trim() || submittingModification}
                  >
                    {submittingModification && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Submit Request
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
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
           order.status !== 'quoted' &&
           order.status !== 'cancelled' && (
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
        <ShipmentTracker shipment={shipment} onUpdate={fetchOrderDetails} />

        {/* Request History Timeline */}
        <OrderRequestHistory 
          key={requestHistoryKey}
          orderId={order.id} 
          onRequestChange={() => setRequestHistoryKey(prev => prev + 1)}
        />

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
  );
}
