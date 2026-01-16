import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, Receipt, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Link } from 'react-router-dom';
import { downloadBrandedReceipt } from '@/utils/brandedPdfDownload';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
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
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!customerData) {
        toast.error('Customer profile not found');
        return;
      }

      const { data: orderIds } = await supabase
        .from('sales_orders')
        .select('id')
        .eq('customer_id', customerData.id);

      if (!orderIds || orderIds.length === 0) {
        setTransactions([]);
        setLoading(false);
        return;
      }

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

      const total = data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const deposits = data?.filter(t => t.payment_type === 'deposit').length || 0;
      const finals = data?.filter(t => t.payment_type === 'final').length || 0;

      setStats({
        totalPaid: total,
        depositCount: deposits,
        finalCount: finals,
      });
    } catch (error) {
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
    return type === 'deposit' ? 'Deposit' : 'Final';
  };

  const getPaymentTypeBadge = (type: string) => {
    return type === 'deposit' ? 'bg-blue-500' : 'bg-green-500';
  };

  const handleDownloadReceipt = async (transactionId: string) => {
    setDownloadingId(transactionId);
    try {
      await downloadBrandedReceipt(transactionId);
      toast.success('Receipt downloaded successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download receipt');
    } finally {
      setDownloadingId(null);
    }
  };

  // Mobile Transaction Card
  const TransactionCard = ({ transaction }: { transaction: PaymentTransaction }) => (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <Button
              variant="link"
              className="p-0 h-auto font-semibold text-sm"
              onClick={() => navigate(`/customer/orders/${transaction.so_id}`)}
            >
              {transaction.sales_orders.human_uid}
            </Button>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(transaction.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
          </div>
          <Badge className={getPaymentTypeBadge(transaction.payment_type)}>
            {formatPaymentType(transaction.payment_type)}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-bold">${Number(transaction.amount).toFixed(2)}</div>
          <Badge variant="outline" className="bg-green-500/10 text-green-700">
            {transaction.status}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between pt-3 border-t">
          <span className="text-xs text-muted-foreground capitalize">
            {transaction.payment_method}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownloadReceipt(transaction.id)}
            disabled={downloadingId === transaction.id}
          >
            {downloadingId === transaction.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Download className="h-4 w-4 mr-1" />
                Receipt
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
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
            <BreadcrumbPage>Payments</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Payment History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View all your payment transactions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6">
        <Card>
          <CardHeader className="pb-2 pt-4 px-3 md:px-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Total Paid
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-6 pb-4">
            <div className="text-2xl md:text-3xl font-bold">${stats.totalPaid.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-3 md:px-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Deposits
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-6 pb-4">
            <div className="text-2xl md:text-3xl font-bold">{stats.depositCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-3 md:px-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Final Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-6 pb-4">
            <div className="text-2xl md:text-3xl font-bold">{stats.finalCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Transactions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5" />
            Transactions
          </CardTitle>
          <CardDescription className="text-sm">
            Detailed list of all your payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No payments yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your payment history will appear here once you make your first payment.
              </p>
              <Button onClick={() => navigate('/customer')}>
                View Orders
              </Button>
            </div>
          ) : isMobile ? (
            // Mobile Card View
            <div>
              {transactions.map((transaction) => (
                <TransactionCard key={transaction.id} transaction={transaction} />
              ))}
            </div>
          ) : (
            // Desktop Table View
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
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
                        day: 'numeric'
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
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadReceipt(transaction.id)}
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
