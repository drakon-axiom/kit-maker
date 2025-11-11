import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

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
}

const ShippingLabel = forwardRef<HTMLDivElement, ShippingLabelProps>(
  ({ orderUid, humanUid, customerName, customerEmail, customerPhone, trackingNumber, carrier, totalBottles, createdDate }, ref) => {
    return (
      <div ref={ref} className="print:block">
        <style>{`
          @media print {
            @page {
              size: 4in 6in;
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
            <div className="text-center border-b-2 border-black pb-3">
              <div className="text-2xl font-bold">SHIPPING LABEL</div>
              <div className="text-sm font-mono mt-1">{humanUid}</div>
            </div>

            {/* Ship To */}
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase">Ship To:</div>
              <div className="font-bold text-lg">{customerName}</div>
              {customerEmail && <div className="text-sm">{customerEmail}</div>}
              {customerPhone && <div className="text-sm">{customerPhone}</div>}
            </div>

            {/* Tracking Info */}
            {(trackingNumber || carrier) && (
              <div className="space-y-1 border-t-2 border-black pt-3">
                {carrier && <div className="text-sm"><span className="font-bold">Carrier:</span> {carrier}</div>}
                {trackingNumber && (
                  <div className="text-sm">
                    <span className="font-bold">Tracking:</span>
                    <div className="font-mono text-xs mt-1">{trackingNumber}</div>
                  </div>
                )}
              </div>
            )}

            {/* Order Details */}
            <div className="space-y-1 border-t-2 border-black pt-3">
              <div className="text-sm"><span className="font-bold">Bottles:</span> {totalBottles}</div>
              <div className="text-xs">Date: {new Date(createdDate).toLocaleDateString()}</div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center border-t-2 border-black pt-3">
              <QRCodeSVG 
                value={orderUid} 
                size={120}
                level="H"
                includeMargin={false}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ShippingLabel.displayName = 'ShippingLabel';

export default ShippingLabel;
