import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { renderToStaticMarkup } from 'react-dom/server';

interface LabelSettings {
  id: string;
  label_type: string;
  size_width: number;
  size_height: number;
  show_qr_code: boolean;
  show_logo: boolean;
  logo_url: string | null;
  logo_position: string;
  show_customer_email: boolean;
  show_customer_phone: boolean;
  show_status: boolean;
  show_total_bottles: boolean;
  show_date: boolean;
  show_tracking_number: boolean;
  show_carrier: boolean;
  show_batch_quantity: boolean;
  show_order_reference: boolean;
  custom_html: string | null;
}

const LABEL_VARIABLES = {
  order: [
    '{{qrCode}}', '{{orderUid}}', '{{humanUid}}', '{{customerName}}', '{{customerEmail}}',
    '{{customerPhone}}', '{{subtotal}}', '{{totalBottles}}', '{{status}}', '{{date}}'
  ],
  shipping: [
    '{{qrCode}}', '{{orderUid}}', '{{humanUid}}', '{{customerName}}', '{{customerEmail}}',
    '{{customerPhone}}', '{{trackingNumber}}', '{{carrier}}', '{{totalBottles}}', '{{date}}'
  ],
  batch: [
    '{{qrCode}}', '{{batchUid}}', '{{humanUid}}', '{{orderUid}}', '{{customerName}}',
    '{{quantity}}', '{{date}}'
  ]
};

const LabelSettingsPage = () => {
  const [orderSettings, setOrderSettings] = useState<LabelSettings | null>(null);
  const [shippingSettings, setShippingSettings] = useState<LabelSettings | null>(null);
  const [batchSettings, setBatchSettings] = useState<LabelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('label_settings')
        .select('*');

      if (error) throw error;

      data?.forEach(setting => {
        if (setting.label_type === 'order') setOrderSettings(setting as LabelSettings);
        if (setting.label_type === 'shipping') setShippingSettings(setting as LabelSettings);
        if (setting.label_type === 'batch') setBatchSettings(setting as LabelSettings);
      });
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

  const saveSettings = async (settings: LabelSettings) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('label_settings')
        .update({
          size_width: settings.size_width,
          size_height: settings.size_height,
          show_qr_code: settings.show_qr_code,
          show_logo: settings.show_logo,
          logo_url: settings.logo_url,
          logo_position: settings.logo_position,
          show_customer_email: settings.show_customer_email,
          show_customer_phone: settings.show_customer_phone,
          show_status: settings.show_status,
          show_total_bottles: settings.show_total_bottles,
          show_date: settings.show_date,
          show_tracking_number: settings.show_tracking_number,
          show_carrier: settings.show_carrier,
          show_batch_quantity: settings.show_batch_quantity,
          show_order_reference: settings.show_order_reference,
          custom_html: settings.custom_html,
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Label settings saved successfully',
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

  const handleInsertVariable = (variable: string, settings: LabelSettings, updateFn: (s: LabelSettings) => void) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = settings.custom_html || '';
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + variable + after;

    updateFn({ ...settings, custom_html: newText });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const generatePreviewHtml = (settings: LabelSettings) => {
    if (!settings.custom_html) {
      return '<div style="padding: 20px; text-align: center; color: #888;">No custom template. Using default template.</div>';
    }

    // Generate appropriate QR code based on label type
    const qrValue = settings.label_type === 'order' ? 'ORD-2024-12345' 
      : settings.label_type === 'shipping' ? 'ORD-2024-12345'
      : 'BATCH-2024-001';
    
    const qrSize = settings.label_type === 'order' ? 140 
      : settings.label_type === 'shipping' ? 120 
      : 180;

    const qrCodeSvg = renderToStaticMarkup(
      <QRCodeSVG 
        value={qrValue} 
        size={qrSize}
        level="H"
        includeMargin={false}
      />
    );

    const sampleData: { [key: string]: string } = {
      '{{qrCode}}': qrCodeSvg,
      '{{orderUid}}': 'ORD-2024-12345',
      '{{humanUid}}': 'AX-001',
      '{{customerName}}': 'John Doe',
      '{{customerEmail}}': 'john.doe@example.com',
      '{{customerPhone}}': '+1 (555) 123-4567',
      '{{subtotal}}': '1250.00',
      '{{totalBottles}}': '500',
      '{{status}}': 'In Production',
      '{{date}}': new Date().toLocaleDateString(),
      '{{trackingNumber}}': '1Z999AA10123456784',
      '{{carrier}}': 'UPS Ground',
      '{{batchUid}}': 'BATCH-2024-001',
      '{{quantity}}': '250',
    };

    let html = settings.custom_html;
    Object.entries(sampleData).forEach(([variable, value]) => {
      html = html.replace(new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });

    return html;
  };

  const handleResetTemplate = async (settings: LabelSettings, updateFn: (s: LabelSettings) => void) => {
    updateFn({ ...settings, custom_html: null });
    
    toast({
      title: 'Template Reset',
      description: 'Custom HTML cleared. Using default template.',
    });
  };

  const renderSettingsForm = (settings: LabelSettings | null, updateFn: (s: LabelSettings) => void) => {
    if (!settings) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`width-${settings.label_type}`}>Width (inches)</Label>
            <Input
              id={`width-${settings.label_type}`}
              type="number"
              step="0.5"
              min="1"
              max="12"
              value={settings.size_width}
              onChange={(e) => updateFn({ ...settings, size_width: parseFloat(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`height-${settings.label_type}`}>Height (inches)</Label>
            <Input
              id={`height-${settings.label_type}`}
              type="number"
              step="0.5"
              min="1"
              max="12"
              value={settings.size_height}
              onChange={(e) => updateFn({ ...settings, size_height: parseFloat(e.target.value) })}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor={`qr-${settings.label_type}`}>Show QR Code</Label>
            <Switch
              id={`qr-${settings.label_type}`}
              checked={settings.show_qr_code}
              onCheckedChange={(checked) => updateFn({ ...settings, show_qr_code: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor={`logo-${settings.label_type}`}>Show Logo</Label>
            <Switch
              id={`logo-${settings.label_type}`}
              checked={settings.show_logo}
              onCheckedChange={(checked) => updateFn({ ...settings, show_logo: checked })}
            />
          </div>

          {settings.show_logo && (
            <>
              <div className="space-y-2">
                <Label htmlFor={`logo-url-${settings.label_type}`}>Logo URL</Label>
                <Input
                  id={`logo-url-${settings.label_type}`}
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={settings.logo_url || ''}
                  onChange={(e) => updateFn({ ...settings, logo_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`logo-pos-${settings.label_type}`}>Logo Position</Label>
                <Select
                  value={settings.logo_position}
                  onValueChange={(value) => updateFn({ ...settings, logo_position: value })}
                >
                  <SelectTrigger id={`logo-pos-${settings.label_type}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="bottom">Bottom</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        {settings.label_type === 'order' && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-semibold">Field Visibility</h4>
            <div className="flex items-center justify-between">
              <Label>Customer Email</Label>
              <Switch
                checked={settings.show_customer_email}
                onCheckedChange={(checked) => updateFn({ ...settings, show_customer_email: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Customer Phone</Label>
              <Switch
                checked={settings.show_customer_phone}
                onCheckedChange={(checked) => updateFn({ ...settings, show_customer_phone: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Order Status</Label>
              <Switch
                checked={settings.show_status}
                onCheckedChange={(checked) => updateFn({ ...settings, show_status: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Total Bottles</Label>
              <Switch
                checked={settings.show_total_bottles}
                onCheckedChange={(checked) => updateFn({ ...settings, show_total_bottles: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Date</Label>
              <Switch
                checked={settings.show_date}
                onCheckedChange={(checked) => updateFn({ ...settings, show_date: checked })}
              />
            </div>
          </div>
        )}

        {settings.label_type === 'shipping' && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-semibold">Field Visibility</h4>
            <div className="flex items-center justify-between">
              <Label>Customer Email</Label>
              <Switch
                checked={settings.show_customer_email}
                onCheckedChange={(checked) => updateFn({ ...settings, show_customer_email: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Customer Phone</Label>
              <Switch
                checked={settings.show_customer_phone}
                onCheckedChange={(checked) => updateFn({ ...settings, show_customer_phone: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Tracking Number</Label>
              <Switch
                checked={settings.show_tracking_number}
                onCheckedChange={(checked) => updateFn({ ...settings, show_tracking_number: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Carrier</Label>
              <Switch
                checked={settings.show_carrier}
                onCheckedChange={(checked) => updateFn({ ...settings, show_carrier: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Total Bottles</Label>
              <Switch
                checked={settings.show_total_bottles}
                onCheckedChange={(checked) => updateFn({ ...settings, show_total_bottles: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Date</Label>
              <Switch
                checked={settings.show_date}
                onCheckedChange={(checked) => updateFn({ ...settings, show_date: checked })}
              />
            </div>
          </div>
        )}

        {settings.label_type === 'batch' && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-semibold">Field Visibility</h4>
            <div className="flex items-center justify-between">
              <Label>Batch Quantity</Label>
              <Switch
                checked={settings.show_batch_quantity}
                onCheckedChange={(checked) => updateFn({ ...settings, show_batch_quantity: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Order Reference</Label>
              <Switch
                checked={settings.show_order_reference}
                onCheckedChange={(checked) => updateFn({ ...settings, show_order_reference: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Date</Label>
              <Switch
                checked={settings.show_date}
                onCheckedChange={(checked) => updateFn({ ...settings, show_date: checked })}
              />
            </div>
          </div>
        )}

        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Custom HTML Template</h4>
            {settings.custom_html && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleResetTemplate(settings, updateFn)}
              >
                Reset to Default
              </Button>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`html-${settings.label_type}`}>HTML Code</Label>
                <Select onValueChange={(variable) => handleInsertVariable(variable, settings, updateFn)}>
                  <SelectTrigger className="w-[200px] h-8">
                    <SelectValue placeholder="Insert variable" />
                  </SelectTrigger>
                  <SelectContent>
                    {LABEL_VARIABLES[settings.label_type as keyof typeof LABEL_VARIABLES]?.map((variable) => (
                      <SelectItem key={variable} value={variable}>
                        {variable}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                ref={textareaRef}
                id={`html-${settings.label_type}`}
                value={settings.custom_html || ''}
                onChange={(e) => updateFn({ ...settings, custom_html: e.target.value })}
                placeholder="Leave empty to use default template. Use variables like {{customerName}} for dynamic content. Use {{qrCode}} to insert a QR code."
                className="font-mono text-sm min-h-[400px]"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use the default template with settings above. Add custom HTML to fully customize the label design.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Live Preview</Label>
              <div 
                className="border rounded-md p-4 min-h-[400px] bg-background overflow-auto"
                style={{
                  width: `${settings.size_width}in`,
                  height: `${settings.size_height}in`,
                  maxWidth: '100%',
                  maxHeight: '600px',
                }}
              >
                <div dangerouslySetInnerHTML={{ __html: generatePreviewHtml(settings) }} />
              </div>
              <p className="text-xs text-muted-foreground">
                Preview shows sample data. Actual labels will use real order/batch data.
              </p>
            </div>
          </div>
        </div>

        <Button onClick={() => saveSettings(settings)} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Settings
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Label Settings</h1>
        <p className="text-muted-foreground mt-1">Customize label templates for printing</p>
      </div>

      <Tabs defaultValue="order" className="w-full">
        <TabsList>
          <TabsTrigger value="order">Order Labels</TabsTrigger>
          <TabsTrigger value="shipping">Shipping Labels</TabsTrigger>
          <TabsTrigger value="batch">Batch Labels</TabsTrigger>
        </TabsList>

        <TabsContent value="order">
          <Card>
            <CardHeader>
              <CardTitle>Order Label Template</CardTitle>
              <CardDescription>Configure how order labels are printed</CardDescription>
            </CardHeader>
            <CardContent>
              {renderSettingsForm(orderSettings, setOrderSettings)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipping">
          <Card>
            <CardHeader>
              <CardTitle>Shipping Label Template</CardTitle>
              <CardDescription>Configure how shipping labels are printed</CardDescription>
            </CardHeader>
            <CardContent>
              {renderSettingsForm(shippingSettings, setShippingSettings)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch">
          <Card>
            <CardHeader>
              <CardTitle>Batch Label Template</CardTitle>
              <CardDescription>Configure how batch labels are printed</CardDescription>
            </CardHeader>
            <CardContent>
              {renderSettingsForm(batchSettings, setBatchSettings)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LabelSettingsPage;
