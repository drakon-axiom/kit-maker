import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, Send } from "lucide-react";

interface SMSNotificationSettingsProps {
  customerId: string;
}

export const SMSNotificationSettings = ({ customerId }: SMSNotificationSettingsProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [settings, setSettings] = useState({
    sms_enabled: false,
    sms_phone_number: "",
    sms_order_status: true,
    sms_quote_approved: true,
    sms_shipment_updates: true,
    sms_payment_received: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, [customerId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("customer_id", customerId)
        .single();

      if (error) throw error;

      if (data) {
        setSettings({
          sms_enabled: data.sms_enabled,
          sms_phone_number: data.sms_phone_number || "",
          sms_order_status: data.sms_order_status,
          sms_quote_approved: data.sms_quote_approved,
          sms_shipment_updates: data.sms_shipment_updates,
          sms_payment_received: data.sms_payment_received,
        });
      }
    } catch (error) {
      console.error("Error loading SMS settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          customer_id: customerId,
          ...settings,
        }, {
          onConflict: 'customer_id'
        });

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your SMS notification preferences have been updated",
      });
    } catch (error) {
      console.error("Error saving SMS settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSMS = async () => {
    if (!settings.sms_phone_number) {
      toast({
        title: "Phone number required",
        description: "Please enter a phone number first",
        variant: "destructive",
      });
      return;
    }

    setSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke('send-sms-notification', {
        body: {
          orderId: null,
          newStatus: 'test',
          phoneNumber: settings.sms_phone_number,
          eventType: 'test',
          testMessage: 'This is a test SMS from your order management system. If you received this, SMS notifications are working correctly!',
        },
      });

      if (error) throw error;

      toast({
        title: "Test SMS sent",
        description: "Check your phone for the test message",
      });
    } catch (error) {
      console.error("Error sending test SMS:", error);
      toast({
        title: "Error",
        description: "Failed to send test SMS. Please check your phone number and try again.",
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          <CardTitle>SMS Notifications</CardTitle>
        </div>
        <CardDescription>
          Receive text message updates about your orders
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable SMS Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive updates via text message
            </p>
          </div>
          <Switch
            checked={settings.sms_enabled}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, sms_enabled: checked })
            }
          />
        </div>

        {settings.sms_enabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex gap-2">
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1234567890"
                  value={settings.sms_phone_number}
                  onChange={(e) =>
                    setSettings({ ...settings, sms_phone_number: e.target.value })
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestSMS}
                  disabled={sendingTest || !settings.sms_phone_number}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendingTest ? "Sending..." : "Test"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Include country code (e.g., +1 for US)
              </p>
            </div>

            <div className="space-y-4">
              <Label>Notify me about:</Label>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="font-normal">Order Status Changes</Label>
                  <p className="text-sm text-muted-foreground">
                    When your order status updates
                  </p>
                </div>
                <Switch
                  checked={settings.sms_order_status}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, sms_order_status: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="font-normal">Quote Approvals</Label>
                  <p className="text-sm text-muted-foreground">
                    When your quote is approved
                  </p>
                </div>
                <Switch
                  checked={settings.sms_quote_approved}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, sms_quote_approved: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="font-normal">Shipment Updates</Label>
                  <p className="text-sm text-muted-foreground">
                    When your order ships
                  </p>
                </div>
                <Switch
                  checked={settings.sms_shipment_updates}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, sms_shipment_updates: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="font-normal">Payment Confirmations</Label>
                  <p className="text-sm text-muted-foreground">
                    When payments are received
                  </p>
                </div>
                <Switch
                  checked={settings.sms_payment_received}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, sms_payment_received: checked })
                  }
                />
              </div>
            </div>
          </>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Preferences"}
        </Button>
      </CardContent>
    </Card>
  );
};