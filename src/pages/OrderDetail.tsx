import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Loader2, DollarSign, Package } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface OrderDetail {
  id: string;
  uid: string;
  human_uid: string;
  status: string;
  subtotal: number;
  deposit_required: boolean;
  deposit_amount: number;
  deposit_status: string;
  label_required: boolean;
  eta_date: string | null;
  promised_date: string | null;
  created_at: string;
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  sales_order_lines: Array<{
    id: string;
    sell_mode: string;
    qty_entered: number;
    bottle_qty: number;
    unit_price: number;
    line_subtotal: number;
    sku: {
      code: string;
      description: string;
    };
  }>;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted',
  quoted: 'bg-blue-500',
  deposit_due: 'bg-warning',
  in_queue: 'bg-purple-500',
  in_production: 'bg-primary',
  packed: 'bg-success',
  invoiced: 'bg-orange-500',
  payment_due: 'bg-warning',
  ready_to_ship: 'bg-success',
  shipped: 'bg-muted-foreground',
  cancelled: 'bg-destructive',
};

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  const fetchOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customer:customers(name, email, phone),
          sales_order_lines(
            *,
            sku:skus(code, description)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setOrder(data as any);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const totalBottles = order?.sales_order_lines.reduce((sum, line) => sum + line.bottle_qty, 0) || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Order not found</p>
          <Button className="mt-4" onClick={() => navigate('/orders')}>
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight font-mono">{order.human_uid}</h1>
          <p className="text-muted-foreground mt-1">{order.customer.name}</p>
        </div>
        <Badge className={statusColors[order.status] || 'bg-muted'}>
          {formatStatus(order.status)}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{order.customer.name}</p>
            </div>
            {order.customer.email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{order.customer.email}</p>
              </div>
            )}
            {order.customer.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{order.customer.phone}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Bottles</span>
              <span className="font-mono font-medium">{totalBottles}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Labels Required</span>
              <Badge variant={order.label_required ? 'default' : 'outline'}>
                {order.label_required ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="font-medium">${order.subtotal.toFixed(2)}</span>
            </div>
            {order.deposit_required && (
              <>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Deposit</span>
                  <div className="text-right">
                    <div className="font-medium">${order.deposit_amount.toFixed(2)}</div>
                    <Badge variant={order.deposit_status === 'paid' ? 'default' : 'outline'} className="text-xs">
                      {order.deposit_status}
                    </Badge>
                  </div>
                </div>
              </>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold pt-2">
              <span>Order Total</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
          <CardDescription>{order.sales_order_lines.length} item(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Bottles</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.sales_order_lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-mono">{line.sku.code}</TableCell>
                  <TableCell>{line.sku.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {line.sell_mode}
                    </Badge>
                  </TableCell>
                  <TableCell>{line.qty_entered}</TableCell>
                  <TableCell className="font-mono">{line.bottle_qty}</TableCell>
                  <TableCell>${line.unit_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${line.line_subtotal.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {userRole === 'admin' && order.status === 'draft' && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>Actions available for this order</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full" variant="outline">
              <DollarSign className="mr-2 h-4 w-4" />
              Generate Quote
            </Button>
            <Button className="w-full" variant="outline">
              <Package className="mr-2 h-4 w-4" />
              Plan Batches
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OrderDetail;