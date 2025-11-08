import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Loader2, Trash2, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface PricingTier {
  id?: string;
  min_quantity: number;
  max_quantity: number | null;
  price_per_kit: number;
}

interface SKU {
  id: string;
  code: string;
  description: string;
  label_required: boolean;
  price_per_kit: number;
  price_per_piece: number;
  active: boolean;
  use_tier_pricing: boolean;
  created_at: string;
  pricing_tiers?: PricingTier[];
}

const SKUs = () => {
  const [skus, setSKUs] = useState<SKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSKU, setEditingSKU] = useState<SKU | null>(null);
  const [selectedSKUs, setSelectedSKUs] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkFormData, setBulkFormData] = useState({
    active: true,
    label_required: false,
    price_per_piece: '',
  });
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    label_required: false,
    price_per_kit: '',
    price_per_piece: '',
    active: true,
    use_tier_pricing: false,
  });
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([
    { min_quantity: 5, max_quantity: 10, price_per_kit: 0 },
    { min_quantity: 11, max_quantity: 25, price_per_kit: 0 },
    { min_quantity: 26, max_quantity: 50, price_per_kit: 0 },
    { min_quantity: 51, max_quantity: 99, price_per_kit: 0 },
    { min_quantity: 100, max_quantity: null, price_per_kit: 0 },
  ]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchSKUs();
  }, []);

  const fetchSKUs = async () => {
    try {
      const { data, error } = await supabase
        .from('skus')
        .select(`
          *,
          pricing_tiers:sku_pricing_tiers(*)
        `)
        .order('code');

      if (error) throw error;
      const skusWithTiers = (data || []).map(sku => ({
        ...sku,
        pricing_tiers: sku.pricing_tiers?.sort((a: PricingTier, b: PricingTier) => a.min_quantity - b.min_quantity) || []
      }));
      setSKUs(skusWithTiers);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        code: formData.code,
        description: formData.description,
        label_required: formData.label_required,
        price_per_kit: parseFloat(formData.price_per_kit),
        price_per_piece: parseFloat(formData.price_per_piece),
        active: formData.active,
        use_tier_pricing: formData.use_tier_pricing,
      };

      let skuId = editingSKU?.id;

      if (editingSKU) {
        const { error } = await supabase
          .from('skus')
          .update(payload)
          .eq('id', editingSKU.id);

        if (error) throw error;

        // Delete existing tiers
        await supabase
          .from('sku_pricing_tiers')
          .delete()
          .eq('sku_id', editingSKU.id);
        
        skuId = editingSKU.id;
      } else {
        const { data, error } = await supabase
          .from('skus')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        skuId = data.id;
      }

      // Insert pricing tiers only if tier pricing is enabled
      if (formData.use_tier_pricing) {
        const tierInserts = pricingTiers.map(tier => ({
          sku_id: skuId,
          min_quantity: tier.min_quantity,
          max_quantity: tier.max_quantity,
          price_per_kit: tier.price_per_kit,
        }));

        const { error: tiersError } = await supabase
          .from('sku_pricing_tiers')
          .insert(tierInserts);

        if (tiersError) throw tiersError;
      }

      toast({ 
        title: 'Success', 
        description: editingSKU ? 'SKU updated successfully' : 'SKU created successfully' 
      });

      setDialogOpen(false);
      resetForm();
      fetchSKUs();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedSKUs.size === 0) {
      toast({
        title: 'No SKUs selected',
        description: 'Please select at least one SKU to update',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const updates: any = {
        active: bulkFormData.active,
        label_required: bulkFormData.label_required,
      };

      if (bulkFormData.price_per_piece) {
        updates.price_per_piece = parseFloat(bulkFormData.price_per_piece);
      }

      const updatePromises = Array.from(selectedSKUs).map(skuId =>
        supabase.from('skus').update(updates).eq('id', skuId)
      );

      const results = await Promise.all(updatePromises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} SKU(s)`);
      }

      toast({
        title: 'Success',
        description: `Updated ${selectedSKUs.size} SKU(s) successfully`,
      });

      setBulkEditOpen(false);
      setSelectedSKUs(new Set());
      setBulkFormData({
        active: true,
        label_required: false,
        price_per_piece: '',
      });
      fetchSKUs();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleSelectSKU = (skuId: string) => {
    const newSelected = new Set(selectedSKUs);
    if (newSelected.has(skuId)) {
      newSelected.delete(skuId);
    } else {
      newSelected.add(skuId);
    }
    setSelectedSKUs(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedSKUs.size === skus.length) {
      setSelectedSKUs(new Set());
    } else {
      setSelectedSKUs(new Set(skus.map(s => s.id)));
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      label_required: false,
      price_per_kit: '',
      price_per_piece: '',
      active: true,
      use_tier_pricing: false,
    });
    setPricingTiers([
      { min_quantity: 5, max_quantity: 10, price_per_kit: 0 },
      { min_quantity: 11, max_quantity: 25, price_per_kit: 0 },
      { min_quantity: 26, max_quantity: 50, price_per_kit: 0 },
      { min_quantity: 51, max_quantity: 99, price_per_kit: 0 },
      { min_quantity: 100, max_quantity: null, price_per_kit: 0 },
    ]);
    setEditingSKU(null);
  };

  const openEditDialog = (sku: SKU) => {
    setEditingSKU(sku);
    setFormData({
      code: sku.code,
      description: sku.description,
      label_required: sku.label_required,
      price_per_kit: sku.price_per_kit.toString(),
      price_per_piece: sku.price_per_piece.toString(),
      active: sku.active,
      use_tier_pricing: sku.use_tier_pricing,
    });
    
    // Load pricing tiers or use defaults
    if (sku.pricing_tiers && sku.pricing_tiers.length > 0) {
      setPricingTiers(sku.pricing_tiers.map(t => ({
        id: t.id,
        min_quantity: t.min_quantity,
        max_quantity: t.max_quantity,
        price_per_kit: t.price_per_kit
      })));
    } else {
      // Reset to defaults if no tiers
      setPricingTiers([
        { min_quantity: 5, max_quantity: 10, price_per_kit: 0 },
        { min_quantity: 11, max_quantity: 25, price_per_kit: 0 },
        { min_quantity: 26, max_quantity: 50, price_per_kit: 0 },
        { min_quantity: 51, max_quantity: 99, price_per_kit: 0 },
        { min_quantity: 100, max_quantity: null, price_per_kit: 0 },
      ]);
    }
    
    setDialogOpen(true);
  };

  const updateTier = (index: number, field: keyof PricingTier, value: any) => {
    const newTiers = [...pricingTiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setPricingTiers(newTiers);
  };

  const addTier = () => {
    const lastTier = pricingTiers[pricingTiers.length - 1];
    const newMin = lastTier.max_quantity ? lastTier.max_quantity + 1 : 100;
    setPricingTiers([...pricingTiers, {
      min_quantity: newMin,
      max_quantity: newMin + 10,
      price_per_kit: 0
    }]);
  };

  const removeTier = (index: number) => {
    setPricingTiers(pricingTiers.filter((_, i) => i !== index));
  };

  const toggleRow = (skuId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(skuId)) {
      newExpanded.delete(skuId);
    } else {
      newExpanded.add(skuId);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products (SKUs)</h1>
          <p className="text-muted-foreground mt-1">Manage your product catalog</p>
        </div>
        <div className="flex gap-2">
          {selectedSKUs.size > 0 && (
            <Button variant="outline" onClick={() => setBulkEditOpen(true)}>
              <Check className="mr-2 h-4 w-4" />
              Edit {selectedSKUs.size} Selected
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add SKU
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSKU ? 'Edit SKU' : 'Add New SKU'}</DialogTitle>
              <DialogDescription>
                {editingSKU ? 'Update product information' : 'Add a new product to your catalog'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">SKU Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., PROD-001"
                    required
                  />
                </div>
                <div className="space-y-2 flex items-end">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="active"
                      checked={formData.active}
                      onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                    />
                    <Label htmlFor="active">Active</Label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Product description"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {!formData.use_tier_pricing && (
                  <div className="space-y-2">
                    <Label htmlFor="price_per_kit">Price per Kit ($) *</Label>
                    <Input
                      id="price_per_kit"
                      type="number"
                      step="0.01"
                      value={formData.price_per_kit}
                      onChange={(e) => setFormData({ ...formData, price_per_kit: e.target.value })}
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="price_per_piece">Price per Piece ($) *</Label>
                  <Input
                    id="price_per_piece"
                    type="number"
                    step="0.01"
                    value={formData.price_per_piece}
                    onChange={(e) => setFormData({ ...formData, price_per_piece: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="use_tier_pricing">Use Tier Pricing</Label>
                  <Switch
                    id="use_tier_pricing"
                    checked={formData.use_tier_pricing}
                    onCheckedChange={(checked) => setFormData({ ...formData, use_tier_pricing: checked })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enable quantity-based pricing tiers for bulk orders
                </p>
              </div>
              
              {formData.use_tier_pricing && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Kit Pricing Tiers *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addTier}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Tier
                  </Button>
                </div>
                <div className="space-y-2">
                  {pricingTiers.map((tier, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Min Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={tier.min_quantity}
                          onChange={(e) => updateTier(index, 'min_quantity', parseInt(e.target.value) || 0)}
                          required
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Max Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Unlimited"
                          value={tier.max_quantity || ''}
                          onChange={(e) => updateTier(index, 'max_quantity', e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </div>
                      <div className="col-span-5 space-y-1">
                        <Label className="text-xs">Price per Kit ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tier.price_per_kit}
                          onChange={(e) => updateTier(index, 'price_per_kit', parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>
                      <div className="col-span-1">
                        {pricingTiers.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTier(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}
              <div className="flex items-center space-x-2">
                <Switch
                  id="label_required"
                  checked={formData.label_required}
                  onCheckedChange={(checked) => setFormData({ ...formData, label_required: checked })}
                />
                <Label htmlFor="label_required">Label Required</Label>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingSKU ? 'Update' : 'Create'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Products</CardTitle>
          <CardDescription>
            {skus.length} product{skus.length !== 1 ? 's' : ''} in catalog
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : skus.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No products yet. Click "Add SKU" to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedSKUs.size === skus.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Piece Price</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skus.map((sku) => (
                  <>
                    <TableRow key={sku.id} className="cursor-pointer" onClick={() => toggleRow(sku.id)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedSKUs.has(sku.id)}
                          onCheckedChange={() => toggleSelectSKU(sku.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          {expandedRows.has(sku.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono font-medium">{sku.code}</TableCell>
                      <TableCell className="max-w-xs truncate">{sku.description}</TableCell>
                      <TableCell>${sku.price_per_piece.toFixed(2)}</TableCell>
                      <TableCell>
                        {sku.label_required ? (
                          <Badge variant="secondary">Required</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {sku.active ? (
                          <Badge className="bg-success">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(sku)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(sku.id) && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/50">
                          <div className="py-2 px-4">
                            {sku.use_tier_pricing ? (
                              <>
                                <div className="text-sm font-semibold mb-2">Kit Pricing Tiers:</div>
                                <div className="grid grid-cols-4 gap-4">
                                  {sku.pricing_tiers && sku.pricing_tiers.length > 0 ? (
                                    sku.pricing_tiers.map((tier, idx) => (
                                      <div key={idx} className="bg-background p-3 rounded-md border">
                                        <div className="text-xs text-muted-foreground mb-1">
                                          {tier.min_quantity} - {tier.max_quantity || '∞'} kits
                                        </div>
                                        <div className="text-lg font-semibold">
                                          ${tier.price_per_kit.toFixed(2)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">per kit</div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-sm text-muted-foreground">No pricing tiers configured</div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                Standard pricing: ${sku.price_per_kit.toFixed(2)} per kit (no tiers)
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Edit SKUs</DialogTitle>
            <DialogDescription>
              Update {selectedSKUs.size} selected SKU(s) at once
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="bulk_active">Active Status</Label>
              <Switch
                id="bulk_active"
                checked={bulkFormData.active}
                onCheckedChange={(checked) => setBulkFormData({ ...bulkFormData, active: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="bulk_label">Label Required</Label>
              <Switch
                id="bulk_label"
                checked={bulkFormData.label_required}
                onCheckedChange={(checked) => setBulkFormData({ ...bulkFormData, label_required: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk_price">Price per Piece ($)</Label>
              <Input
                id="bulk_price"
                type="number"
                step="0.01"
                placeholder="Leave empty to keep existing prices"
                value={bulkFormData.price_per_piece}
                onChange={(e) => setBulkFormData({ ...bulkFormData, price_per_piece: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to keep existing prices unchanged
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setBulkEditOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleBulkUpdate} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update All'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SKUs;