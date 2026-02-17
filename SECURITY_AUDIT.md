# Security Vulnerability Audit Report

**Date:** 2026-02-17
**Scope:** Full codebase scan of kit-maker application
**Stack:** React + Supabase (PostgreSQL) + Deno Edge Functions

---

## Executive Summary

This audit identified **34 security findings** across the kit-maker codebase, including **7 critical**, **10 high**, **12 medium**, and **5 low** severity issues. The most severe issues involve **payment amount manipulation**, **missing authentication on payment endpoints**, **overly permissive RLS policies**, and **hardcoded credentials**.

---

## CRITICAL Severity

### 1. Price Manipulation — Client Controls Payment Amounts

**Impact:** An attacker can pay any amount (e.g., $1) for any order regardless of actual total.

| File | Line |
|------|------|
| `supabase/functions/create-payment-checkout/index.ts` | 27, 56 |
| `supabase/functions/create-paypal-order/index.ts` | 99, 149 |
| `supabase/functions/create-btcpay-invoice/index.ts` | 22, 113 |
| `src/components/PaymentCard.tsx` | 71-78 |
| `src/components/PayPalCheckoutButton.tsx` | 81-89 |

All payment creation functions accept `amount` from the client request body and use it directly to create Stripe/PayPal/BTCPay sessions without ever fetching the order total from the database for server-side validation.

**Remediation:** Fetch the order/invoice total from the database in every payment function and reject requests where the client-provided amount doesn't match.

---

### 2. Missing Authentication on `create-paypal-order`

**File:** `supabase/functions/create-paypal-order/index.ts`
**Config:** `supabase/config.toml` — `verify_jwt = false`

No authentication check whatsoever. Anyone can call this endpoint to create PayPal orders using the brand's PayPal credentials for any order ID.

**Remediation:** Add JWT verification or implement manual auth header validation. Verify the caller owns the order.

---

### 3. Missing Authentication on `send-invoice-email`

**File:** `supabase/functions/send-invoice-email/index.ts:101-117`

No authentication check. Any unauthenticated caller can trigger invoice emails to any customer, leaking customer details and enabling social engineering.

**Remediation:** Require admin role authentication.

---

### 4. Missing Idempotency on Payment Webhooks

| File | Lines |
|------|-------|
| `supabase/functions/stripe-webhook/index.ts` | 37-79 |
| `supabase/functions/capture-paypal-payment/index.ts` | 137-153 |
| `supabase/functions/cashapp-webhook/index.ts` | 160-198 |

If a webhook fires twice (common in production), payment transactions are inserted twice. No unique constraints on payment identifiers (`stripe_payment_intent`, `paypal_capture_id`, etc.) and no idempotency key checks.

**Remediation:** Add unique database constraints on payment provider IDs. Check for existing records before inserting.

---

### 5. CashApp Webhook Signature Verification Flaw

**File:** `supabase/functions/cashapp-webhook/index.ts:112-154`

If the `CASHAPP_WEBHOOK_SECRET` environment variable is not set, `crypto.subtle.importKey` receives an empty string and signature verification behavior becomes undefined. The `atob()` call on the signature also has no error handling for invalid base64.

**Remediation:** Fail-closed: return 500 immediately if `CASHAPP_WEBHOOK_SECRET` is not set. Wrap `atob()` in try/catch.

---

### 6. Overly Permissive RLS Policies — All Authenticated Users See All Data

**File:** `supabase/migrations/20251107221826_c67b33f3-2d6a-42b6-b1de-e9f9284df617.sql:247-300`

RLS SELECT policies use `is_authenticated_user()` for all tables:

```sql
CREATE POLICY "Authenticated users can view customers" ON public.customers
  FOR SELECT USING (public.is_authenticated_user());
-- Same for: skus, sales_orders, sales_order_lines, production_batches,
-- invoices, invoice_payments, shipments
```

Any authenticated customer can query all other customers' orders, invoices, payments, and shipments.

**Remediation:** Replace with role-based + ownership policies. Customers should only see their own records; operators/admins see all.

---

### 7. Wildcard CORS on 22 Edge Functions

All edge functions use:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

This allows any website to make authenticated cross-origin requests to the API.

**Remediation:** Restrict `Access-Control-Allow-Origin` to the known application domains.

---

## HIGH Severity

### 8. Hardcoded Supabase Anon Key in Source + Migrations

| File | Line |
|------|------|
| `src/integrations/supabase/client.ts` | 6 |
| `supabase/migrations/20251110042136_*.sql` | 15 |
| `supabase/migrations/20251110042149_*.sql` | 15 |
| `supabase/migrations/20251115033246_*.sql` | 19 |
| `supabase/migrations/20251115033318_*.sql` | 27 |
| `supabase/migrations/20251116042834_*.sql` | 30, 59 |

The JWT token (`eyJhbGci...`) is hardcoded as a fallback in the client code and embedded in 5+ migration files. It expires 2035-11-08.

**Remediation:** Remove hardcoded fallback from client.ts. Use `Deno.env.get("SUPABASE_ANON_KEY")` in migrations. Rotate the key.

---

### 9. IDOR in `create-payment-checkout` (Stripe)

**File:** `supabase/functions/create-payment-checkout/index.ts:27`

User is authenticated but order ownership is never verified. Any authenticated user can create Stripe payment sessions for any order.

**Remediation:** Verify the authenticated user is the customer on the order before creating a session.

---

### 10. Open Redirect via Unvalidated Origin Header

**File:** `supabase/functions/create-payment-checkout/index.ts:62-63`

```typescript
success_url: `${req.headers.get("origin")}/customer/orders/${orderId}?payment=success`,
cancel_url: `${req.headers.get("origin")}/customer/orders/${orderId}?payment=cancelled`,
```

The `Origin` header is attacker-controlled. A malicious origin redirects users to a phishing site after Stripe payment.

**Remediation:** Validate the origin against an allowlist of known application domains.

---

### 11. Email Header Injection via Brand Name

| File | Line |
|------|------|
| `supabase/functions/send-password-reset/index.ts` | 392, 400 |
| `supabase/functions/generate-quote/index.ts` | 399 |
| `supabase/functions/accept-quote/index.ts` | 300 |

Brand names fetched from the database are used directly in SMTP `From` headers without stripping `\r\n`. An attacker who controls the brand name can inject additional headers (BCC, CC, etc.).

**Remediation:** Strip `\r`, `\n`, and other SMTP control characters from all email header values.

---

### 12. Race Conditions in Payment Processing

All webhook handlers (`stripe-webhook`, `capture-paypal-payment`, `cashapp-webhook`) perform multiple sequential database writes without transactions. Two concurrent webhook deliveries can both insert records and update statuses, causing double-counted payments.

**Remediation:** Use database transactions (or Supabase RPC with `BEGIN`/`COMMIT`) and unique constraints.

---

### 13. Payment Gateway Credentials in Database Without Field-Level Encryption

The `brands` table stores PayPal client secrets (`paypal_client_secret`), BTCPay API keys (`btcpay_api_key`), and SMTP passwords (`smtp_password`) in plaintext columns. With the permissive RLS policies (finding #6), these may be queryable.

**Remediation:** Encrypt sensitive columns at rest. Move credentials to Supabase Vault or environment-level secrets. Restrict SELECT access to these columns.

---

### 14. Missing Rate Limiting on Sensitive Endpoints

No rate limiting on:
- `send-password-reset` — enables email/SMS bombing
- `send-sms-notification` — enables SMS flooding
- `create-paypal-order` — enables PayPal session creation abuse
- `verify-password-reset` — enables brute-force token guessing

Only `accept-quote` has a 5-minute cooldown.

**Remediation:** Implement rate limiting per IP/user on all state-changing functions.

---

### 15. JWT Stored in localStorage

**File:** `src/integrations/supabase/client.ts:13`

```typescript
auth: { storage: localStorage, ... }
```

Tokens in localStorage are accessible to any JavaScript on the page. If an XSS vulnerability exists, tokens are immediately compromised.

**Remediation:** Consider using httpOnly cookies for session tokens where architecturally feasible.

---

### 16. Multiple Edge Functions with JWT Verification Disabled

**File:** `supabase/config.toml`

10 functions have `verify_jwt = false`, including:
- `create-paypal-order`, `capture-paypal-payment`, `create-btcpay-invoice`
- `generate-quote`, `send-verification-email`
- `send-password-reset`, `send-password-reset-email`, `verify-password-reset`
- `update-ups-tracking`, `cashapp-webhook`

Some legitimately need public access (webhooks, password reset), but payment creation functions (`create-paypal-order`, `create-btcpay-invoice`) should not be publicly callable without auth.

**Remediation:** Enable JWT verification for payment functions and implement manual auth checks in functions that must remain public.

---

### 17. Information Disclosure in Error Messages

Multiple edge functions return `error.message` directly to clients:

| File | Line |
|------|------|
| `supabase/functions/create-btcpay-invoice/index.ts` | 59, 124, 129 |
| `supabase/functions/send-order-approval/index.ts` | 252, 261 |
| `supabase/functions/generate-quote/index.ts` | 420 |
| `supabase/functions/verify-password-reset/index.ts` | 126 |

These may expose database error details, API endpoint URLs, or infrastructure info.

**Remediation:** Return generic error messages to clients. Log detailed errors server-side only.

---

## MEDIUM Severity

### 18. No CSRF Protection

No CSRF tokens are generated or validated anywhere in the codebase. State-changing operations rely solely on Bearer token auth headers, which are not automatically sent by browsers in cross-origin form posts, but the wildcard CORS (finding #7) combined with `fetch()` from malicious pages could enable CSRF.

### 19. Missing Content-Security-Policy Header

**File:** `index.html` — No CSP meta tag or header. Without CSP, inline scripts and third-party script injection are not restricted.

### 20. Missing Security Headers

No `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy` headers configured. Application is vulnerable to clickjacking.

### 21. Sidebar Cookie Missing Security Flags

**File:** `src/components/ui/sidebar.tsx:68`

```typescript
document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
```

No `Secure`, `HttpOnly`, or `SameSite` flags. Low direct risk but indicates inconsistent security practices.

### 22. Client-Side Only Role Authorization

**File:** `src/components/ProtectedRoute.tsx:12-31`

Role hierarchy enforcement is purely client-side. An attacker can modify JavaScript to bypass role checks and access admin/operator routes. Combined with permissive RLS (finding #6), this means the data is also accessible.

### 23. Permissive TypeScript Configuration

**File:** `tsconfig.json`

```json
"noImplicitAny": false,
"strictNullChecks": false
```

Disabling these checks reduces TypeScript's ability to catch null-reference bugs and type-confusion issues that can lead to security vulnerabilities.

### 24. Template Variable Replacement Without HTML Encoding

| File | Lines |
|------|-------|
| `src/pages/Notifications.tsx` | 193-226 |
| `src/components/QuotePreview.tsx` | 134-151 |

Database values (company name, customer name, etc.) are inserted into HTML templates via `.replace()` without HTML entity encoding. While DOMPurify sanitizes the final output, stored XSS payloads could potentially bypass if DOMPurify configuration is relaxed.

### 25. No Transaction Isolation in Payment Flows

All webhook functions perform multi-step database updates (insert transaction → update order status → update invoice → send email) without transaction wrapping. A failure in any step leaves the system in an inconsistent state.

### 26. CashApp Manual Confirmation Accepts Arbitrary Amounts

**File:** `supabase/functions/cashapp-webhook/index.ts:25-108`

The manual flow lets customers self-report payment amounts without server verification. While marked as `pending_verification`, the UX flow may allow premature status advancement.

### 27. Receipt Generation Without Ownership Verification

| File | Lines |
|------|-------|
| `supabase/functions/generate-payment-receipt/index.ts` | 20-50 |
| `supabase/functions/generate-manual-payment-receipt/index.ts` | 20-56 |

User is authenticated but not verified as the owner of the transaction. Any authenticated user can generate receipts for any transaction ID.

### 28. Open Redirect in Quote Approval

**File:** `src/pages/QuoteApproval.tsx:111`

```typescript
if (response.redirected) {
  window.location.href = response.url;
}
```

Follows server redirects without validating the destination domain.

### 29. DOMPurify Used with Default Configuration

All 6 uses of `DOMPurify.sanitize()` use default options. This allows a wide range of HTML tags and attributes. A stricter allowlist would reduce the attack surface.

---

## LOW Severity

### 30. Console.log Statements Exposing Operational Details

Multiple edge functions log email addresses, SMTP hosts, webhook payloads, and PayPal order IDs to console, which appears in Deno/Supabase function logs.

### 31. Weak Email Validation

**File:** `supabase/functions/send-password-reset/index.ts:211`

Only checks `if (!email)` — no format validation. Accepts any string as an email address.

### 32. Brand Cookie Missing HttpOnly Flag

**File:** `src/contexts/BrandContext.tsx:50-54`

Cookie is accessible via JavaScript. Low impact since it only contains a brand slug.

### 33. No API Rate Limiting on Receipt Generation

Receipt generation functions can be called without limits, enabling enumeration of transaction IDs.

### 34. Git History Contains Hardcoded JWT

The hardcoded Supabase anon key exists in git history. Even if removed from source, it remains in commit history unless cleaned.

---

## Summary by Category

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Payment Security | 3 | 2 | 2 | 0 |
| Authentication/Authorization | 2 | 3 | 1 | 0 |
| Data Exposure | 1 | 2 | 0 | 2 |
| Web Security (CORS/CSRF/Headers) | 1 | 1 | 4 | 0 |
| Input Validation | 0 | 1 | 2 | 1 |
| Configuration | 0 | 1 | 3 | 2 |
| **Total** | **7** | **10** | **12** | **5** |

---

## Priority Remediation Roadmap

**Phase 1 — Immediate (Critical/High impact, high exploitability):**
1. Add server-side payment amount validation in all payment functions
2. Add authentication to `create-paypal-order` and `send-invoice-email`
3. Fix RLS policies to enforce customer data isolation
4. Add idempotency checks to payment webhooks
5. Restrict CORS to application domains
6. Validate Origin header in `create-payment-checkout`

**Phase 2 — Short-term (High impact, requires more work):**
7. Rotate and remove hardcoded Supabase anon key
8. Add order ownership verification to all payment/receipt functions
9. Sanitize email header values (strip CRLF)
10. Add rate limiting to sensitive endpoints
11. Fix CashApp webhook signature edge case

**Phase 3 — Medium-term (Defense in depth):**
12. Add Content-Security-Policy header
13. Add security headers (X-Frame-Options, etc.)
14. Move to stricter TypeScript configuration
15. Implement database transactions for payment flows
16. HTML-encode template variables before DOMPurify
17. Encrypt sensitive credentials in database
18. Add generic error messages for all edge functions
