import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

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
}

const OrderLabel = forwardRef<HTMLDivElement, OrderLabelProps>(
  ({ orderUid, humanUid, customerName, customerEmail, customerPhone, subtotal, totalBottles, createdDate, status }, ref) => {
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
          <div className="flex flex-col items-center gap-4">
            {/* QR Code */}
            <div className="p-4 bg-white">
              <QRCodeSVG 
                value={orderUid} 
                size={140}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Order Info */}
            <div className="text-center space-y-2 w-full">
              <div className="text-3xl font-bold font-mono border-2 border-black p-2">
                {humanUid}
              </div>
              
              <div className="text-sm space-y-1 border-t-2 border-black pt-2 mt-2">
                <div className="font-bold text-lg">{customerName}</div>
                {customerEmail && <div className="text-xs">{customerEmail}</div>}
                {customerPhone && <div className="text-xs">{customerPhone}</div>}
              </div>

              <div className="text-sm space-y-1 border-t-2 border-black pt-2 mt-2">
                <div className="font-semibold">Status: {status}</div>
                <div className="font-semibold">Total: ${subtotal.toFixed(2)}</div>
                <div className="text-xs">Bottles: {totalBottles}</div>
                <div className="text-xs">{new Date(createdDate).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

OrderLabel.displayName = 'OrderLabel';

export default OrderLabel;
