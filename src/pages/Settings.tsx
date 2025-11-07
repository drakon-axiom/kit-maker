import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save } from 'lucide-react';

interface Setting {
  key: string;
  value: string;
  description: string | null;
}

const Settings = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*');

      if (error) throw error;
      
      const settingsMap: Record<string, string> = {};
      data?.forEach((setting: Setting) => {
        settingsMap[setting.key] = setting.value;
      });
      setSettings(settingsMap);
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

  const handleSave = async (key: string, value: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('settings')
        .update({ value })
        .eq('key', key);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Setting updated successfully',
      });
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure system-wide settings</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Kit Size</CardTitle>
              <CardDescription>Default number of bottles per kit</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="kit_size">Bottles per Kit</Label>
                  <Input
                    id="kit_size"
                    type="number"
                    min="1"
                    max="500"
                    value={settings.kit_size || '10'}
                    onChange={(e) => setSettings({ ...settings, kit_size: e.target.value })}
                  />
                </div>
                <Button 
                  onClick={() => handleSave('kit_size', settings.kit_size)}
                  disabled={saving}
                  size="sm"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Default Deposit</CardTitle>
              <CardDescription>Default deposit percentage for new orders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="default_deposit_percent">Deposit %</Label>
                  <Input
                    id="default_deposit_percent"
                    type="number"
                    min="0"
                    max="100"
                    value={settings.default_deposit_percent || '50'}
                    onChange={(e) => setSettings({ ...settings, default_deposit_percent: e.target.value })}
                  />
                </div>
                <Button 
                  onClick={() => handleSave('default_deposit_percent', settings.default_deposit_percent)}
                  disabled={saving}
                  size="sm"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Tracking Carriers</CardTitle>
              <CardDescription>Comma-separated list of available shipping carriers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tracking_carriers">Carriers</Label>
                  <Input
                    id="tracking_carriers"
                    value={settings.tracking_carriers || 'USPS,FedEx,UPS,DHL,Other'}
                    onChange={(e) => setSettings({ ...settings, tracking_carriers: e.target.value })}
                    placeholder="USPS,FedEx,UPS,DHL,Other"
                  />
                </div>
                <Button 
                  onClick={() => handleSave('tracking_carriers', settings.tracking_carriers)}
                  disabled={saving}
                  size="sm"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Settings;