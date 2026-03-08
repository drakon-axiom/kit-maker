# Standalone Customer Portal — Build Prompt

Build a standalone **Wholesale Customer Portal** web application with a **separate Admin Portal**. The customer portal allows wholesale customers to sign in, place orders, track order/production status, manage quotes, view payment history, and manage their profile. The admin portal allows administrators to manage customer accounts, products, and manually enter orders on behalf of customers. Both apps share the same Supabase backend. Focus on framework and functionality first — UI polish will come later.

---

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui component library
- **Backend/Database**: Supabase (PostgreSQL, Auth, Edge Functions, Row Level Security)
- **State Management**: React Query (@tanstack/react-query) for server state
- **Routing**: react-router-dom v6
- **Forms**: react-hook-form + zod validation
- **Date utilities**: date-fns

---

## Architecture Overview

Two separate React applications sharing one Supabase project:

1. **Customer Portal** (`/customer/*` routes) — customer-facing
2. **Admin Portal** (`/admin/*` routes) — separate app for internal staff

Both connect to the same Supabase instance. Authentication uses Supabase Auth with role-based access. The system is designed to later integrate with an external production/manufacturing system for real-time order and shipping status updates.

---

## Database Schema

### Enums

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'customer');
CREATE TYPE public.order_status AS ENUM (
  'draft', 'awaiting_approval', 'quoted', 'deposit_due',
  'in_queue', 'in_production', 'in_labeling', 'in_packing',
  'awaiting_invoice', 'awaiting_payment', 'ready_to_ship',
  'shipped', 'on_hold', 'cancelled'
);
CREATE TYPE public.deposit_status AS ENUM ('unpaid', 'partial', 'paid');
CREATE TYPE public.sell_mode AS ENUM ('kit', 'piece');
CREATE TYPE public.batch_status AS ENUM ('queued', 'wip', 'hold', 'complete');
CREATE TYPE public.workflow_step_type AS ENUM ('produce', 'bottle_cap', 'label', 'pack');
CREATE TYPE public.step_status AS ENUM ('pending', 'wip', 'done');
```

### Tables

#### `profiles`
Automatically created on user signup via trigger.

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `user_roles`
Maps users to their role. Every user must have a role.

```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);
```

#### `customers`
Customer accounts with contact info and addresses. Linked to auth user via `user_id`.

```sql
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  default_terms TEXT,
  notes TEXT,
  -- Shipping address
  shipping_address_line1 TEXT,
  shipping_address_line2 TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  shipping_country TEXT DEFAULT 'USA',
  -- Billing address
  billing_same_as_shipping BOOLEAN DEFAULT TRUE,
  billing_address_line1 TEXT,
  billing_address_line2 TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_zip TEXT,
  billing_country TEXT DEFAULT 'USA',
  -- Settings
  quote_expiration_days INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `skus` (Products)
Products available for ordering. Supports kit and piece selling modes with optional tiered pricing.

```sql
CREATE TABLE public.skus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  price_per_kit DECIMAL(10,2) NOT NULL,
  price_per_piece DECIMAL(10,2) NOT NULL,
  pack_size INT NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  use_tier_pricing BOOLEAN NOT NULL DEFAULT FALSE,
  category_id UUID REFERENCES public.sku_categories(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `sku_categories`
Product categories for organizing SKUs.

```sql
CREATE TABLE public.sku_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `sku_pricing_tiers`
Volume-based pricing tiers per SKU.

```sql
CREATE TABLE public.sku_pricing_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_id UUID NOT NULL REFERENCES public.skus(id) ON DELETE CASCADE,
  min_quantity INT NOT NULL,
  max_quantity INT,
  price_per_kit DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `customer_sku_access`
Controls which products each customer can see/order. If no rows exist for a customer, they see no products and must request access.

```sql
CREATE TABLE public.customer_sku_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES public.skus(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, sku_id)
);
```

#### `customer_access_requests`
Tracks customer requests for product access.

```sql
CREATE TABLE public.customer_access_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  admin_notes TEXT
);
```

#### `sales_orders`
The main orders table.

```sql
CREATE TABLE public.sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uid TEXT UNIQUE NOT NULL,
  human_uid TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  source_channel TEXT NOT NULL DEFAULT 'customer_portal', -- 'customer_portal', 'admin', 'email'
  status order_status NOT NULL DEFAULT 'draft',
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_required BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  deposit_status deposit_status NOT NULL DEFAULT 'unpaid',
  promised_date DATE,
  eta_date DATE,
  quote_expires_at TIMESTAMPTZ,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `sales_order_lines`
Line items for each order.

```sql
CREATE TABLE public.sales_order_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES public.skus(id),
  sell_mode sell_mode NOT NULL,
  qty_entered INT NOT NULL,
  bottle_qty INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `order_comments`
Comments and requests on orders (modification requests, cancellation requests, general notes).

```sql
CREATE TABLE public.order_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  comment TEXT NOT NULL,
  comment_type TEXT NOT NULL DEFAULT 'comment', -- 'comment', 'modification_request', 'cancellation_request'
  request_status TEXT, -- 'pending', 'approved', 'rejected' (for requests)
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `quote_actions`
Tracks customer actions on quotes (accept/reject).

```sql
CREATE TABLE public.quote_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_id UUID NOT NULL REFERENCES public.sales_orders(id),
  action TEXT NOT NULL, -- 'accepted', 'rejected'
  action_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `payment_transactions`
Payment records linked to orders.

```sql
CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_id UUID NOT NULL REFERENCES public.sales_orders(id),
  payment_type TEXT NOT NULL, -- 'deposit', 'final'
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  payment_method TEXT NOT NULL, -- 'stripe', 'paypal', 'cashapp', 'wire', 'manual'
  stripe_payment_intent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `shipments`
Shipping/tracking information per order.

```sql
CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  carrier TEXT,
  tracking_no TEXT NOT NULL,
  tracking_status TEXT,
  tracking_location TEXT,
  estimated_delivery TEXT,
  shipped_at TIMESTAMPTZ,
  tracking_events JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `production_batches`
Production batch tracking (populated by external manufacturing system).

```sql
CREATE TABLE public.production_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uid TEXT UNIQUE NOT NULL,
  human_uid TEXT NOT NULL,
  so_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  status batch_status NOT NULL DEFAULT 'queued',
  planned_start TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_finish TIMESTAMPTZ,
  qty_bottle_planned INT NOT NULL,
  qty_bottle_good INT DEFAULT 0,
  qty_bottle_scrap INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `workflow_steps`
Steps within production batches.

```sql
CREATE TABLE public.workflow_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  step workflow_step_type NOT NULL, -- 'produce', 'bottle_cap', 'label', 'pack'
  status step_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id, step)
);
```

#### `saved_addresses`
Multiple saved addresses per customer.

```sql
CREATE TABLE public.saved_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address_type TEXT NOT NULL DEFAULT 'shipping', -- 'shipping', 'billing', 'both'
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'USA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `notification_preferences`
Per-customer notification settings.

```sql
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  email_order_status BOOLEAN NOT NULL DEFAULT TRUE,
  email_payment_received BOOLEAN NOT NULL DEFAULT TRUE,
  email_shipment_updates BOOLEAN NOT NULL DEFAULT TRUE,
  email_quote_approved BOOLEAN NOT NULL DEFAULT TRUE,
  email_quote_expiring BOOLEAN NOT NULL DEFAULT TRUE,
  email_marketing BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id)
);
```

#### `settings`
Global application settings.

```sql
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.settings (key, value, description) VALUES
  ('kit_size', '10', 'Default number of bottles per kit'),
  ('default_deposit_percent', '50', 'Default deposit percentage'),
  ('tracking_carriers', 'USPS,FedEx,UPS,DHL,Other', 'Available shipping carriers');
```

### Database Triggers

```sql
-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at columns
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_skus_updated_at BEFORE UPDATE ON public.skus FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_production_batches_updated_at BEFORE UPDATE ON public.production_batches FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### Row Level Security (RLS)

Enable RLS on all tables. Use helper functions:

```sql
-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Check if user is the customer who owns the record
CREATE OR REPLACE FUNCTION public.is_customer_owner(_user_id UUID, _customer_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.customers WHERE id = _customer_id AND user_id = _user_id)
$$;
```

**Key RLS policies:**
- **Admins**: Full access to all tables
- **Customers**: Can only read/write their own data (customers, orders, addresses, etc. filtered by their `customer_id`)
- Customers can INSERT into `sales_orders` and `sales_order_lines` (to place orders)
- Customers can INSERT into `order_comments` (to submit modification/cancellation requests)
- Customers can READ `skus` that they have access to (via `customer_sku_access`)
- Customers can READ their own `shipments`, `production_batches`, `workflow_steps`, `payment_transactions`

---

## Customer Portal App

### Authentication

#### Sign In Page (`/auth`)
- Email + password sign-in using Supabase Auth
- "Forgot Password?" link opens a dialog to send reset email via Edge Function
- Password reset flow: user receives email with token, redirected to `/auth?reset_token=...`, enters new password
- After sign in, redirect to `/customer` (customer dashboard)
- Support for forced password change on first login (check `user_metadata.requires_password_change`)

#### Sign Up / Wholesale Application (`/wholesale-signup`)
- Registration form: email, password, full name
- On signup:
  1. Create Supabase auth user
  2. Create `profiles` record
  3. Create `user_roles` record with role `customer`
  4. Create `customers` record linked via `user_id`
- After signup, customer can sign in but will see no products until admin grants access

### Customer Portal Routes (all under `/customer`)

All routes require authentication with `customer` role.

#### Layout
- **Desktop**: Collapsible sidebar with navigation links + top header bar with user email dropdown (sign out)
- **Mobile**: Bottom navigation bar (no sidebar) + top header
- Sidebar nav items: Orders (home), New Order, Production, Quotes, Payments, Profile, Settings

#### Dashboard / Orders List (`/customer` — index route)
- Welcome message showing customer name
- "New Order" button
- Orders table/card list showing: Order #, Status, Subtotal, Order Date, Promised Date
- **Search**: Filter by order number
- **Status filter**: Dropdown to filter by status (all statuses from enum)
- **Sort**: Newest, Oldest, Highest value, Lowest value
- **Export**: Download filtered orders as CSV
- **Actions per order**:
  - View — navigate to order detail
  - Reorder — duplicate the order (copy all line items into a new draft order)
  - Cancel (if status is `draft`, `quoted`, `deposit_due`, or `awaiting_approval`) — opens confirmation dialog, submits a cancellation request comment
- Mobile: Card layout. Desktop: Table layout.

#### Place New Order (`/customer/new-order`)
- Breadcrumb navigation
- Fetch active SKUs that the customer has access to (join `skus` with `customer_sku_access`)
- If no products available: Show "No Products Available" message with "Request Access" button
  - Request Access: Creates a `customer_access_requests` record, shows pending status
  - Rate limit: Only allow requests 24 hours after signup
- Order line items form:
  - Select product (SKU)
  - Sell mode: Kit or Piece
  - Quantity input (minimum 5 for kits)
  - Unit price (auto-calculated from SKU pricing or tier pricing, but editable)
  - Bottles calculated: `qty * pack_size` for kits, `qty` for pieces
  - Line subtotal: `qty * unit_price`
  - Volume discount info shown if SKU has tier pricing
- Add/remove line items
- Running total
- Submit: Creates `sales_orders` record with status `awaiting_approval` and source_channel `customer_portal`, then creates `sales_order_lines`
- Generate unique order UID: timestamp-based alphanumeric code, prefixed with `SO-`

**Pricing logic:**
- If SKU has `use_tier_pricing = true` and pricing tiers exist, find the tier matching the quantity
- Otherwise use `price_per_kit` (kit mode) or `price_per_piece` (piece mode)
- Price can be manually overridden by customer per line item

#### Order Detail (`/customer/orders/:id`)
- Breadcrumb navigation
- Order header: Order #, status badge, placed date
- Action buttons: Back, Download PDF, Request Modification (if status allows)
- **Order Progress Timeline**: Visual step-by-step progress indicator showing current status
- **Payment section**: Shows deposit info, final payment info based on order status
  - If `awaiting_approval`: Show "Awaiting Approval" message
  - If `deposit_due`: Show deposit payment card
  - If `awaiting_payment`/`ready_to_ship`: Show final payment card
- **Shipment Tracking**: Display carrier, tracking number, status, events if a shipment exists
- **Order Request History**: Timeline of modification/cancellation requests and their statuses
- **Order Items**: Table/cards listing all line items with product, quantity, price, subtotal
- **Order Comments**: Threaded comment section for communication
- **Modification Request**: Dialog to submit text describing desired changes (creates `order_comments` with `comment_type: 'modification_request'`). Only available before packing stage.
- **PDF Download**: Generate a simple order confirmation PDF (using jsPDF or similar)

#### Profile (`/customer/profile`)
- Form to edit: Name, Email, Phone
- Shipping address: Line 1, Line 2, City, State, ZIP, Country
- Billing address: Option to "same as shipping" or enter separate
- Save updates to `customers` table

#### Account Settings (`/customer/settings`)
- **Saved Addresses**: CRUD for multiple saved addresses with labels, types (shipping/billing/both), default flag
- **Notification Preferences**: Toggle switches for:
  - Order status updates
  - Payment confirmations
  - Shipping notifications
  - Quote approvals
  - Quote expiration reminders
  - Marketing emails
- **Security**: Change password (via Supabase Auth `updateUser`)

#### Payment History (`/customer/payments`)
- Summary cards: Total Paid, Deposit count, Final Payment count
- Transactions table/cards: Date, Order #, Type (deposit/final), Method, Status, Amount
- Each transaction links to its order
- Receipt download per transaction

#### Quote Management (`/customer/quotes`)
- Lists orders with status `quoted` or `awaiting_approval`
- Shows: Quote #, Amount, Deposit amount, Created date, Expiration (with countdown), Status
- **Accept Quote**: Changes order status to `deposit_due` (if deposit required) or `in_queue`, records action in `quote_actions`
- **Reject Quote**: Changes order status to `cancelled`, records action
- Expired quotes cannot be accepted
- Confirmation dialog with optional notes for both actions

#### Production Progress (`/customer/production`)
- Lists orders in production-related statuses (`in_queue`, `in_production`, `in_labeling`, `in_packing`, `packed`, `ready_to_ship`, `shipped`)
- Per order: Status badge, promised date, overall bottle progress bar
- Per production batch within an order:
  - Batch ID, status (queued/wip/hold/complete)
  - Workflow step progress: produce → bottle_cap → label → pack
  - Step indicators (color-coded: green=done, orange=in progress, gray=pending)
  - Quantity info (planned vs completed bottles)
- **Note**: Production data is read-only for customers. Data will be populated by the external manufacturing system.

---

## Admin Portal App (Separate Application)

Separate React app with its own routes. Requires `admin` role.

### Admin Authentication (`/admin/auth`)
- Email + password sign in
- After sign in, verify user has `admin` role, redirect to admin dashboard

### Admin Dashboard (`/admin`)
- Overview stats: Total customers, active orders, pending access requests

### Customer Management (`/admin/customers`)
- **List**: Searchable table of all customers with name, email, phone, created date
- **Create**: Form to add new customer (name, email, phone, terms, notes, addresses)
  - Option to create a Supabase auth account for the customer (email + temporary password)
  - Auto-creates `user_roles` with `customer` role and `customers` record
- **Edit**: Update customer details
- **Delete**: Remove customer (with confirmation)
- **Import**: CSV/XLSX upload to bulk-create customers (columns: name, email, phone, default_terms)

### Product Management (`/admin/products`)
- **List**: Table of all SKUs with code, description, price, active status
- **Create/Edit**: Form with fields:
  - Code (unique identifier)
  - Description
  - Price per kit
  - Price per piece
  - Pack size (bottles per kit)
  - Active toggle
  - Category assignment
  - Tier pricing toggle + tier configuration (min qty, max qty, price per kit)
- **Categories**: CRUD for product categories (name, slug, description, sort order)
- **Delete**: Soft-delete by setting `active = false`

### Customer Access Management (`/admin/customer-access`)
- **Assign Access tab**:
  - Select a customer from dropdown
  - Shows all products with checkboxes
  - Toggle individual product access or "grant all" / "revoke all"
  - Changes create/delete rows in `customer_sku_access`
- **Access Requests tab**:
  - List of pending `customer_access_requests` with customer name, email, date
  - Approve (then redirect to assign access for that customer) or Reject
  - Badge showing count of pending requests

### Manual Order Entry (`/admin/orders/new`)
- Select customer from dropdown
- Same order line item form as customer portal (select products, qty, pricing)
- Admin can set any status, promised date, deposit requirement, etc.
- Source channel set to `admin`
- Creates the order on behalf of the customer

### Order Management (`/admin/orders`)
- List all orders with filters: status, customer, date range
- View order details (same info as customer sees plus internal notes)
- Update order status
- Add internal comments (not visible to customer)
- Set/update deposit requirements and amounts
- Set promised dates and quote expiration dates

---

## Integration Points (for future manufacturing system connection)

Design these as clear interfaces that can later be connected:

### Inbound (Manufacturing → Portal)
These will be populated by the external system via Supabase direct access or Edge Functions:

1. **Order Status Updates**: Update `sales_orders.status` when production status changes
2. **Production Batch Creation**: Insert into `production_batches` when batches are created
3. **Workflow Step Updates**: Update `workflow_steps` as production progresses
4. **Shipment Creation**: Insert into `shipments` when orders are shipped with tracking info
5. **Tracking Updates**: Update `shipments.tracking_status` and `tracking_events`

### Outbound (Portal → Manufacturing)
New customer orders need to be sent to the manufacturing system:

1. **New Order Notification**: When an order is placed or approved, trigger notification
2. **Order Modification**: When admin modifies an order, sync changes

Create placeholder Edge Functions:
- `sync-order-to-manufacturing` — stub that logs the order data, ready to be wired to actual API
- `receive-production-update` — webhook endpoint for manufacturing system to push updates

---

## Supabase Edge Functions

### Required Edge Functions

1. **`request-customer-access`**: Customer requests product access. Rate-limited (24hr cooldown). Creates `customer_access_requests` record.

2. **`send-password-reset`**: Generates a password reset token, stores in `password_reset_tokens` table, sends email with reset link.

3. **`verify-password-reset`**: Validates token, updates user password via Supabase Admin API.

4. **`send-order-notification`**: Sends email notification when order status changes (uses notification preferences to determine if customer wants the email).

5. **`send-shipment-notification`**: Sends email when shipment is created/updated with tracking info.

6. **`sync-order-to-manufacturing`** (placeholder): Stub for sending new/updated orders to manufacturing system.

7. **`receive-production-update`** (placeholder): Webhook endpoint for receiving production status updates.

---

## Business Logic Summary

### Order Lifecycle
```
draft → awaiting_approval → quoted → deposit_due → in_queue → in_production → in_labeling → in_packing → awaiting_invoice → awaiting_payment → ready_to_ship → shipped
                                                                                                                                                     ↗
                                                                              (or if no deposit required: quoted → in_queue)
At any point: → on_hold or → cancelled
```

### Customer can:
- Place orders (status starts at `awaiting_approval`)
- View their own orders, shipments, production progress
- Accept/reject quotes
- Request order modifications (before packing)
- Request order cancellation (before production)
- Reorder (duplicate) previous orders
- Manage their profile, addresses, notification preferences
- View payment history

### Admin can:
- Manage customer accounts (CRUD)
- Manage products/SKUs (CRUD with categories and pricing tiers)
- Control which products each customer can access
- Manually create orders on behalf of customers
- Update order statuses
- Approve/reject customer access requests
- View and manage all orders

### Pricing
- Each SKU has a base `price_per_kit` and `price_per_piece`
- Optional tier pricing: when `use_tier_pricing = true`, price is determined by quantity brackets
- Tier lookup: Find tier where `qty >= min_quantity AND (max_quantity IS NULL OR qty <= max_quantity)`
- Customer can override price per line item when placing order (the entered price is what gets saved)
- Minimum order quantity: 5 kits per line item (no minimum for pieces)

### Access Control
- Customers only see products they've been granted access to via `customer_sku_access`
- If customer has no access records, "New Order" page shows "Request Access" flow
- Admin explicitly grants access per-customer per-product
- Access requests go through approval workflow

---

## Key Implementation Notes

1. **Mobile responsive**: All pages should work on mobile. Use card layouts on mobile, table layouts on desktop. Use a `useIsMobile()` hook (media query based).

2. **Supabase client**: Initialize with environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Use typed client with generated types.

3. **Auth context**: React context providing `user`, `session`, `userRole`, `loading`, `signIn`, `signUp`, `signOut`. Fetch role from `user_roles` table on auth state change.

4. **Protected routes**: Wrapper component that checks auth state and role, redirects to login if unauthorized.

5. **Toast notifications**: Use sonner for success/error feedback on all mutations.

6. **Order UID generation**: `timestamp_base36 + random_5chars`, uppercased, prefixed with `SO-` for display.

7. **CSV export**: Client-side CSV generation using array mapping and `Blob` download.

8. **PDF generation**: Client-side using jsPDF for simple order confirmation documents.

9. **Real-time**: Consider Supabase realtime subscriptions on `sales_orders` and `shipments` tables for live status updates (optional, can add later).

10. **Error handling**: All Supabase calls wrapped in try/catch with toast error feedback. Loading states on all async operations.
