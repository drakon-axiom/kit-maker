import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Layers, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  fetchAddOnOrders,
  getConsolidatedLineItems,
  shouldShowConsolidatedView,
  AddOnOrder,
  GroupedLineItem,
} from '@/utils/consolidatedOrder';

interface ConsolidatedLineItemsProps {
  orderId: string;
  orderUid: string;
  orderStatus: string;
  parentLineItems: Array<{
    id: string;
    sell_mode: string;
    qty_entered: number;
    bottle_qty: number;
    unit_price: number;
    line_subtotal: number;
    sku: { code: string; description: string };
  }>;
}

export function ConsolidatedLineItems({
  orderId,
  orderUid,
  orderStatus,
  parentLineItems,
}: ConsolidatedLineItemsProps) {
  const [addOns, setAddOns] = useState<AddOnOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConsolidated, setShowConsolidated] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const addOnData = await fetchAddOnOrders(orderId);
      setAddOns(addOnData);
    } catch (error) {
      console.error('Error fetching add-ons:', error);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Don't show consolidated view for non-fulfillment statuses
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

  // No add-ons, don't show consolidated view
  if (addOns.length === 0) {
    return null;
  }

  const consolidatedItems = getConsolidatedLineItems(orderId, orderUid, parentLineItems, addOns);
  const totalBottles = consolidatedItems.reduce((sum, item) => sum + item.lineItem.bottle_qty, 0);
  const totalValue = consolidatedItems.reduce((sum, item) => sum + item.lineItem.line_subtotal, 0);

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Consolidated Line Items
            </CardTitle>
            <CardDescription>
              {consolidatedItems.length} item(s) from {addOns.length + 1} orders • {totalBottles.toLocaleString()} bottles • ${totalValue.toFixed(2)} total
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConsolidated(!showConsolidated)}
          >
            {showConsolidated ? (
              <>
                <EyeOff className="h-4 w-4 mr-1" />
                Hide Consolidated
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Show Consolidated
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      {showConsolidated && (
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Bottles</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consolidatedItems.map((item, index) => (
                <TableRow key={`${item.sourceOrderId}-${item.lineItem.id}`} className={item.isAddOn ? 'bg-muted/30' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link
                        to={`/orders/${item.sourceOrderId}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {item.sourceOrderUid}
                      </Link>
                      {item.isAddOn && (
                        <Badge variant="secondary" className="text-xs">Add-On</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{item.lineItem.sku.code}</TableCell>
                  <TableCell>{item.lineItem.sku.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {item.lineItem.sell_mode}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.lineItem.qty_entered}</TableCell>
                  <TableCell className="font-mono">{item.lineItem.bottle_qty}</TableCell>
                  <TableCell>${item.lineItem.unit_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${item.lineItem.line_subtotal.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="font-bold border-t-2">
                <TableCell colSpan={5}>Consolidated Total</TableCell>
                <TableCell className="font-mono">{totalBottles.toLocaleString()}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right text-primary">${totalValue.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}
