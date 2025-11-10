import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

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
  const [sendingTest, setSendingTest] = useState(false);
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTest(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("No user email found");

      const { error } = await supabase.functions.invoke('generate-quote', {
        body: { 
          testEmail: user.email,
          testMode: true 
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Test quote email sent to ${user.email}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
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

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Quote Email Template</CardTitle>
              <CardDescription>Customize the appearance and content of quote emails</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Company Name</Label>
                    <Input
                      id="company_name"
                      value={settings.company_name || 'Nexus Aminos'}
                      onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_email">Company Email</Label>
                    <Input
                      id="company_email"
                      type="email"
                      value={settings.company_email || 'info@nexusaminos.com'}
                      onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quote_header_bg_color">Header Background Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="quote_header_bg_color"
                        type="color"
                        value={settings.quote_header_bg_color || '#c2e4fb'}
                        onChange={(e) => setSettings({ ...settings, quote_header_bg_color: e.target.value })}
                        className="w-20 h-10"
                      />
                      <Input
                        value={settings.quote_header_bg_color || '#c2e4fb'}
                        onChange={(e) => setSettings({ ...settings, quote_header_bg_color: e.target.value })}
                        placeholder="#c2e4fb"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quote_header_text_color">Header Text Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="quote_header_text_color"
                        type="color"
                        value={settings.quote_header_text_color || '#000000'}
                        onChange={(e) => setSettings({ ...settings, quote_header_text_color: e.target.value })}
                        className="w-20 h-10"
                      />
                      <Input
                        value={settings.quote_header_text_color || '#000000'}
                        onChange={(e) => setSettings({ ...settings, quote_header_text_color: e.target.value })}
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote_footer_text">Footer Message</Label>
                  <Textarea
                    id="quote_footer_text"
                    value={settings.quote_footer_text || 'We look forward to working with you!'}
                    onChange={(e) => setSettings({ ...settings, quote_footer_text: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button 
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await Promise.all([
                        handleSave('company_name', settings.company_name),
                        handleSave('company_email', settings.company_email),
                        handleSave('quote_header_bg_color', settings.quote_header_bg_color),
                        handleSave('quote_header_text_color', settings.quote_header_text_color),
                        handleSave('quote_footer_text', settings.quote_footer_text),
                      ]);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  size="sm"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Quote Template
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

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Custom HTML Template</CardTitle>
              <CardDescription>Full HTML template customization for quote emails</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="quote_custom_html">HTML Template</Label>
                    <Textarea
                      id="quote_custom_html"
                      value={settings.quote_custom_html || ''}
                      onChange={(e) => setSettings({ ...settings, quote_custom_html: e.target.value })}
                      placeholder="Leave empty to use default template. Available variables: {{company_name}}, {{customer_name}}, {{quote_number}}, {{date}}, {{customer_email}}, {{line_items}}, {{subtotal}}, {{deposit_info}}"
                      className="font-mono text-sm min-h-[400px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Live Preview</Label>
                    <div className="border rounded-md p-4 min-h-[400px] max-h-[400px] overflow-auto bg-muted/30">
                      {settings.quote_custom_html ? (
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: settings.quote_custom_html
                              .replace(/\{\{company_name\}\}/g, settings.company_name || 'Nexus Aminos')
                              .replace(/\{\{customer_name\}\}/g, 'John Doe')
                              .replace(/\{\{quote_number\}\}/g, 'Q-2024-001')
                              .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
                              .replace(/\{\{customer_email\}\}/g, 'customer@example.com')
                              .replace(/\{\{line_items\}\}/g, `
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                  <td style="padding: 12px; text-align: left;">Sample Product</td>
                                  <td style="padding: 12px; text-align: center;">10</td>
                                  <td style="padding: 12px; text-align: right;">$50.00</td>
                                  <td style="padding: 12px; text-align: right;">$500.00</td>
                                </tr>
                              `)
                              .replace(/\{\{subtotal\}\}/g, '$500.00')
                              .replace(/\{\{deposit_info\}\}/g, '<p style="margin: 16px 0; color: #059669; font-weight: 600;">50% deposit required: $250.00</p>')
                          }}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">Enter HTML template to see preview with sample data</p>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Customize entire HTML email. Variables will be replaced with actual order data.
                </p>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleSave('quote_custom_html', settings.quote_custom_html)}
                    disabled={saving}
                    size="sm"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Template
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setSettings({ ...settings, quote_custom_html: '' })}
                    size="sm"
                  >
                    Reset to Default
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={handleSendTestEmail}
                    disabled={sendingTest}
                    size="sm"
                  >
                    {sendingTest ? "Sending..." : "Send Test Email"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Settings;