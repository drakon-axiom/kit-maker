import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, Mail, ArrowLeft } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { SMSQuotaTracker } from '@/components/SMSQuotaTracker';
import { SMSTemplateEditor } from '@/components/SMSTemplateEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EmailTemplate {
  id: string;
  template_type: string;
  name: string;
  description: string;
  subject: string;
  custom_html: string | null;
  available_variables: string[];
}

const Notifications = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [companyName, setCompanyName] = useState('Your Company');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchTemplates();
    fetchCompanyName();
  }, []);

  const fetchCompanyName = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'company_name')
        .single();

      if (error) throw error;
      if (data?.value) setCompanyName(data.value);
    } catch (error) {
      // Error handled silently
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({
          subject: selectedTemplate.subject,
          custom_html: selectedTemplate.custom_html,
        })
        .eq('id', selectedTemplate.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Template saved successfully',
      });

      fetchTemplates();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetTemplate = () => {
    if (!selectedTemplate) return;
    setSelectedTemplate({
      ...selectedTemplate,
      custom_html: null,
    });
  };

  const handleSendTestEmail = async () => {
    if (!selectedTemplate || !user?.email) return;

    setSendingTest(true);
    try {
      // Handle order approval/rejection templates
      if (selectedTemplate.template_type === 'order_approval' || selectedTemplate.template_type === 'order_rejection') {
        // Get a real order ID from database for testing
        const { data: orders } = await supabase
          .from('sales_orders')
          .select('id')
          .limit(1);
        
        if (!orders || orders.length === 0) {
          throw new Error('No orders found. Create an order first to test approval emails.');
        }

        const { error } = await supabase.functions.invoke('send-order-approval', {
          body: {
            orderId: orders[0].id,
            approved: selectedTemplate.template_type === 'order_approval',
            rejectionReason: selectedTemplate.template_type === 'order_rejection' ? 'This is a test rejection' : undefined,
            testMode: true,
            testEmail: user.email,
          },
        });

        if (error) throw error;
      } else {
        // Handle other templates (quote, etc.)
        const { error } = await supabase.functions.invoke('generate-quote', {
          body: {
            testMode: true,
            testEmail: user.email,
            templateType: selectedTemplate.template_type,
          },
        });

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: `Test email sent to ${user.email}`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleInsertVariable = (variable: string) => {
    if (!textareaRef.current || !selectedTemplate) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = selectedTemplate.custom_html || '';
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + variable + after;

    setSelectedTemplate({ ...selectedTemplate, custom_html: newText });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const generatePreviewHtml = (template: EmailTemplate) => {
    let html = template.custom_html || '<p>No custom template set. Using default template.</p>';
    
    // Replace variables with sample data
    const sampleData: { [key: string]: string } = {
      '{{company_name}}': companyName,
      '{{customer_name}}': 'John Doe',
      '{{quote_number}}': 'Q-2024-001',
      '{{order_number}}': 'O-2024-001',
      '{{order_total}}': '$1,250.00',
      '{{date}}': new Date().toLocaleDateString(),
      '{{customer_email}}': 'customer@example.com',
      '{{tracking_no}}': 'TRK123456789',
      '{{carrier}}': 'FedEx',
      '{{estimated_delivery}}': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      '{{deposit_amount}}': '$500.00',
      '{{deposit_required}}': 'Yes',
      '{{due_date}}': new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      '{{status}}': 'In Production',
      '{{message}}': 'Your order is being processed',
      '{{rejection_reason}}': 'This is a sample rejection reason for testing purposes',
      '{{line_items}}': '<tr><td>Sample Product</td><td>10</td><td>$50.00</td></tr>',
      '{{subtotal}}': '$500.00',
      '{{total}}': '$500.00',
      '{{deposit_info}}': 'Deposit: $250.00 due by ' + new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      '{{logo_url}}': 'https://example.com/logo.png',
    };

    Object.entries(sampleData).forEach(([key, value]) => {
      html = html.replace(new RegExp(key, 'g'), value);
    });

    return html;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedTemplate) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedTemplate(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Templates
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{selectedTemplate.name}</CardTitle>
            <CardDescription>{selectedTemplate.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                value={selectedTemplate.subject}
                onChange={(e) => setSelectedTemplate({ ...selectedTemplate, subject: e.target.value })}
                placeholder="Email subject line"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="custom_html">HTML Template</Label>
                  <Select onValueChange={handleInsertVariable}>
                    <SelectTrigger className="w-[200px] h-8">
                      <SelectValue placeholder="Insert variable" />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      {selectedTemplate.available_variables.map((variable) => (
                        <SelectItem key={variable} value={variable}>
                          {variable.replace(/[{}]/g, '')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  ref={textareaRef}
                  id="custom_html"
                  value={selectedTemplate.custom_html || ''}
                  onChange={(e) => setSelectedTemplate({ ...selectedTemplate, custom_html: e.target.value })}
                  placeholder="Leave empty to use default template. Click 'Insert variable' above to add template variables."
                  className="font-mono text-sm min-h-[500px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Live Preview</Label>
                <div 
                  className="border rounded-md p-4 min-h-[500px] bg-background overflow-auto"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(generatePreviewHtml(selectedTemplate)) }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveTemplate} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Template
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleResetTemplate}>
                Reset to Default
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleSendTestEmail}
                disabled={sendingTest || !['quote', 'order_approval', 'order_rejection'].includes(selectedTemplate.template_type)}
              >
                {sendingTest ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Test Email
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notifications</h1>
        <p className="text-muted-foreground mt-2">
          Manage email templates and SMS quota
        </p>
      </div>

      <Tabs defaultValue="email" className="w-full">
        <TabsList>
          <TabsTrigger value="email">Email Templates</TabsTrigger>
          <TabsTrigger value="sms-templates">SMS Templates</TabsTrigger>
          <TabsTrigger value="sms-quota">SMS Quota</TabsTrigger>
        </TabsList>
        
        <TabsContent value="email" className="space-y-4 mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card 
                key={template.id} 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setSelectedTemplate(template)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    {template.name}
                  </CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">Subject:</span> {template.subject}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {template.custom_html ? 'Custom template' : 'Using default template'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sms-templates" className="mt-6">
          <SMSTemplateEditor />
        </TabsContent>

        <TabsContent value="sms-quota" className="mt-6">
          <SMSQuotaTracker />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Notifications;
