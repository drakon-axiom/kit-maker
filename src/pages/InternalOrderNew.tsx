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

interface Brand {
  id: string;
  name: string;
  slug: string;
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
  use_tier_pricing: boolean;
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

const InternalOrderNew = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [skus, setSKUs] = useState<SKU[]>([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [labelRequired, setLabelRequired] = useState(true);
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
      const [brandsRes, skusRes, settingsRes] = await Promise.all([
        supabase.from('brands').select('id, name, slug').eq('active', true).order('name'),
        supabase.from('skus').select(`
          *,
          pricing_tiers:sku_pricing_tiers(*)
        `).eq('active', true).order('code'),
        supabase.from('settings').select('*'),
      ]);

      if (brandsRes.error) throw brandsRes.error;
      if (skusRes.error) throw skusRes.error;
      if (settingsRes.error) throw settingsRes.error;

      setBrands(brandsRes.data || []);
      const skusWithTiers = (skusRes.data || []).map(sku => ({
        ...sku,
        pricing_tiers: sku.pricing_tiers?.sort((a: PricingTier, b: PricingTier) => a.min_quantity - b.min_quantity) || []
      }));
      setSKUs(skusWithTiers);

      const kitSizeSetting = settingsRes.data?.find(s => s.key === 'kit_size');
      if (kitSizeSetting) setKitSize(parseInt(kitSizeSetting.value));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getPriceForQuantity = (sku: SKU, quantity: number): number => {
    if (!sku.use_tier_pricing || !sku.pricing_tiers || sku.pricing_tiers.length === 0) {
      return sku.price_per_kit;
    }

    const tier = sku.pricing_tiers.find(t => 
      quantity >= t.min_quantity && (t.max_quantity === null || quantity <= t.max_quantity)
    );

    return tier ? tier.price_per_kit : sku.price_per_kit;
  };

  const addLine = () => {
    if (skus.length === 0) return;
    
    const defaultSKU = skus[0];
    const newLine: OrderLine = {
      sku_id: defaultSKU.id,
      sku_code: defaultSKU.code,
      sku_description: defaultSKU.description,
      sell_mode: 'kit',
      qty_entered: 1,
      unit_price: defaultSKU.price_per_kit,
      line_subtotal: defaultSKU.price_per_kit,
      bottle_qty: kitSize,
    };
    setLines([...lines, newLine]);
  };

  const updateLine = (index: number, field: keyof OrderLine, value: any) => {
    const newLines = [...lines];
    const line = newLines[index];

    if (field === 'sku_id') {
      const sku = skus.find(s => s.id === value);
      if (sku) {
        line.sku_id = sku.id;
        line.sku_code = sku.code;
        line.sku_description = sku.description;
        line.unit_price = sku.price_per_kit;
        line.line_subtotal = line.qty_entered * sku.price_per_kit;
      }
    } else if (field === 'qty_entered') {
      const qty = parseInt(value) || 0;
      line.qty_entered = qty;
      
      const sku = skus.find(s => s.id === line.sku_id);
      if (sku) {
        const pricePerKit = getPriceForQuantity(sku, qty);
        line.unit_price = pricePerKit;
        line.line_subtotal = qty * pricePerKit;
      }
      
      if (line.sell_mode === 'kit') {
        line.bottle_qty = qty * kitSize;
      } else {
        line.bottle_qty = qty;
      }
    } else if (field === 'sell_mode') {
      line.sell_mode = value;
      const sku = skus.find(s => s.id === line.sku_id);
      if (sku) {
        if (value === 'kit') {
          line.unit_price = getPriceForQuantity(sku, line.qty_entered);
          line.bottle_qty = line.qty_entered * kitSize;
        } else {
          line.unit_price = sku.price_per_piece;
          line.bottle_qty = line.qty_entered;
        }
        line.line_subtotal = line.qty_entered * line.unit_price;
      }
    }

    setLines(newLines);
  };

  const removeLine = (index: number) => {
    const newLines = lines.filter((_, i) => i !== index);
    setLines(newLines);
  };

  const calculateSubtotal = () => {
    return lines.reduce((sum, line) => sum + line.line_subtotal, 0);
  };

  const calculateTotalBottles = () => {
    return lines.reduce((sum, line) => sum + line.bottle_qty, 0);
  };

  const generateOrderUID = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `INT-${timestamp}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBrand) {
      toast({
        title: 'Error',
        description: 'Please select a brand',
        variant: 'destructive',
      });
      return;
    }

    if (lines.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one product line',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const uid = generateOrderUID();
      const subtotal = calculateSubtotal();

      // Create internal order
      const { data: order, error: orderError } = await supabase
        .from('sales_orders')
        .insert({
          uid: uid,
          human_uid: uid,
          brand_id: selectedBrand,
          customer_id: null,
          is_internal: true,
          subtotal: subtotal,
          status: 'in_queue',
          label_required: labelRequired,
          deposit_required: false,
          deposit_status: 'paid',
          source_channel: 'internal',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order lines
      const lineInserts = lines.map(line => ({
        so_id: order.id,
        sku_id: line.sku_id,
        sell_mode: line.sell_mode,
        qty_entered: line.qty_entered,
        unit_price: line.unit_price,
        line_subtotal: line.line_subtotal,
        bottle_qty: line.bottle_qty,
      }));

      const { error: linesError } = await supabase
        .from('sales_order_lines')
        .insert(lineInserts);

      if (linesError) throw linesError;

      // Log to audit trail
      await supabase.from('audit_log').insert({
        entity: 'sales_order',
        entity_id: order.id,
        action: 'create_internal',
        after: { order_uid: uid, brand_id: selectedBrand, subtotal },
        actor_id: user.id,
      });

      toast({
        title: 'Success',
        description: `Internal order ${uid} created successfully`,
      });

      navigate(`/orders/${order.id}`);
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
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Internal Order</h1>
          <p className="text-muted-foreground">Create internal production runs for retail stock</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
            <CardDescription>Configure the internal production run</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Brand *</Label>
                <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map(brand => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="label-required"
                  checked={labelRequired}
                  onCheckedChange={setLabelRequired}
                />
                <Label htmlFor="label-required">Label Required</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Lines</CardTitle>
            <CardDescription>Add products to this internal order</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Bottles</TableHead>
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
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {skus.map(sku => (
                            <SelectItem key={sku.id} value={sku.id}>
                              {sku.code} - {sku.description}
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
                        <SelectTrigger className="w-[100px]">
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
                    <TableCell>${line.unit_price.toFixed(2)}</TableCell>
                    <TableCell>{line.bottle_qty}</TableCell>
                    <TableCell>${line.line_subtotal.toFixed(2)}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Button type="button" variant="outline" onClick={addLine}>
              <Plus className="h-4 w-4 mr-2" />
              Add Line
            </Button>

            <div className="flex justify-end space-x-6 pt-4 border-t">
              <div className="space-y-1 text-right">
                <p className="text-sm text-muted-foreground">Total Bottles</p>
                <p className="text-2xl font-bold">{calculateTotalBottles()}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">${calculateSubtotal().toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/orders')}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Internal Order'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default InternalOrderNew;
