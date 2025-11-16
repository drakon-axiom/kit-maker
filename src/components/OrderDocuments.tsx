import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';
import { toast } from 'sonner';

interface OrderDocumentsProps {
  orderId: string;
  orderNumber: string;
  status: string;
  hasQuote: boolean;
  hasInvoice: boolean;
}

const OrderDocuments = ({ orderId, orderNumber, status, hasQuote, hasInvoice }: OrderDocumentsProps) => {
  const handleDownload = (docType: string) => {
    // TODO: Implement PDF generation
    toast.info(`${docType} download coming soon!`);
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
                onClick={() => handleDownload(doc.name)}
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
