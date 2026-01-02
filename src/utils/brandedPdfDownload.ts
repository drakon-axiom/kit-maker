import { supabase } from '@/integrations/supabase/client';

export async function downloadBrandedInvoice(invoiceId: string, invoiceNo: string) {
  try {
    const { data, error } = await supabase.functions.invoke('generate-branded-pdf', {
      body: {
        type: 'invoice',
        id: invoiceId,
      },
    });

    if (error) throw error;

    // Create a blob from the response and trigger download
    const blob = new Blob([data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice-${invoiceNo}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to download invoice');
  }
}

export async function downloadBrandedReceipt(paymentId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('generate-branded-pdf', {
      body: {
        type: 'receipt',
        id: paymentId,
      },
    });

    if (error) throw error;

    // Create a blob from the response and trigger download
    const blob = new Blob([data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${paymentId.slice(0, 8)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to download receipt');
  }
}
