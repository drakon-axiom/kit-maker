import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Save, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SMSTemplate {
  id: string;
  template_type: string;
  name: string;
  message_template: string;
  available_variables: string[];
}

export const SMSTemplateManager = () => {
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sms_templates")
        .select("*")
        .order("template_type");

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      // Error handled silently
      toast({
        title: "Error",
        description: "Failed to load SMS templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (template: SMSTemplate) => {
    setSaving(template.id);
    try {
      const { error } = await supabase
        .from("sms_templates")
        .update({
          message_template: template.message_template,
          updated_at: new Date().toISOString(),
        })
        .eq("id", template.id);

      if (error) throw error;

      toast({
        title: "Template saved",
        description: "SMS template updated successfully",
      });
    } catch (error) {
      // Error handled silently
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleTemplateChange = (id: string, value: string) => {
    setTemplates(templates.map(t => 
      t.id === id ? { ...t, message_template: value } : t
    ));
  };

  if (loading) {
    return <div>Loading templates...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <CardTitle>SMS Message Templates</CardTitle>
        </div>
        <CardDescription>
          Customize SMS messages sent to customers. Use variables like {"{{"} customer_name {"}}"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {templates.map((template) => (
          <div key={template.id} className="space-y-3 pb-6 border-b last:border-0">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">{template.name}</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Type: {template.template_type}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => handleSave(template)}
                disabled={saving === template.id}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving === template.id ? "Saving..." : "Save"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`template-${template.id}`}>Message Template</Label>
              <Textarea
                id={`template-${template.id}`}
                value={template.message_template}
                onChange={(e) => handleTemplateChange(template.id, e.target.value)}
                rows={3}
                className="font-mono text-sm"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs text-muted-foreground">Available variables:</span>
                {template.available_variables.map((variable) => (
                  <Badge key={variable} variant="secondary" className="text-xs">
                    {"{{"} {variable} {"}}"}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};