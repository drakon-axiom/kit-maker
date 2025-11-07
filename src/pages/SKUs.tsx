import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface SKU {
  id: string;
  code: string;
  description: string;
  label_required: boolean;
  price_per_kit: number;
  price_per_piece: number;
  active: boolean;
  created_at: string;
}

const SKUs = () => {
  const [skus, setSKUs] = useState<SKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSKU, setEditingSKU] = useState<SKU | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    label_required: false,
    price_per_kit: '',
    price_per_piece: '',
    active: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchSKUs();
  }, []);

  const fetchSKUs = async () => {
    try {
      const { data, error } = await supabase
        .from('skus')
        .select('*')
        .order('code');

      if (error) throw error;
      setSKUs(data || []);
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

    try {
      const payload = {
        code: formData.code,
        description: formData.description,
        label_required: formData.label_required,
        price_per_kit: parseFloat(formData.price_per_kit),
        price_per_piece: parseFloat(formData.price_per_piece),
        active: formData.active,
      };

      if (editingSKU) {
        const { error } = await supabase
          .from('skus')
          .update(payload)
          .eq('id', editingSKU.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'SKU updated successfully' });
      } else {
        const { error } = await supabase
          .from('skus')
          .insert([payload]);

        if (error) throw error;
        toast({ title: 'Success', description: 'SKU created successfully' });
      }

      setDialogOpen(false);
      resetForm();
      fetchSKUs();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
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
    });
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
    });
    setDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products (SKUs)</h1>
          <p className="text-muted-foreground mt-1">Manage your product catalog</p>
        </div>
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
          <DialogContent className="max-w-2xl">
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
              <div className="flex items-center space-x-2">
                <Switch
                  id="label_required"
                  checked={formData.label_required}
                  onCheckedChange={(checked) => setFormData({ ...formData, label_required: checked })}
                />
                <Label htmlFor="label_required">Label Required</Label>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingSKU ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Kit Price</TableHead>
                  <TableHead>Piece Price</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skus.map((sku) => (
                  <TableRow key={sku.id}>
                    <TableCell className="font-mono font-medium">{sku.code}</TableCell>
                    <TableCell className="max-w-xs truncate">{sku.description}</TableCell>
                    <TableCell>${sku.price_per_kit.toFixed(2)}</TableCell>
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
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(sku)}
                      >
                        <Pencil className="h-4 w-4" />
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

export default SKUs;