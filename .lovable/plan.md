

# Admin Override for Late Add-Ons

## Problem Statement
When an order is already packed or in later fulfillment stages, the normal add-on window is closed. However, admins sometimes need to add forgotten items or last-minute requests from customers. Currently, there's no way to do this without manually manipulating database records.

## Proposed Solution
Add an **Admin Override** capability for add-on creation that:
1. Shows the blocked reason to the admin
2. Requires a justification note (just like status change overrides)
3. Logs the override to the audit trail
4. Automatically recalculates the `consolidated_total` after the late add-on is created

This follows the existing override pattern used in `StatusChangeDialog`.

## Implementation Details

### 1. Update Add-On Eligibility Logic (`src/utils/orderAddons.ts`)

Add a new function to check if admin override is possible:

```typescript
// Statuses where admin override is allowed (not cancelled or shipped)
const ADMIN_OVERRIDE_ALLOWED_STATUSES = [
  'in_packing',
  'packed',
  'awaiting_invoice',
  'awaiting_payment',
  'ready_to_ship',
];

export const canAdminOverrideAddon = (status: string): boolean => {
  return ADMIN_OVERRIDE_ALLOWED_STATUSES.includes(status);
};
```

### 2. Update OrderAddOnsList Component

Modify the button visibility logic to show an "Admin Override" option when:
- Normal add-on is blocked (`canCreateAddon` returns false)
- Admin override is allowed (`canAdminOverrideAddon` returns true)
- User is an admin

The UI will show the blocked reason with a warning, plus an override button:

```text
+---------------------------------------------+
| Add-On Orders                               |
+---------------------------------------------+
| [!] Add-ons blocked: Order already packed   |
|                                             |
| [Override & Add Items] (Admin Only)         |
+---------------------------------------------+
```

### 3. Add Override Confirmation Dialog

Create a new dialog or extend `AddOnCreator` to:
- Display a warning about the late add-on
- Require a justification note (mandatory)
- Show the impact on consolidated totals

```text
+---------------------------------------------+
| Override Add-On Block                       |
+---------------------------------------------+
| ! Warning: This order is already packed.    |
| Adding items will require:                  |
| - Re-calculating consolidated total         |
| - Updating final invoice (if exists)        |
|                                             |
| Justification Required *                    |
| [Customer forgot to include items...]       |
|                                             |
| This will be logged to the audit trail.     |
|                                             |
|              [Cancel] [Proceed to Add Items]|
+---------------------------------------------+
```

### 4. Extend AddOnCreator for Override Mode

Pass an `isOverride` prop and `overrideNote` to the creator:
- When `isOverride` is true, the add-on goes through normal creation
- After creation, trigger consolidated total recalculation
- Log the override action with justification

### 5. Add Consolidated Total Recalculation

Create a utility function to recalculate `consolidated_total`:

```typescript
export const recalculateConsolidatedTotal = async (parentOrderId: string): Promise<number> => {
  // Fetch parent order subtotal
  const { data: parent } = await supabase
    .from('sales_orders')
    .select('subtotal')
    .eq('id', parentOrderId)
    .single();

  // Fetch all add-on subtotals
  const { data: addons } = await supabase
    .from('order_addons')
    .select('addon_order:sales_orders!order_addons_addon_so_id_fkey(subtotal)')
    .eq('parent_so_id', parentOrderId);

  const total = (parent?.subtotal || 0) + 
    addons.reduce((sum, a) => sum + (a.addon_order?.subtotal || 0), 0);

  // Update parent order
  await supabase
    .from('sales_orders')
    .update({ consolidated_total: total })
    .eq('id', parentOrderId);

  return total;
};
```

### 6. Update Existing Final Invoice (if applicable)

After recalculating the consolidated total, check if there's an unpaid final invoice and update it:

```typescript
// If unpaid final invoice exists, update its total
const { data: invoice } = await supabase
  .from('invoices')
  .select('*')
  .eq('so_id', parentOrderId)
  .eq('type', 'final')
  .eq('status', 'unpaid')
  .single();

if (invoice) {
  await supabase
    .from('invoices')
    .update({ 
      subtotal: newConsolidatedTotal,
      total: newConsolidatedTotal + (invoice.tax || 0)
    })
    .eq('id', invoice.id);
}
```

### 7. Audit Trail Entry

Log the override with full context:

```typescript
await supabase.from('audit_log').insert({
  entity: 'order_addon',
  entity_id: newOrder.id,
  action: 'created_override',
  actor_id: user?.id,
  before: { 
    parent_status: parentOrderStatus,
    blocked_reason: getAddonBlockedReason(parentOrderStatus)
  },
  after: {
    parent_order: parentOrderNumber,
    addon_order: orderNumber,
    total: addonTotal,
    override_note: overrideNote,
    new_consolidated_total: newTotal
  },
});
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/utils/orderAddons.ts` | Add `canAdminOverrideAddon` function |
| `src/utils/consolidatedOrder.ts` | Add `recalculateConsolidatedTotal` function |
| `src/components/OrderAddOnsList.tsx` | Show override option when blocked but overridable |
| `src/components/AddOnCreator.tsx` | Accept `isOverride` and `overrideNote` props, trigger recalculation |
| `src/pages/OrderDetail.tsx` | Add state management for override confirmation dialog |

## User Workflow

1. Admin opens a packed order (e.g., `SO-MKJ3VUM4JF5M2`)
2. In the Add-On Orders section, they see: "Add-ons blocked: Order already packed"
3. An "Override & Add Items" button is visible (admin only)
4. Clicking it opens a confirmation dialog requiring justification
5. After confirming, the normal Add-On Creator opens
6. Upon successful creation:
   - New add-on order is created and linked
   - `consolidated_total` is recalculated
   - Unpaid final invoice is updated (if exists)
   - Override is logged to audit trail
7. Admin can now proceed with invoicing/shipping as normal

## Edge Cases Handled

- **Shipped orders**: Override NOT allowed (too late)
- **Cancelled orders**: Override NOT allowed (invalid state)
- **Paid invoices**: Warning shown, but override allowed (admin may need to issue credit/refund separately)
- **No existing invoice**: Override allowed, consolidated total updated for future invoice

