import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Layers, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  fetchAddOnOrders, 
  calculateConsolidatedTotals, 
  shouldShowConsolidatedView,
  AddOnOrder 
} from '@/utils/consolidatedOrder';

interface ConsolidatedOrderSummaryProps {
  orderId: string;
  orderUid: string;
  orderStatus: string;
  orderSubtotal: number;
  parentLineItems: Array<{ bottle_qty: number }>;
}

export function ConsolidatedOrderSummary({
  orderId,
  orderUid,
  orderStatus,
  orderSubtotal,
  parentLineItems,
}: ConsolidatedOrderSummaryProps) {
  const [addOns, setAddOns] = useState<AddOnOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const addOnData = await fetchAddOnOrders(orderId);
      setAddOns(addOnData);
    } catch (error) {
      console.error('Error fetching add-ons for consolidation:', error);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Don't render if not in consolidation phase or no add-ons
  if (!shouldShowConsolidatedView(orderStatus)) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (addOns.length === 0) {
    return null;
  }

  const { total, lineItemCount, bottleCount } = calculateConsolidatedTotals(
    orderSubtotal,
    parentLineItems,
    addOns
  );

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Consolidated Order Summary
          </CardTitle>
          <Badge variant="secondary">
            {addOns.length + 1} orders combined
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{lineItemCount}</p>
            <p className="text-xs text-muted-foreground">Total Line Items</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{bottleCount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Bottles</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">${total.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Combined Subtotal</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Hide Breakdown' : 'View Breakdown'}
        </Button>

        {expanded && (
          <div className="space-y-2 pt-2 border-t">
            {/* Parent Order */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium">{orderUid}</span>
                <Badge variant="outline" className="text-xs">Parent</Badge>
              </div>
              <span className="font-medium">${orderSubtotal.toFixed(2)}</span>
            </div>

            {/* Add-on Orders */}
            {addOns.map((addon) => (
              <div key={addon.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/orders/${addon.id}`}
                    className="font-mono font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    {addon.human_uid}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <Badge variant="secondary" className="text-xs">Add-On</Badge>
                </div>
                <span className="font-medium">+ ${addon.subtotal.toFixed(2)}</span>
              </div>
            ))}

            {/* Total */}
            <div className="flex items-center justify-between py-2 border-t font-bold">
              <span>Consolidated Total</span>
              <span className="text-primary">${total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
