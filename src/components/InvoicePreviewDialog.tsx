import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Eye, Send, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InvoicePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNo: string;
  customerEmail: string;
  onSend: () => void;
  sending: boolean;
}

interface LineItem {
  sku_code: string;
  description: string;
  qty: number;
  unit_price: number;
  line_subtotal: number;
  source?: string;
}

interface InvoiceData {
  invoice_no: string;
  type: 'deposit' | 'final';
  subtotal: number;
  tax: number;
  total: number;
  issued_at: string;
  lineItems: LineItem[];
  orderNumber: string;
  customerName: string;
  brand: {
    name: string;
    logo_url: string | null;
    primary_color: string;
    contact_email: string | null;
    contact_phone: string | null;
    contact_address: string | null;
  } | null;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const generatePreviewHtml = (data: InvoiceData): string => {
  const brand = data.brand;
  
  const brandName = brand?.name || 'Company';
  const brandLogoUrl = brand?.logo_url || null;
  const brandEmail = brand?.contact_email || null;
  const brandPhone = brand?.contact_phone || null;
  const brandAddress = brand?.contact_address || null;
  const primaryColor = brand?.primary_color || '#2563eb';
  
  const typeLabel = data.type === 'deposit' ? 'Deposit Invoice' : 'Invoice';
  const formattedDate = new Date(data.issued_at).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const lineItemsHtml = data.lineItems.map(item => 
    `<tr><td style="padding:12px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:14px;">${item.sku_code}${item.source ? ` <span style="color:#888;font-size:11px;">(${item.source})</span>` : ''}</td><td style="padding:12px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:14px;">${item.description}</td><td style="padding:12px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:14px;text-align:center;">${item.qty}</td><td style="padding:12px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:14px;text-align:right;">${formatCurrency(item.unit_price)}</td><td style="padding:12px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:14px;text-align:right;">${formatCurrency(item.line_subtotal)}</td></tr>`
  ).join('');

  const taxRow = data.tax > 0 ? `<tr><td style="padding:8px 0;font-size:14px;color:#666;">Tax</td><td style="padding:8px 0;font-size:14px;color:#333;text-align:right;">${formatCurrency(data.tax)}</td></tr>` : '';
  
  const logoOrName = brandLogoUrl 
    ? `<img src="${brandLogoUrl}" alt="${brandName}" style="max-width:180px;max-height:60px;">` 
    : `<h1 style="color:#ffffff;margin:0;font-size:24px;">${brandName}</h1>`;
  
  const emailLink = brandEmail ? `<p style="margin:0 0 5px;font-size:13px;color:#666;"><a href="mailto:${brandEmail}" style="color:${primaryColor};">${brandEmail}</a></p>` : '';
  const phoneText = brandPhone ? `<p style="margin:0 0 5px;font-size:13px;color:#666;">${brandPhone}</p>` : '';
  const addressText = brandAddress ? `<p style="margin:0;font-size:13px;color:#666;">${brandAddress}</p>` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${typeLabel} ${data.invoice_no}</title></head><body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);"><tr><td style="background-color:${primaryColor};padding:30px;text-align:center;">${logoOrName}</td></tr><tr><td style="padding:30px 40px 20px;"><h2 style="margin:0 0 10px;color:#333;font-size:28px;">${typeLabel}</h2><p style="margin:0;color:#666;font-size:16px;">Invoice #${data.invoice_no}</p><p style="margin:5px 0 0;color:#666;font-size:14px;">Order: ${data.orderNumber}</p><p style="margin:5px 0 0;color:#666;font-size:14px;">Date: ${formattedDate}</p></td></tr><tr><td style="padding:0 40px 20px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:15px;background-color:#f9f9f9;border-radius:6px;"><p style="margin:0 0 5px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Bill To</p><p style="margin:0;font-size:16px;color:#333;font-weight:bold;">${data.customerName}</p></td></tr></table></td></tr><tr><td style="padding:0 40px 20px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;overflow:hidden;"><tr style="background-color:#f5f5f5;"><th style="padding:12px;text-align:left;font-family:Arial,sans-serif;font-size:12px;color:#666;text-transform:uppercase;">SKU</th><th style="padding:12px;text-align:left;font-family:Arial,sans-serif;font-size:12px;color:#666;text-transform:uppercase;">Description</th><th style="padding:12px;text-align:center;font-family:Arial,sans-serif;font-size:12px;color:#666;text-transform:uppercase;">Qty</th><th style="padding:12px;text-align:right;font-family:Arial,sans-serif;font-size:12px;color:#666;text-transform:uppercase;">Unit Price</th><th style="padding:12px;text-align:right;font-family:Arial,sans-serif;font-size:12px;color:#666;text-transform:uppercase;">Total</th></tr>${lineItemsHtml}</table></td></tr><tr><td style="padding:0 40px 30px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td width="60%"></td><td width="40%"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:8px 0;font-size:14px;color:#666;">Subtotal</td><td style="padding:8px 0;font-size:14px;color:#333;text-align:right;">${formatCurrency(data.subtotal)}</td></tr>${taxRow}<tr><td style="padding:12px 0;font-size:18px;color:#333;font-weight:bold;border-top:2px solid #333;">Amount Due</td><td style="padding:12px 0;font-size:18px;color:${primaryColor};font-weight:bold;text-align:right;border-top:2px solid #333;">${formatCurrency(data.total)}</td></tr></table></td></tr></table></td></tr><tr><td style="padding:0 40px 30px;"><div style="background-color:#fff8e1;border-left:4px solid #ffc107;padding:15px 20px;border-radius:0 6px 6px 0;"><p style="margin:0;font-size:14px;color:#856404;"><strong>Payment Instructions:</strong> Please remit payment at your earliest convenience. If you have any questions about this invoice, please contact us.</p></div></td></tr><tr><td style="background-color:#f5f5f5;padding:25px 40px;text-align:center;border-top:1px solid #eee;"><p style="margin:0 0 5px;font-size:14px;color:#333;font-weight:bold;">${brandName}</p>${emailLink}${phoneText}${addressText}<p style="margin:15px 0 0;font-size:12px;color:#999;">&copy; ${new Date().getFullYear()} ${brandName}. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;
};

export function InvoicePreviewDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNo,
  customerEmail,
  onSend,
  sending,
}: InvoicePreviewDialogProps) {
  const [loading, setLoading] = useState(true);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && invoiceId) {
      fetchInvoiceData();
    }
  }, [open, invoiceId]);

  const fetchInvoiceData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch invoice with order and lines
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          sales_orders!invoices_so_id_fkey (
            id,
            human_uid,
            customer_id,
            brand_id,
            customers (
              id,
              name,
              email
            ),
            brands (
              id,
              name,
              logo_url,
              primary_color,
              contact_email,
              contact_phone,
              contact_address
            ),
            sales_order_lines (
              id,
              qty_entered,
              unit_price,
              line_subtotal,
              skus (
                code,
                description
              )
            )
          )
        `)
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      const order = invoice.sales_orders as any;
      if (!order) throw new Error('Order not found');

      // Get brand from order, or fetch default brand if none assigned
      let brandData = order.brands;
      if (!brandData) {
        const { data: defaultBrand } = await supabase
          .from('brands')
          .select('id, name, logo_url, primary_color, contact_email, contact_phone, contact_address')
          .eq('is_default', true)
          .single();
        brandData = defaultBrand;
      }

      // Collect line items from parent order
      const lineItems: LineItem[] = (order.sales_order_lines || []).map((line: any) => ({
        sku_code: line.skus?.code || 'N/A',
        description: line.skus?.description || 'Item',
        qty: line.qty_entered,
        unit_price: line.unit_price,
        line_subtotal: line.line_subtotal,
      }));

      // Fetch add-on orders for final invoices
      if (invoice.type === 'final') {
        const { data: addons } = await supabase
          .from('order_addons')
          .select(`
            addon_order:sales_orders!order_addons_addon_so_id_fkey (
              id,
              human_uid,
              sales_order_lines (
                id,
                qty_entered,
                unit_price,
                line_subtotal,
                skus (
                  code,
                  description
                )
              )
            )
          `)
          .eq('parent_so_id', order.id);

        // Add add-on line items
        (addons || []).forEach((addon: any) => {
          const addonOrder = addon.addon_order;
          if (addonOrder?.sales_order_lines) {
            addonOrder.sales_order_lines.forEach((line: any) => {
              lineItems.push({
                sku_code: line.skus?.code || 'N/A',
                description: line.skus?.description || 'Item',
                qty: line.qty_entered,
                unit_price: line.unit_price,
                line_subtotal: line.line_subtotal,
                source: `Add-on ${addonOrder.human_uid}`,
              });
            });
          }
        });
      }

      const invoiceData: InvoiceData = {
        invoice_no: invoice.invoice_no,
        type: invoice.type,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        issued_at: invoice.issued_at,
        lineItems,
        orderNumber: order.human_uid,
        customerName: order.customers?.name || 'Customer',
        brand: brandData,
      };

      const html = generatePreviewHtml(invoiceData);
      setPreviewHtml(html);
    } catch (err) {
      console.error('Error fetching invoice data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load invoice preview');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Invoice Preview: {invoiceNo}
          </DialogTitle>
          <DialogDescription>
            Preview how the invoice email will appear to {customerEmail}
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-10 text-center">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" onClick={fetchInvoiceData} className="mt-4">
                Retry
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[60vh] border rounded-lg">
              <iframe
                srcDoc={previewHtml}
                title="Invoice Preview"
                className="w-full h-[60vh] border-0"
                sandbox="allow-same-origin"
              />
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="p-6 pt-4 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
          <Button 
            onClick={onSend} 
            disabled={sending || loading || !!error}
          >
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send to {customerEmail}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
