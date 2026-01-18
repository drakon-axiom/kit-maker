import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Download, Send, Plus, Receipt } from 'lucide-react';
import { downloadBrandedInvoice, downloadBrandedReceipt } from '@/utils/brandedPdfDownload';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Invoice {
  id: string;
  invoice_no: string;
  type: 'deposit' | 'final';
  status: 'unpaid' | 'paid';
  subtotal: number;
  tax: number;
  total: number;
  issued_at: string;
  paid_at: string | null;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  recorded_at: string;
  notes: string | null;
}

interface InvoiceManagementProps {
  orderId: string;
  orderTotal: number;
  depositAmount: number;
  depositRequired: boolean;
  customerEmail: string | null;
  orderStatus: string;
  onStatusChange?: () => void;
}

export function InvoiceManagement({
  orderId,
  orderTotal,
  depositAmount,
  depositRequired,
  customerEmail,
  orderStatus,
  onStatusChange,
}: InvoiceManagementProps) {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment[]>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [invoiceTypeToCreate, setInvoiceTypeToCreate] = useState<'deposit' | 'final'>('deposit');
  const [customAmount, setCustomAmount] = useState('');

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('so_id', orderId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setInvoices(data || []);

      // Fetch payments for each invoice
      if (data && data.length > 0) {
        const invoiceIds = data.map((inv) => inv.id);
        const { data: paymentData, error: paymentError } = await supabase
          .from('invoice_payments')
          .select('*')
          .in('invoice_id', invoiceIds)
          .order('recorded_at', { ascending: false });

        if (!paymentError && paymentData) {
          const grouped: Record<string, Payment[]> = {};
          paymentData.forEach((p) => {
            if (!grouped[p.invoice_id]) grouped[p.invoice_id] = [];
            grouped[p.invoice_id].push(p);
          });
          setPayments(grouped);
        }
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [orderId]);

  const generateInvoiceNumber = (type: 'deposit' | 'final') => {
    const prefix = type === 'deposit' ? 'DEP' : 'INV';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${year}${month}-${random}`;
  };

  const handleCreateInvoice = async () => {
    setCreating(true);
    try {
      const amount = invoiceTypeToCreate === 'deposit' 
        ? (customAmount ? parseFloat(customAmount) : depositAmount)
        : (customAmount ? parseFloat(customAmount) : orderTotal);

      const taxAmount = 0; // Tax calculation can be added later
      const total = amount + taxAmount;

      const { error } = await supabase.from('invoices').insert({
        so_id: orderId,
        invoice_no: generateInvoiceNumber(invoiceTypeToCreate),
        type: invoiceTypeToCreate,
        status: 'unpaid',
        subtotal: amount,
        tax: taxAmount,
        total: total,
      });

      if (error) throw error;

      toast({
        title: 'Invoice Created',
        description: `${invoiceTypeToCreate === 'deposit' ? 'Deposit' : 'Final'} invoice created successfully`,
      });

      setCreateDialogOpen(false);
      setCustomAmount('');
      fetchInvoices();
      onStatusChange?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create invoice',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSendInvoice = async (invoice: Invoice) => {
    if (!customerEmail) {
      toast({
        title: 'No Email',
        description: 'Customer does not have an email address',
        variant: 'destructive',
      });
      return;
    }

    setSending(invoice.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-order-notification', {
        body: {
          orderId,
          newStatus: 'awaiting_payment',
          oldStatus: orderStatus,
          invoiceId: invoice.id,
        },
      });

      if (error) throw error;

      const message = (data as any)?.message as string | undefined;
      if (message && message.toLowerCase().includes('does not require notification')) {
        toast({
          title: 'Not Sent',
          description: message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Invoice Sent',
        description: `Invoice ${invoice.invoice_no} sent to ${customerEmail}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send invoice',
        variant: 'destructive',
      });
    } finally {
      setSending(null);
    }
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    setDownloading(invoice.id);
    try {
      await downloadBrandedInvoice(invoice.id, invoice.invoice_no);
      toast({
        title: 'Downloaded',
        description: `Invoice ${invoice.invoice_no} downloaded`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to download invoice',
        variant: 'destructive',
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleMarkPaid = async (invoice: Invoice) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', invoice.id);

      if (error) throw error;

      toast({
        title: 'Invoice Updated',
        description: `Invoice ${invoice.invoice_no} marked as paid`,
      });

      fetchInvoices();
      onStatusChange?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update invoice',
        variant: 'destructive',
      });
    }
  };

  const hasDepositInvoice = invoices.some((inv) => inv.type === 'deposit');
  const hasFinalInvoice = invoices.some((inv) => inv.type === 'final');
  const canCreateDeposit = depositRequired && !hasDepositInvoice;
  const canCreateFinal = !hasFinalInvoice;

  const totalPaid = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0);

  const totalDue = invoices
    .filter((inv) => inv.status === 'unpaid')
    .reduce((sum, inv) => sum + inv.total, 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Invoices & Payments
              </CardTitle>
              <CardDescription>
                {invoices.length} invoice(s) • ${totalPaid.toFixed(2)} paid • ${totalDue.toFixed(2)} due
              </CardDescription>
            </div>
            {(canCreateDeposit || canCreateFinal) && (
              <Button
                size="sm"
                onClick={() => {
                  setInvoiceTypeToCreate(canCreateDeposit ? 'deposit' : 'final');
                  setCustomAmount('');
                  setCreateDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No invoices yet</p>
              <p className="text-sm mt-1">Create an invoice to request payment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{invoice.invoice_no}</span>
                        <Badge variant={invoice.type === 'deposit' ? 'secondary' : 'default'}>
                          {invoice.type === 'deposit' ? 'Deposit' : 'Final'}
                        </Badge>
                        <Badge
                          variant={invoice.status === 'paid' ? 'default' : 'outline'}
                          className={invoice.status === 'paid' ? 'bg-success' : ''}
                        >
                          {invoice.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Issued {new Date(invoice.issued_at).toLocaleDateString()}
                        {invoice.paid_at && (
                          <span className="ml-2">
                            • Paid {new Date(invoice.paid_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">${invoice.total.toFixed(2)}</div>
                      {invoice.tax > 0 && (
                        <div className="text-xs text-muted-foreground">
                          (${invoice.subtotal.toFixed(2)} + ${invoice.tax.toFixed(2)} tax)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payments for this invoice */}
                  {payments[invoice.id] && payments[invoice.id].length > 0 && (
                    <div className="bg-muted/50 rounded p-3 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase">Payments</div>
                      {payments[invoice.id].map((payment) => (
                        <div key={payment.id} className="flex justify-between text-sm">
                          <span className="capitalize">
                            {payment.method} • {new Date(payment.recorded_at).toLocaleDateString()}
                          </span>
                          <span className="font-medium">${payment.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadInvoice(invoice)}
                      disabled={downloading === invoice.id}
                    >
                      {downloading === invoice.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Download
                    </Button>
                    {invoice.status === 'unpaid' && customerEmail && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendInvoice(invoice)}
                        disabled={sending === invoice.id}
                      >
                        {sending === invoice.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Send
                      </Button>
                    )}
                    {invoice.status === 'unpaid' && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleMarkPaid(invoice)}
                      >
                        Mark Paid
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>
              Create a new invoice for this order
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Invoice Type</Label>
              <div className="flex gap-2">
                {canCreateDeposit && (
                  <Button
                    type="button"
                    variant={invoiceTypeToCreate === 'deposit' ? 'default' : 'outline'}
                    onClick={() => {
                      setInvoiceTypeToCreate('deposit');
                      setCustomAmount('');
                    }}
                    className="flex-1"
                  >
                    Deposit
                  </Button>
                )}
                {canCreateFinal && (
                  <Button
                    type="button"
                    variant={invoiceTypeToCreate === 'final' ? 'default' : 'outline'}
                    onClick={() => {
                      setInvoiceTypeToCreate('final');
                      setCustomAmount('');
                    }}
                    className="flex-1"
                  >
                    Final
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={
                    invoiceTypeToCreate === 'deposit'
                      ? depositAmount.toFixed(2)
                      : orderTotal.toFixed(2)
                  }
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Default: ${invoiceTypeToCreate === 'deposit' ? depositAmount.toFixed(2) : orderTotal.toFixed(2)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInvoice} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
