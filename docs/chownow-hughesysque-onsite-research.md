# ChowNow and Hugheseys Que Onsite Ordering Research

Date: 2026-06-10
Repos:
- ChowNow / FoodTruc-App: `C:\Users\Steve\Desktop\GitHub\FoodTruc-App`
- Hugheseys Que: `C:\Users\Steve\Desktop\GitHub\hughesysque`

## Executive Summary

ChowNow exists to be the onsite operations layer for food trucks and event food service: QR ordering, front-of-house POS, back-of-house display, local printing, offline capture, and later cloud sync. Its "ChowBox" Raspberry Pi direction is exactly the missing piece for a venue like Hugheseys Que when network coverage is weak or absent.

The current app can already support a useful no-network onsite workflow:

1. The Pi serves the app and API on a local hotspot.
2. Customers or staff create local orders.
3. FOH marks external payment or cash as accepted.
4. BOH sees confirmed orders.
5. The Pi prints labels or receipts.
6. The Pi queues local changes and syncs to cloud when internet returns.

The current app does not yet support truthful integrated card payment with no network. Stripe Checkout, the current Stripe Terminal path, Square hosted checkout, ClickSend, Resend/MailChannels, webhooks, and Cloudflare sync all need internet today. Offline card payment is possible in the market, but it would require a dedicated native Stripe Terminal offline implementation or a Square POS/Mobile Payments SDK offline path, plus reconciliation and risk controls.

The recommended integration path for Hugheseys Que is not a full migration first. Keep Hugheseys as the cloud source of truth for menu, events, customers, Square payments, admin, and reporting. Use ChowNow/Pi as a local onsite station that imports the Hugheseys menu/events, runs local QR/FOH/BOH/printing, and syncs orders/statuses back through a trusted device bridge.

## Why ChowNow Exists

ChowNow is a multi-tenant SaaS food truck POS and operations product. The stated product scope includes QR ordering, kitchen display, FOH POS, offline mode, SMS notifications, and a ChowBox Raspberry Pi hardware device. Evidence:

- `CLAUDE.md:4` describes ChowNow as a multi-tenant SaaS food truck POS with QR ordering, kitchen display, FOH POS, offline mode, SMS notifications, and ChowBox hardware.
- `README.md:3-11` describes an offline-first food truck POS with QR ordering, kitchen display, and Raspberry Pi local mode.
- `CLAUDE.md:77-88` lists the product modules: QR ordering, BOH, FOH, collection PINs, thermal printer, notifications, offline mode, multi-tenant SaaS, fleet management, Stripe Connect, and analytics.

The core job is to reduce event-service friction:

- Customers should not wait in one physical queue just to place an order.
- FOH should not rewrite or relay orders manually.
- BOH should see a clean queue with collection PINs.
- Staff should still operate when internet is poor.
- Owners should get synced order history, payment records, and customer comms later.

## How ChowNow Works Today

ChowNow is a React/Vite hash-routed SPA backed by Cloudflare Pages Functions and D1 in cloud mode, and by a Node/SQLite server in Pi mode.

Key architecture:

- `App.tsx:88-101` defines operational routes for `/boh`, `/foh`, `/qr-order`, `/order-status/:orderId`, and `/portal`.
- `App.tsx:153-165` gates the platform tenant (`chownow`) into the SaaS landing surface, while customer tenants receive the food truck app.
- `context/TenantContext.tsx:2-8` resolves the tenant from `/api/v1/tenant`.
- `functions/api/v1/_lib/tenant.ts` resolves `*.chownow.au` tenants and restricts trusted `X-Tenant-ID` overrides.
- `wrangler.toml:1-8` maps the Cloudflare Pages project to `foodtruck-app`, `dist`, and D1 database `foodtruck-db`.
- `schema.sql` is tenant-scoped across tenants, menu, orders, settings, cook days, users, and ChowBox devices.

Offline-first frontend behavior:

- `context/AppContext.tsx:2-8` states the design: load from IndexedDB, poll D1, write API first, queue outbox when offline.
- `context/AppContext.tsx:334-356` creates orders optimistically, caches them locally, posts to API when online, and queues `CREATE_ORDER` when offline.
- `services/offlineStore.ts:1-18` stores menu, orders, settings, events, and an outbox in IndexedDB.
- `services/syncEngine.ts:75-120` flushes outbox items.
- `services/syncEngine.ts:191-223` polls orders fast and slower data less often.

Pi mode:

- `pi-server/server.js:1-17` describes the ChowBox local server.
- `pi-server/server.js:51-53` sets `CLOUD_URL`, sync interval, and `TENANT_ID`.
- `pi-server/server.js:189-228` implements local order list/create over SQLite.
- `pi-server/server.js:353-374` implements local print endpoint behavior.
- `pi-server/server.js:659-760` queues and flushes local changes to cloud.
- `pi-server/server.js:768-821` pulls menu/settings down from cloud.
- `pi-server/setup-chowbox.sh:33-82` clones/builds the app and installs it as a systemd ChowBox service.
- `pi-server/setup-pi.sh:121-155` configures hotspot/captive portal pieces.

Order lifecycle today:

1. Customer scans QR and opens `/#/qr-order`.
2. Customer creates an order. Pay-at-window orders become `Pending`.
3. Cloud mode writes to D1. Pi mode writes to local SQLite and queues cloud sync.
4. FOH sees pending/active orders and can mark external payment/cash as confirmed.
5. BOH only shows `Confirmed` and `Cooking` orders.
6. BOH bumps `Confirmed -> Cooking -> Ready`.
7. Print/SMS/email fire from the relevant online or local path where available.
8. FOH marks collected/completed.
9. Pi/cloud sync reconciles local changes later.

## Payment and No-Network Reality

What works without internet today:

- Local Pi-hosted ordering page and API.
- Local order capture.
- Local status updates.
- FOH external-payment/cash confirmation.
- BOH display.
- Local Dymo/CUPS or Bluetooth ESC/POS printing if configured.
- Persistent local sync queue for later cloud upload.

What needs internet today:

- Stripe Checkout.
- Current Stripe Terminal implementation, because `services/stripeTerminal.ts:95-120` calls the cloud backend to create a PaymentIntent before collection.
- Stripe Connect onboarding/status.
- Stripe webhooks.
- Square hosted checkout in Hugheseys Que.
- SMS and email providers.
- Cloudflare D1 sync.
- Cloudflare Tunnel/fleet visibility.
- QR image generation paths that call external QR services.

Important distinction:

- "Paid offline" can mean "operator accepted cash/external EFTPOS and marked paid." ChowNow can support this operationally now.
- "Integrated offline card payment" means the payment SDK/device captures card-present payment while disconnected and later forwards it for authorization/settlement. ChowNow does not implement this today.

Current official payment-doc check:

- Stripe Terminal supports offline collection, but it requires offline mode configuration, supported readers, prior online connection/location setup, client-side SDK PaymentIntent creation while offline, offline listeners, forwarding/reconciliation, and merchant risk acceptance.
- Square supports offline payments through Mobile Payments SDK / Point of Sale API paths, with requirements such as prior online reader/app state, offline processing enabled, limits, and later processing. Square Terminal API checkouts are API-forwarded to Square Terminal and should be treated as online for this product path unless a Square offline SDK/POS flow is deliberately implemented.

Product implication:

For a first Hugheseys onsite pilot, do not promise no-network integrated card payments. Promise no-network order capture, BOH, printing, and external payment recording. If the business needs true offline card, choose one of these as a separate payment workstream:

1. Square POS app switch / Square offline flow, if Hugheseys wants to stay with Square.
2. Square Mobile Payments SDK offline integration in a native Android/iOS app.
3. Stripe Terminal offline integration in the ChowNow Capacitor/native app.
4. External EFTPOS terminal with manual reconciliation as the simplest operational starting point.

## Hugheseys Que Current Shape

Hugheseys Que is a single-brand Cloudflare Pages/D1 app. It is not a ChowNow tenant today.

Evidence from the repo:

- `README.md:3` describes it as a BBQ catering and cook-day pre-orders site for Gladstone.
- `README.md:12-16` documents Cloudflare D1, Resend, ClickSend, Square hosted payment links, and HMAC auth. It explicitly says no Clerk.
- `wrangler.toml` binds the Pages app to `hughesys-que`, D1 `hughesys-que-db`, and R2 buckets.
- `schema.sql:19-75` defines menu and orders.
- `client/src/App.tsx` defines public/storefront/admin routes.
- `client/src/pages/StorefrontOrder.js` implements guest checkout and redirects to Square when a payment URL is returned.
- `functions/api/v1/orders/index.ts` accepts guest orders but strips unsafe payment/status fields, recomputes totals server-side, and creates Square links.
- `functions/api/v1/payment/square-webhook.ts` marks matching orders paid after verified Square webhook events.
- `client/src/pages/admin/OrderManager.tsx` already owns service-day order management, unpaid-order handling, resend-link workflows, and status controls.

Memory notes from previous Hugheseys work add useful constraints:

- Customer checkout should remain guest-first.
- Clerk was removed and should not be reintroduced by default.
- Payments are Square-centered.
- Resend and ClickSend are already expected provider paths.
- The live custom-domain Pages project is `hughesys-que`, not the separate `hughesysque` Pages project.

## Recommended Integration Model

Use an API bridge first.

Hugheseys remains the cloud source of truth:

- Menu
- Cook days and pickup/service windows
- Customer/order history
- Square payment state
- Customer/admin notifications
- Admin reporting

ChowNow/Pi becomes the onsite station:

- Local hotspot and captive portal.
- QR ordering for the event site.
- FOH payment acceptance and queue control.
- BOH display.
- Local printing.
- Local SQLite storage.
- Sync queue and reconciliation.

Bridge responsibilities:

1. Pull Hugheseys menu, settings, and event/service-window data into the Pi schema.
2. Accept trusted Pi device order/status syncs into Hugheseys.
3. Preserve Hugheseys public order security by not abusing the public guest endpoint for trusted local-paid orders.
4. Use device tokens, idempotency keys, local order IDs, and revision timestamps.
5. Map local payment markers clearly: `cash`, `external_eftpos`, `square_offline_pending`, `stripe_offline_pending`, `paid_online`, etc.
6. Expose sync/print/device health in one admin surface.

This is lower risk than embedding ChowNow components inside Hugheseys immediately, because the two apps differ in routing, auth, payment provider, schema, and admin workflow ownership.

## Data Contracts Needed

Tenant/site:

- `tenantId`, `slug`, `businessName`, `timezone`, `branding`, `domain`, `paymentProvider`, notification settings.

Menu/items:

- Stable external ID, name, description, category, price, image, availability, stock/sold-out, modifiers/options, catering/pack flags, service-period constraints.

Events/service windows:

- Cook day, event/service ID, pickup slots, location, orderable start/end, onsite mode flag.

Orders:

- Cloud order ID, local order ID, source, device ID, customer name/email/phone, items, totals, fulfillment method, cook day, pickup time, collection PIN, status, timestamps, revision.

Payments:

- Provider, method, amount, status, captured/authorized/pending/reconciled flags, provider IDs, offline client transaction ID, idempotency key, risk/decline handling.

Device/sync/print:

- Device ID, tenant/source app, last heartbeat, local URL/tunnel URL, printer status, queue depth, last successful sync, last failed sync, print job status.

## Staged Plan

Stage 1: Inventory and mapping

- Define a Hugheseys to ChowNow menu/event mapper.
- Decide which menu fields are required onsite and which can be ignored.
- Generate a local Pi seed from Hugheseys D1 or bridge API.

Stage 2: Trusted bridge

- Add Hugheseys bridge endpoints for trusted ChowBox devices.
- Use service/device tokens, not customer/admin browser tokens.
- Add idempotent create/update for local onsite orders.

Stage 3: Operational pilot

- Run ChowNow Pi locally for Hugheseys onsite orders.
- Payment mode: cash/external EFTPOS/manual paid marker.
- Use BOH and printing locally.
- Sync to Hugheseys after the event or whenever connectivity returns.

Stage 4: Admin reconciliation

- Add Hugheseys admin view for onsite/Pi orders.
- Show sync state, payment method, payment risk, print status, and conflict warnings.
- Preserve Hugheseys existing service-day queue semantics.

Stage 5: True offline card payment workstream

- If Square remains the system of record, evaluate Square POS API or Mobile Payments SDK offline mode.
- If ChowNow becomes payment-owner, evaluate Stripe Terminal offline mode in the native app.
- Do not mix "accepted externally" and "processor-confirmed paid" in one status.

Stage 6: Product decision

- Keep as API bridge for existing brands like Hugheseys.
- Offer ChowNow tenant/subdomain for new food trucks.
- Consider white-label/full migration only after the onsite bridge proves itself.

## Key Risks and Gaps

1. Payment truth

The app can operate locally, but integrated offline card capture is not implemented. Manual external EFTPOS is the honest first pilot.

2. BOH visibility

BOH shows confirmed/cooking orders. Pending orders will not appear until FOH marks them paid/confirmed. That is good for "no food without payment" but must match the onsite payment flow.

3. Provider mismatch

ChowNow is currently Stripe-oriented. Hugheseys is Square-oriented. A bridge must not pretend these are the same payment state machine.

4. Auth mismatch

ChowNow mentions Clerk in places, but current Hugheseys uses HMAC sessions and no Clerk. The bridge should use device/service tokens.

5. Schema drift

Hugheseys menu availability and order rules have app-specific migrations and business logic. The Pi must import through a mapper, not by blindly copying table schemas.

6. Conflict ownership

If Hugheseys admin and ChowNow BOH/FOH can both update the same order, the system needs clear source-of-truth and conflict rules.

7. Current ChowNow bugs worth fixing before pilot

- QR pay-at-window orders do not set `source: 'qr'`; backend defaults missing source to `walk_up`.
- FOH QR payment polling appears to call `/api/v1/orders?id=...`, while the orders index does not support `id`.
- Stripe checkout success URL and `PaymentSuccess` query param names appear mismatched.
- Setup wizard may check `stripeConnected` while status endpoint returns `connected`.
- Some docs still say Street Eats, Twilio, or SendGrid while the app has moved toward ChowNow, ClickSend, and other provider paths.

## Bottom Line

ChowNow exists because a normal cloud storefront is fragile at an onsite food event. Hugheseys Que already handles brand, menu, Square payments, customer comms, and admin well, but it is not designed to be the local network brain when the internet disappears.

The high-value product is a local Pi order station that can keep taking orders, send them to BOH, print labels/receipts, and sync back later. The first sellable version should be honest: no-network ordering and operations, with cash/external EFTPOS or online payment when internet exists. True no-network integrated card payment is a separate native payment integration and risk/reconciliation problem.
