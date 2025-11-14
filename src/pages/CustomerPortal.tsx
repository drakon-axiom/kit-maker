import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Package, Loader2, Eye, User } from 'lucide-react';
import { toast } from 'sonner';

interface Order {
  id: string;
  human_uid: string;
  status: string;
  subtotal: number;
  created_at: string;
  promised_date: string | null;
}

export default function CustomerPortal() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState('');

  useEffect(() => {
    if (user) {
      fetchCustomerData();
    }
  }, [user]);

  const fetchCustomerData = async () => {
    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('id, name')
        .eq('user_id', user?.id)
        .single();

      if (customer) {
        setCustomerName(customer.name);
        
        const { data: ordersData, error } = await supabase
          .from('sales_orders')
          .select('id, human_uid, status, subtotal, created_at, promised_date')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders(ordersData || []);
      }
    } catch (error: any) {
      toast.error('Failed to load orders');
      console.error(error);
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {customerName}</h1>
            <p className="text-muted-foreground mt-1">Manage your orders and place new ones</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/customer/profile')}>
              <User className="h-4 w-4 mr-2" />
              Profile
            </Button>
            <Button onClick={() => navigate('/customer/new-order')}>
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Button>
            <Button variant="outline" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Orders</CardTitle>
            <CardDescription>View and track all your orders</CardDescription>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
                <p className="text-muted-foreground mb-4">Get started by placing your first order</p>
                <Button onClick={() => navigate('/customer/new-order')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Place Order
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Promised Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.human_uid}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(order.status)}>
                          {formatStatus(order.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>${order.subtotal.toFixed(2)}</TableCell>
                      <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {order.promised_date ? new Date(order.promised_date).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/customer/orders/${order.id}`)}
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
    </div>
  );
}
