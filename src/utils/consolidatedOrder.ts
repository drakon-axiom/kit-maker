// Consolidated Order utilities for add-on handling

import { supabase } from '@/integrations/supabase/client';

export interface AddOnOrder {
  id: string;
  human_uid: string;
  subtotal: number;
  status: string;
  sales_order_lines: Array<{
    id: string;
    sell_mode: string;
    qty_entered: number;
    bottle_qty: number;
    unit_price: number;
    line_subtotal: number;
    sku: {
      code: string;
      description: string;
    };
  }>;
}

export interface ConsolidatedOrderData {
  parentOrder: {
    id: string;
    human_uid: string;
    subtotal: number;
    status: string;
  };
  addOnOrders: AddOnOrder[];
  consolidatedTotal: number;
  totalLineItems: number;
  totalBottles: number;
}

/**
 * Statuses where consolidation view should be shown (fulfillment phase)
 */
const CONSOLIDATED_VIEW_STATUSES = [
  'in_packing',
  'packed',
  'awaiting_invoice',
  'awaiting_payment',
  'ready_to_ship',
  'shipped',
];

/**
 * Check if an order should show the consolidated view
 */
export const shouldShowConsolidatedView = (status: string): boolean => {
  return CONSOLIDATED_VIEW_STATUSES.includes(status);
};

/**
 * Fetch all add-on orders linked to a parent order with their line items
 */
export const fetchAddOnOrders = async (parentOrderId: string): Promise<AddOnOrder[]> => {
  const { data, error } = await supabase
    .from('order_addons')
    .select(`
      id,
      addon_so_id,
      addon_order:sales_orders!order_addons_addon_so_id_fkey (
        id,
        human_uid,
        subtotal,
        status,
        sales_order_lines (
          id,
          sell_mode,
          qty_entered,
          bottle_qty,
          unit_price,
          line_subtotal,
          sku:skus (
            code,
            description
          )
        )
      )
    `)
    .eq('parent_so_id', parentOrderId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Transform the nested data structure
  return (data || []).map((addon) => {
    const order = addon.addon_order as unknown as AddOnOrder;
    return {
      id: order.id,
      human_uid: order.human_uid,
      subtotal: order.subtotal,
      status: order.status,
      sales_order_lines: order.sales_order_lines || [],
    };
  });
};

/**
 * Calculate consolidated totals for a parent order and its add-ons
 */
export const calculateConsolidatedTotals = (
  parentSubtotal: number,
  parentLineItems: Array<{ bottle_qty: number }>,
  addOnOrders: AddOnOrder[]
): { total: number; lineItemCount: number; bottleCount: number } => {
  const addOnTotal = addOnOrders.reduce((sum, addon) => sum + (addon.subtotal || 0), 0);
  
  const parentBottles = parentLineItems.reduce((sum, line) => sum + (line.bottle_qty || 0), 0);
  const addOnBottles = addOnOrders.reduce(
    (sum, addon) => sum + addon.sales_order_lines.reduce(
      (lineSum, line) => lineSum + (line.bottle_qty || 0), 0
    ),
    0
  );
  
  const parentLineCount = parentLineItems.length;
  const addOnLineCount = addOnOrders.reduce(
    (sum, addon) => sum + addon.sales_order_lines.length, 0
  );
  
  return {
    total: parentSubtotal + addOnTotal,
    lineItemCount: parentLineCount + addOnLineCount,
    bottleCount: parentBottles + addOnBottles,
  };
};

/**
 * Get all line items from parent order and add-ons, grouped by source
 */
export interface GroupedLineItem {
  sourceOrderId: string;
  sourceOrderUid: string;
  isAddOn: boolean;
  lineItem: {
    id: string;
    sell_mode: string;
    qty_entered: number;
    bottle_qty: number;
    unit_price: number;
    line_subtotal: number;
    sku: {
      code: string;
      description: string;
    };
  };
}

export const getConsolidatedLineItems = (
  parentOrderId: string,
  parentOrderUid: string,
  parentLineItems: Array<{
    id: string;
    sell_mode: string;
    qty_entered: number;
    bottle_qty: number;
    unit_price: number;
    line_subtotal: number;
    sku: { code: string; description: string };
  }>,
  addOnOrders: AddOnOrder[]
): GroupedLineItem[] => {
  const result: GroupedLineItem[] = [];
  
  // Add parent order items first
  parentLineItems.forEach((line) => {
    result.push({
      sourceOrderId: parentOrderId,
      sourceOrderUid: parentOrderUid,
      isAddOn: false,
      lineItem: line,
    });
  });
  
  // Add add-on order items
  addOnOrders.forEach((addon) => {
    addon.sales_order_lines.forEach((line) => {
      result.push({
        sourceOrderId: addon.id,
        sourceOrderUid: addon.human_uid,
        isAddOn: true,
        lineItem: line,
      });
    });
  });
  
  return result;
};

/**
 * Check if an order has any add-ons
 */
export const hasAddOns = async (orderId: string): Promise<boolean> => {
  const { count, error } = await supabase
    .from('order_addons')
    .select('id', { count: 'exact', head: true })
    .eq('parent_so_id', orderId);

  if (error) return false;
  return (count || 0) > 0;
};

/**
 * Get add-on count for an order
 */
export const getAddOnCount = async (orderId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('order_addons')
    .select('id', { count: 'exact', head: true })
    .eq('parent_so_id', orderId);

  if (error) return 0;
  return count || 0;
};
