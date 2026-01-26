import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Save, Plus, Pencil, Trash2, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BoxPreset {
  id: string;
  name: string;
  length_inches: number;
  width_inches: number;
  height_inches: number;
  weight_oz: number | null;
  is_default: boolean;
  active: boolean;
}

interface BoxPresetForm {
  name: string;
  length_inches: string;
  width_inches: string;
  height_inches: string;
  weight_oz: string;
  is_default: boolean;
}

const emptyForm: BoxPresetForm = {
  name: '',
  length_inches: '',
  width_inches: '',
  height_inches: '',
  weight_oz: '',
  is_default: false,
};

export function BoxPresetsManager() {
  const [boxPresets, setBoxPresets] = useState<BoxPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<BoxPreset | null>(null);
  const [form, setForm] = useState<BoxPresetForm>(emptyForm);
  const { toast } = useToast();

  const fetchPresets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('box_presets')
        .select('*')
        .order('name');

      if (error) throw error;
      setBoxPresets(data || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load box presets',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const openEditDialog = (preset: BoxPreset) => {
    setEditingPreset(preset);
    setForm({
      name: preset.name,
      length_inches: preset.length_inches.toString(),
      width_inches: preset.width_inches.toString(),
      height_inches: preset.height_inches.toString(),
      weight_oz: preset.weight_oz?.toString() || '',
      is_default: preset.is_default,
    });
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingPreset(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleSavePreset = async () => {
    if (!form.name || !form.length_inches || !form.width_inches || !form.height_inches) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        length_inches: parseFloat(form.length_inches),
        width_inches: parseFloat(form.width_inches),
        height_inches: parseFloat(form.height_inches),
        weight_oz: form.weight_oz ? parseFloat(form.weight_oz) : null,
        is_default: form.is_default,
        active: true,
      };

      // If setting as default, clear other defaults first
      if (form.is_default) {
        await supabase.from('box_presets').update({ is_default: false }).eq('is_default', true);
      }

      if (editingPreset) {
        const { error } = await supabase.from('box_presets').update(payload).eq('id', editingPreset.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('box_presets').insert(payload);
        if (error) throw error;
      }

      toast({ title: 'Success', description: `Box preset ${editingPreset ? 'updated' : 'created'}` });
      setDialogOpen(false);
      fetchPresets();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save preset',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePreset = async (id: string) => {
    if (!confirm('Delete this box preset?')) return;

    try {
      const { error } = await supabase.from('box_presets').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Box preset deleted' });
      fetchPresets();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  const togglePresetActive = async (preset: BoxPreset) => {
    try {
      const { error } = await supabase
        .from('box_presets')
        .update({ active: !preset.active })
        .eq('id', preset.id);
      if (error) throw error;
      fetchPresets();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Box Presets
          </CardTitle>
          <CardDescription>Manage saved box dimensions for quick packing and label creation</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewDialog} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Preset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPreset ? 'Edit Box Preset' : 'New Box Preset'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="preset-name">Name *</Label>
                <Input
                  id="preset-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Small Box, Large Flat Rate"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="preset-length">Length (in) *</Label>
                  <Input
                    id="preset-length"
                    type="number"
                    step="0.1"
                    value={form.length_inches}
                    onChange={(e) => setForm({ ...form, length_inches: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preset-width">Width (in) *</Label>
                  <Input
                    id="preset-width"
                    type="number"
                    step="0.1"
                    value={form.width_inches}
                    onChange={(e) => setForm({ ...form, width_inches: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preset-height">Height (in) *</Label>
                  <Input
                    id="preset-height"
                    type="number"
                    step="0.1"
                    value={form.height_inches}
                    onChange={(e) => setForm({ ...form, height_inches: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preset-weight">Default Weight (oz)</Label>
                <Input
                  id="preset-weight"
                  type="number"
                  step="0.1"
                  value={form.weight_oz}
                  onChange={(e) => setForm({ ...form, weight_oz: e.target.value })}
                  placeholder="Optional - box weight only"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="preset-default"
                  checked={form.is_default}
                  onCheckedChange={(checked) => setForm({ ...form, is_default: checked })}
                />
                <Label htmlFor="preset-default">Set as default box</Label>
              </div>
              <Button onClick={handleSavePreset} disabled={saving} className="w-full">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {editingPreset ? 'Update Preset' : 'Create Preset'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {boxPresets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No box presets yet</p>
            <p className="text-sm">Add presets to quickly apply dimensions when packing</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Dimensions (L×W×H)</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boxPresets.map((preset) => (
                <TableRow key={preset.id}>
                  <TableCell className="font-medium">
                    {preset.name}
                    {preset.is_default && (
                      <Badge variant="secondary" className="ml-2">Default</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {preset.length_inches}" × {preset.width_inches}" × {preset.height_inches}"
                  </TableCell>
                  <TableCell>
                    {preset.weight_oz ? `${preset.weight_oz} oz` : '-'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={preset.active}
                      onCheckedChange={() => togglePresetActive(preset)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(preset)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeletePreset(preset.id)}
                      >
                        <Trash2 className="h-4 w-4" />
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
  );
}
