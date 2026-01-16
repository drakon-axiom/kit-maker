import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  Check,
  X,
  Wallet,
  Loader2,
  RefreshCw,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PaymentMetadata {
  cashapp_name?: string;
  customer_notes?: string;
  customer_name?: string;
  order_number?: string;
  submitted_at?: string;
  approved_at?: string;
  approval_notes?: string;
  rejected_at?: string;
  rejection_reason?: string;
}

interface PendingPayment {
  id: string;
  so_id: string;
  amount: number;
  payment_type: string;
  payment_method: string;
  status: string;
  customer_email: string;
  created_at: string;
  metadata: PaymentMetadata | null;
}

interface OrderInfo {
  id: string;
  human_uid: string;
  status: string;
  deposit_status: string;
  subtotal: number;
  customers: {
    name: string;
    email: string;
  } | null;
}

const PendingPaymentVerification = () => {
  const navigate = useNavigate();
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');

  useEffect(() => {
    fetchPendingPayments();
  }, []);

  const fetchPendingPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('status', 'pending_verification')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Cast metadata to proper type
      const payments = (data || []).map(p => ({
        ...p,
        metadata: p.metadata as PaymentMetadata | null
      }));
      setPendingPayments(payments);
    } catch (error) {
      console.error('Error fetching pending payments:', error);
      toast.error('Failed to load pending payments');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderInfo = async (soId: string) => {
    const { data, error } = await supabase
      .from('sales_orders')
      .select('id, human_uid, status, deposit_status, subtotal, customers(name, email)')
      .eq('id', soId)
      .single();

    if (error) {
      console.error('Error fetching order info:', error);
      return null;
    }
    return data as OrderInfo;
  };

  const handleViewDetails = async (payment: PendingPayment) => {
    setSelectedPayment(payment);
    const order = await fetchOrderInfo(payment.so_id);
    setOrderInfo(order);
  };

  const handleApprove = async () => {
    if (!selectedPayment) return;

    setProcessingId(selectedPayment.id);
    try {
      // Update payment transaction status to completed
      const { error: txError } = await supabase
        .from('payment_transactions')
        .update({ 
          status: 'completed',
          metadata: {
            ...selectedPayment.metadata,
            approved_at: new Date().toISOString(),
            approval_notes: approvalNotes,
          }
        })
        .eq('id', selectedPayment.id);

      if (txError) throw txError;

      // Update order/invoice based on payment type
      if (selectedPayment.payment_type === 'deposit') {
        // Find and update deposit invoice
        const { data: invoice } = await supabase
          .from('invoices')
          .select('id')
          .eq('so_id', selectedPayment.so_id)
          .eq('type', 'deposit')
          .single();

        if (invoice) {
          await supabase
            .from('invoices')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
            })
            .eq('id', invoice.id);
        }

        // Update order deposit status
        await supabase
          .from('sales_orders')
          .update({ deposit_status: 'paid' })
          .eq('id', selectedPayment.so_id);

      } else if (selectedPayment.payment_type === 'final') {
        // Find and update final invoice
        const { data: invoice } = await supabase
          .from('invoices')
          .select('id')
          .eq('so_id', selectedPayment.so_id)
          .eq('type', 'final')
          .single();

        if (invoice) {
          await supabase
            .from('invoices')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
            })
            .eq('id', invoice.id);
        }
      }

      // Log to audit trail
      await supabase.from('audit_log').insert({
        entity: 'payment',
        entity_id: selectedPayment.so_id,
        action: 'cashapp_payment_approved',
        after: {
          transaction_id: selectedPayment.id,
          amount: selectedPayment.amount,
          payment_type: selectedPayment.payment_type,
          approval_notes: approvalNotes,
        },
      });

      toast.success('Payment approved and order updated!');
      setShowApproveDialog(false);
      setSelectedPayment(null);
      setApprovalNotes('');
      fetchPendingPayments();
    } catch (error) {
      console.error('Error approving payment:', error);
      toast.error('Failed to approve payment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedPayment) return;

    setProcessingId(selectedPayment.id);
    try {
      // Update payment transaction status to rejected
      const { error: txError } = await supabase
        .from('payment_transactions')
        .update({ 
          status: 'rejected',
          metadata: {
            ...selectedPayment.metadata,
            rejected_at: new Date().toISOString(),
            rejection_reason: rejectionReason,
          }
        })
        .eq('id', selectedPayment.id);

      if (txError) throw txError;

      // Log to audit trail
      await supabase.from('audit_log').insert({
        entity: 'payment',
        entity_id: selectedPayment.so_id,
        action: 'cashapp_payment_rejected',
        after: {
          transaction_id: selectedPayment.id,
          amount: selectedPayment.amount,
          payment_type: selectedPayment.payment_type,
          rejection_reason: rejectionReason,
        },
      });

      toast.success('Payment verification rejected');
      setShowRejectDialog(false);
      setSelectedPayment(null);
      setRejectionReason('');
      fetchPendingPayments();
    } catch (error) {
      console.error('Error rejecting payment:', error);
      toast.error('Failed to reject payment');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pending Payment Verifications</h1>
          <p className="text-muted-foreground">
            Review and approve CashApp payments submitted by customers
          </p>
        </div>
        <Button onClick={fetchPendingPayments} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : pendingPayments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Check className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold">All Caught Up!</h3>
            <p className="text-muted-foreground">
              No pending payment verifications at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Pending Verifications
              <Badge variant="secondary">{pendingPayments.length}</Badge>
            </CardTitle>
            <CardDescription>
              Customers have submitted payment confirmations that need verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>CashApp Name</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <Button
                        variant="link"
                        className="p-0 h-auto font-mono"
                        onClick={() => navigate(`/orders/${payment.so_id}`)}
                      >
                        {payment.metadata?.order_number || 'N/A'}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{payment.metadata?.customer_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{payment.customer_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${payment.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={payment.payment_type === 'deposit' ? 'outline' : 'default'}>
                        {payment.payment_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {payment.metadata?.cashapp_name || 'Not provided'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(payment.created_at), 'MMM d, h:mm a')}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetails(payment)}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowApproveDialog(true);
                          }}
                          disabled={processingId === payment.id}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowRejectDialog(true);
                          }}
                          disabled={processingId === payment.id}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* View Details Dialog */}
      <Dialog open={!!selectedPayment && !showApproveDialog && !showRejectDialog} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>
              Review the payment confirmation details
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Order</Label>
                  <p className="font-mono font-medium">{selectedPayment.metadata?.order_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p className="font-semibold text-lg">${selectedPayment.amount.toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Type</Label>
                  <p className="capitalize">{selectedPayment.payment_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Method</Label>
                  <p className="capitalize">{selectedPayment.payment_method}</p>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <Label className="text-muted-foreground">Customer's CashApp Name</Label>
                <p className="font-mono text-lg">{selectedPayment.metadata?.cashapp_name || 'Not provided'}</p>
              </div>

              {selectedPayment.metadata?.customer_notes && (
                <div>
                  <Label className="text-muted-foreground">Customer Notes</Label>
                  <p className="text-sm mt-1">{selectedPayment.metadata.customer_notes}</p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Submitted</Label>
                <p>{format(new Date(selectedPayment.created_at), 'PPpp')}</p>
              </div>

              {orderInfo && (
                <div className="p-4 border rounded-lg space-y-2">
                  <Label className="text-muted-foreground">Order Status</Label>
                  <div className="flex items-center gap-2">
                    <Badge>{orderInfo.status.replace(/_/g, ' ')}</Badge>
                    <Badge variant="outline">Deposit: {orderInfo.deposit_status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Total: ${orderInfo.subtotal.toFixed(2)}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <p className="text-sm text-yellow-800">
                  Verify this payment was received in CashApp before approving
                </p>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectDialog(true)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setShowApproveDialog(true)}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment Approval</DialogTitle>
            <DialogDescription>
              This will mark the payment as received and update the order status.
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-medium text-green-800">
                  Approving ${selectedPayment.amount.toFixed(2)} {selectedPayment.payment_type} payment
                </p>
                <p className="text-sm text-green-700">
                  Order: {selectedPayment.metadata?.order_number}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="approval-notes">Notes (optional)</Label>
                <Textarea
                  id="approval-notes"
                  placeholder="Add any notes about this payment verification..."
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleApprove}
                  disabled={processingId === selectedPayment?.id}
                >
                  {processingId === selectedPayment?.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Confirm Approval
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment Verification</DialogTitle>
            <DialogDescription>
              This will mark the payment as rejected. The customer will need to resubmit.
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="font-medium text-red-800">
                  Rejecting ${selectedPayment.amount.toFixed(2)} {selectedPayment.payment_type} payment
                </p>
                <p className="text-sm text-red-700">
                  Order: {selectedPayment.metadata?.order_number}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Reason for rejection *</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Explain why this payment is being rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={processingId === selectedPayment?.id || !rejectionReason.trim()}
                >
                  {processingId === selectedPayment?.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Confirm Rejection
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingPaymentVerification;
