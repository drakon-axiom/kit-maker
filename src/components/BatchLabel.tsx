import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface BatchLabelProps {
  batchUid: string;
  humanUid: string;
  orderUid: string;
  customerName: string;
  quantity: number;
  createdDate: string;
}

const BatchLabel = forwardRef<HTMLDivElement, BatchLabelProps>(
  ({ batchUid, humanUid, orderUid, customerName, quantity, createdDate }, ref) => {
    return (
      <div ref={ref} className="print:block">
        <style>{`
          @media print {
            @page {
              size: 4in 3in;
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
                value={batchUid} 
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Batch Info */}
            <div className="text-center space-y-2 w-full">
              <div className="text-3xl font-bold font-mono border-2 border-black p-2">
                {humanUid}
              </div>
              
              <div className="text-sm space-y-1">
                <div className="font-semibold">Order: {orderUid}</div>
                <div className="font-semibold truncate">{customerName}</div>
                <div className="text-xs">Qty: {quantity} bottles</div>
                <div className="text-xs">{new Date(createdDate).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

BatchLabel.displayName = 'BatchLabel';

export default BatchLabel;
