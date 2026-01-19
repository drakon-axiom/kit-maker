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
      logo_url: string | null;
      primary_color: string;
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
        logo_url: string | null;
        primary_color: string;
        contact_email: string | null;
        contact_phone: string | null;
        contact_address: string | null;
      } | null;
    };
  };
}

// Parse HSL string like "222.2 84% 4.9%" to RGB values
function hslToRgb(hslString: string): { r: number; g: number; b: number } {
  const parts = hslString.split(' ');
  if (parts.length < 3) {
    return { r: 50, g: 50, b: 50 }; // Default dark gray
  }
  
  const h = parseFloat(parts[0]) / 360;
  const s = parseFloat(parts[1].replace('%', '')) / 100;
  const l = parseFloat(parts[2].replace('%', '')) / 100;
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

// Load image and convert to base64 for jsPDF
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('Failed to load logo image:', e);
    return null;
  }
}

function safeDownloadPdf(doc: any, filename: string) {
  const blob = (doc as any).output?.('blob');
  if (!blob) throw new Error('Unable to generate PDF blob');

  console.log('safeDownloadPdf: Generated blob, attempting download for', filename);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  
  try {
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log('safeDownloadPdf: Download triggered via link click');
  } catch (e) {
    console.log('safeDownloadPdf: Link click failed, opening in new window');
    window.open(url, '_blank');
  }
  
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadBrandedInvoice(invoiceId: string, invoiceNo: string) {
  // First fetch the invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (invoiceError || !invoice) {
    console.error('downloadBrandedInvoice invoice query error:', invoiceError);
    throw new Error(invoiceError?.message || 'Failed to fetch invoice');
  }

  // Fetch the sales order with related data including logo and colors
  const { data: order, error: orderError } = await supabase
    .from('sales_orders')
    .select(`
      human_uid,
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
        logo_url,
        primary_color,
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
    `)
    .eq('id', invoice.so_id)
    .single();

  if (orderError) {
    console.error('downloadBrandedInvoice order query error:', orderError);
    throw new Error(orderError?.message || 'Failed to fetch order data');
  }

  if (!order) {
    console.error('downloadBrandedInvoice: No order found for so_id:', invoice.so_id);
    throw new Error('Order not found for this invoice');
  }

  // If no brand on order, fetch default brand
  let brand = order.brands;
  if (!brand) {
    const { data: defaultBrand } = await supabase
      .from('brands')
      .select('name, logo_url, primary_color, contact_email, contact_phone, contact_address')
      .eq('is_default', true)
      .single();
    brand = defaultBrand;
  }

  console.log('downloadBrandedInvoice: Generating PDF for invoice', invoiceNo, 'with brand:', brand?.name);

  const customer = order.customers;
  const lines = order.sales_order_lines || [];

  // Get brand color
  const brandColor = brand?.primary_color ? hslToRgb(brand.primary_color) : { r: 50, g: 50, b: 50 };

  // Load logo if available
  let logoBase64: string | null = null;
  if (brand?.logo_url) {
    logoBase64 = await loadImageAsBase64(brand.logo_url);
  }

  const jsPDFModule = await import('jspdf');
  const JsPDFCtor = (jsPDFModule as any).default || (jsPDFModule as any).jsPDF;
  const doc = new JsPDFCtor();

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Add logo if available (top right)
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'AUTO', pageWidth - 50, 10, 30, 30);
    } catch (e) {
      console.error('Failed to add logo to PDF:', e);
    }
  }

  // Header - Brand/Company info (right aligned, below logo if present)
  const headerStartY = logoBase64 ? 45 : 20;
  yPos = headerStartY;
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

  // Invoice title with brand color
  yPos = 20;
  doc.setTextColor(brandColor.r, brandColor.g, brandColor.b);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 20, yPos);

  yPos += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Invoice #: ${invoice.invoice_no}`, 20, yPos);
  yPos += 5;
  doc.text(`Order #: ${order?.human_uid || ''}`, 20, yPos);
  yPos += 5;
  doc.text(`Date: ${format(new Date(invoice.issued_at), 'MMMM dd, yyyy')}`, 20, yPos);
  yPos += 5;

  const typeLabel = invoice.type === 'deposit' ? 'DEPOSIT INVOICE' : 'FINAL INVOICE';
  doc.text(`Type: ${typeLabel}`, 20, yPos);
  yPos += 5;

  const statusLabel = invoice.status === 'paid' ? 'PAID' : 'UNPAID';
  doc.text(`Status: ${statusLabel}`, 20, yPos);
  if (invoice.paid_at) {
    doc.text(` (${format(new Date(invoice.paid_at), 'MMM dd, yyyy')})`, 55, yPos);
  }

  // Bill To section
  yPos = Math.max(yPos + 15, headerStartY + 30);
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

  // Line items table with brand color header
  yPos += 15;
  doc.setFillColor(brandColor.r, brandColor.g, brandColor.b);
  doc.rect(20, yPos, pageWidth - 40, 8, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255); // White text on colored header
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
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', 130, yPos);
  doc.text(`$${invoice.subtotal.toFixed(2)}`, pageWidth - 22, yPos, { align: 'right' });

  if (invoice.tax > 0) {
    yPos += 6;
    doc.text('Tax:', 130, yPos);
    doc.text(`$${invoice.tax.toFixed(2)}`, pageWidth - 22, yPos, { align: 'right' });
  }

  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(brandColor.r, brandColor.g, brandColor.b);
  doc.text('Total Due:', 130, yPos);
  doc.text(`$${invoice.total.toFixed(2)}`, pageWidth - 22, yPos, { align: 'right' });

  // Footer
  yPos = doc.internal.pageSize.getHeight() - 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Thank you for your business!', pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.text(`Generated on ${format(new Date(), 'MMMM dd, yyyy')}`, pageWidth / 2, yPos, { align: 'center' });

  safeDownloadPdf(doc, `invoice-${invoiceNo}.pdf`);
}

export async function downloadBrandedReceipt(paymentId: string) {
  const { data: payment, error } = await supabase
    .from('invoice_payments')
    .select(`
      *,
      invoices:invoice_id (
        invoice_no,
        type,
        so_id,
        sales_orders:so_id (
          human_uid,
          customers:customer_id (
            name,
            email
          ),
          brands:brand_id (
            name,
            logo_url,
            primary_color,
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
    console.error('downloadBrandedReceipt query error:', error);
    throw new Error(error?.message || 'Failed to fetch payment data');
  }

  const paymentData = payment as unknown as PaymentData;
  const invoice = paymentData.invoices;
  const order = invoice?.sales_orders;
  const customer = order?.customers;
  
  // If no brand on order, fetch default brand
  let brand = order?.brands;
  if (!brand) {
    const { data: defaultBrand } = await supabase
      .from('brands')
      .select('name, logo_url, primary_color, contact_email, contact_phone, contact_address')
      .eq('is_default', true)
      .single();
    brand = defaultBrand;
  }

  // Get brand color
  const brandColor = brand?.primary_color ? hslToRgb(brand.primary_color) : { r: 50, g: 50, b: 50 };

  // Load logo if available
  let logoBase64: string | null = null;
  if (brand?.logo_url) {
    logoBase64 = await loadImageAsBase64(brand.logo_url);
  }

  const jsPDFModule = await import('jspdf');
  const JsPDFCtor = (jsPDFModule as any).default || (jsPDFModule as any).jsPDF;
  const doc = new JsPDFCtor();

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Add logo if available (top right)
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'AUTO', pageWidth - 50, 10, 30, 30);
    } catch (e) {
      console.error('Failed to add logo to PDF:', e);
    }
  }

  // Header - Brand/Company info (right aligned)
  const headerStartY = logoBase64 ? 45 : 20;
  yPos = headerStartY;
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

  // Receipt title with brand color
  yPos = 20;
  doc.setTextColor(brandColor.r, brandColor.g, brandColor.b);
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
  yPos = Math.max(yPos + 15, headerStartY + 30);
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

  // Payment details box with brand color
  yPos += 20;
  doc.setFillColor(brandColor.r, brandColor.g, brandColor.b);
  doc.setDrawColor(brandColor.r, brandColor.g, brandColor.b);
  doc.roundedRect(20, yPos, pageWidth - 40, 50, 3, 3, 'S'); // Stroke with brand color
  
  // Light fill
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(21, yPos + 1, pageWidth - 42, 48, 2, 2, 'F');

  yPos += 12;
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.setFont('helvetica', 'normal');
  doc.text('Payment Method:', 30, yPos);
  doc.setTextColor(0);
  doc.text(String(paymentData.method || '').toUpperCase(), 90, yPos);

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
  doc.setTextColor(0, 128, 0);
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

  safeDownloadPdf(doc, `receipt-${paymentData.id.slice(0, 8)}.pdf`);
}
