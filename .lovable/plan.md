
# Consolidated Invoicing & Packaging for Add-On Orders

## Current State Analysis

Your system currently handles add-ons as **separate linked orders**:
- Each add-on order (`AO-xxxx`) has its own `parent_order_id` pointing to the main order
- The `order_addons` table tracks the relationship and approval status
- Invoices are created per-order (`so_id`), meaning add-ons get their own invoices
- Packaging (`order_packages`) is recorded per-order

**The Problem**: When it's time to ship, you have:
- Multiple invoices to track (parent order + each add-on)
- Separate packaging records that don't reflect the actual consolidated shipment
- No unified "master" view for billing and fulfillment

## Proposed Solution

Your approach makes sense with one key refinement: **consolidation should happen at the fulfillment stage** (when packing begins), not before. This preserves the audit trail of individual add-ons while giving you a single billing and shipping view.

### Recommended Flow

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Consolidated Order Lifecycle                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   PRODUCTION PHASE                    │   FULFILLMENT PHASE                 │
│   (Add-ons allowed)                   │   (Add-ons blocked)                 │
│                                       │                                     │
│   ┌────────────┐                      │   ┌─────────────────────────────┐   │
│   │ Parent     │ ── creates ──────────┼─► │ Consolidated View           │   │
│   │ Order      │                      │   │                             │   │
│   │ AXC-0042   │                      │   │ • Combined line items       │   │
│   └────────────┘                      │   │ • Consolidated subtotal     │   │
│        │                              │   │ • Single final invoice      │   │
│        │ add-ons                      │   │ • Unified packing details   │   │
│        ▼                              │   │                             │   │
│   ┌────────────┐                      │   │ Parent: $5,000              │   │
│   │ Add-On 1   │ ── merges into ──────┼─► │ + AO-0001: $800             │   │
│   │ AO-0001    │                      │   │ + AO-0002: $350             │   │
│   └────────────┘                      │   │ ─────────────────           │   │
│        │                              │   │ TOTAL: $6,150               │   │
│        ▼                              │   │                             │   │
│   ┌────────────┐                      │   └─────────────────────────────┘   │
│   │ Add-On 2   │ ── merges into ──────┼───────────────┘                     │
│   │ AO-0002    │                      │                                     │
│   └────────────┘                      │                                     │
│                                       │                                     │
│         ▲                             │                                     │
│         │                             │                                     │
│   ┌─────┴─────┐                       │                                     │
│   │ in_packing│ ◄─────────────────────┘ Cutoff point                        │
│   └───────────┘                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Aspect | Approach | Rationale |
|--------|----------|-----------|
| **Invoice Consolidation** | Single "final" invoice on parent order that sums parent + all add-on subtotals | Avoids duplicate invoicing; customer sees one bill |
| **Line Item Display** | Show all items (parent + add-ons) grouped by source order | Clear visibility into what was added |
| **Packing** | All packages recorded on parent order | ShipStation integration already uses parent order; single shipment origin |
| **Individual Totals** | Preserved on each order for audit trail | Can always drill down to see original add-on amounts |

## Implementation Details

### Phase 1: Database Changes

**New column on `sales_orders`**:
```sql
ALTER TABLE sales_orders 
ADD COLUMN consolidated_total numeric DEFAULT NULL;
```

This stores the combined total when consolidation is triggered, while preserving each order's `subtotal`.

**New setting**:
```sql
INSERT INTO settings (key, value, description)
VALUES ('auto_consolidate_on_packing', 'true', 'Automatically consolidate add-ons when parent enters in_packing status');
```

### Phase 2: Invoice Management Enhancement

**Changes to `InvoiceManagement.tsx`**:

1. When creating a **final invoice** for a parent order, automatically:
   - Fetch all linked add-on orders via `order_addons` table
   - Sum subtotals: `parentSubtotal + SUM(addonSubtotals)`
   - Display breakdown in invoice creation dialog
   - Store consolidated total on parent order

2. Add new UI section showing:
   ```
   ┌────────────────────────────────────────┐
   │ Consolidated Invoice Total             │
   ├────────────────────────────────────────┤
   │ Parent Order (AXC-0042):    $5,000.00  │
   │ + Add-On (AO-0001):           $800.00  │
   │ + Add-On (AO-0002):           $350.00  │
   │ ────────────────────────────────────── │
   │ TOTAL:                      $6,150.00  │
   └────────────────────────────────────────┘
   ```

### Phase 3: Order Detail Consolidation View

**Changes to `OrderDetail.tsx`**:

1. When viewing a parent order in `in_packing` or later statuses:
   - Show a **"Consolidated View"** toggle/section
   - Display all line items from parent + add-ons in a unified table
   - Show combined totals prominently

2. Add a **"Consolidated Order Summary"** card:
   ```
   ┌────────────────────────────────────────┐
   │ Consolidated Order Summary             │
   │ Status: In Packing                     │
   ├────────────────────────────────────────┤
   │ 3 orders combined (1 parent + 2 addons)│
   │                                        │
   │ Total Line Items: 8                    │
   │ Total Bottles: 450                     │
   │ Combined Subtotal: $6,150.00           │
   │                                        │
   │ [View Individual Orders]               │
   └────────────────────────────────────────┘
   ```

### Phase 4: Unified Packing Experience

**Changes to `PackingDetails.tsx`**:

1. For parent orders with add-ons:
   - Show combined item count from all linked orders
   - Calculate `totalItems` as sum of all `bottle_qty` from parent + add-ons
   - Package records remain on parent order only

2. Add visual indicator:
   ```
   ┌────────────────────────────────────────┐
   │ Packing Details                        │
   │ Items: 350/450 packed (2 add-ons incl.)│
   └────────────────────────────────────────┘
   ```

### Phase 5: Automatic Status Synchronization

**Database trigger or edge function**:

When parent order reaches `in_packing`:
1. Update all linked add-on orders to `in_packing` status
2. Calculate and store `consolidated_total` on parent
3. Log consolidation event to audit trail

When parent order reaches `shipped`:
1. Update all linked add-on orders to `shipped` status
2. Ensure single shipment record covers all items

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/xxx.sql` | Add `consolidated_total` column, new setting, consolidation trigger |
| `src/components/InvoiceManagement.tsx` | Fetch add-ons, calculate consolidated total, show breakdown |
| `src/pages/OrderDetail.tsx` | Add consolidated view section for parent orders with add-ons |
| `src/components/PackingDetails.tsx` | Calculate combined item totals from parent + add-ons |
| `src/components/OrderAddOnsList.tsx` | Add consolidation status indicator |
| `src/utils/orderAddons.ts` | Add utility function to fetch consolidated totals |

## Alternative Considered

**Why not merge add-ons into parent order directly?**

Merging would mean:
- Modifying `parent_order_id` of add-on line items to point to parent
- Deleting the add-on order record
- Losing audit trail of when add-ons were created and approved

The consolidation approach preserves:
- Full history of each add-on as a separate order
- Original approval/creation timestamps
- Ability to "unconsolidate" if needed (e.g., customer cancels part of order)

## Summary

Your instinct is correct: consolidation for invoicing and packing makes operational sense. The recommended approach:

1. **Keep add-ons as separate orders** during production (preserves audit trail)
2. **Consolidate at the UI/invoice level** when packing begins
3. **Single final invoice** calculated from parent + all add-on subtotals
4. **Unified packing screen** showing combined items from all linked orders
5. **Synchronized status changes** so shipping one order ships them all
