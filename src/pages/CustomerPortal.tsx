import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Package, Loader2, Eye, RefreshCw, Search, Filter, Download, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchCustomerData();
    }
  }, [user]);

  useEffect(() => {
    // Apply search and filters
    let filtered = [...orders];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.human_uid.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'highest':
          return b.subtotal - a.subtotal;
        case 'lowest':
          return a.subtotal - b.subtotal;
        default:
          return 0;
      }
    });

    setFilteredOrders(filtered);
  }, [orders, searchTerm, statusFilter, sortBy]);

  const fetchCustomerData = async () => {
    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('id, name')
        .eq('user_id', user?.id)
        .single();

      if (customer) {
        setCustomerName(customer.name);
        setCustomerId(customer.id);
        
        const { data: ordersData, error } = await supabase
          .from('sales_orders')
          .select('id, human_uid, status, subtotal, created_at, promised_date')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders(ordersData || []);
      }
    } catch (error) {
      toast.error('Failed to load orders');
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async (orderId: string) => {
    setReorderingId(orderId);
    try {
      // Fetch the order lines from the original order
      const { data: orderLines, error: linesError } = await supabase
        .from('sales_order_lines')
        .select(`
          sku_id,
          sell_mode,
          qty_entered,
          unit_price,
          bottle_qty,
          line_subtotal
        `)
        .eq('so_id', orderId);

      if (linesError) throw linesError;

      if (!orderLines || orderLines.length === 0) {
        toast.error('No items found in the original order');
        return;
      }

      // Create a new order
      const newOrderUid = `ORD-${Date.now()}`;
      const { data: newOrder, error: orderError } = await supabase
        .from('sales_orders')
        .insert({
          customer_id: customerId,
          uid: newOrderUid,
          human_uid: newOrderUid,
          status: 'draft',
          source_channel: 'customer_portal',
          subtotal: orderLines.reduce((sum, line) => sum + Number(line.line_subtotal), 0),
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert the order lines
      const newOrderLines = orderLines.map(line => ({
        so_id: newOrder.id,
        sku_id: line.sku_id,
        sell_mode: line.sell_mode,
        qty_entered: line.qty_entered,
        unit_price: line.unit_price,
        bottle_qty: line.bottle_qty,
        line_subtotal: line.line_subtotal,
      }));

      const { error: insertError } = await supabase
        .from('sales_order_lines')
        .insert(newOrderLines);

      if (insertError) throw insertError;

      toast.success('Order duplicated successfully! Redirecting...');
      
      // Refresh orders list
      await fetchCustomerData();
      
      // Navigate to the new order
      setTimeout(() => {
        navigate(`/customer/orders/${newOrder.id}`);
      }, 1000);
    } catch (error) {
      // Error handled silently
      toast.error('Failed to create reorder');
    } finally {
      setReorderingId(null);
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

  const handleExportOrders = () => {
    try {
      const csvContent = [
        ['Order #', 'Status', 'Subtotal', 'Order Date', 'Promised Date'].join(','),
        ...filteredOrders.map(order => [
          order.human_uid,
          formatStatus(order.status),
          order.subtotal.toFixed(2),
          new Date(order.created_at).toLocaleDateString(),
          order.promised_date ? new Date(order.promised_date).toLocaleDateString() : '-'
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Orders exported successfully');
    } catch (error) {
      toast.error('Failed to export orders');
    }
  };

  const handleCancelRequest = async () => {
    if (!orderToCancel) return;

    try {
      const { error } = await supabase
        .from('order_comments')
        .insert({
          so_id: orderToCancel,
          comment: 'Customer requested order cancellation',
          comment_type: 'cancellation_request',
          request_status: 'pending',
          is_internal: false,
          user_id: user?.id || '',
        });

      if (error) throw error;

      toast.success('Cancellation request submitted. Our team will review it shortly.');
      setCancelDialogOpen(false);
      setOrderToCancel(null);
    } catch (error) {
      // Error handled silently
      toast.error('Failed to submit cancellation request');
    }
  };

  const canRequestCancellation = (status: string) => {
    return ['draft', 'quoted', 'deposit_due', 'awaiting_approval'].includes(status);
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Welcome, {customerName}</h1>
          <p className="text-muted-foreground mt-1">Manage your orders and place new ones</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/customer/new-order')}>
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </div>
      </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Your Orders</CardTitle>
                <CardDescription>View and track all your orders</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportOrders}
                disabled={filteredOrders.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and Filter Controls */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by order number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="quoted">Quoted</SelectItem>
                  <SelectItem value="awaiting_approval">Awaiting Approval</SelectItem>
                  <SelectItem value="deposit_due">Deposit Due</SelectItem>
                  <SelectItem value="in_queue">In Queue</SelectItem>
                  <SelectItem value="in_production">In Production</SelectItem>
                  <SelectItem value="packed">Packed</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="highest">Highest Value</SelectItem>
                  <SelectItem value="lowest">Lowest Value</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                {orders.length === 0 ? (
                  <>
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
                    <p className="text-muted-foreground mb-4">Get started by placing your first order</p>
                    <Button onClick={() => navigate('/customer/new-order')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Place Order
                    </Button>
                  </>
                ) : (
                  <>
                    <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No orders found</h3>
                    <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('all');
                      }}
                    >
                      Clear Filters
                    </Button>
                  </>
                )}
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
                  {filteredOrders.map((order) => (
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
                        <div className="flex gap-2 justify-end">
                          {canRequestCancellation(order.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setOrderToCancel(order.id);
                                setCancelDialogOpen(true);
                              }}
                              title="Request order cancellation"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReorder(order.id)}
                            disabled={reorderingId === order.id}
                            title="Create a new order with the same items"
                          >
                            {reorderingId === order.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Reorder
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => navigate(`/customer/orders/${order.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Request Order Cancellation</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p>
                    Are you sure you want to request cancellation for this order? Our team will review your request and contact you shortly.
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Note: Orders in later stages of production may not be eligible for cancellation.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setOrderToCancel(null)}>
                Keep Order
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelRequest}>
                Request Cancellation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
