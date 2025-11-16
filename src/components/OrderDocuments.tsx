import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface OrderDocumentsProps {
  orderId: string;
  orderNumber: string;
  status: string;
  hasQuote: boolean;
  hasInvoice: boolean;
}

const OrderDocuments = ({ orderId, orderNumber, status, hasQuote, hasInvoice }: OrderDocumentsProps) => {
  const handleDownload = async (docType: string) => {
    try {
      if (docType === 'quote') {
        await generateQuotePdf();
        return;
      }
      if (docType === 'confirmation') {
        await generateConfirmationPdf();
        return;
      }
      toast.info('Download coming soon!');
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error('Failed to download document');
    }
  };

  const fetchOrderWithLines = async () => {
    const { data, error } = await supabase
      .from('sales_orders')
      .select(`
        *,
        sales_order_lines (
          id, qty_entered, unit_price, line_subtotal, sell_mode,
          skus (code, description)
        )
      `)
      .eq('id', orderId)
      .single();
    if (error) throw error;
    return data as any;
  };

  const generateQuotePdf = async () => {
    const order = await fetchOrderWithLines();
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text('Quote', 20, 20);
    doc.setFontSize(10);
    doc.text(`Quote #: ${order.human_uid}`, 20, 30);
    doc.text(`Date: ${order.created_at ? format(new Date(order.created_at), 'MMM dd, yyyy') : ''}`, 20, 36);
    if (order.quote_expires_at) {
      doc.text(`Expires: ${format(new Date(order.quote_expires_at), 'MMM dd, yyyy')}`, 20, 42);
    }

    // Line items
    doc.setFontSize(12);
    doc.text('Items', 20, 55);
    doc.setFontSize(10);
    let yPos = 65;
    (order.sales_order_lines || []).forEach((line: any, idx: number) => {
      doc.text(`${idx + 1}. ${line.skus?.description || ''}`, 20, yPos);
      doc.text(`   Qty: ${line.qty_entered} ${line.sell_mode === 'kit' ? 'kits' : 'pieces'}`, 20, yPos + 5);
      doc.text(`   Unit: $${Number(line.unit_price).toFixed(2)}  Subtotal: $${Number(line.line_subtotal).toFixed(2)}`, 20, yPos + 10);
      yPos += 22;
    });

    // Totals / Deposit
    yPos += 6;
    doc.setFontSize(12);
    doc.text(`Subtotal: $${Number(order.subtotal).toFixed(2)}`, 20, yPos);
    yPos += 8;
    if (order.deposit_required && order.deposit_amount) {
      doc.text(`Deposit Required: $${Number(order.deposit_amount).toFixed(2)}`, 20, yPos);
      yPos += 8;
    }

    doc.save(`quote-${order.human_uid}.pdf`);
  };

  const generateConfirmationPdf = async () => {
    const order = await fetchOrderWithLines();
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('Order Confirmation', 20, 20);
    doc.setFontSize(10);
    doc.text(`Order #: ${order.human_uid}`, 20, 30);
    doc.text(`Date: ${order.created_at ? format(new Date(order.created_at), 'MMM dd, yyyy') : ''}`, 20, 36);
    doc.text(`Status: ${String(order.status).replace(/_/g, ' ').toUpperCase()}`, 20, 42);

    doc.setFontSize(12);
    doc.text('Order Items', 20, 55);
    doc.setFontSize(10);
    let yPos = 65;
    (order.sales_order_lines || []).forEach((line: any, idx: number) => {
      doc.text(`${idx + 1}. ${line.skus?.description || ''}`, 20, yPos);
      doc.text(`   Qty: ${line.qty_entered} ${line.sell_mode === 'kit' ? 'kits' : 'pieces'}`, 20, yPos + 5);
      doc.text(`   Price: $${Number(line.unit_price).toFixed(2)}  Subtotal: $${Number(line.line_subtotal).toFixed(2)}`, 20, yPos + 10);
      yPos += 22;
    });

    yPos += 6;
    doc.setFontSize(12);
    doc.text(`Total: $${Number(order.subtotal).toFixed(2)}`, 20, yPos);

    doc.save(`order-${order.human_uid}.pdf`);
  };
  const documents = [
    {
      name: 'Quote',
      description: 'Original price quote',
      available: hasQuote || status === 'quoted',
      type: 'quote'
    },
    {
      name: 'Order Confirmation',
      description: 'Order summary and details',
      available: status !== 'draft',
      type: 'confirmation'
    },
    {
      name: 'Invoice',
      description: 'Final invoice for payment',
      available: hasInvoice || ['awaiting_payment', 'shipped'].includes(status),
      type: 'invoice'
    },
    {
      name: 'Packing Slip',
      description: 'Shipping documentation',
      available: ['packed', 'shipped'].includes(status),
      type: 'packing_slip'
    }
  ];

  const availableDocs = documents.filter(doc => doc.available);

  if (availableDocs.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documents
        </CardTitle>
        <CardDescription>Download order documents and invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {availableDocs.map((doc) => (
            <div 
              key={doc.type}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-sm">{doc.name}</div>
                  <div className="text-xs text-muted-foreground">{doc.description}</div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleDownload(doc.type)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderDocuments;
