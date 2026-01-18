import { supabase } from '@/integrations/supabase/client';

export async function downloadBrandedInvoice(invoiceId: string, invoiceNo: string) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-branded-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        type: 'invoice',
        id: invoiceId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to generate invoice');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // Check content type - if HTML, use .html extension
    const contentType = response.headers.get('content-type');
    const extension = contentType?.includes('html') ? 'html' : 'pdf';
    link.download = `invoice-${invoiceNo}.${extension}`;
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
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-branded-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        type: 'receipt',
        id: paymentId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to generate receipt');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // Check content type - if HTML, use .html extension
    const contentType = response.headers.get('content-type');
    const extension = contentType?.includes('html') ? 'html' : 'pdf';
    link.download = `receipt-${paymentId.slice(0, 8)}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to download receipt');
  }
}
