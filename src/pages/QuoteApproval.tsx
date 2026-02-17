import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function QuoteApproval() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get("token");
  
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchQuote = async () => {
      if (!token) {
        setError("Invalid quote link");
        setLoading(false);
        return;
      }

      try {
        // Use the secure public_quotes view that only exposes necessary data
        const quoteResult = await supabase
          .from("public_quotes")
          .select("*")
          .eq("quote_link_token", token)
          .single();

        if (quoteResult.error || !quoteResult.data) {
          setError("Quote not found or link expired");
          setLoading(false);
          return;
        }

        // Get line items separately using the order ID
        const linesResult = await supabase
          .from("sales_order_lines")
          .select(`
            qty_entered,
            bottle_qty,
            unit_price,
            line_subtotal,
            sku:skus (
              code,
              description
            )
          `)
          .eq("so_id", quoteResult.data.id);

        // Combine the data
        const result = {
          data: {
            ...quoteResult.data,
            customer: { name: quoteResult.data.customer_name },
            sales_order_lines: linesResult.data || []
          },
          error: null
        };

        if (result.error || !result.data) {
          setError("Quote not found or link expired");
        } else if (result.data.status !== "quoted") {
          setError("This quote has already been processed");
        } else {
          setOrder(result.data);
        }
      } catch (err) {
        setError("Failed to load quote");
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, [token]);

  const handleApprove = async () => {
    if (!order) return;

    setApproving(true);
    try {
      // Call the accept-quote edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/accept-quote?orderId=${order.id}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok || response.redirected) {
        setApproved(true);
        toast({
          title: "Quote Approved",
          description: "Thank you! Your quote has been approved.",
        });
        
        // If there's a redirect URL (payment link), validate and follow it
        if (response.redirected) {
          const redirectUrl = new URL(response.url);
          // Security: Only follow redirects to same origin or known domains
          if (redirectUrl.origin === window.location.origin || redirectUrl.hostname.endsWith('.supabase.co')) {
            window.location.href = response.url;
          }
        }
      } else {
        throw new Error("Failed to approve quote");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to approve quote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <CardTitle>Quote Approved</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Thank you for approving the quote! You will receive further instructions via email.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const depositAmount = order?.deposit_amount || 0;
  const depositPercentage = order?.subtotal > 0 
    ? Math.round((depositAmount / order.subtotal) * 100) 
    : 0;

  const expiresAt = order?.quote_expires_at ? new Date(order.quote_expires_at) : null;
  const isExpired = expiresAt && expiresAt < new Date();
  const expiresFormatted = expiresAt?.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Quote Review</CardTitle>
            <CardDescription>
              Quote #{order?.human_uid} • {new Date(order?.created_at).toLocaleDateString()}
              {expiresAt && (
                <span className={`ml-2 ${isExpired ? 'text-destructive' : 'text-amber-600'}`}>
                  • {isExpired ? 'Expired' : 'Expires'}: {expiresFormatted}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Customer Info */}
            <div>
              <h3 className="font-semibold mb-2">Customer Information</h3>
              <p className="text-sm text-muted-foreground">{order?.customer?.name}</p>
              <p className="text-sm text-muted-foreground">{order?.customer?.email}</p>
              {order?.customer?.phone && (
                <p className="text-sm text-muted-foreground">{order?.customer?.phone}</p>
              )}
            </div>

            {/* Line Items */}
            <div>
              <h3 className="font-semibold mb-2">Items</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium">SKU</th>
                      <th className="text-left p-3 text-sm font-medium">Description</th>
                      <th className="text-right p-3 text-sm font-medium">Qty</th>
                      <th className="text-right p-3 text-sm font-medium">Price</th>
                      <th className="text-right p-3 text-sm font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order?.sales_order_lines?.map((line: any, idx: number) => (
                      <tr key={idx} className="border-t">
                        <td className="p-3 text-sm">{line.sku?.code}</td>
                        <td className="p-3 text-sm">{line.sku?.description}</td>
                        <td className="p-3 text-sm text-right">
                          {line.qty_entered} ({line.bottle_qty} bottles)
                        </td>
                        <td className="p-3 text-sm text-right">${line.unit_price.toFixed(2)}</td>
                        <td className="p-3 text-sm text-right">${line.line_subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted">
                    <tr>
                      <td colSpan={4} className="p-3 text-right font-semibold">Subtotal:</td>
                      <td className="p-3 text-right font-semibold">${order?.subtotal.toFixed(2)}</td>
                    </tr>
                    {order?.deposit_required && depositAmount > 0 && (
                      <tr>
                        <td colSpan={4} className="p-3 text-right text-sm">
                          Deposit Required ({depositPercentage}%):
                        </td>
                        <td className="p-3 text-right text-sm">${depositAmount.toFixed(2)}</td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Approval Section */}
            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">Approve This Quote</h3>
              {isExpired ? (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                  <p className="text-destructive font-semibold">
                    ⚠️ This quote has expired and can no longer be approved.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Please contact us to request a new quote.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    By clicking the button below, you approve this quote and authorize us to proceed with your order.
                    {order?.deposit_required && depositAmount > 0 && (
                      <span> You will be redirected to complete the deposit payment.</span>
                    )}
                  </p>
                  {expiresAt && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-amber-800">
                        ⏰ This quote expires on <strong>{expiresFormatted}</strong>. Please approve before the expiration date to secure this pricing.
                      </p>
                    </div>
                  )}
                  <Button 
                    onClick={handleApprove} 
                    disabled={approving}
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    {approving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Approve Quote & Continue"
                    )}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
