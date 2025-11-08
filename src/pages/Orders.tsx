import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface Order {
  id: string;
  uid: string;
  human_uid: string;
  status: string;
  customer: {
    name: string;
  };
  subtotal: number;
  deposit_required: boolean;
  deposit_status: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted',
  quoted: 'bg-blue-500',
  deposit_due: 'bg-warning',
  in_queue: 'bg-purple-500',
  in_production: 'bg-primary',
  in_labeling: 'bg-indigo-500',
  in_packing: 'bg-cyan-500',
  packed: 'bg-success',
  invoiced: 'bg-orange-500',
  payment_due: 'bg-warning',
  ready_to_ship: 'bg-success',
  shipped: 'bg-muted-foreground',
  cancelled: 'bg-destructive',
  on_hold_customer: 'bg-amber-500',
  on_hold_internal: 'bg-amber-600',
  on_hold_materials: 'bg-amber-700',
};

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customer:customers(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data as any || []);
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
    if (status === 'on_hold_customer') return 'On Hold (Customer Hold)';
    if (status === 'on_hold_internal') return 'On Hold (Internal Hold)';
    if (status === 'on_hold_materials') return 'On Hold (Materials Hold)';
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground mt-1">Manage sales orders and track progress</p>
        </div>
        <Button onClick={() => navigate('/orders/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Order
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
          <CardDescription>
            {orders.length} order{orders.length !== 1 ? 's' : ''} in total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No orders yet. Click "New Order" to create your first one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deposit</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-medium">{order.human_uid}</TableCell>
                    <TableCell>{order.customer?.name}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[order.status] || 'bg-muted'}>
                        {formatStatus(order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.deposit_required ? (
                        <Badge variant={order.deposit_status === 'paid' ? 'default' : 'outline'}>
                          {order.deposit_status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>${order.subtotal.toFixed(2)}</TableCell>
                    <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        <Eye className="h-4 w-4" />
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
};

export default Orders;