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
import { ArrowLeft, Plus, Trash2, Loader2, Package, Send, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';

interface PricingTier {
  id: string;
  min_quantity: number;
  max_quantity: number | null;
  price_per_kit: number;
}

interface SKU {
  id: string;
  code: string;
  description: string;
  price_per_kit: number;
  price_per_piece: number;
  pack_size: number;
  use_tier_pricing: boolean;
  pricing_tiers?: PricingTier[];
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
      // Error handled silently
    }
  };

  const fetchData = async () => {
    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id)
        .single();
      if (!customer) {
        toast.error('Customer profile not found');
        navigate('/customer');
        return;
      }
      setCustomerId(customer.id);
      const { data: skusData, error } = await supabase
        .from('skus')
        .select(`
          id, code, description, price_per_kit, price_per_piece, pack_size, use_tier_pricing,
          pricing_tiers:sku_pricing_tiers(id, min_quantity, max_quantity, price_per_kit)
        `)
        .eq('active', true);
      if (error) throw error;

      const skusWithSortedTiers = (skusData || []).map(sku => ({
        ...sku,
        pricing_tiers: sku.pricing_tiers?.sort((a: PricingTier, b: PricingTier) => a.min_quantity - b.min_quantity) || []
      }));
      setSKUs(skusWithSortedTiers);
    } catch (error) {
      toast.error('Failed to load products');
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
    } catch (error) {
      toast.error('Failed to submit access request');
    } finally {
      setRequestingAccess(false);
    }
  };

  const getPriceForQuantity = (sku: SKU, quantity: number): number => {
    if (!sku.use_tier_pricing || !sku.pricing_tiers || sku.pricing_tiers.length === 0) {
      return sku.price_per_kit;
    }
    const tier = sku.pricing_tiers.find(t => quantity >= t.min_quantity && (t.max_quantity === null || quantity <= t.max_quantity));
    return tier ? tier.price_per_kit : sku.price_per_kit;
  };

  const MIN_ORDER_QUANTITY = 5;

  const addLine = () => {
    setLines([...lines, {
      sku_id: '',
      sell_mode: 'kit',
      qty_entered: MIN_ORDER_QUANTITY,
      unit_price: 0,
      bottle_qty: 0,
      line_subtotal: 0
    }]);
  };

  const updateLine = (index: number, field: keyof OrderLine, value: any) => {
    const updatedLines = [...lines];
    updatedLines[index] = { ...updatedLines[index], [field]: value };
    if (field === 'sku_id' || field === 'sell_mode' || field === 'qty_entered') {
      const sku = skus.find(s => s.id === updatedLines[index].sku_id);
      if (sku) {
        const sellMode = updatedLines[index].sell_mode;
        let qty = updatedLines[index].qty_entered || 0;
        if (sellMode === 'kit' && qty < MIN_ORDER_QUANTITY && qty > 0) {
          qty = MIN_ORDER_QUANTITY;
          updatedLines[index].qty_entered = qty;
        }
        updatedLines[index].unit_price = sellMode === 'kit' ? getPriceForQuantity(sku, qty) : sku.price_per_piece;
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
      const { data: order, error: orderError } = await supabase
        .from('sales_orders')
        .insert({
          customer_id: customerId,
          uid: orderUID,
          human_uid: `SO-${orderUID}`,
          status: 'awaiting_approval',
          subtotal,
          source_channel: 'customer_portal'
        })
        .select()
        .single();
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
      const { error: linesError } = await supabase
        .from('sales_order_lines')
        .insert(orderLines);
      if (linesError) throw linesError;
      toast.success('Order placed successfully!');
      navigate('/customer');
    } catch (error) {
      toast.error('Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Mobile Line Item Card
  const LineItemCard = ({ line, index }: { line: OrderLine; index: number }) => {
    const selectedSku = skus.find(s => s.id === line.sku_id);
    const hasTiers = selectedSku?.use_tier_pricing && selectedSku?.pricing_tiers && selectedSku.pricing_tiers.length > 0;
    
    return (
      <Card className="mb-3">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <Label className="text-xs text-muted-foreground">Product</Label>
            <Button variant="ghost" size="sm" onClick={() => removeLine(index)} className="-mt-1 -mr-2">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          
          <Select value={line.sku_id} onValueChange={value => updateLine(index, 'sku_id', value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select product" />
            </SelectTrigger>
            <SelectContent>
              {skus.map(sku => (
                <SelectItem key={sku.id} value={sku.id}>
                  {sku.code} - {sku.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasTiers && line.sell_mode === 'kit' && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              <Info className="h-3 w-3 shrink-0" />
              <span>Volume discounts: {selectedSku.pricing_tiers?.map(t => 
                `${t.min_quantity}+ = $${t.price_per_kit}`
              ).join(', ')}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Sell By</Label>
              <Select value={line.sell_mode} onValueChange={value => updateLine(index, 'sell_mode', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kit">Kit</SelectItem>
                  <SelectItem value="piece">Piece</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Quantity</Label>
              <Input
                type="number"
                min={line.sell_mode === 'kit' ? MIN_ORDER_QUANTITY : 1}
                value={line.qty_entered}
                onChange={e => updateLine(index, 'qty_entered', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t text-sm">
            <div>
              <span className="text-muted-foreground">Unit: </span>
              <span className="font-medium">${line.unit_price.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Bottles: </span>
              <span className="font-medium">{line.bottle_qty}</span>
            </div>
            <div className="font-bold">
              ${line.line_subtotal.toFixed(2)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

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
            <BreadcrumbPage>New Order</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Place New Order</h1>
        <p className="text-sm text-muted-foreground mt-1">Select products and quantities</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Order Items</CardTitle>
          <CardDescription className="text-sm">Add products to your order</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {skus.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Package className="h-12 md:h-16 w-12 md:w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg md:text-xl font-semibold mb-2">No Products Available</h3>
              <p className="text-sm text-muted-foreground mb-4 px-4">
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
                  <Button onClick={handleRequestAccess} disabled={requestingAccess}>
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
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              {isMobile ? (
                <div>
                  {lines.map((line, index) => (
                    <LineItemCard key={index} line={line} index={index} />
                  ))}
                </div>
              ) : (
                /* Desktop Table View */
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
                    {lines.map((line, index) => {
                      const selectedSku = skus.find(s => s.id === line.sku_id);
                      const hasTiers = selectedSku?.use_tier_pricing && selectedSku?.pricing_tiers && selectedSku.pricing_tiers.length > 0;
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="space-y-1">
                              <Select value={line.sku_id} onValueChange={value => updateLine(index, 'sku_id', value)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select product" />
                                </SelectTrigger>
                                <SelectContent>
                                  {skus.map(sku => (
                                    <SelectItem key={sku.id} value={sku.id}>
                                      {sku.code} - {sku.description}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {hasTiers && line.sell_mode === 'kit' && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                                        <Info className="h-3 w-3" />
                                        <span>Volume discounts available</span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="max-w-xs">
                                      <div className="space-y-1">
                                        <p className="font-medium text-sm">Pricing Tiers:</p>
                                        {selectedSku.pricing_tiers?.map((tier, idx) => (
                                          <div key={idx} className="flex justify-between gap-4 text-xs">
                                            <span>{tier.min_quantity}-{tier.max_quantity || '∞'} kits</span>
                                            <span className="font-medium">${tier.price_per_kit.toFixed(2)}/kit</span>
                                          </div>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
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
                            <Input
                              type="number"
                              min={line.sell_mode === 'kit' ? MIN_ORDER_QUANTITY : 1}
                              value={line.qty_entered}
                              onChange={e => updateLine(index, 'qty_entered', parseInt(e.target.value) || 0)}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>${line.unit_price.toFixed(2)}</TableCell>
                          <TableCell>{line.bottle_qty}</TableCell>
                          <TableCell>${line.line_subtotal.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => removeLine(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              <Button onClick={addLine} variant="outline" disabled={skus.length === 0} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pt-4 border-t">
                <div className="text-lg font-semibold">
                  Total: ${calculateSubtotal().toFixed(2)}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate('/customer')} className="flex-1 sm:flex-initial">
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={lines.length === 0 || submitting || skus.length === 0}
                    className="flex-1 sm:flex-initial"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Placing...
                      </>
                    ) : (
                      'Place Order'
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
