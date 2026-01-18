import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface InvoiceData {
  id: string;
  invoice_no: string;
  type: 'deposit' | 'final';
  status: 'unpaid' | 'paid';
  subtotal: number;
  tax: number;
  total: number;
  issued_at: string;
  paid_at: string | null;
  sales_orders: {
    human_uid: string;
    subtotal: number;
    created_at: string;
    customers: {
      name: string;
      email: string | null;
      phone: string | null;
      billing_address_line1: string | null;
      billing_address_line2: string | null;
      billing_city: string | null;
      billing_state: string | null;
      billing_zip: string | null;
    } | null;
    brands: {
      name: string;
      contact_email: string | null;
      contact_phone: string | null;
      contact_address: string | null;
    } | null;
    sales_order_lines: Array<{
      qty_entered: number;
      unit_price: number;
      line_subtotal: number;
      sell_mode: string;
      skus: {
        code: string;
        description: string;
      };
    }>;
  };
}

interface PaymentData {
  id: string;
  amount: number;
  method: string;
  recorded_at: string;
  notes: string | null;
  invoices: {
    invoice_no: string;
    type: string;
    sales_orders: {
      human_uid: string;
      customers: {
        name: string;
        email: string | null;
      } | null;
      brands: {
        name: string;
        contact_email: string | null;
        contact_phone: string | null;
        contact_address: string | null;
      } | null;
    };
  };
}

function safeOpenOrSavePdf(doc: any, filename: string) {
  try {
    if (typeof doc.save === 'function') {
      doc.save(filename);
      return;
    }
  } catch {
    // Fallback to blob URL method
  }
  try {
    const blobUrl = typeof doc.output === 'function' ? doc.output('bloburl') : '';
    if (blobUrl) {
      const newWindow = window.open(blobUrl, '_blank');
      if (!newWindow) {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      return;
    }
  } catch {
    // Fallback
  }
  throw new Error('PDF download blocked');
}

export async function downloadBrandedInvoice(invoiceId: string, invoiceNo: string) {
  // Fetch invoice data with related order, customer, and line items
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      *,
      sales_orders (
        human_uid,
        subtotal,
        created_at,
        customers (
          name,
          email,
          phone,
          billing_address_line1,
          billing_address_line2,
          billing_city,
          billing_state,
          billing_zip
        ),
        brands (
          name,
          contact_email,
          contact_phone,
          contact_address
        ),
        sales_order_lines (
          qty_entered,
          unit_price,
          line_subtotal,
          sell_mode,
          skus (
            code,
            description
          )
        )
      )
    `)
    .eq('id', invoiceId)
    .single();

  if (error || !invoice) {
    throw new Error('Failed to fetch invoice data');
  }

  const invoiceData = invoice as unknown as InvoiceData;
  const order = invoiceData.sales_orders;
  const customer = order?.customers;
  const brand = order?.brands;
  const lines = order?.sales_order_lines || [];

  // Generate PDF using jsPDF
  const jsPDFModule = await import('jspdf');
  const JsPDFCtor = (jsPDFModule as any).default || (jsPDFModule as any).jsPDF;
  const doc = new JsPDFCtor();

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Header - Brand/Company info (right aligned)
  doc.setFontSize(10);
  doc.setTextColor(100);
  if (brand?.name) {
    doc.text(brand.name, pageWidth - 20, yPos, { align: 'right' });
    yPos += 5;
  }
  if (brand?.contact_address) {
    doc.text(brand.contact_address, pageWidth - 20, yPos, { align: 'right' });
    yPos += 5;
  }
  if (brand?.contact_email) {
    doc.text(brand.contact_email, pageWidth - 20, yPos, { align: 'right' });
    yPos += 5;
  }
  if (brand?.contact_phone) {
    doc.text(brand.contact_phone, pageWidth - 20, yPos, { align: 'right' });
  }

  // Invoice title
  yPos = 20;
  doc.setTextColor(0);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 20, yPos);
  
  yPos += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Invoice #: ${invoiceData.invoice_no}`, 20, yPos);
  yPos += 5;
  doc.text(`Order #: ${order?.human_uid || ''}`, 20, yPos);
  yPos += 5;
  doc.text(`Date: ${format(new Date(invoiceData.issued_at), 'MMMM dd, yyyy')}`, 20, yPos);
  yPos += 5;
  
  // Invoice type badge
  const typeLabel = invoiceData.type === 'deposit' ? 'DEPOSIT INVOICE' : 'FINAL INVOICE';
  doc.text(`Type: ${typeLabel}`, 20, yPos);
  yPos += 5;
  
  const statusLabel = invoiceData.status === 'paid' ? 'PAID' : 'UNPAID';
  doc.text(`Status: ${statusLabel}`, 20, yPos);
  if (invoiceData.paid_at) {
    doc.text(` (${format(new Date(invoiceData.paid_at), 'MMM dd, yyyy')})`, 55, yPos);
  }

  // Bill To section
  yPos += 15;
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  if (customer) {
    doc.text(customer.name, 20, yPos);
    yPos += 5;
    if (customer.billing_address_line1) {
      doc.text(customer.billing_address_line1, 20, yPos);
      yPos += 5;
    }
    if (customer.billing_address_line2) {
      doc.text(customer.billing_address_line2, 20, yPos);
      yPos += 5;
    }
    const cityStateZip = [customer.billing_city, customer.billing_state, customer.billing_zip]
      .filter(Boolean)
      .join(', ');
    if (cityStateZip) {
      doc.text(cityStateZip, 20, yPos);
      yPos += 5;
    }
    if (customer.email) {
      doc.text(customer.email, 20, yPos);
      yPos += 5;
    }
    if (customer.phone) {
      doc.text(customer.phone, 20, yPos);
    }
  }

  // Line items table
  yPos += 15;
  doc.setFillColor(245, 245, 245);
  doc.rect(20, yPos, pageWidth - 40, 8, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80);
  yPos += 5;
  doc.text('Item', 22, yPos);
  doc.text('Qty', 100, yPos);
  doc.text('Unit Price', 125, yPos);
  doc.text('Subtotal', pageWidth - 22, yPos, { align: 'right' });
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  doc.setFontSize(9);

  lines.forEach((line) => {
    const description = line.skus?.description || line.skus?.code || 'Item';
    const qtyText = `${line.qty_entered} ${line.sell_mode === 'kit' ? 'kits' : 'pcs'}`;
    
    // Truncate description if too long
    const maxDescWidth = 75;
    let displayDesc = description;
    if (doc.getTextWidth(description) > maxDescWidth) {
      while (doc.getTextWidth(displayDesc + '...') > maxDescWidth && displayDesc.length > 0) {
        displayDesc = displayDesc.slice(0, -1);
      }
      displayDesc += '...';
    }
    
    doc.text(displayDesc, 22, yPos);
    doc.text(qtyText, 100, yPos);
    doc.text(`$${line.unit_price.toFixed(2)}`, 125, yPos);
    doc.text(`$${line.line_subtotal.toFixed(2)}`, pageWidth - 22, yPos, { align: 'right' });
    yPos += 7;
  });

  // Totals section
  yPos += 5;
  doc.setDrawColor(200);
  doc.line(120, yPos, pageWidth - 20, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.text('Subtotal:', 130, yPos);
  doc.text(`$${invoiceData.subtotal.toFixed(2)}`, pageWidth - 22, yPos, { align: 'right' });
  
  if (invoiceData.tax > 0) {
    yPos += 6;
    doc.text('Tax:', 130, yPos);
    doc.text(`$${invoiceData.tax.toFixed(2)}`, pageWidth - 22, yPos, { align: 'right' });
  }
  
  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total Due:', 130, yPos);
  doc.text(`$${invoiceData.total.toFixed(2)}`, pageWidth - 22, yPos, { align: 'right' });

  // Footer
  yPos = doc.internal.pageSize.getHeight() - 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Thank you for your business!', pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.text(`Generated on ${format(new Date(), 'MMMM dd, yyyy')}`, pageWidth / 2, yPos, { align: 'center' });

  safeOpenOrSavePdf(doc, `invoice-${invoiceNo}.pdf`);
}

export async function downloadBrandedReceipt(paymentId: string) {
  // Fetch payment data with related invoice and order info
  const { data: payment, error } = await supabase
    .from('invoice_payments')
    .select(`
      *,
      invoices (
        invoice_no,
        type,
        sales_orders (
          human_uid,
          customers (
            name,
            email
          ),
          brands (
            name,
            contact_email,
            contact_phone,
            contact_address
          )
        )
      )
    `)
    .eq('id', paymentId)
    .single();

  if (error || !payment) {
    throw new Error('Failed to fetch payment data');
  }

  const paymentData = payment as unknown as PaymentData;
  const invoice = paymentData.invoices;
  const order = invoice?.sales_orders;
  const customer = order?.customers;
  const brand = order?.brands;

  // Generate PDF using jsPDF
  const jsPDFModule = await import('jspdf');
  const JsPDFCtor = (jsPDFModule as any).default || (jsPDFModule as any).jsPDF;
  const doc = new JsPDFCtor();

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Header - Brand/Company info (right aligned)
  doc.setFontSize(10);
  doc.setTextColor(100);
  if (brand?.name) {
    doc.text(brand.name, pageWidth - 20, yPos, { align: 'right' });
    yPos += 5;
  }
  if (brand?.contact_address) {
    doc.text(brand.contact_address, pageWidth - 20, yPos, { align: 'right' });
    yPos += 5;
  }
  if (brand?.contact_email) {
    doc.text(brand.contact_email, pageWidth - 20, yPos, { align: 'right' });
    yPos += 5;
  }
  if (brand?.contact_phone) {
    doc.text(brand.contact_phone, pageWidth - 20, yPos, { align: 'right' });
  }

  // Receipt title
  yPos = 20;
  doc.setTextColor(0);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT RECEIPT', 20, yPos);
  
  yPos += 15;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Receipt #: ${paymentData.id.slice(0, 8).toUpperCase()}`, 20, yPos);
  yPos += 5;
  doc.text(`Invoice #: ${invoice?.invoice_no || ''}`, 20, yPos);
  yPos += 5;
  doc.text(`Order #: ${order?.human_uid || ''}`, 20, yPos);
  yPos += 5;
  doc.text(`Payment Date: ${format(new Date(paymentData.recorded_at), 'MMMM dd, yyyy')}`, 20, yPos);

  // Customer info
  yPos += 15;
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Received From:', 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  if (customer) {
    doc.text(customer.name, 20, yPos);
    yPos += 5;
    if (customer.email) {
      doc.text(customer.email, 20, yPos);
    }
  }

  // Payment details box
  yPos += 20;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(20, yPos, pageWidth - 40, 50, 3, 3, 'F');
  
  yPos += 12;
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text('Payment Method:', 30, yPos);
  doc.setTextColor(0);
  doc.text(paymentData.method.toUpperCase(), 90, yPos);
  
  yPos += 10;
  doc.setTextColor(80);
  doc.text('Invoice Type:', 30, yPos);
  doc.setTextColor(0);
  doc.text(invoice?.type === 'deposit' ? 'Deposit' : 'Final', 90, yPos);
  
  yPos += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(80);
  doc.text('Amount Paid:', 30, yPos);
  doc.setTextColor(0, 128, 0); // Green
  doc.text(`$${paymentData.amount.toFixed(2)}`, 90, yPos);

  if (paymentData.notes) {
    yPos += 15;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Notes:', 30, yPos);
    yPos += 5;
    doc.text(paymentData.notes, 30, yPos);
  }

  // Footer
  yPos = doc.internal.pageSize.getHeight() - 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Thank you for your payment!', pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.text(`Generated on ${format(new Date(), 'MMMM dd, yyyy')}`, pageWidth / 2, yPos, { align: 'center' });

  safeOpenOrSavePdf(doc, `receipt-${paymentData.id.slice(0, 8)}.pdf`);
}
