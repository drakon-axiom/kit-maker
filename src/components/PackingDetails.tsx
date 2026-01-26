import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface OrderPackage {
  id: string;
  so_id: string;
  package_number: number;
  length_inches: number;
  width_inches: number;
  height_inches: number;
  weight_oz: number;
  item_count: number;
  notes: string | null;
}

interface BoxPreset {
  id: string;
  name: string;
  length_inches: number;
  width_inches: number;
  height_inches: number;
  weight_oz: number | null;
}

interface PackingDetailsProps {
  orderId: string;
  totalItems: number;
  onPackagesChange?: () => void;
}

export function PackingDetails({ orderId, totalItems, onPackagesChange }: PackingDetailsProps) {
  const { toast } = useToast();
  const [packages, setPackages] = useState<OrderPackage[]>([]);
  const [boxPresets, setBoxPresets] = useState<BoxPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchPackages();
    fetchBoxPresets();
  }, [orderId]);

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('order_packages')
        .select('*')
        .eq('so_id', orderId)
        .order('package_number');

      if (error) throw error;
      setPackages(data || []);
    } catch (error) {
      console.error('Error fetching packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBoxPresets = async () => {
    try {
      const { data, error } = await supabase
        .from('box_presets')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setBoxPresets(data || []);
    } catch (error) {
      console.error('Error fetching box presets:', error);
    }
  };

  const addPackage = async () => {
    const nextNumber = packages.length + 1;
    const defaultPreset = boxPresets.find(p => p.name.toLowerCase().includes('default')) || boxPresets[0];

    try {
      const { data, error } = await supabase
        .from('order_packages')
        .insert({
          so_id: orderId,
          package_number: nextNumber,
          length_inches: defaultPreset?.length_inches || 0,
          width_inches: defaultPreset?.width_inches || 0,
          height_inches: defaultPreset?.height_inches || 0,
          weight_oz: defaultPreset?.weight_oz || 0,
          item_count: 0,
        })
        .select()
        .single();

      if (error) throw error;

      setPackages([...packages, data]);
      onPackagesChange?.();
      toast({
        title: 'Package Added',
        description: `Package #${nextNumber} added`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add package',
        variant: 'destructive',
      });
    }
  };

  const updatePackage = async (pkg: OrderPackage) => {
    setSaving(pkg.id);
    try {
      const { error } = await supabase
        .from('order_packages')
        .update({
          length_inches: pkg.length_inches,
          width_inches: pkg.width_inches,
          height_inches: pkg.height_inches,
          weight_oz: pkg.weight_oz,
          item_count: pkg.item_count,
          notes: pkg.notes,
        })
        .eq('id', pkg.id);

      if (error) throw error;

      onPackagesChange?.();
      toast({
        title: 'Package Updated',
        description: `Package #${pkg.package_number} saved`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update package',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const deletePackage = async (pkg: OrderPackage) => {
    try {
      const { error } = await supabase
        .from('order_packages')
        .delete()
        .eq('id', pkg.id);

      if (error) throw error;

      // Refetch to renumber
      fetchPackages();
      onPackagesChange?.();
      toast({
        title: 'Package Removed',
        description: `Package #${pkg.package_number} deleted`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete package',
        variant: 'destructive',
      });
    }
  };

  const applyPreset = (pkg: OrderPackage, presetId: string) => {
    const preset = boxPresets.find(p => p.id === presetId);
    if (!preset) return;

    const updated = packages.map(p => 
      p.id === pkg.id 
        ? {
            ...p,
            length_inches: preset.length_inches,
            width_inches: preset.width_inches,
            height_inches: preset.height_inches,
            weight_oz: preset.weight_oz || p.weight_oz,
          }
        : p
    );
    setPackages(updated);
  };

  const updateLocalPackage = (id: string, field: keyof OrderPackage, value: number | string | null) => {
    setPackages(packages.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const packedItemCount = packages.reduce((sum, p) => sum + p.item_count, 0);
  const remainingItems = totalItems - packedItemCount;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <CardTitle>Packing Details</CardTitle>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{packedItemCount}</span> / {totalItems} items packed
              {remainingItems > 0 && (
                <Badge variant="outline" className="ml-2">
                  {remainingItems} remaining
                </Badge>
              )}
            </div>
            <Button onClick={addPackage} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Package
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {packages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No packages added yet</p>
            <p className="text-sm">Click "Add Package" to start packing</p>
          </div>
        ) : (
          <div className="space-y-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Package #{pkg.package_number}</h4>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updatePackage(pkg)}
                      disabled={saving === pkg.id}
                    >
                      {saving === pkg.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deletePackage(pkg)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {boxPresets.length > 0 && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Box Preset</Label>
                    <Select onValueChange={(value) => applyPreset(pkg, value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a box preset..." />
                      </SelectTrigger>
                      <SelectContent>
                        {boxPresets.map(preset => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.name} ({preset.length_inches}" x {preset.width_inches}" x {preset.height_inches}")
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor={`length-${pkg.id}`}>Length (in)</Label>
                    <Input
                      id={`length-${pkg.id}`}
                      type="number"
                      step="0.1"
                      min="0"
                      value={pkg.length_inches}
                      onChange={(e) => updateLocalPackage(pkg.id, 'length_inches', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`width-${pkg.id}`}>Width (in)</Label>
                    <Input
                      id={`width-${pkg.id}`}
                      type="number"
                      step="0.1"
                      min="0"
                      value={pkg.width_inches}
                      onChange={(e) => updateLocalPackage(pkg.id, 'width_inches', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`height-${pkg.id}`}>Height (in)</Label>
                    <Input
                      id={`height-${pkg.id}`}
                      type="number"
                      step="0.1"
                      min="0"
                      value={pkg.height_inches}
                      onChange={(e) => updateLocalPackage(pkg.id, 'height_inches', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`weight-${pkg.id}`}>Weight (oz)</Label>
                    <Input
                      id={`weight-${pkg.id}`}
                      type="number"
                      step="0.1"
                      min="0"
                      value={pkg.weight_oz}
                      onChange={(e) => updateLocalPackage(pkg.id, 'weight_oz', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`items-${pkg.id}`}>Items in Package</Label>
                    <Input
                      id={`items-${pkg.id}`}
                      type="number"
                      min="0"
                      max={totalItems}
                      value={pkg.item_count}
                      onChange={(e) => updateLocalPackage(pkg.id, 'item_count', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`notes-${pkg.id}`}>Notes</Label>
                    <Textarea
                      id={`notes-${pkg.id}`}
                      value={pkg.notes || ''}
                      onChange={(e) => updateLocalPackage(pkg.id, 'notes', e.target.value)}
                      placeholder="Optional notes..."
                      rows={1}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
