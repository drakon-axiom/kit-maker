

# Add Payment Methods to Invoice Email + BTCPay Server Integration

## Summary

This plan adds two major capabilities:
1. **Payment methods section in invoice emails** - Shows all available payment options with direct payment links where possible, plus a "Pay in Portal" fallback
2. **BTCPay Server integration** - Full crypto payment support using BTCPay Server (works with both hosted and self-hosted instances)

## What Customers Will See

### In Invoice Emails
The invoice email will include a new "Payment Options" section at the bottom, showing:

- **Credit/Debit Card** - Direct link to Stripe checkout (if enabled)
- **CashApp** - Deep link to open CashApp with pre-filled amount + $CashTag
- **PayPal** - Link to PayPal payment (if SDK enabled) or manual email
- **Wire Transfer** - Bank details for wire payments
- **Cryptocurrency** - Link to BTCPay Server checkout page

All methods also include a "Pay in Portal" fallback link for customers who prefer logging in.

### In Customer Portal
A new "Cryptocurrency" button will appear alongside existing payment methods, which opens the BTCPay Server checkout modal/page supporting all cryptocurrencies your BTCPay instance accepts.

## Implementation Details

### 1. Database Changes

Add BTCPay Server configuration fields to the `brands` table:

| Column | Type | Description |
|--------|------|-------------|
| `btcpay_server_url` | text | Your BTCPay Server instance URL (e.g., `https://btcpay.example.com`) |
| `btcpay_store_id` | text | The store ID from BTCPay Server |
| `btcpay_api_key` | text | API key for creating invoices programmatically |

### 2. Brand Management Updates

Add a new "Cryptocurrency (BTCPay Server)" section in the Payment Configuration area with:
- Toggle to enable/disable crypto payments
- BTCPay Server URL input
- Store ID input  
- API Key input (securely stored)
- Link to BTCPay Server documentation

### 3. Invoice Preview & Email Updates

Modify both the preview component and edge function to:
1. Fetch full brand payment configuration
2. Generate a "Payment Options" section showing all enabled methods
3. Include direct payment links for applicable methods:
   - Stripe: Generate a checkout URL on-the-fly
   - CashApp: Deep link with amount (`cash.app/$tag/amount`)
   - PayPal: Either SDK checkout link or manual email
   - BTCPay: Link to create invoice via API
   - Wire: Display bank details inline
4. Always include a "Pay in Customer Portal" fallback link

### 4. BTCPay Server Edge Function

Create a new `create-btcpay-invoice` edge function that:
- Accepts order details (ID, amount, customer email)
- Fetches brand's BTCPay configuration
- Creates an invoice via BTCPay Server API
- Returns the checkout URL for customer

```text
POST /functions/v1/create-btcpay-invoice
{
  "orderId": "uuid",
  "amount": 150.00,
  "paymentType": "deposit" | "final"
}
→ Returns: { "checkoutUrl": "https://btcpay.example.com/i/abc123" }
```

### 5. Customer Payment Card Updates

Add a new "Crypto" payment button that:
- Opens BTCPay Server checkout in a new tab/modal
- Shows all available cryptocurrencies (BTC, Lightning, stablecoins, etc.)
- Handles callback/redirect after payment completion

### 6. Invoice Email Payment Section Design

```text
+------------------------------------------------+
|  💳 PAYMENT OPTIONS                            |
+------------------------------------------------+
|                                                |
|  [Pay with Card] ────────────────────────────► |
|  Pay instantly with credit or debit card       |
|                                                |
|  [Pay with CashApp] ─────────────────────────► |
|  Send to: $YourCashTag                         |
|                                                |
|  [Pay with PayPal] ──────────────────────────► |
|  Via PayPal checkout                           |
|                                                |
|  [Pay with Crypto] ──────────────────────────► |
|  Bitcoin, Lightning, USDT, USDC & more         |
|                                                |
|  Wire Transfer                                 |
|  Bank: Chase Bank                              |
|  Routing: 123456789                            |
|  Account: XXXX1234                             |
|  Reference: Order SO-ABC123                    |
|                                                |
|  ─────────────────────────────────────────     |
|  Or log in to pay: [View in Customer Portal]  |
+------------------------------------------------+
```

## Files to Modify/Create

| File | Changes |
|------|---------|
| `brands` table | Add 3 new columns for BTCPay configuration |
| `src/pages/BrandManagement.tsx` | Add BTCPay Server configuration section |
| `src/components/InvoicePreviewDialog.tsx` | Fetch payment config, add payment methods section to preview |
| `supabase/functions/send-invoice-email/index.ts` | Add payment methods section to email HTML |
| `supabase/functions/create-btcpay-invoice/index.ts` | New function to create BTCPay invoices |
| `src/components/PaymentCard.tsx` | Add crypto payment button with BTCPay integration |

## BTCPay Server Integration Flow

```text
1. Customer clicks "Pay with Crypto" in email or portal
                    ↓
2. Edge function calls BTCPay Server API:
   POST {btcpay_url}/api/v1/stores/{store_id}/invoices
   {
     "amount": 150.00,
     "currency": "USD",
     "metadata": { "orderId": "...", "orderNumber": "SO-ABC123" }
   }
                    ↓
3. BTCPay returns checkout URL
                    ↓
4. Customer redirected to BTCPay checkout page
   (shows BTC, Lightning, USDT, USDC, etc. based on your BTCPay config)
                    ↓
5. Customer pays in preferred cryptocurrency
                    ↓
6. BTCPay webhook notifies your system (optional future enhancement)
   OR admin manually marks payment as received
```

## Security Considerations

- BTCPay API key is stored in the brands table (same security model as PayPal client secret)
- Only admins can view/edit BTCPay configuration via existing RLS policies
- API key is only used server-side in edge functions, never exposed to frontend
- Checkout URLs are one-time use and expire (configurable in BTCPay)

## Edge Cases

- **BTCPay Server unreachable**: Show error message, fallback to "Contact us" option
- **No payment methods configured**: Email still sends but shows only "Contact us for payment options"
- **Partial configuration**: Only show methods that are fully configured
- **Self-hosted migration**: URL field allows easy switch from hosted to self-hosted BTCPay

