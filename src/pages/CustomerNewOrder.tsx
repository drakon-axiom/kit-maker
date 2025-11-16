import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2, Loader2, Package, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Link } from 'react-router-dom';
interface SKU {
  id: string;
  code: string;
  description: string;
  price_per_kit: number;
  price_per_piece: number;
  pack_size: number;
}
interface PricingTier {
  min_quantity: number;
  max_quantity: number | null;
  price_per_kit: number;
}
interface OrderLine {
  sku_id: string;
  sell_mode: 'kit' | 'piece';
  qty_entered: number;
  unit_price: number;
  bottle_qty: number;
  line_subtotal: number;
}
export default function CustomerNewOrder() {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const [skus, setSKUs] = useState<SKU[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [hasRequestedAccess, setHasRequestedAccess] = useState(false);
  useEffect(() => {
    if (user) {
      fetchData();
      checkAccessRequest();
    }
  }, [user]);

  const checkAccessRequest = async () => {
    if (!user) return;

    try {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (customerData) {
        const { data: request } = await supabase
          .from('customer_access_requests')
          .select('id')
          .eq('customer_id', customerData.id)
          .eq('status', 'pending')
          .maybeSingle();

        setHasRequestedAccess(!!request);
      }
    } catch (error) {
      console.error('Error checking access request:', error);
    }
  };

  const fetchData = async () => {
    try {
      const {
        data: customer
      } = await supabase.from('customers').select('id').eq('user_id', user?.id).single();
      if (!customer) {
        toast.error('Customer profile not found');
        navigate('/customer');
        return;
      }
      setCustomerId(customer.id);
      const {
        data: skusData,
        error
      } = await supabase.from('skus').select('id, code, description, price_per_kit, price_per_piece, pack_size').eq('active', true);
      if (error) throw error;
      setSKUs(skusData || []);
    } catch (error: any) {
      toast.error('Failed to load products');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async () => {
    if (!customerId) return;

    setRequestingAccess(true);
    try {
      const { data, error } = await supabase.functions.invoke('request-customer-access', {
        body: { customerId }
      });

      if (error) throw error;

      if (data?.hoursRemaining) {
        toast.error(`Please wait ${data.hoursRemaining} more hours before requesting access`);
      } else {
        toast.success('Access request submitted! Administrators have been notified.');
        setHasRequestedAccess(true);
      }
    } catch (error: any) {
      console.error('Error requesting access:', error);
      toast.error('Failed to submit access request');
    } finally {
      setRequestingAccess(false);
    }
  };

  const addLine = () => {
    setLines([...lines, {
      sku_id: '',
      sell_mode: 'kit',
      qty_entered: 1,
      unit_price: 0,
      bottle_qty: 0,
      line_subtotal: 0
    }]);
  };
  const updateLine = (index: number, field: keyof OrderLine, value: any) => {
    const updatedLines = [...lines];
    updatedLines[index] = {
      ...updatedLines[index],
      [field]: value
    };
    if (field === 'sku_id' || field === 'sell_mode' || field === 'qty_entered') {
      const sku = skus.find(s => s.id === updatedLines[index].sku_id);
      if (sku) {
        const sellMode = updatedLines[index].sell_mode;
        const qty = updatedLines[index].qty_entered || 0;
        updatedLines[index].unit_price = sellMode === 'kit' ? sku.price_per_kit : sku.price_per_piece;
        updatedLines[index].bottle_qty = sellMode === 'kit' ? qty * (sku.pack_size || 1) : qty;
        updatedLines[index].line_subtotal = qty * updatedLines[index].unit_price;
      }
    }
    setLines(updatedLines);
  };
  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };
  const calculateSubtotal = () => {
    return lines.reduce((sum, line) => sum + line.line_subtotal, 0);
  };
  const generateOrderUID = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `${timestamp}${random}`.toUpperCase();
  };
  const handleSubmit = async () => {
    if (lines.length === 0) {
      toast.error('Please add at least one product');
      return;
    }
    if (lines.some(l => !l.sku_id || l.qty_entered <= 0)) {
      toast.error('Please fill in all line items');
      return;
    }
    setSubmitting(true);
    try {
      const orderUID = generateOrderUID();
      const subtotal = calculateSubtotal();
      const {
        data: order,
        error: orderError
      } = await supabase.from('sales_orders').insert({
        customer_id: customerId,
        uid: orderUID,
        human_uid: `SO-${orderUID}`,
        status: 'awaiting_approval',
        subtotal,
        source_channel: 'customer_portal'
      }).select().single();
      if (orderError) throw orderError;
      const orderLines = lines.map(line => ({
        so_id: order.id,
        sku_id: line.sku_id,
        sell_mode: line.sell_mode,
        qty_entered: line.qty_entered,
        unit_price: line.unit_price,
        bottle_qty: line.bottle_qty,
        line_subtotal: line.line_subtotal
      }));
      const {
        error: linesError
      } = await supabase.from('sales_order_lines').insert(orderLines);
      if (linesError) throw linesError;
      toast.success('Order placed successfully!');
      navigate('/customer');
    } catch (error: any) {
      toast.error('Failed to place order');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
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
            <BreadcrumbPage>New Order</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-3xl font-bold">Place New Order</h1>
        <p className="text-muted-foreground mt-1">Select products and quantities</p>
      </div>

        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
            <CardDescription>Add products to your order</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {skus.length === 0 ? <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Products Available</h3>
                <p className="text-muted-foreground mb-4">
                  You don't have access to any products yet. Please request access from your administrator.
                </p>
                {hasRequestedAccess ? (
                  <div className="bg-muted/50 border border-border rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-sm text-muted-foreground">
                      Your access request is pending. An administrator will review it shortly.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Button 
                      onClick={handleRequestAccess} 
                      disabled={requestingAccess}
                    >
                      {requestingAccess ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Request Access
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Note: Requests can only be submitted 24 hours after signup
                    </p>
                  </div>
                )}
              </div> : <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Sell By</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Bottles</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => <TableRow key={index}>
                    <TableCell>
                      <Select value={line.sku_id} onValueChange={value => updateLine(index, 'sku_id', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {skus.map(sku => <SelectItem key={sku.id} value={sku.id}>
                              {sku.code} - {sku.description}
                            </SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={line.sell_mode} onValueChange={value => updateLine(index, 'sell_mode', value)}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kit">Kit</SelectItem>
                          <SelectItem value="piece">Piece</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input type="number" min="1" value={line.qty_entered} onChange={e => updateLine(index, 'qty_entered', parseInt(e.target.value) || 0)} className="w-24" />
                    </TableCell>
                    <TableCell>${line.unit_price.toFixed(2)}</TableCell>
                    <TableCell>{line.bottle_qty}</TableCell>
                    <TableCell>${line.line_subtotal.toFixed(2)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeLine(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>

            <Button onClick={addLine} variant="outline" disabled={skus.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-lg font-semibold">
                Total: ${calculateSubtotal().toFixed(2)}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/customer')}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={lines.length === 0 || submitting || skus.length === 0}>
                  {submitting ? <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Placing Order...
                    </> : 'Place Order'}
                </Button>
              </div>
            </div>
            </>}
          </CardContent>
        </Card>
    </div>
  );
}