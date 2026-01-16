import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Save, Eye, Code, Copy, RotateCcw, Send, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EmailTemplate {
  id: string;
  name: string;
  template_type: string;
  subject: string;
  custom_html: string | null;
  available_variables: string[];
  brand_id: string | null;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  primary_color: string;
  contact_email: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password: string | null;
}

// Generate portal URL from brand
const getPortalUrl = (brand: Brand | undefined): string => {
  if (!brand) return 'https://portal.example.com';
  if (brand.domain) {
    return brand.domain.startsWith('http') ? brand.domain : `https://${brand.domain}`;
  }
  // Fallback to path-based URL using published app URL
  const baseUrl = window.location.origin;
  return `${baseUrl}/brand/${brand.slug}`;
};

interface BrandEmailTemplatesProps {
  brandId?: string;
}

// Sample data for preview
const sampleData: Record<string, string> = {
  '{{company_name}}': 'Nexus Aminos',
  '{{customer_name}}': 'John Smith',
  '{{order_number}}': 'SO-2024-0042',
  '{{quote_number}}': 'QT-2024-0042',
  '{{date}}': new Date().toLocaleDateString(),
  '{{total}}': '$1,234.56',
  '{{subtotal}}': '$1,150.00',
  '{{tracking_no}}': '1Z999AA10123456784',
  '{{carrier}}': 'UPS',
  '{{logo_url}}': 'https://via.placeholder.com/200x60?text=Logo',
  '{{deposit_amount}}': '$500.00',
  '{{temp_password}}': 'TempPass123!',
  '{{portal_url}}': 'https://portal.example.com',
  '{{line_items}}': `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">Liposomal Vitamin C (30ml)</td>
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e0e0e0;">100</td>
      <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e0e0e0;">$450.00</td>
    </tr>
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">NAD+ Booster (60ml)</td>
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e0e0e0;">50</td>
      <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e0e0e0;">$700.00</td>
    </tr>
  `,
};

export function BrandEmailTemplates({ brandId }: BrandEmailTemplatesProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedBrandId, setSelectedBrandId] = useState<string>(brandId || 'global');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  // Fetch templates and brands
  useEffect(() => {
    const fetchData = async () => {
      const [templatesRes, brandsRes] = await Promise.all([
        supabase.from('email_templates').select('*').order('name'),
        supabase.from('brands').select('id, name, slug, domain, logo_url, primary_color, contact_email, smtp_host, smtp_port, smtp_user, smtp_password').eq('active', true),
      ]);

      if (templatesRes.data) setTemplates(templatesRes.data);
      if (brandsRes.data) setBrands(brandsRes.data);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Filter templates by selected brand
  const filteredTemplates = useMemo(() => {
    if (selectedBrandId === 'global') {
      return templates.filter(t => !t.brand_id);
    }
    // Show brand-specific templates or fall back to global
    const brandTemplates = templates.filter(t => t.brand_id === selectedBrandId);
    const globalTemplates = templates.filter(t => !t.brand_id);
    
    // Merge: brand-specific overrides global
    const merged = [...globalTemplates];
    brandTemplates.forEach(bt => {
      const idx = merged.findIndex(gt => gt.template_type === bt.template_type);
      if (idx >= 0) {
        merged[idx] = bt;
      } else {
        merged.push(bt);
      }
    });
    return merged;
  }, [templates, selectedBrandId]);

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setEditingTemplate({ ...template });
    }
  };

  const handleSave = async () => {
    if (!editingTemplate) return;

    const { error } = await supabase
      .from('email_templates')
      .update({
        subject: editingTemplate.subject,
        custom_html: editingTemplate.custom_html,
      })
      .eq('id', editingTemplate.id);

    if (error) {
      toast.error('Failed to save template');
      return;
    }

    toast.success('Template saved successfully');
    // Refresh templates
    const { data } = await supabase.from('email_templates').select('*').order('name');
    if (data) setTemplates(data);
  };

  const handleCreateBrandOverride = async () => {
    if (!editingTemplate || selectedBrandId === 'global') return;

    // Check if brand override already exists
    const existing = templates.find(
      t => t.brand_id === selectedBrandId && t.template_type === editingTemplate.template_type
    );

    if (existing) {
      toast.error('Brand override already exists for this template type');
      return;
    }

    const { data, error } = await supabase
      .from('email_templates')
      .insert({
        name: `${editingTemplate.name} (${brands.find(b => b.id === selectedBrandId)?.name})`,
        template_type: editingTemplate.template_type,
        subject: editingTemplate.subject,
        custom_html: editingTemplate.custom_html,
        available_variables: editingTemplate.available_variables,
        brand_id: selectedBrandId,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create brand override');
      return;
    }

    toast.success('Brand-specific template created');
    const { data: refreshedData } = await supabase.from('email_templates').select('*').order('name');
    if (refreshedData) {
      setTemplates(refreshedData);
      if (data) {
        setSelectedTemplateId(data.id);
        setEditingTemplate(data);
      }
    }
  };

  // Get selected brand for display
  const selectedBrand = useMemo(() => 
    brands.find(b => b.id === selectedBrandId), 
    [brands, selectedBrandId]
  );

  // Replace variables with sample data for preview
  const previewHtml = useMemo(() => {
    if (!editingTemplate?.custom_html) return '';
    let html = editingTemplate.custom_html;
    
    // Get brand-specific values
    const brand = brands.find(b => b.id === selectedBrandId);
    if (brand?.logo_url) {
      sampleData['{{logo_url}}'] = brand.logo_url;
      sampleData['{{company_name}}'] = brand.name;
    }
    // Set dynamic portal URL
    sampleData['{{portal_url}}'] = getPortalUrl(brand);
    
    Object.entries(sampleData).forEach(([key, value]) => {
      html = html.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    });
    return html;
  }, [editingTemplate?.custom_html, selectedBrandId, brands]);

  const copyToClipboard = () => {
    if (editingTemplate?.custom_html) {
      navigator.clipboard.writeText(editingTemplate.custom_html);
      toast.success('HTML copied to clipboard');
    }
  };

  const handleSendTestEmail = async () => {
    if (!editingTemplate || !previewHtml) {
      toast.error('Please select a template first');
      return;
    }

    const brand = brands.find(b => b.id === selectedBrandId);
    
    // Check if brand has SMTP configured
    if (selectedBrandId !== 'global' && (!brand?.smtp_host || !brand?.smtp_user || !brand?.smtp_password)) {
      toast.error('Selected brand does not have SMTP configured. Please configure SMTP in brand settings first.');
      return;
    }

    const recipientEmail = testEmail || brand?.contact_email || brand?.smtp_user;
    if (!recipientEmail) {
      toast.error('Please enter a recipient email address');
      return;
    }

    setSendingTest(true);
    try {
      // Replace variables in subject line
      const processedSubject = editingTemplate.subject.replace(
        /\{\{[^}]+\}\}/g, 
        (match) => sampleData[match] || match
      );

      const { data, error } = await supabase.functions.invoke('email-test', {
        body: {
          to: recipientEmail,
          subject: `[TEST] ${processedSubject}`,
          html: previewHtml,
          smtp_host: brand?.smtp_host,
          smtp_port: brand?.smtp_port || 465,
          smtp_user: brand?.smtp_user,
          smtp_password: brand?.smtp_password,
          brand_name: brand?.name || 'Global',
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Test email sent to ${data.sentTo || recipientEmail}`);
    } catch (error: any) {
      console.error('Failed to send test email:', error);
      toast.error(`Failed to send: ${error.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading templates...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Templates</CardTitle>
        <CardDescription>
          Customize email templates for each brand. Brand-specific templates override global defaults.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Brand and Template Selectors */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 space-y-2">
            <Label>Brand</Label>
            <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
              <SelectTrigger>
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global (Default)</SelectItem>
                {brands.map(brand => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBrand && (
              <p className="text-xs text-muted-foreground mt-1">
                Portal: <code className="bg-muted px-1 rounded">{getPortalUrl(selectedBrand)}</code>
              </p>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <Label>Template</Label>
            <Select value={selectedTemplateId} onValueChange={handleSelectTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {filteredTemplates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                    {template.brand_id && (
                      <Badge variant="secondary" className="ml-2 text-xs">Brand</Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {editingTemplate && (
          <>
            {/* Subject Line */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={editingTemplate.subject}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
              />
            </div>

            {/* Available Variables */}
            <div className="space-y-2">
              <Label>Available Variables</Label>
              <div className="flex flex-wrap gap-2">
                {editingTemplate.available_variables.map(variable => (
                  <Badge
                    key={variable}
                    variant="outline"
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => {
                      navigator.clipboard.writeText(variable);
                      toast.success(`Copied ${variable}`);
                    }}
                  >
                    {variable}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Editor with Tabs */}
            <Tabs defaultValue="code" className="w-full">
              <div className="flex justify-between items-center">
                <TabsList>
                  <TabsTrigger value="code">
                    <Code className="h-4 w-4 mr-2" />
                    HTML Code
                  </TabsTrigger>
                  <TabsTrigger value="preview">
                    <Eye className="h-4 w-4 mr-2" />
                    Live Preview
                  </TabsTrigger>
                </TabsList>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyToClipboard}>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                  {selectedBrandId !== 'global' && !editingTemplate.brand_id && (
                    <Button variant="outline" size="sm" onClick={handleCreateBrandOverride}>
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Create Brand Override
                    </Button>
                  )}
                </div>
              </div>

              <TabsContent value="code" className="mt-4">
                <Textarea
                  value={editingTemplate.custom_html || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, custom_html: e.target.value })}
                  className="font-mono text-sm min-h-[400px]"
                  placeholder="Enter HTML template..."
                />
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                <div className="border rounded-lg overflow-hidden bg-white">
                  <ScrollArea className="h-[500px]">
                    <iframe
                      srcDoc={previewHtml}
                      className="w-full h-[500px] border-0"
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex flex-col gap-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Test email address (optional)"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="max-w-xs"
                  type="email"
                />
                <Button 
                  variant="secondary" 
                  onClick={handleSendTestEmail}
                  disabled={sendingTest || selectedBrandId === 'global'}
                >
                  {sendingTest ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {sendingTest ? 'Sending...' : 'Send Test Email'}
                </Button>
                {selectedBrandId === 'global' && (
                  <span className="text-xs text-muted-foreground">Select a brand to send test emails</span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Full Preview
                </Button>
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Full Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Email Preview: {editingTemplate?.name}</DialogTitle>
              <DialogDescription>
                Subject: {editingTemplate?.subject.replace(/\{\{[^}]+\}\}/g, (match) => sampleData[match] || match)}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[70vh]">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[70vh] border rounded"
                title="Full Email Preview"
                sandbox="allow-same-origin"
              />
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
