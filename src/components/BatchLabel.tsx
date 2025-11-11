import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { renderToStaticMarkup } from 'react-dom/server';

interface LabelSettings {
  size_width: number;
  size_height: number;
  show_qr_code: boolean;
  show_logo: boolean;
  logo_url: string | null;
  logo_position: string;
  show_batch_quantity: boolean;
  show_order_reference: boolean;
  show_date: boolean;
  custom_html: string | null;
}

interface BatchLabelProps {
  batchUid: string;
  humanUid: string;
  orderUid: string;
  customerName: string;
  quantity: number;
  createdDate: string;
  settings?: LabelSettings;
}

const BatchLabel = forwardRef<HTMLDivElement, BatchLabelProps>(
  ({ batchUid, humanUid, orderUid, customerName, quantity, createdDate, settings }, ref) => {
    const width = settings?.size_width || 4;
    const height = settings?.size_height || 3;
    const showQR = settings?.show_qr_code ?? true;
    const showLogo = settings?.show_logo ?? false;
    const logoUrl = settings?.logo_url;
    const logoPosition = settings?.logo_position || 'top';
    const showQuantity = settings?.show_batch_quantity ?? true;
    const showOrderRef = settings?.show_order_reference ?? true;
    const showDate = settings?.show_date ?? true;

    const replaceVariables = (html: string) => {
      const qrCodeSvg = renderToStaticMarkup(
        <QRCodeSVG 
          value={batchUid} 
          size={180}
          level="H"
          includeMargin={false}
        />
      );
      
      return html
        .replace(/\{\{qrCode\}\}/g, qrCodeSvg)
        .replace(/\{\{batchUid\}\}/g, batchUid)
        .replace(/\{\{humanUid\}\}/g, humanUid)
        .replace(/\{\{orderUid\}\}/g, orderUid)
        .replace(/\{\{customerName\}\}/g, customerName)
        .replace(/\{\{quantity\}\}/g, quantity.toString())
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
              <img src={logoUrl} alt="Logo" className="h-8 object-contain" />
            )}

            {showQR && (
              <div className="p-4 bg-white">
                <QRCodeSVG 
                  value={batchUid} 
                  size={180}
                  level="H"
                  includeMargin={false}
                />
              </div>
            )}

            <div className="text-center space-y-2 w-full">
              <div className="text-3xl font-bold font-mono border-2 border-black p-2">
                {humanUid}
              </div>
              
              <div className="text-sm space-y-1">
                {showOrderRef && <div className="font-semibold">Order: {orderUid}</div>}
                <div className="font-semibold truncate">{customerName}</div>
                {showQuantity && <div className="text-xs">Qty: {quantity} bottles</div>}
                {showDate && <div className="text-xs">{new Date(createdDate).toLocaleDateString()}</div>}
              </div>
            </div>

            {showLogo && logoUrl && logoPosition === 'bottom' && (
              <img src={logoUrl} alt="Logo" className="h-8 object-contain" />
            )}
          </div>
        </div>
      </div>
    );
  }
);

BatchLabel.displayName = 'BatchLabel';

export default BatchLabel;
