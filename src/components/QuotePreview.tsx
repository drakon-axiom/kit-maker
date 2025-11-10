import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface QuotePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    human_uid: string;
    created_at: string;
    deposit_required: boolean;
    subtotal: number;
    customer?: {
      name: string;
      email: string;
      phone?: string;
    };
    sales_order_lines: Array<{
      qty_entered: number;
      bottle_qty: number;
      unit_price: number;
      line_subtotal: number;
      sku?: {
        code: string;
        description: string;
      };
    }>;
  };
  onSend: () => void;
  sending: boolean;
}

const QuotePreview = ({ open, onOpenChange, order, onSend, sending }: QuotePreviewProps) => {
  const depositAmount = order.subtotal * 0.5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quote Email Preview</DialogTitle>
          <DialogDescription>
            Preview of the quote email that will be sent to {order.customer?.email}
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-lg overflow-hidden">
          {/* Email Preview */}
          <div style={{ 
            fontFamily: "'Open Sans', Arial, sans-serif", 
            background: "#ffffff", 
            color: "#222",
            margin: 0,
            padding: 0
          }}>
            {/* Header */}
            <div style={{ 
              background: "#c2e4fb", 
              padding: "30px", 
              textAlign: "center" 
            }}>
              <h1 style={{ color: "#000", margin: 0, fontSize: "24px", fontWeight: "bold" }}>
                NEXUS AMINOS
              </h1>
            </div>

            {/* Content */}
            <div style={{ 
              maxWidth: "600px", 
              margin: "0 auto", 
              padding: "30px 20px" 
            }}>
              <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>
                Hello {order.customer?.name || "Customer"},
              </h2>
              
              <p style={{ marginBottom: "16px", lineHeight: "1.6" }}>
                Thank you for your interest in Nexus Aminos. Please find your quote attached to this email.
              </p>
              
              <div style={{ 
                background: "#f5f5f5", 
                padding: "16px", 
                borderRadius: "8px",
                marginBottom: "16px" 
              }}>
                <p style={{ margin: "8px 0" }}>
                  <strong>Quote Number:</strong> {order.human_uid}
                </p>
                <p style={{ margin: "8px 0" }}>
                  <strong>Date:</strong> {new Date(order.created_at).toLocaleDateString()}
                </p>
                <p style={{ margin: "8px 0" }}>
                  <strong>Customer:</strong> {order.customer?.name}
                </p>
                {order.customer?.email && (
                  <p style={{ margin: "8px 0" }}>
                    <strong>Email:</strong> {order.customer.email}
                  </p>
                )}
              </div>

              {/* Line Items Table */}
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>
                  Line Items
                </h3>
                <table style={{ 
                  width: "100%", 
                  borderCollapse: "collapse",
                  fontSize: "14px" 
                }}>
                  <thead>
                    <tr style={{ background: "#f0f0f0", borderBottom: "2px solid #ddd" }}>
                      <th style={{ padding: "8px", textAlign: "left" }}>SKU</th>
                      <th style={{ padding: "8px", textAlign: "left" }}>Quantity</th>
                      <th style={{ padding: "8px", textAlign: "right" }}>Unit Price</th>
                      <th style={{ padding: "8px", textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.sales_order_lines.map((line, index) => (
                      <tr key={index} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "8px" }}>
                          {line.sku?.code || "N/A"}
                        </td>
                        <td style={{ padding: "8px" }}>
                          {line.qty_entered} ({line.bottle_qty} bottles)
                        </td>
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          ${line.unit_price.toFixed(2)}
                        </td>
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          ${line.line_subtotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #ddd", fontWeight: "600" }}>
                      <td colSpan={3} style={{ padding: "8px", textAlign: "right" }}>
                        Subtotal:
                      </td>
                      <td style={{ padding: "8px", textAlign: "right" }}>
                        ${order.subtotal.toFixed(2)}
                      </td>
                    </tr>
                    {order.deposit_required && (
                      <tr>
                        <td colSpan={3} style={{ padding: "8px", textAlign: "right" }}>
                          Deposit Required (50%):
                        </td>
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          ${depositAmount.toFixed(2)}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>

              <p style={{ marginBottom: "16px", lineHeight: "1.6" }}>
                This quote is valid for 30 days. If you have any questions or would like to proceed with this order, please reply to this email or contact us.
              </p>
              
              {order.deposit_required && (
                <div style={{ 
                  background: "#fff3cd", 
                  border: "1px solid #ffc107",
                  padding: "12px", 
                  borderRadius: "4px",
                  marginBottom: "16px" 
                }}>
                  <strong>Note:</strong> A 50% deposit is required before production begins.
                </div>
              )}
              
              <p style={{ lineHeight: "1.6" }}>
                We look forward to working with you!
              </p>
            </div>

            {/* Footer */}
            <div style={{ 
              background: "#c2e4fb", 
              padding: "20px", 
              textAlign: "center",
              marginTop: "40px" 
            }}>
              <p style={{ margin: "8px 0", fontWeight: "500" }}>
                Nexus Aminos<br />
                info@nexusaminos.com
              </p>
              <p style={{ 
                fontSize: "12px", 
                color: "#666", 
                margin: "8px 0" 
              }}>
                © {new Date().getFullYear()} Nexus Aminos. All rights reserved.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            onClick={onSend}
            disabled={sending}
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Quote"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuotePreview;
