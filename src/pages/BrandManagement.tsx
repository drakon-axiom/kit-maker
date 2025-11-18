import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Save, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Brand {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  primary_color: string;
  primary_foreground: string;
  is_default: boolean;
  active: boolean;
}

const BrandManagement = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBrand, setEditingBrand] = useState<Partial<Brand> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchBrands = async () => {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .order('is_default', { ascending: false });

    if (error) {
      toast.error('Failed to load brands');
      return;
    }
    setBrands(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const handleSaveBrand = async () => {
    if (!editingBrand?.name || !editingBrand?.slug) {
      toast.error('Name and slug are required');
      return;
    }

    const brandData = {
      name: editingBrand.name,
      slug: editingBrand.slug,
      domain: editingBrand.domain || null,
      logo_url: editingBrand.logo_url || null,
      primary_color: editingBrand.primary_color || '222.2 84% 4.9%',
      primary_foreground: editingBrand.primary_foreground || '210 40% 98%',
      is_default: editingBrand.is_default || false,
      active: editingBrand.active !== false,
    };

    if (editingBrand.id) {
      const { error } = await supabase
        .from('brands')
        .update(brandData)
        .eq('id', editingBrand.id);

      if (error) {
        toast.error('Failed to update brand');
        return;
      }
      toast.success('Brand updated successfully');
    } else {
      const { error } = await supabase
        .from('brands')
        .insert([brandData]);

      if (error) {
        toast.error('Failed to create brand');
        return;
      }
      toast.success('Brand created successfully');
    }

    setDialogOpen(false);
    setEditingBrand(null);
    fetchBrands();
  };

  const handleDeleteBrand = async (id: string) => {
    if (!confirm('Are you sure you want to delete this brand?')) return;

    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete brand');
      return;
    }

    toast.success('Brand deleted successfully');
    fetchBrands();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Loading brands...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Brand Management</h1>
          <p className="text-muted-foreground">Manage your business brands and their visual identity</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingBrand({})}>
              <Plus className="h-4 w-4 mr-2" />
              Add Brand
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingBrand?.id ? 'Edit Brand' : 'Create New Brand'}</DialogTitle>
              <DialogDescription>
                Configure the brand identity including colors and logo
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Brand Name</Label>
                <Input
                  id="name"
                  value={editingBrand?.name || ''}
                  onChange={(e) => setEditingBrand({ ...editingBrand, name: e.target.value })}
                  placeholder="Axiom Collective"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  value={editingBrand?.slug || ''}
                  onChange={(e) => setEditingBrand({ ...editingBrand, slug: e.target.value })}
                  placeholder="axiom-collective"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="domain">Custom Domain</Label>
                <Input
                  id="domain"
                  value={editingBrand?.domain || ''}
                  onChange={(e) => setEditingBrand({ ...editingBrand, domain: e.target.value })}
                  placeholder="nexusaminos.com"
                />
                <p className="text-xs text-muted-foreground">
                  Custom domain for this brand (optional). Set up CNAME record to point to portal.axc.llc
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="logo">Logo URL</Label>
                <Input
                  id="logo"
                  value={editingBrand?.logo_url || ''}
                  onChange={(e) => setEditingBrand({ ...editingBrand, logo_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="primary">Primary Color (HSL)</Label>
                  <Input
                    id="primary"
                    value={editingBrand?.primary_color || ''}
                    onChange={(e) => setEditingBrand({ ...editingBrand, primary_color: e.target.value })}
                    placeholder="222.2 84% 4.9%"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="primary-fg">Primary Foreground (HSL)</Label>
                  <Input
                    id="primary-fg"
                    value={editingBrand?.primary_foreground || ''}
                    onChange={(e) => setEditingBrand({ ...editingBrand, primary_foreground: e.target.value })}
                    placeholder="210 40% 98%"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="default"
                  checked={editingBrand?.is_default || false}
                  onCheckedChange={(checked) => setEditingBrand({ ...editingBrand, is_default: checked })}
                />
                <Label htmlFor="default">Set as Default Brand</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={editingBrand?.active !== false}
                  onCheckedChange={(checked) => setEditingBrand({ ...editingBrand, active: checked })}
                />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveBrand}>
                <Save className="h-4 w-4 mr-2" />
                Save Brand
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => (
          <Card key={brand.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{brand.name}</CardTitle>
                  <CardDescription>/{brand.slug}</CardDescription>
                </div>
                {brand.is_default && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                    Default
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {brand.logo_url && (
                <img src={brand.logo_url} alt={brand.name} className="h-12 mb-4 object-contain" />
              )}
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setEditingBrand(brand);
                    setDialogOpen(true);
                  }}
                >
                  Edit
                </Button>
                {!brand.is_default && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteBrand(brand.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default BrandManagement;