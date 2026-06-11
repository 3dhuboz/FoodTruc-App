# Walk-Up Stall v1 Gap Audit

Date: 2026-06-11
Related design: `2026-06-11-chowbox-square-companion-design.md`

## Current Verdict

Walk-Up Stall v1 is not a blank build. The repo already has most of the local trading skeleton:

- Customer QR ordering route.
- FOH manual order creation and unpaid queue.
- BOH queue filtered to paid/confirmed kitchen work.
- Pi-hosted SQLite API for menu, orders, settings, print, admin status, and sync.
- Local print paths for Dymo/CUPS and Bluetooth ESC/POS.
- IndexedDB outbox and Pi sync queue for later cloud upload.
- Operator dashboard with internet, printer, orders, and sync visibility.

The main gap is product truthfulness: until now the app mostly used `status` as both payment state and kitchen state. That is not enough for a Square-compatible companion because ChowBox must be able to say "the operator accepted Square/external/cash" without pretending to be the card processor.

This audit started the first foundation slice by adding explicit payment-state fields across shared types, D1 schema/migration, Cloudflare order APIs, Pi order APIs, and FOH/QR order creation.

## Evidence From Current Code

### Already Aligned

- `pages/QROrder.tsx` can create onsite QR orders as `Pending`.
- `pages/FOH.tsx` shows `Pending`, `Confirmed`, `Cooking`, and `Ready` orders and lets staff mark unpaid orders paid.
- `pages/BOH.tsx` only shows `Confirmed` and `Cooking`, which is the correct kitchen gate for v1.
- `pi-server/server.js` serves local `/api/v1/orders`, `/api/v1/print/order`, `/api/v1/admin/status`, and sync queue endpoints.
- `pi-server/operator.html` already shows internet, printer, orders today, and sync state.
- `services/offlineStore.ts` and `services/syncEngine.ts` already cache orders and replay outbox updates.

### Partially Aligned

- FOH can mark paid, but the old path only changed `status` to `Confirmed`.
- QR orders were identifiable by `userId = 'qr_customer'`; they now also set `source = 'qr'`.
- Pi and cloud schemas had `source`, `payment_intent_id`, and `square_checkout_id`, but no provider-neutral payment-state columns.
- Operator dashboard shows basic sync/printer/internet health, but not pending payment risk or BOH/FOH device counts.
- Print works locally, but the v1 pilot needs a boring first-class 80mm printer path and setup verification.

### Not Yet Aligned

- No Square POS API or Square Mobile Payments SDK offline integration.
- No Square receipt/reference capture field in the FOH payment modal UI yet.
- No end-of-day reconciliation/export screen.
- No setup preset that says "Walk-Up Stall" and hides irrelevant SaaS/catering complexity.
- No local customer Wi-Fi onboarding proof on real phones.
- No local pickup/status screen designed specifically for the stall counter.
- No cloud admin view that separates `Pending`, `Confirmed`, payment state, sync state, and late decline exceptions.

## Foundation Change Landed

The v1 payment-state foundation adds these order fields:

- `source`
- `paymentState`
- `paymentMethod`
- `paymentProvider`
- `providerReference`
- `operatorConfirmedBy`
- `paymentRiskLevel`
- `syncState`

New QR orders now start as:

- `source = 'qr'`
- `paymentState = 'unpaid'`
- `paymentMethod = 'pay_at_window'`
- `syncState = 'local'`

New FOH orders now start as:

- `source = 'foh'`
- `paymentState = 'unpaid'`
- `paymentMethod = 'pay_at_window'`
- `syncState = 'local'`

FOH payment confirmation now preserves the existing kitchen behavior while recording payment context:

- Stripe/NFC or hosted checkout success: `processor_confirmed`
- Square/EFTPOS operator-confirmed button: `square_paid_operator_confirmed`
- Cash button: `cash_paid`
- Operator confirmation is stamped as `operatorConfirmedBy = 'foh'`

The Pi now exposes a day export endpoint for reconciliation:

- JSON: `/api/v1/admin/export/day?date=YYYY-MM-DD`
- CSV: `/api/v1/admin/export/day?date=YYYY-MM-DD&format=csv`

The export includes totals by status, payment state, payment method, and source, plus order rows with provider references. It does not include card data.

This does not replace Square. It creates the data slot that lets ChowBox sit beside Square honestly.

## Next Implementation Slice

The next slice should make Walk-Up Stall mode feel like a coherent operator product:

1. Add a compact service status strip to FOH.
2. Show local/internet state, pending sync, printer state, and current payment mode.
3. Add a smoke test path for "QR order -> FOH paid -> BOH cooking -> ready -> printed".
4. Add a simple export/download button in the operator dashboard for the Pi day export endpoint.
5. Add setup preset copy and defaults for "Walk-Up Stall".

The first UI goal is not beauty. It is that a trader can understand the current service state in under 10 seconds.

## Verification Needed Before Pilot

- Run a local build/typecheck after the payment-state foundation.
- Run the Pi server against a fresh SQLite DB and an upgraded DB.
- Confirm D1 migration applies cleanly.
- Verify QR order creation stores `source = 'qr'`.
- Verify FOH Square/EFTPOS payment stores `payment_state = 'square_paid_operator_confirmed'`.
- Verify FOH cash payment stores `payment_state = 'cash_paid'`.
- Verify BOH still only sees `Confirmed` and `Cooking`.
- Verify order sync preserves payment fields in both directions.
- Verify printer endpoints still respond with Dymo/Bluetooth fallback.
