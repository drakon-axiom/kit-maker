
# Order Add-On System Implementation Plan

## Overview

Implement a structured add-on system that allows customers and admins to add products to existing orders until packing begins. Once an order moves to `in_packing` or later stages, add-ons are blocked and a new order is required.

## Add-On Eligible Statuses

| Status | Add-On Allowed? | Notes |
|--------|----------------|-------|
| `draft` | Yes | Pre-quote stage |
| `quoted` | Yes | Quote sent, not yet approved |
| `awaiting_approval` | Yes | Pending admin review |
| `deposit_due` | Yes | Awaiting deposit payment |
| `in_queue` | Yes | Waiting for production |
| `in_production` | Yes | Being manufactured |
| `in_labeling` | Yes | Labels being applied |
| `in_packing` | **No** | Packing started - cutoff point |
| `packed` | No | Already packed |
| `awaiting_invoice` | No | Invoicing stage |
| `awaiting_payment` | No | Final payment due |
| `ready_to_ship` | No | Preparing shipment |
| `shipped` | No | Already shipped |

---

## Database Schema

### New Table: `order_addons`

```text
┌─────────────────────────────────────────────────────────────┐
│ order_addons                                                │
├─────────────────────────────────────────────────────────────┤
│ id              UUID (PK, default gen_random_uuid())        │
│ parent_so_id    UUID (FK → sales_orders.id) NOT NULL        │
│ addon_so_id     UUID (FK → sales_orders.id, UNIQUE) NOT NULL│
│ created_at      TIMESTAMPTZ (default now())                 │
│ created_by      UUID (FK → auth.users)                      │
│ reason          TEXT (customer's request reason)            │
│ status          TEXT ('pending', 'approved', 'rejected')    │
│ approved_by     UUID (nullable)                             │
│ approved_at     TIMESTAMPTZ (nullable)                      │
│ admin_notes     TEXT (nullable)                             │
└─────────────────────────────────────────────────────────────┘
```

### RLS Policies
- Admins can manage all add-ons
- Customers can view add-ons linked to their orders
- Customers can create add-on requests for their own orders

### New Settings Keys (settings table)
- `addon_max_percent`: Maximum add-on value as % of original order (default: 100)
- `addon_auto_approve_threshold`: Auto-approve add-ons below this $ amount (default: 0 = disabled)
- `addon_cutoff_status`: Status after which add-ons are blocked (default: `in_packing`)

---

## Implementation Details

### Phase 1: Database Migration

Create the `order_addons` linking table with:
- Foreign keys to `sales_orders` for parent and add-on order
- Status tracking for approval workflow
- Audit fields for who created/approved

Add a `parent_order_id` self-referential column to `sales_orders` for easy querying.

### Phase 2: Shared Eligibility Logic

Create a reusable function to check add-on eligibility:

```typescript
// src/utils/orderAddons.ts
const ADDON_BLOCKED_STATUSES = [
  'in_packing', 'packed', 'awaiting_invoice', 
  'awaiting_payment', 'ready_to_ship', 'shipped', 
  'cancelled'
];

export const canCreateAddon = (status: string): boolean => {
  return !ADDON_BLOCKED_STATUSES.includes(status);
};
```

### Phase 3: Admin UI Changes

**OrderDetail.tsx**
1. Add "Create Add-On" button visible when:
   - Order status allows add-ons (`canCreateAddon(status)`)
   - User has admin role
   
2. Display linked add-ons section showing:
   - Add-on order number and status
   - Add-on total and line items summary
   - Link to view full add-on order

**New Component: AddOnCreator.tsx**
- Product selector (limited to customer's accessible SKUs)
- Quantity inputs with pricing preview
- Size limit validation based on settings
- Reason/notes field
- Creates a linked "child" sales order automatically

### Phase 4: Customer UI Changes

**CustomerOrderDetail.tsx**
1. Update `canRequestModification` to include production statuses:
   ```typescript
   const canRequestModification = (status: string) => {
     return !['in_packing', 'packed', 'awaiting_invoice', 
              'awaiting_payment', 'ready_to_ship', 'shipped', 
              'cancelled'].includes(status);
   };
   ```

2. Add "Request Add-On" button that:
   - Shows a product picker (their accessible SKUs)
   - Calculates estimated additional cost
   - Submits as structured request (stored in `order_comments` with `comment_type: 'addon_request'`)

**CustomerNewOrder.tsx Enhancement**
- Add optional "Link to Order" dropdown when customer has in-progress orders
- Pre-fills customer address from parent order
- Marks the new order as an add-on

### Phase 5: Request Management

**OrderRequestManagement.tsx**
- Add filter for add-on requests
- One-click "Convert to Add-On Order" button
- Pre-fills order creation with requested items
- Automatically links orders in `order_addons` table

### Phase 6: Settings Page

**Settings.tsx**
- Add "Order Add-Ons" configuration card with:
  - Maximum add-on size (% of original order)
  - Auto-approve threshold ($)
  - Custom cutoff status selector

---

## Technical Considerations

### Production Integration
- Add-on orders create their own production batches
- Batches are tagged/prioritized to coordinate with parent order
- Parent order cannot ship until all linked add-ons are ready

### Shipping Logic
- Check for pending add-ons before allowing status change to `shipped`
- Add warning if add-ons exist in production when parent is ready to ship
- Option for admin override with justification

### Invoicing
- Add-ons generate their own invoices
- Option to combine invoices when add-on is approved before parent's final invoice

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `supabase/migrations/xxx.sql` | New | Create `order_addons` table, add `parent_order_id` to `sales_orders` |
| `src/utils/orderAddons.ts` | New | Shared eligibility logic |
| `src/pages/OrderDetail.tsx` | Modify | Add "Create Add-On" button, display linked add-ons |
| `src/pages/CustomerOrderDetail.tsx` | Modify | Update modification eligibility, add structured add-on request |
| `src/components/AddOnCreator.tsx` | New | Dialog for creating add-on orders |
| `src/components/OrderAddOnsList.tsx` | New | Display linked add-ons on order detail |
| `src/pages/OrderRequestManagement.tsx` | Modify | Handle add-on request conversion |
| `src/pages/Settings.tsx` | Modify | Add add-on configuration settings |

---

## Summary

This approach allows flexibility for mid-production changes while maintaining operational control:
- **Customers can request add-ons** until packing begins
- **Admins can create add-ons directly** for the same period
- **Linked orders** keep the audit trail clean and batches separate
- **Configurable limits** prevent oversized add-ons from disrupting production
- **Clear cutoff** at `in_packing` ensures packing/shipping integrity
