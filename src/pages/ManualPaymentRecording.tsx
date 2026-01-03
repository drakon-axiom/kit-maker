import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, DollarSign, AlertCircle, CheckCircle2 } from "lucide-react";

interface EligibleOrder {
  id: string;
  human_uid: string;
  customer_name: string;
  customer_email: string;
  subtotal: number;
  status: string;
  unpaid_invoices: {
    type: "deposit" | "final";
    total: number;
  }[];
}

export default function ManualPaymentRecording() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [eligibleOrders, setEligibleOrders] = useState<EligibleOrder[]>([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState<"deposit" | "final">("final");
  const [notes, setNotes] = useState("");
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  const fetchEligibleOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      // Fetch all orders with their customers
      const { data: orders, error: ordersError } = await supabase
        .from("sales_orders")
        .select("id, human_uid, status, subtotal, customers(name, email)")
        .in("status", [
          "awaiting_payment",
          "deposit_due",
          "awaiting_invoice",
          "invoiced",
          "payment_due"
        ])
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch all unpaid invoices
      const { data: allInvoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("*")
        .neq("status", "paid");

      if (invoicesError) throw invoicesError;

      // Map orders with their invoice info
      const eligible: EligibleOrder[] = orders
        ?.map(order => {
          const orderInvoices = allInvoices?.filter(inv => inv.so_id === order.id) || [];
          return {
            id: order.id,
            human_uid: order.human_uid,
            customer_name: order.customers?.name || "Unknown",
            customer_email: order.customers?.email || "",
            subtotal: order.subtotal,
            status: order.status,
            unpaid_invoices: orderInvoices.map(inv => ({
              type: inv.type as "deposit" | "final",
              total: inv.total,
            })),
          };
        }) || [];

      setEligibleOrders(eligible);
    } catch (error) {
      // Error handled silently
      toast({
        title: "Failed to load orders",
        description: "Could not fetch eligible orders",
        variant: "destructive",
      });
    } finally {
      setLoadingOrders(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEligibleOrders();
  }, [fetchEligibleOrders]);

  const handleOrderSelect = async (selectedOrderNumber: string) => {
    setOrderNumber(selectedOrderNumber);
    
    try {
      // Fetch order details
      const { data: order, error: orderError } = await supabase
        .from("sales_orders")
        .select("*, customers(name, email)")
        .eq("human_uid", selectedOrderNumber)
        .maybeSingle();

      if (orderError || !order) {
        toast({
          title: "Order not found",
          description: `No order found with number ${selectedOrderNumber}`,
          variant: "destructive",
        });
        setOrderDetails(null);
        setInvoices([]);
        return;
      }

      // Fetch invoices
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq("so_id", order.id);

      if (invoiceError) {
        // Error handled silently
      }

      setOrderDetails(order);
      setInvoices(invoiceData || []);
    } catch (error) {
      // Error handled silently
      toast({
        title: "Failed to load order",
        description: "Could not fetch order details",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orderDetails) {
      toast({
        title: "No order selected",
        description: "Please search for an order first",
        variant: "destructive",
      });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("record-manual-payment", {
        body: {
          orderNumber: orderNumber.trim(),
          amount: amountNum,
          paymentType,
          notes: notes.trim() || undefined,
        },
      });

      if (error) throw error;

      // Generate and download receipt
      if (data?.paymentId) {
        try {
          const { data: receiptHtml, error: receiptError } = await supabase.functions.invoke(
            "generate-manual-payment-receipt",
            {
              body: { paymentId: data.paymentId },
            }
          );

          if (!receiptError && receiptHtml) {
            // Create a blob and download
            const blob = new Blob([receiptHtml], { type: "text/html" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `receipt-${orderNumber}-${paymentType}.html`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          }
        } catch (receiptErr) {
          // Error handled silently
          // Don't fail the whole operation if receipt generation fails
        }
      }

      toast({
        title: "Payment recorded",
        description: `Successfully recorded ${paymentType} payment of $${amountNum}. Receipt downloaded.`,
      });

      // Reset form
      setAmount("");
      setNotes("");
      setOrderDetails(null);
      setInvoices([]);
      setOrderNumber("");
    } catch (error) {
      // Error handled silently
      toast({
        title: "Failed to record payment",
        description: error instanceof Error ? error.message : "An error occurred while recording the payment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedInvoice = invoices.find(inv => inv.type === paymentType);
  const amountNum = parseFloat(amount);
  const amountExceedsInvoice = selectedInvoice && !isNaN(amountNum) && amountNum > selectedInvoice.total;
  const isPartialPayment = selectedInvoice && !isNaN(amountNum) && amountNum > 0 && amountNum < selectedInvoice.total;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-6 w-6" />
              Manual CashApp Payment Recording
            </CardTitle>
            <CardDescription>
              Search for an order and record a manual CashApp payment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Order Selection */}
              <div className="space-y-2">
                <Label htmlFor="orderNumber">Select Order</Label>
                {loadingOrders ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : eligibleOrders.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No orders with outstanding payments found
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Select value={orderNumber} onValueChange={handleOrderSelect}>
                    <SelectTrigger id="orderNumber" className="bg-background">
                      <SelectValue placeholder="Select an order..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {eligibleOrders.map((order) => (
                        <SelectItem key={order.id} value={order.human_uid}>
                          <div className="flex flex-col">
                            <span className="font-medium">{order.human_uid}</span>
                            <span className="text-sm text-muted-foreground">
                              {order.customer_name} - ${order.subtotal}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Order Details Display */}
              {orderDetails && (
                <Alert className="bg-muted">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-semibold">{orderDetails.customers.name}</p>
                      <p className="text-sm text-muted-foreground">{orderDetails.customers.email}</p>
                      <p className="text-sm">Status: <span className="font-medium">{orderDetails.status}</span></p>
                      <p className="text-sm">Subtotal: <span className="font-medium">${orderDetails.subtotal}</span></p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {orderDetails && (
                <>
                  {/* Payment Type */}
                  <div className="space-y-2">
                    <Label htmlFor="paymentType">Payment Type</Label>
                    <Select 
                      value={paymentType} 
                      onValueChange={(value: "deposit" | "final") => {
                        setPaymentType(value);
                        const invoice = invoices.find(inv => inv.type === value);
                        if (invoice) {
                          setAmount(invoice.total.toString());
                        } else if (orderDetails) {
                          // Fallback to order subtotal if no invoice exists
                          setAmount(orderDetails.subtotal.toString());
                        }
                      }}
                    >
                      <SelectTrigger id="paymentType" className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="final">Final Payment</SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedInvoice ? (
                      <p className="text-sm text-muted-foreground">
                        {paymentType === "deposit" ? "Deposit" : "Final"} invoice total: ${selectedInvoice.total}
                        {selectedInvoice.status === "paid" && (
                          <span className="ml-2 text-green-600 font-medium">(Already Paid)</span>
                        )}
                      </p>
                    ) : (
                      <Alert variant="destructive" className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No {paymentType} invoice exists. Using order subtotal (${orderDetails?.subtotal || 0}).
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <Label htmlFor="amount">Payment Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={loading}
                      required
                    />
                    {amountExceedsInvoice && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Amount exceeds invoice total of ${selectedInvoice.total}
                        </AlertDescription>
                      </Alert>
                    )}
                    {isPartialPayment && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          This will be recorded as a partial payment
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add any additional notes about this payment..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={loading}
                      rows={3}
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || !amount || amountExceedsInvoice}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Recording Payment...
                      </>
                    ) : (
                      "Record Payment"
                    )}
                  </Button>
                </>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
