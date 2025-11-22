import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { renderToStaticMarkup } from 'react-dom/server';
import DOMPurify from 'dompurify';

interface LabelSettings {
  size_width: number;
  size_height: number;
  show_qr_code: boolean;
  show_logo: boolean;
  logo_url: string | null;
  logo_position: string;
  show_customer_email: boolean;
  show_customer_phone: boolean;
  show_tracking_number: boolean;
  show_carrier: boolean;
  show_total_bottles: boolean;
  show_date: boolean;
  custom_html: string | null;
}

interface ShippingLabelProps {
  orderUid: string;
  humanUid: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  trackingNumber?: string;
  carrier?: string;
  totalBottles: number;
  createdDate: string;
  settings?: LabelSettings;
}

const ShippingLabel = forwardRef<HTMLDivElement, ShippingLabelProps>(
  ({ orderUid, humanUid, customerName, customerEmail, customerPhone, trackingNumber, carrier, totalBottles, createdDate, settings }, ref) => {
    const width = settings?.size_width || 4;
    const height = settings?.size_height || 6;
    const showQR = settings?.show_qr_code ?? true;
    const showLogo = settings?.show_logo ?? false;
    const logoUrl = settings?.logo_url;
    const logoPosition = settings?.logo_position || 'top';
    const showEmail = settings?.show_customer_email ?? true;
    const showPhone = settings?.show_customer_phone ?? true;
    const showTracking = settings?.show_tracking_number ?? true;
    const showCarrier = settings?.show_carrier ?? true;
    const showBottles = settings?.show_total_bottles ?? true;
    const showDate = settings?.show_date ?? true;

    const replaceVariables = (html: string) => {
      const qrCodeSvg = renderToStaticMarkup(
        <QRCodeSVG 
          value={orderUid} 
          size={120}
          level="H"
          includeMargin={false}
        />
      );

      const logoHtml = settings?.logo_url 
        ? `<img src="${settings.logo_url}" alt="Company Logo" style="max-height: 60px; object-fit: contain;" />`
        : '';
      
      return html
        .replace(/\{\{qrCode\}\}/g, qrCodeSvg)
        .replace(/\{\{logo\}\}/g, logoHtml)
        .replace(/\{\{orderUid\}\}/g, orderUid)
        .replace(/\{\{humanUid\}\}/g, humanUid)
        .replace(/\{\{customerName\}\}/g, customerName)
        .replace(/\{\{customerEmail\}\}/g, customerEmail || '')
        .replace(/\{\{customerPhone\}\}/g, customerPhone || '')
        .replace(/\{\{trackingNumber\}\}/g, trackingNumber || '')
        .replace(/\{\{carrier\}\}/g, carrier || '')
        .replace(/\{\{totalBottles\}\}/g, totalBottles.toString())
        .replace(/\{\{date\}\}/g, new Date(createdDate).toLocaleDateString());
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
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(replaceVariables(settings.custom_html)) }} />
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
          <div className="flex flex-col gap-4">
            {showLogo && logoUrl && logoPosition === 'top' && (
              <img src={logoUrl} alt="Logo" className="h-10 object-contain mb-2" />
            )}

            <div className="text-center border-b-2 border-black pb-3">
              <div className="text-2xl font-bold">SHIPPING LABEL</div>
              <div className="text-sm font-mono mt-1">{humanUid}</div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-bold uppercase">Ship To:</div>
              <div className="font-bold text-lg">{customerName}</div>
              {showEmail && customerEmail && <div className="text-sm">{customerEmail}</div>}
              {showPhone && customerPhone && <div className="text-sm">{customerPhone}</div>}
            </div>

            {(showTracking || showCarrier) && (trackingNumber || carrier) && (
              <div className="space-y-1 border-t-2 border-black pt-3">
                {showCarrier && carrier && <div className="text-sm"><span className="font-bold">Carrier:</span> {carrier}</div>}
                {showTracking && trackingNumber && (
                  <div className="text-sm">
                    <span className="font-bold">Tracking:</span>
                    <div className="font-mono text-xs mt-1">{trackingNumber}</div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1 border-t-2 border-black pt-3">
              {showBottles && <div className="text-sm"><span className="font-bold">Bottles:</span> {totalBottles}</div>}
              {showDate && <div className="text-xs">Date: {new Date(createdDate).toLocaleDateString()}</div>}
            </div>

            {showQR && (
              <div className="flex justify-center border-t-2 border-black pt-3">
                <QRCodeSVG 
                  value={orderUid} 
                  size={120}
                  level="H"
                  includeMargin={false}
                />
              </div>
            )}

            {showLogo && logoUrl && logoPosition === 'bottom' && (
              <img src={logoUrl} alt="Logo" className="h-10 object-contain mt-2" />
            )}
          </div>
        </div>
      </div>
    );
  }
);

ShippingLabel.displayName = 'ShippingLabel';

export default ShippingLabel;
