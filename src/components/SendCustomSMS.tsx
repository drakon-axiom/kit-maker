import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send } from "lucide-react";

interface SendCustomSMSProps {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerId: string;
}

export const SendCustomSMS = ({
  orderId,
  orderNumber,
  customerName,
  customerId,
}: SendCustomSMSProps) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please enter a message to send",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      // Get customer's phone number and SMS preferences
      const { data: prefs, error: prefsError } = await supabase
        .from("notification_preferences")
        .select("sms_enabled, sms_phone_number")
        .eq("customer_id", customerId)
        .single();

      if (prefsError) throw prefsError;

      if (!prefs?.sms_phone_number) {
        toast({
          title: "No phone number",
          description: "Customer has not provided a phone number for SMS",
          variant: "destructive",
        });
        return;
      }

      if (!prefs.sms_enabled) {
        toast({
          title: "SMS disabled",
          description: "Customer has SMS notifications disabled. Send anyway?",
          variant: "destructive",
        });
        // Could add a confirmation dialog here
      }

      // Send SMS via edge function
      const { error: smsError } = await supabase.functions.invoke("send-sms-notification", {
        body: {
          orderId: orderId,
          phoneNumber: prefs.sms_phone_number,
          eventType: "custom",
          testMessage: `${customerName}, ${message} - Order: ${orderNumber}`,
        },
      });

      if (smsError) throw smsError;

      // Log the SMS
      await supabase.from("sms_logs").insert({
        customer_id: customerId,
        so_id: orderId,
        phone_number: prefs.sms_phone_number,
        message: message,
        template_type: "custom",
        status: "sent",
        sent_by: (await supabase.auth.getUser()).data.user?.id,
      });

      toast({
        title: "SMS sent",
        description: `Message sent to ${prefs.sms_phone_number}`,
      });

      setMessage("");
      setOpen(false);
    } catch (error) {
      console.error("Error sending SMS:", error);
      toast({
        title: "Error",
        description: "Failed to send SMS",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        Send SMS
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send SMS to Customer</DialogTitle>
            <DialogDescription>
              Send a one-time SMS message to {customerName} for order {orderNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sms-message">Message</Label>
              <Textarea
                id="sms-message"
                placeholder="Enter your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={160}
              />
              <p className="text-xs text-muted-foreground">
                {message.length}/160 characters
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !message.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Sending..." : "Send SMS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};