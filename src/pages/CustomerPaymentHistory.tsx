import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, CreditCard, Receipt, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Link } from 'react-router-dom';
import { downloadBrandedReceipt } from '@/utils/brandedPdfDownload';

interface PaymentTransaction {
  id: string;
  so_id: string;
  payment_type: string;
  amount: number;
  status: string;
  payment_method: string;
  stripe_payment_intent: string | null;
  created_at: string;
  sales_orders: {
    human_uid: string;
  };
}

export default function CustomerPaymentHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalPaid: 0,
    depositCount: 0,
    finalCount: 0,
  });

  const fetchPaymentHistory = useCallback(async () => {
    try {
      // Get customer ID
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!customerData) {
        toast.error('Customer profile not found');
        return;
      }

      // First get order IDs for this customer
      const { data: orderIds } = await supabase
        .from('sales_orders')
        .select('id')
        .eq('customer_id', customerData.id);

      if (!orderIds || orderIds.length === 0) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      // Fetch payment transactions
      const { data, error } = await supabase
        .from('payment_transactions')
        .select(`
          *,
          sales_orders (human_uid)
        `)
        .in('so_id', orderIds.map(o => o.id))
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions(data || []);

      // Calculate stats
      const total = data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const deposits = data?.filter(t => t.payment_type === 'deposit').length || 0;
      const finals = data?.filter(t => t.payment_type === 'final').length || 0;

      setStats({
        totalPaid: total,
        depositCount: deposits,
        finalCount: finals,
      });
    } catch (error) {
      // Error handled silently
      toast.error('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchPaymentHistory();
    }
  }, [user, fetchPaymentHistory]);

  const formatPaymentType = (type: string) => {
    return type === 'deposit' ? 'Deposit' : 'Final Payment';
  };

  const getPaymentTypeBadge = (type: string) => {
    return type === 'deposit' ? 'bg-blue-500' : 'bg-green-500';
  };

  const handleDownloadReceipt = async (transactionId: string, orderNumber: string, paymentType: string) => {
    setDownloadingId(transactionId);
    try {
      await downloadBrandedReceipt(transactionId);
      toast.success('Receipt downloaded successfully');
    } catch (error) {
      // Error handled silently
      toast.error(error instanceof Error ? error.message : 'Failed to download receipt');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
            <BreadcrumbPage>Payment History</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Payment History</h1>
        <p className="text-muted-foreground mt-1">
          View all your payment transactions and receipts
        </p>
      </div>

        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${stats.totalPaid.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-2">
                Across all orders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Deposit Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.depositCount}</div>
              <p className="text-xs text-muted-foreground mt-2">
                Total deposits made
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Final Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.finalCount}</div>
              <p className="text-xs text-muted-foreground mt-2">
                Completed orders
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Transaction History
            </CardTitle>
            <CardDescription>
              Detailed list of all your payment transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No payments yet</h3>
                <p className="text-muted-foreground mb-4">
                  Your payment history will appear here once you make your first payment.
                </p>
                <Button onClick={() => navigate('/customer')}>
                  View Orders
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {new Date(transaction.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          className="p-0 h-auto font-medium"
                          onClick={() => navigate(`/customer/orders/${transaction.so_id}`)}
                        >
                          {transaction.sales_orders.human_uid}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPaymentTypeBadge(transaction.payment_type)}>
                          {formatPaymentType(transaction.payment_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">
                        {transaction.payment_method}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-500/10 text-green-700">
                          {transaction.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${Number(transaction.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {transaction.stripe_payment_intent?.substring(0, 20)}...
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadReceipt(
                            transaction.id,
                            transaction.sales_orders.human_uid,
                            transaction.payment_type
                          )}
                          disabled={downloadingId === transaction.id}
                        >
                          {downloadingId === transaction.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Receipt
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
