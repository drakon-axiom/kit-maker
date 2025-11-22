import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Edit, Trash2, MessageSquare, Save, X, Send } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SMSTemplate {
  id: string;
  name: string;
  template_type: string;
  message_template: string;
  available_variables: string[];
  created_at: string;
  updated_at: string;
}

const TEMPLATE_TYPES = [
  { value: "order_status", label: "Order Status Update" },
  { value: "quote_approved", label: "Quote Approved" },
  { value: "shipment_update", label: "Shipment Update" },
  { value: "shipment_delivered", label: "Shipment Delivered" },
  { value: "payment_received", label: "Payment Received" },
  { value: "custom", label: "Custom Message" },
];

const COMMON_VARIABLES = [
  "{{customer_name}}",
  "{{order_number}}",
  "{{status}}",
  "{{tracking_number}}",
];

export const SMSTemplateEditor = () => {
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    template_type: "",
    message_template: "",
    available_variables: COMMON_VARIABLES,
  });
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testTemplate, setTestTemplate] = useState<SMSTemplate | null>(null);
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
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
        .order("name");

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading templates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTemplate.name || !newTemplate.template_type || !newTemplate.message_template) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("sms_templates").insert([
        {
          name: newTemplate.name,
          template_type: newTemplate.template_type,
          message_template: newTemplate.message_template,
          available_variables: newTemplate.available_variables,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Template created",
        description: "SMS template has been created successfully",
      });

      setIsCreateDialogOpen(false);
      setNewTemplate({
        name: "",
        template_type: "",
        message_template: "",
        available_variables: COMMON_VARIABLES,
      });
      loadTemplates();
    } catch (error: any) {
      toast({
        title: "Error creating template",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async (template: SMSTemplate) => {
    try {
      const { error } = await supabase
        .from("sms_templates")
        .update({
          name: template.name,
          message_template: template.message_template,
          available_variables: template.available_variables,
        })
        .eq("id", template.id);

      if (error) throw error;

      toast({
        title: "Template updated",
        description: "SMS template has been updated successfully",
      });

      setEditingTemplate(null);
      loadTemplates();
    } catch (error: any) {
      toast({
        title: "Error updating template",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("sms_templates").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Template deleted",
        description: "SMS template has been deleted successfully",
      });

      loadTemplates();
    } catch (error: any) {
      toast({
        title: "Error deleting template",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const insertVariable = (variable: string, isEditing: boolean = false) => {
    if (isEditing && editingTemplate) {
      setEditingTemplate({
        ...editingTemplate,
        message_template: editingTemplate.message_template + " " + variable,
      });
    } else {
      setNewTemplate({
        ...newTemplate,
        message_template: newTemplate.message_template + " " + variable,
      });
    }
  };

  const getPreviewMessage = (template: string) => {
    const sampleData: { [key: string]: string } = {
      "{{customer_name}}": "John Doe",
      "{{order_number}}": "SO-MI8B9C31TTACY",
      "{{status}}": "In Production",
      "{{tracking_number}}": "TRK123456789",
    };

    let preview = template;
    Object.entries(sampleData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), value);
    });

    return preview;
  };

  const handleSendTest = async () => {
    if (!testPhoneNumber || !testTemplate) {
      toast({
        title: "Missing information",
        description: "Please enter a phone number",
        variant: "destructive",
      });
      return;
    }

    setSendingTest(true);
    try {
      const previewMessage = getPreviewMessage(testTemplate.message_template);
      
      const { error } = await supabase.functions.invoke("send-sms-notification", {
        body: {
          phoneNumber: testPhoneNumber,
          eventType: "test",
          testMessage: previewMessage,
        },
      });

      if (error) throw error;

      toast({
        title: "Test SMS sent",
        description: `Test message sent to ${testPhoneNumber}`,
      });

      setTestDialogOpen(false);
      setTestPhoneNumber("");
      setTestTemplate(null);
    } catch (error: any) {
      toast({
        title: "Error sending test SMS",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">SMS Templates</h2>
          <p className="text-muted-foreground">
            Create and manage reusable SMS message templates with variable placeholders
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create SMS Template</DialogTitle>
              <DialogDescription>
                Create a new reusable SMS message template with variable placeholders
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-name">Template Name</Label>
                <Input
                  id="new-name"
                  placeholder="e.g., Order Status Update"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="new-type">Template Type</Label>
                <Select
                  value={newTemplate.template_type}
                  onValueChange={(value) => setNewTemplate({ ...newTemplate, template_type: value })}
                >
                  <SelectTrigger id="new-type">
                    <SelectValue placeholder="Select template type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="new-message">Message Template</Label>
                  <Select onValueChange={(value) => insertVariable(value, false)}>
                    <SelectTrigger className="w-[180px] h-8">
                      <SelectValue placeholder="Insert variable" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_VARIABLES.map((variable) => (
                        <SelectItem key={variable} value={variable}>
                          {variable.replace(/[{}]/g, "")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  id="new-message"
                  placeholder="Hi {{customer_name}}, your order {{order_number}} status is now: {{status}}"
                  value={newTemplate.message_template}
                  onChange={(e) => setNewTemplate({ ...newTemplate, message_template: e.target.value })}
                  rows={4}
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {newTemplate.message_template.length}/160 characters
                </p>
              </div>
              <div>
                <Label>Preview</Label>
                <div className="p-3 bg-muted rounded-md text-sm">
                  {getPreviewMessage(newTemplate.message_template) || "Message preview will appear here..."}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create Template</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    {template.name}
                  </CardTitle>
                  <CardDescription>
                    <Badge variant="secondary" className="text-xs">
                      {TEMPLATE_TYPES.find((t) => t.value === template.template_type)?.label}
                    </Badge>
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTestTemplate(template);
                      setTestDialogOpen(true);
                    }}
                    title="Send test SMS"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingTemplate(template)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the "{template.name}" template. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(template.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm bg-muted p-3 rounded-md">
                {template.message_template}
              </div>
              <div className="flex flex-wrap gap-1">
                {template.available_variables.map((variable) => (
                  <Badge key={variable} variant="outline" className="text-xs">
                    {variable}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editingTemplate && (
        <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit SMS Template</DialogTitle>
              <DialogDescription>
                Update the template name and message content
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Template Name</Label>
                <Input
                  id="edit-name"
                  value={editingTemplate.name}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Template Type</Label>
                <Badge variant="secondary">
                  {TEMPLATE_TYPES.find((t) => t.value === editingTemplate.template_type)?.label}
                </Badge>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="edit-message">Message Template</Label>
                  <Select onValueChange={(value) => insertVariable(value, true)}>
                    <SelectTrigger className="w-[180px] h-8">
                      <SelectValue placeholder="Insert variable" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_VARIABLES.map((variable) => (
                        <SelectItem key={variable} value={variable}>
                          {variable.replace(/[{}]/g, "")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  id="edit-message"
                  value={editingTemplate.message_template}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      message_template: e.target.value,
                    })
                  }
                  rows={4}
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {editingTemplate.message_template.length}/160 characters
                </p>
              </div>
              <div>
                <Label>Preview</Label>
                <div className="p-3 bg-muted rounded-md text-sm">
                  {getPreviewMessage(editingTemplate.message_template)}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setTestTemplate(editingTemplate);
                  setTestDialogOpen(true);
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Test
              </Button>
              <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={() => handleUpdate(editingTemplate)}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test SMS</DialogTitle>
            <DialogDescription>
              Send a test SMS to verify the template works correctly
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="test-phone">Phone Number</Label>
              <Input
                id="test-phone"
                placeholder="+1234567890"
                value={testPhoneNumber}
                onChange={(e) => setTestPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Include country code (e.g., +1 for US)
              </p>
            </div>
            {testTemplate && (
              <div>
                <Label>Message Preview</Label>
                <div className="p-3 bg-muted rounded-md text-sm">
                  {getPreviewMessage(testTemplate.message_template)}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTestDialogOpen(false);
                setTestPhoneNumber("");
                setTestTemplate(null);
              }}
              disabled={sendingTest}
            >
              Cancel
            </Button>
            <Button onClick={handleSendTest} disabled={sendingTest}>
              {sendingTest ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
