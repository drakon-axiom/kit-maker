import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, Mail, ArrowLeft } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
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
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
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
      const { error } = await supabase.functions.invoke('generate-quote', {
        body: {
          testMode: true,
          testEmail: user.email,
          templateType: selectedTemplate.template_type,
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Test email sent to ${user.email}`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
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
      '{{company_name}}': 'Axiom Manufacturing',
      '{{customer_name}}': 'John Doe',
      '{{quote_number}}': 'Q-2024-001',
      '{{order_number}}': 'O-2024-001',
      '{{date}}': new Date().toLocaleDateString(),
      '{{customer_email}}': 'customer@example.com',
      '{{tracking_no}}': 'TRK123456789',
      '{{carrier}}': 'FedEx',
      '{{estimated_delivery}}': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      '{{deposit_amount}}': '$500.00',
      '{{due_date}}': new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      '{{status}}': 'In Production',
      '{{message}}': 'Your order is being processed',
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
                  dangerouslySetInnerHTML={{ __html: generatePreviewHtml(selectedTemplate) }}
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
                disabled={sendingTest || selectedTemplate.template_type !== 'quote'}
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
        <h1 className="text-3xl font-bold">Email Notifications</h1>
        <p className="text-muted-foreground mt-2">
          Manage automated email templates for customer notifications
        </p>
      </div>

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
    </div>
  );
};

export default Notifications;
