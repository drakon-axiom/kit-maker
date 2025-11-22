import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from 'dompurify';

interface QuotePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    human_uid: string;
    created_at: string;
    deposit_required: boolean;
    deposit_amount?: number;
    subtotal: number;
    quote_expires_at?: string;
    quote_expiration_days?: number;
    customer?: {
      name: string;
      email: string;
      phone?: string;
    };
    sales_order_lines: Array<{
      qty_entered: number;
      bottle_qty: number;
      unit_price: number;
      line_subtotal: number;
      sku?: {
        code: string;
        description: string;
      };
    }>;
  };
  onSend: () => void;
  sending: boolean;
}

const QuotePreview = ({ open, onOpenChange, order, onSend, sending }: QuotePreviewProps) => {
  const depositAmount = order.deposit_amount || 0;
  const depositPercentage = order.subtotal > 0 ? Math.round((depositAmount / order.subtotal) * 100) : 0;

  const [settings, setSettings] = useState<Record<string, string>>({
    company_name: "Nexus Aminos",
    company_email: "info@nexusaminos.com",
    quote_header_bg_color: "#c2e4fb",
    quote_header_text_color: "#000000",
    quote_footer_text: "We look forward to working with you!",
    company_logo_url: "",
  });
  const [customHtml, setCustomHtml] = useState<string>("");

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["company_name", "company_email", "quote_header_bg_color", "quote_header_text_color", "quote_footer_text", "company_logo_url"]);
      
      if (data) {
        const settingsMap: Record<string, string> = {};
        data.forEach((s) => {
          settingsMap[s.key] = s.value;
        });
        setSettings(prev => ({ ...prev, ...settingsMap }));
      }
    };

    const fetchTemplate = async () => {
      const { data } = await supabase
        .from("email_templates")
        .select("custom_html")
        .eq("template_type", "quote")
        .single();
      
      if (data?.custom_html) {
        setCustomHtml(data.custom_html);
      }
    };

    if (open) {
      fetchSettings();
      fetchTemplate();
    }
  }, [open]);

  const generatePreviewHtml = () => {
    const depositAmount = order.deposit_amount || 0;
    const depositPercentage = order.subtotal > 0 ? Math.round((depositAmount / order.subtotal) * 100) : 0;
    
    // Generate line items HTML
    let lineItemsHtml = '';
    order.sales_order_lines.forEach((line) => {
      lineItemsHtml += `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px;">${line.sku?.code || "N/A"}</td><td style="padding: 8px;">${line.qty_entered} (${line.bottle_qty} bottles)</td><td style="padding: 8px; text-align: right;">$${line.unit_price.toFixed(2)}</td><td style="padding: 8px; text-align: right;">$${line.line_subtotal.toFixed(2)}</td></tr>`;
    });

    // Generate accept button HTML (preview only - actual link won't work)
    const acceptButtonHtml = order.deposit_required && depositAmount > 0
      ? `<div style="text-align: center; margin: 32px 0;">
           <a href="#" style="display: inline-block; background: #28a745; color: white; padding: 16px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
             Accept Quote & Pay Deposit
           </a>
           <p style="font-size: 12px; color: #666; margin-top: 8px;">Click the button above to accept this quote and proceed with the deposit payment.</p>
         </div>`
      : '';

    // Calculate expiration data
    let expiryDate: Date | null = null;
    
    if (order.quote_expires_at) {
      expiryDate = new Date(order.quote_expires_at);
    } else if (order.quote_expiration_days) {
      // Calculate from days if not already set
      expiryDate = new Date(order.created_at);
      expiryDate.setDate(expiryDate.getDate() + order.quote_expiration_days);
    }
    
    const expiresAt = expiryDate ? expiryDate.toLocaleDateString() : '';
    
    const expirationWarning = expiryDate 
      ? (() => {
          const now = new Date();
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilExpiry < 0) {
            return '<div style="background: #fee; border: 1px solid #fcc; padding: 12px; border-radius: 4px; margin: 16px 0; color: #c00;"><strong>This quote has expired.</strong></div>';
          } else if (daysUntilExpiry <= 3) {
            return `<div style="background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 4px; margin: 16px 0;"><strong>Note:</strong> This quote expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}.</div>`;
          }
          return '';
        })()
      : '';

    if (customHtml) {
      // Use custom template with variable replacement
      return customHtml
        .replace(/\{\{company_name\}\}/g, settings.company_name)
        .replace(/\{\{company_email\}\}/g, settings.company_email)
        .replace(/\{\{customer_name\}\}/g, order.customer?.name || "Customer")
        .replace(/\{\{quote_number\}\}/g, order.human_uid)
        .replace(/\{\{date\}\}/g, new Date(order.created_at).toLocaleDateString())
        .replace(/\{\{expires_at\}\}/g, expiresAt)
        .replace(/\{\{expiration_warning\}\}/g, expirationWarning)
        .replace(/\{\{customer_email\}\}/g, order.customer?.email || '')
        .replace(/\{\{line_items\}\}/g, lineItemsHtml)
        .replace(/\{\{subtotal\}\}/g, `$${order.subtotal.toFixed(2)}`)
        .replace(/\{\{logo_url\}\}/g, settings.company_logo_url)
        .replace(/\{\{accept_button\}\}/g, acceptButtonHtml)
        .replace(/\{\{deposit_info\}\}/g, order.deposit_required && depositAmount > 0 
          ? `<tr><td colspan="3" style="padding: 8px; text-align: right;">Deposit Required (${depositPercentage}%):</td><td style="padding: 8px; text-align: right;">$${depositAmount.toFixed(2)}</td></tr>`
          : '');
    }

    // Default template
    const headerContent = settings.company_logo_url 
      ? `<img src="${settings.company_logo_url}" alt="${settings.company_name}" style="max-height: 80px; max-width: 300px;" />`
      : `<h1 style="color: ${settings.quote_header_text_color}; margin: 0; font-size: 24px; font-weight: bold;">${settings.company_name.toUpperCase()}</h1>`;

    return `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family: 'Open Sans', Arial, sans-serif; background: #ffffff; color: #222; margin: 0; padding: 0;"><div style="background: ${settings.quote_header_bg_color}; padding: 30px; text-align: center;">${headerContent}</div><div style="max-width: 600px; margin: 0 auto; padding: 30px 20px;"><h2 style="font-size: 20px; margin-bottom: 16px;">Hello ${order.customer?.name || "Customer"},</h2><p style="margin-bottom: 16px; line-height: 1.6;">Thank you for your interest in ${settings.company_name}. Please find your quote details below.</p><div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 16px;"><p style="margin: 8px 0;"><strong>Quote Number:</strong> ${order.human_uid}</p><p style="margin: 8px 0;"><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p><p style="margin: 8px 0;"><strong>Customer:</strong> ${order.customer?.name}</p>${order.customer?.email ? `<p style="margin: 8px 0;"><strong>Email:</strong> ${order.customer.email}</p>` : ''}</div><div style="margin-bottom: 24px;"><h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Line Items</h3><table style="width: 100%; border-collapse: collapse; font-size: 14px;"><thead><tr style="background: #f0f0f0; border-bottom: 2px solid #ddd;"><th style="padding: 8px; text-align: left;">SKU</th><th style="padding: 8px; text-align: left;">Quantity</th><th style="padding: 8px; text-align: right;">Unit Price</th><th style="padding: 8px; text-align: right;">Total</th></tr></thead><tbody>${lineItemsHtml}</tbody><tfoot><tr style="border-top: 2px solid #ddd; font-weight: 600;"><td colspan="3" style="padding: 8px; text-align: right;">Subtotal:</td><td style="padding: 8px; text-align: right;">$${order.subtotal.toFixed(2)}</td></tr>${order.deposit_required && depositAmount > 0 ? `<tr><td colspan="3" style="padding: 8px; text-align: right;">Deposit Required (${depositPercentage}%):</td><td style="padding: 8px; text-align: right;">$${depositAmount.toFixed(2)}</td></tr>` : ''}</tfoot></table></div>${acceptButtonHtml}<p style="margin-bottom: 16px; line-height: 1.6;">This quote is valid for 30 days. If you have any questions or would like to proceed with this order, please reply to this email or contact us.</p>${order.deposit_required && depositAmount > 0 ? `<div style="background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 4px; margin-bottom: 16px;"><strong>Note:</strong> A ${depositPercentage}% deposit ($${depositAmount.toFixed(2)}) is required before production begins.</div>` : ''}<p style="line-height: 1.6;">${settings.quote_footer_text}</p></div><div style="background: ${settings.quote_header_bg_color}; padding: 20px; text-align: center; margin-top: 40px;"><p style="margin: 8px 0; font-weight: 500;">${settings.company_name}<br>${settings.company_email}</p><p style="font-size: 12px; color: #666; margin: 8px 0;">© ${new Date().getFullYear()} ${settings.company_name}. All rights reserved.</p></div></body></html>`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quote Email Preview</DialogTitle>
          <DialogDescription>
            Preview of the quote email that will be sent to {order.customer?.email}
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-lg overflow-hidden">
          {/* Email Preview */}
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(generatePreviewHtml()) }} />
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            onClick={onSend}
            disabled={sending}
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Quote"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuotePreview;
