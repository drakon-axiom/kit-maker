

# Simplify Order Status Workflow: 20 to 13 Statuses

## Summary

Consolidate the order status enum from 20 values down to 13, removing redundant and duplicate statuses. Add `hold_reason` column and `stocked` terminal status for internal orders.

## New Status Flow

```text
External orders:
  draft -> quoted -> awaiting_approval -> in_queue -> in_production
    -> [in_labeling] -> in_packing -> awaiting_invoice -> awaiting_payment
    -> ready_to_ship -> shipped

Internal orders:
  draft -> in_queue -> in_production -> [in_labeling] -> in_packing
    -> stocked

Hold: on_hold (with hold_reason: customer | internal | materials)
Cancel: cancelled (reachable from most states)
```

## Statuses Being Removed (7)

| Old Status | Reason |
|---|---|
| `invoiced` | Redundant with `awaiting_payment` |
| `payment_due` | Duplicate of `awaiting_payment` |
| `packed` | Auto-transitions to `awaiting_invoice` instantly; invisible state |
| `ready_to_stock` | Replaced by `stocked` |
| `on_hold_customer` | Collapsed into `on_hold` + `hold_reason` column |
| `on_hold_internal` | Collapsed into `on_hold` + `hold_reason` column |
| `on_hold_materials` | Collapsed into `on_hold` + `hold_reason` column |

## Statuses Being Added (2)

| New Status | Purpose |
|---|---|
| `stocked` | Terminal status for internal orders |
| `on_hold` | Single hold status with `hold_reason` field |

## Technical Details

### 1. Database Migration

- Add `on_hold` and `stocked` to the `order_status` enum
- Add `hold_reason` text column to `sales_orders` (nullable, values: `customer`, `internal`, `materials`)
- Migrate existing data:
  - `on_hold_customer` -> `on_hold` with `hold_reason = 'customer'`
  - `on_hold_internal` -> `on_hold` with `hold_reason = 'internal'`
  - `on_hold_materials` -> `on_hold` with `hold_reason = 'materials'`
  - `invoiced` -> `awaiting_payment`
  - `payment_due` -> `awaiting_payment`
  - `packed` -> `awaiting_invoice`
  - `ready_to_stock` -> `stocked`
- Note: Postgres cannot remove enum values, so old values remain in the enum but will no longer be used in the UI or code

### 2. Update Database Triggers/Functions

- **`validate_order_status_transition`**: Remove references to old statuses, add `stocked` and `on_hold` handling
- **`auto_advance_to_awaiting_invoice`**: Change trigger to fire from `in_packing` completion directly (skip `packed`)
- **`auto_advance_to_ready_to_ship_on_payment`**: Add branch for internal orders to go to `stocked` instead
- **`sync_addon_statuses`**: Update synced status list to use new values
- **`notify_order_status_change`**: Update notification-worthy status list

### 3. Frontend Files to Update (11 files)

- **`src/pages/OrderDetail.tsx`**: Update status dropdown (remove old, add `stocked`/`on_hold`), update `formatStatus`, add hold reason selector when `on_hold` is chosen, update shipping button visibility
- **`src/pages/Orders.tsx`**: Update filter dropdowns, bulk update dropdown, `formatStatus`, status color maps
- **`src/pages/CustomerPortal.tsx`**: Update status filters, colors, `canRequestCancellation`
- **`src/pages/Queue.tsx`**: Remove `packed` from queue statuses
- **`src/pages/Shipments.tsx`**: Remove `packed` from shipment queries
- **`src/pages/ManualPaymentRecording.tsx`**: Remove `invoiced`/`payment_due`/`deposit_due` from status filter
- **`src/components/OrderTimeline.tsx`**: Remove `packed`/`deposit_due` steps, add `stocked` as terminal for internal, update step list
- **`src/components/StatusChangeDialog.tsx`**: Works via RPC, no direct changes needed beyond what the DB function handles
- **`src/components/InternalOrdersWidget.tsx`**: Replace `packed`/`ready_to_stock` with `stocked` in status maps
- **`src/components/mobile/OrderCard.tsx`**: Update status color map if defined inline
- **`src/components/OrderAddOnsList.tsx`**: Update status color map

### 4. Hold Reason UX

When admin selects `on_hold` from the status dropdown, a sub-selector appears asking for the hold reason (Customer / Internal / Materials). The `hold_reason` is saved alongside the status. Display logic shows "On Hold (Customer)" etc. based on the `hold_reason` column.

### 5. Deposit Flow Change

`deposit_due` remains as a status since it represents a distinct point in the pre-production workflow where the customer needs to pay a deposit before the order enters the queue. This is functionally different from `awaiting_payment` (which is post-production final payment). No change here from current behavior.

### 6. Data Safety

Before publishing, any existing orders using removed statuses in the Live environment will be migrated to their new equivalents by the migration SQL. No data loss.

