import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface Customer {
  id: string;
  name: string;
}

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
  pricing_tiers?: PricingTier[];
}

interface OrderLine {
  sku_id: string;
  sku_code: string;
  sku_description: string;
  sell_mode: 'kit' | 'piece';
  qty_entered: number;
  unit_price: number;
  line_subtotal: number;
  bottle_qty: number;
}

const OrderNew = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [skus, setSKUs] = useState<SKU[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [depositRequired, setDepositRequired] = useState(false);
  const [depositPercent, setDepositPercent] = useState(50);
  const [labelRequired, setLabelRequired] = useState(false);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [kitSize, setKitSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [customersRes, skusRes, settingsRes] = await Promise.all([
        supabase.from('customers').select('id, name').order('name'),
        supabase.from('skus').select(`
          *,
          pricing_tiers:sku_pricing_tiers(*)
        `).eq('active', true).order('code'),
        supabase.from('settings').select('*'),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (skusRes.error) throw skusRes.error;
      if (settingsRes.error) throw settingsRes.error;

      setCustomers(customersRes.data || []);
      const skusWithTiers = (skusRes.data || []).map(sku => ({
        ...sku,
        pricing_tiers: sku.pricing_tiers?.sort((a: PricingTier, b: PricingTier) => a.min_quantity - b.min_quantity) || []
      }));
      setSKUs(skusWithTiers);

      const kitSizeSetting = settingsRes.data?.find(s => s.key === 'kit_size');
      const depositSetting = settingsRes.data?.find(s => s.key === 'default_deposit_percent');
      
      if (kitSizeSetting) setKitSize(parseInt(kitSizeSetting.value));
      if (depositSetting) setDepositPercent(parseInt(depositSetting.value));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getPriceForQuantity = (sku: SKU, quantity: number): number => {
    if (!sku.pricing_tiers || sku.pricing_tiers.length === 0) {
      return sku.price_per_kit;
    }

    const tier = sku.pricing_tiers.find(t => 
      quantity >= t.min_quantity && (t.max_quantity === null || quantity <= t.max_quantity)
    );

    return tier ? tier.price_per_kit : sku.price_per_kit;
  };

  const addLine = () => {
    if (skus.length === 0) {
      toast({
        title: 'No products',
        description: 'Please add SKUs first',
        variant: 'destructive',
      });
      return;
    }

    const firstSKU = skus[0];
    const kitQty = 1;
    const unitPrice = getPriceForQuantity(firstSKU, kitQty);
    const newLine: OrderLine = {
      sku_id: firstSKU.id,
      sku_code: firstSKU.code,
      sku_description: firstSKU.description,
      sell_mode: 'kit',
      qty_entered: kitQty,
      unit_price: unitPrice,
      line_subtotal: unitPrice,
      bottle_qty: kitSize,
    };
    setLines([...lines, newLine]);
  };

  const updateLine = (index: number, field: keyof OrderLine, value: any) => {
    const newLines = [...lines];
    const line = { ...newLines[index] };

    if (field === 'sku_id') {
      const sku = skus.find(s => s.id === value);
      if (sku) {
        line.sku_id = sku.id;
        line.sku_code = sku.code;
        line.sku_description = sku.description;
        if (line.sell_mode === 'kit') {
          line.unit_price = getPriceForQuantity(sku, line.qty_entered);
        } else {
          line.unit_price = sku.price_per_piece;
        }
      }
    } else if (field === 'sell_mode') {
      const sku = skus.find(s => s.id === line.sku_id);
      if (sku) {
        line.sell_mode = value as 'kit' | 'piece';
        if (value === 'kit') {
          line.unit_price = getPriceForQuantity(sku, line.qty_entered);
        } else {
          line.unit_price = sku.price_per_piece;
        }
      }
    } else if (field === 'qty_entered') {
      line.qty_entered = parseInt(value) || 0;
      // Update price based on quantity tier for kit mode
      if (line.sell_mode === 'kit') {
        const sku = skus.find(s => s.id === line.sku_id);
        if (sku) {
          line.unit_price = getPriceForQuantity(sku, line.qty_entered);
        }
      }
    }

    // Recalculate
    line.bottle_qty = line.sell_mode === 'kit' 
      ? line.qty_entered * kitSize 
      : line.qty_entered;
    line.line_subtotal = line.qty_entered * line.unit_price;

    newLines[index] = line;
    setLines(newLines);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return lines.reduce((sum, line) => sum + line.line_subtotal, 0);
  };

  const calculateTotalBottles = () => {
    return lines.reduce((sum, line) => sum + line.bottle_qty, 0);
  };

  const generateOrderUID = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    const uid = `ORD-${year}${month}${day}-${random}`;
    const humanUid = uid;
    
    return { uid, humanUid };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer) {
      toast({
        title: 'Error',
        description: 'Please select a customer',
        variant: 'destructive',
      });
      return;
    }

    if (lines.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one line item',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const subtotal = calculateSubtotal();
      const { uid, humanUid } = generateOrderUID();
      const depositAmount = depositRequired ? (subtotal * depositPercent / 100) : 0;

      // Insert order
      const { data: orderData, error: orderError } = await supabase
        .from('sales_orders')
        .insert([{
          uid,
          human_uid: humanUid,
          customer_id: selectedCustomer,
          status: 'draft',
          subtotal,
          deposit_required: depositRequired,
          deposit_amount: depositAmount,
          deposit_status: depositRequired ? 'unpaid' : 'paid',
          label_required: labelRequired,
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert lines
      const lineInserts = lines.map(line => ({
        so_id: orderData.id,
        sku_id: line.sku_id,
        sell_mode: line.sell_mode,
        qty_entered: line.qty_entered,
        bottle_qty: line.bottle_qty,
        unit_price: line.unit_price,
        line_subtotal: line.line_subtotal,
      }));

      const { error: linesError } = await supabase
        .from('sales_order_lines')
        .insert(lineInserts);

      if (linesError) throw linesError;

      // Audit log
      await supabase.from('audit_log').insert([{
        action: 'create',
        entity: 'sales_order',
        entity_id: orderData.id,
        after: { order_uid: humanUid, status: 'draft' },
      }]);

      toast({
        title: 'Success',
        description: `Order ${humanUid} created successfully`,
      });

      navigate(`/orders/${orderData.id}`);
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Order</h1>
          <p className="text-muted-foreground mt-1">Create a new sales order</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
            <CardDescription>Select customer and configure deposit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer} required>
                  <SelectTrigger id="customer">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="deposit">Deposit Required</Label>
                  <Switch
                    id="deposit"
                    checked={depositRequired}
                    onCheckedChange={setDepositRequired}
                  />
                </div>
                {depositRequired && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={depositPercent}
                      onChange={(e) => setDepositPercent(parseInt(e.target.value) || 0)}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="labels">Labels Required</Label>
                <Switch
                  id="labels"
                  checked={labelRequired}
                  onCheckedChange={setLabelRequired}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Line Items</CardTitle>
                <CardDescription>
                  Add products to this order (Kit size: {kitSize} bottles)
                </CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={addLine}>
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No line items yet. Click "Add Line" to start.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Bottles</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select
                          value={line.sku_id}
                          onValueChange={(value) => updateLine(index, 'sku_id', value)}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {skus.map((sku) => (
                              <SelectItem key={sku.id} value={sku.id}>
                                {sku.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={line.sell_mode}
                          onValueChange={(value) => updateLine(index, 'sell_mode', value)}
                        >
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
                          min="1"
                          value={line.qty_entered}
                          onChange={(e) => updateLine(index, 'qty_entered', e.target.value)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell className="font-mono">{line.bottle_qty}</TableCell>
                      <TableCell>${line.unit_price.toFixed(2)}</TableCell>
                      <TableCell className="font-medium">${line.line_subtotal.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {lines.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Bottles:</span>
                  <span className="font-mono font-medium">{calculateTotalBottles()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
                </div>
                {depositRequired && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deposit ({depositPercent}%):</span>
                    <span className="font-medium text-warning">
                      ${(calculateSubtotal() * depositPercent / 100).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t flex justify-between">
                  <span className="font-semibold">Order Total:</span>
                  <span className="text-xl font-bold">${calculateSubtotal().toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate('/orders')}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || lines.length === 0}>
            {loading ? 'Creating...' : 'Create Order'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default OrderNew;