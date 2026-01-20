import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Package, Printer, Download } from 'lucide-react';
import { toast } from 'sonner';

interface BoxPreset {
  id: string;
  name: string;
  length_inches: number;
  width_inches: number;
  height_inches: number;
  weight_oz: number | null;
  is_default: boolean;
}

interface ShipStationLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  onSuccess?: () => void;
}

export function ShipStationLabelDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  onSuccess,
}: ShipStationLabelDialogProps) {
  const [loading, setLoading] = useState(false);
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [boxPresets, setBoxPresets] = useState<BoxPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [dimensions, setDimensions] = useState({
    length: '',
    width: '',
    height: '',
  });
  const [weightLbs, setWeightLbs] = useState('');
  const [weightOz, setWeightOz] = useState('');
  const [labelResult, setLabelResult] = useState<{
    trackingNumber: string;
    carrier: string;
    labelUrl: string | null;
  } | null>(null);

  useEffect(() => {
    if (open) {
      fetchBoxPresets();
      setLabelResult(null);
    }
  }, [open]);

  const fetchBoxPresets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('box_presets')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;

      setBoxPresets(data || []);

      // Set default preset
      const defaultPreset = data?.find(p => p.is_default);
      if (defaultPreset) {
        setSelectedPreset(defaultPreset.id);
        applyPreset(defaultPreset);
      }
    } catch (error) {
      console.error('Error fetching box presets:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset: BoxPreset) => {
    setDimensions({
      length: preset.length_inches.toString(),
      width: preset.width_inches.toString(),
      height: preset.height_inches.toString(),
    });
    if (preset.weight_oz) {
      const lbs = Math.floor(preset.weight_oz / 16);
      const oz = preset.weight_oz % 16;
      setWeightLbs(lbs > 0 ? lbs.toString() : '');
      setWeightOz(oz > 0 ? oz.toString() : preset.weight_oz < 16 ? preset.weight_oz.toString() : '');
    }
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    if (presetId === 'custom') {
      setDimensions({ length: '', width: '', height: '' });
      setWeightLbs('');
      setWeightOz('');
    } else {
      const preset = boxPresets.find(p => p.id === presetId);
      if (preset) {
        applyPreset(preset);
      }
    }
  };

  const handleCreateLabel = async () => {
    const lengthNum = parseFloat(dimensions.length);
    const widthNum = parseFloat(dimensions.width);
    const heightNum = parseFloat(dimensions.height);
    const lbsNum = parseFloat(weightLbs) || 0;
    const ozNum = parseFloat(weightOz) || 0;
    const totalWeightOz = (lbsNum * 16) + ozNum;

    if (!lengthNum || !widthNum || !heightNum || totalWeightOz <= 0) {
      toast.error('Please fill in all dimensions and weight');
      return;
    }

    if (lengthNum <= 0 || widthNum <= 0 || heightNum <= 0) {
      toast.error('All dimension values must be greater than 0');
      return;
    }

    setCreatingLabel(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-shipstation-label', {
        body: {
          orderId,
          dimensions: {
            length: lengthNum,
            width: widthNum,
            height: heightNum,
          },
          weightOz: totalWeightOz,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.details || data.error);
      }

      setLabelResult({
        trackingNumber: data.trackingNumber,
        carrier: data.carrier,
        labelUrl: data.labelUrl,
      });

      toast.success(`Label created! Tracking: ${data.trackingNumber}`);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating label:', error);
      toast.error(error.message || 'Failed to create shipping label');
    } finally {
      setCreatingLabel(false);
    }
  };

  const handleDownloadLabel = () => {
    if (labelResult?.labelUrl) {
      const link = document.createElement('a');
      link.href = labelResult.labelUrl;
      link.download = `label-${orderNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePrintLabel = () => {
    if (labelResult?.labelUrl) {
      const printWindow = window.open(labelResult.labelUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create Shipping Label
          </DialogTitle>
          <DialogDescription>
            Create a ShipStation shipping label for order {orderNumber}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : labelResult ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-green-50 border-green-200 p-4 space-y-2">
              <p className="font-medium text-green-800">Label Created Successfully!</p>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Carrier:</span> {labelResult.carrier}</p>
                <p><span className="text-muted-foreground">Tracking:</span> {labelResult.trackingNumber}</p>
              </div>
            </div>
            
            {labelResult.labelUrl && (
              <div className="flex gap-2">
                <Button onClick={handleDownloadLabel} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download Label
                </Button>
                <Button variant="outline" onClick={handlePrintLabel} className="flex-1">
                  <Printer className="h-4 w-4 mr-2" />
                  Print Label
                </Button>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Box Size Preset</Label>
              <Select value={selectedPreset} onValueChange={handlePresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a box size..." />
                </SelectTrigger>
                <SelectContent>
                  {boxPresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name} ({preset.length_inches}" × {preset.width_inches}" × {preset.height_inches}")
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom Dimensions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="length">Length (in)</Label>
                <Input
                  id="length"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="12"
                  value={dimensions.length}
                  onChange={(e) => setDimensions(prev => ({ ...prev, length: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="width">Width (in)</Label>
                <Input
                  id="width"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="10"
                  value={dimensions.width}
                  onChange={(e) => setDimensions(prev => ({ ...prev, width: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height (in)</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="6"
                  value={dimensions.height}
                  onChange={(e) => setDimensions(prev => ({ ...prev, height: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Weight</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="weightLbs" className="text-xs text-muted-foreground">Pounds (lbs)</Label>
                  <Input
                    id="weightLbs"
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={weightLbs}
                    onChange={(e) => setWeightLbs(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="weightOz" className="text-xs text-muted-foreground">Ounces (oz)</Label>
                  <Input
                    id="weightOz"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    value={weightOz}
                    onChange={(e) => setWeightOz(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateLabel} disabled={creatingLabel}>
                {creatingLabel && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Label
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
