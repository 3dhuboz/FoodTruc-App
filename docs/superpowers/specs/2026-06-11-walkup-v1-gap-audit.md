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

- FOH can now mark Square/EFTPOS or cash as operator-confirmed with an optional provider reference.
- QR orders were identifiable by `userId = 'qr_customer'`; they now also set `source = 'qr'`.
- Pi and cloud schemas now include provider-neutral payment-state columns alongside existing `payment_intent_id` and `square_checkout_id` fields.
- Operator dashboard shows basic sync/printer/internet health plus export, smoke-test, FOH/BOH, QR order, and pickup-board actions; it still does not show BOH/FOH device counts.
- Print works locally, but the v1 pilot needs a boring first-class 80mm printer path and setup verification.

### Not Yet Aligned

- No Square POS API or Square Mobile Payments SDK offline integration.
- No cloud/admin reconciliation view for Square/EFTPOS operator-confirmed orders.
- No printable end-of-day reconciliation screen beyond the Pi CSV/JSON export.
- No service-day open/closed control that governs QR ordering and the pickup board together.
- No local customer Wi-Fi onboarding proof on real phones.
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

The Pi operator dashboard now exposes the export actions directly:

- "Download Today CSV"
- "Open Today JSON"

The Pi also exposes a local Walk-Up smoke test endpoint:

- `POST /api/v1/admin/smoke/walkup`

By default this creates a synthetic QR order, confirms Square/EFTPOS payment, moves it through `Confirmed -> Cooking -> Ready`, skips physical printing, then deletes the smoke order. Passing `{ "cleanup": false }` leaves the order in SQLite; passing `{ "print": true }` attempts the configured Dymo/Bluetooth printer path.

This does not replace Square. It creates the data slot that lets ChowBox sit beside Square honestly.

## Local Pickup Board

The Pi now has a standalone local pickup board:

- `GET /pickup`
- `GET /api/v1/orders/pickup-board`

The board shows Ready, Cooking, and Up Next order codes for today's service using only the Pi SQLite database. It is intended for a cheap customer-facing screen at the counter and does not need internet, Clerk, Square APIs, or the cloud app to render.

The operator dashboard and captive portal now link directly to the pickup board. The platform/default React route set also exposes `/order-status/:orderId`, so QR customers can reach their per-order status page even on the platform/default tenant path.

## Walk-Up Stall Preset

Walk-Up Stall is now an explicit settings mode:

- `chowboxMode: "walk_up_stall"`
- `paymentCaptureMode: "square_terminal_operator_confirmed"`
- `walkUpStall` flags for QR ordering, FOH, BOH, pickup screen, local printing, customer-name requirement, and collection-pin order codes

The cloud setup wizard now recommends this preset in the payment step and keeps Stripe/online checkout as optional. The Pi operator setup also saves these defaults on first-run setup.

## Next Implementation Slice

The next slice should make Walk-Up Stall mode feel like a coherent operator product:

1. Add cloud/admin reconciliation visibility for Square/EFTPOS operator-confirmed orders.
2. Add a "service day open/closed" control that affects QR ordering and the pickup board.
3. Add a printable/exportable end-of-day handover report from the Pi dashboard.
4. Add a local setup checklist for hardware: Square Terminal, FOH tablet, BOH tablet, pickup screen, and printer.
5. Add more explicit status for queued SMS/email notifications while offline.

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
