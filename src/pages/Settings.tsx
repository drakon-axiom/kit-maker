import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { SMSTemplateManager } from '@/components/SMSTemplateManager';

interface Setting {
  key: string;
  value: string;
  description: string | null;
}

const Settings = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
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
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
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
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadLogo = async () => {
    if (!logoFile) return;

    setUploadingLogo(true);
    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `logos/company-logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, logoFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      await handleSave('company_logo_url', publicUrl);
      setSettings(prev => ({ ...prev, company_logo_url: publicUrl }));
      setLogoFile(null);

      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };


  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">Configure system-wide settings</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Company Name</CardTitle>
              <CardDescription>Your company name shown in emails and documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    type="text"
                    value={settings.company_name || ''}
                    onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                    placeholder="Enter your company name"
                  />
                </div>
                <Button 
                  onClick={() => handleSave('company_name', settings.company_name)}
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

          <Card>
            <CardHeader>
              <CardTitle>Quote Expiration</CardTitle>
              <CardDescription>Default number of days until quotes expire</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="default_quote_expiration_days">Days Until Expiration</Label>
                  <Input
                    id="default_quote_expiration_days"
                    type="number"
                    min="1"
                    max="365"
                    value={settings.default_quote_expiration_days || '7'}
                    onChange={(e) => setSettings({ ...settings, default_quote_expiration_days: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Can be overridden per customer or per order
                  </p>
                </div>
                <Button 
                  onClick={() => handleSave('default_quote_expiration_days', settings.default_quote_expiration_days)}
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

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Company Logo</CardTitle>
              <CardDescription>Upload a logo for quote email header</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {settings.company_logo_url && (
                  <div className="flex items-center gap-4">
                    <img 
                      src={settings.company_logo_url} 
                      alt="Company logo" 
                      className="h-16 object-contain border rounded p-2"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSettings(prev => ({ ...prev, company_logo_url: '' }));
                        handleSave('company_logo_url', '');
                      }}
                    >
                      Remove Logo
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  />
                  <Button 
                    onClick={handleUploadLogo} 
                    disabled={!logoFile || uploadingLogo}
                    size="sm"
                  >
                    {uploadingLogo ? "Uploading..." : "Upload"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  PNG, JPG, or WEBP (max 2MB). Logo replaces company name in email header.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* SMS Templates */}
          <div className="md:col-span-2">
            <SMSTemplateManager />
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;