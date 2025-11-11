import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface LabelSettings {
  size_width: number;
  size_height: number;
  show_qr_code: boolean;
  show_logo: boolean;
  logo_url: string | null;
  logo_position: string;
  show_customer_email: boolean;
  show_customer_phone: boolean;
  show_status: boolean;
  show_total_bottles: boolean;
  show_date: boolean;
  custom_html: string | null;
}

interface OrderLabelProps {
  orderUid: string;
  humanUid: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  subtotal: number;
  totalBottles: number;
  createdDate: string;
  status: string;
  settings?: LabelSettings;
}

const OrderLabel = forwardRef<HTMLDivElement, OrderLabelProps>(
  ({ orderUid, humanUid, customerName, customerEmail, customerPhone, subtotal, totalBottles, createdDate, status, settings }, ref) => {
    const width = settings?.size_width || 4;
    const height = settings?.size_height || 6;
    const showQR = settings?.show_qr_code ?? true;
    const showLogo = settings?.show_logo ?? false;
    const logoUrl = settings?.logo_url;
    const logoPosition = settings?.logo_position || 'top';
    const showEmail = settings?.show_customer_email ?? true;
    const showPhone = settings?.show_customer_phone ?? true;
    const showStatus = settings?.show_status ?? true;
    const showBottles = settings?.show_total_bottles ?? true;
    const showDate = settings?.show_date ?? true;

    const replaceVariables = (html: string) => {
      const qrCodeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140"><rect width="140" height="140" fill="white"/><g transform="translate(10,10)">${generateQRCodePath(orderUid)}</g></svg>`;
      
      return html
        .replace(/\{\{qrCode\}\}/g, qrCodeSvg)
        .replace(/\{\{orderUid\}\}/g, orderUid)
        .replace(/\{\{humanUid\}\}/g, humanUid)
        .replace(/\{\{customerName\}\}/g, customerName)
        .replace(/\{\{customerEmail\}\}/g, customerEmail || '')
        .replace(/\{\{customerPhone\}\}/g, customerPhone || '')
        .replace(/\{\{subtotal\}\}/g, subtotal.toFixed(2))
        .replace(/\{\{totalBottles\}\}/g, totalBottles.toString())
        .replace(/\{\{status\}\}/g, status)
        .replace(/\{\{date\}\}/g, new Date(createdDate).toLocaleDateString());
    };

    const generateQRCodePath = (value: string) => {
      // Simple QR code placeholder - in production, this would generate actual QR code paths
      return `<rect width="120" height="120" fill="black"/><text x="60" y="60" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="white">QR: ${value.substring(0, 8)}</text>`;
    };

    if (settings?.custom_html) {
      return (
        <div ref={ref} className="print:block">
          <style>{`
            @media print {
              @page {
                size: ${width}in ${height}in;
                margin: 0.25in;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
          `}</style>
          <div dangerouslySetInnerHTML={{ __html: replaceVariables(settings.custom_html) }} />
        </div>
      );
    }

    return (
      <div ref={ref} className="print:block">
        <style>{`
          @media print {
            @page {
              size: ${width}in ${height}in;
              margin: 0.25in;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
        `}</style>
        
        <div className="w-full h-full p-6 bg-white text-black border-4 border-black">
          <div className="flex flex-col items-center gap-4">
            {showLogo && logoUrl && logoPosition === 'top' && (
              <img src={logoUrl} alt="Logo" className="h-12 object-contain" />
            )}

            {showQR && (
              <div className="p-4 bg-white">
                <QRCodeSVG 
                  value={orderUid} 
                  size={140}
                  level="H"
                  includeMargin={false}
                />
              </div>
            )}

            <div className="text-center space-y-2 w-full">
              <div className="text-3xl font-bold font-mono border-2 border-black p-2">
                {humanUid}
              </div>
              
              <div className="text-sm space-y-1 border-t-2 border-black pt-2 mt-2">
                <div className="font-bold text-lg">{customerName}</div>
                {showEmail && customerEmail && <div className="text-xs">{customerEmail}</div>}
                {showPhone && customerPhone && <div className="text-xs">{customerPhone}</div>}
              </div>

              <div className="text-sm space-y-1 border-t-2 border-black pt-2 mt-2">
                {showStatus && <div className="font-semibold">Status: {status}</div>}
                <div className="font-semibold">Total: ${subtotal.toFixed(2)}</div>
                {showBottles && <div className="text-xs">Bottles: {totalBottles}</div>}
                {showDate && <div className="text-xs">{new Date(createdDate).toLocaleDateString()}</div>}
              </div>
            </div>

            {showLogo && logoUrl && logoPosition === 'bottom' && (
              <img src={logoUrl} alt="Logo" className="h-12 object-contain" />
            )}
          </div>
        </div>
      </div>
    );
  }
);

OrderLabel.displayName = 'OrderLabel';

export default OrderLabel;
