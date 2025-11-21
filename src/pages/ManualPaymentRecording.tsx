import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, DollarSign, AlertCircle, CheckCircle2 } from "lucide-react";

export default function ManualPaymentRecording() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState<"deposit" | "final">("final");
  const [notes, setNotes] = useState("");
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  const searchOrder = async () => {
    if (!orderNumber.trim()) {
      toast({
        title: "Order number required",
        description: "Please enter an order number to search",
        variant: "destructive",
      });
      return;
    }

    setSearching(true);
    try {
      // Fetch order details
      const { data: order, error: orderError } = await supabase
        .from("sales_orders")
        .select("*, customers(name, email)")
        .eq("human_uid", orderNumber.trim())
        .single();

      if (orderError || !order) {
        toast({
          title: "Order not found",
          description: `No order found with number ${orderNumber}`,
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
        console.error("Error fetching invoices:", invoiceError);
      }

      setOrderDetails(order);
      setInvoices(invoiceData || []);
      toast({
        title: "Order found",
        description: `Order ${order.human_uid} - ${order.customers.name}`,
      });
    } catch (error) {
      console.error("Error searching order:", error);
      toast({
        title: "Search failed",
        description: "Failed to search for order",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
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

      toast({
        title: "Payment recorded",
        description: `Successfully recorded ${paymentType} payment of $${amountNum}`,
      });

      // Reset form
      setAmount("");
      setNotes("");
      setOrderDetails(null);
      setInvoices([]);
      setOrderNumber("");
    } catch (error: any) {
      console.error("Error recording payment:", error);
      toast({
        title: "Failed to record payment",
        description: error.message || "An error occurred while recording the payment",
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
    <Layout>
      <div className="container mx-auto py-8 max-w-3xl">
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
              {/* Order Search */}
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="orderNumber">Order Number</Label>
                    <Input
                      id="orderNumber"
                      placeholder="SO-XXXX"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                      disabled={loading}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={searchOrder}
                    disabled={searching || !orderNumber.trim()}
                    className="mt-8"
                  >
                    {searching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
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
              </div>

              {orderDetails && (
                <>
                  {/* Payment Type */}
                  <div className="space-y-2">
                    <Label htmlFor="paymentType">Payment Type</Label>
                    <Select value={paymentType} onValueChange={(value: "deposit" | "final") => setPaymentType(value)}>
                      <SelectTrigger id="paymentType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="final">Final Payment</SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedInvoice && (
                      <p className="text-sm text-muted-foreground">
                        {paymentType === "deposit" ? "Deposit" : "Final"} invoice total: ${selectedInvoice.total}
                        {selectedInvoice.status === "paid" && (
                          <span className="ml-2 text-green-600 font-medium">(Already Paid)</span>
                        )}
                      </p>
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
    </Layout>
  );
}
