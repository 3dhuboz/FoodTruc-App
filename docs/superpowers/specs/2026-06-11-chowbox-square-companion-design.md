# ChowBox Square Companion Design

Date: 2026-06-11
Status: Draft for Steve review

## Product Decision

ChowBox should not try to replace Square for individual Australian traders. Square already solves the hardest and highest-trust part of the job: certified card-present payments, offline payment capture, POS hardware, and merchant reporting.

The product should become a Square-compatible local trading companion:

> Keep Square. Add reliable local ordering, kitchen flow, printing, pickup status, and bad-network service continuity.

The first version targets individual traders who already understand Square but need service to keep moving when customer phones, QR menus, staff coordination, or kitchen flow break down at markets, roadside sites, private events, or low-coverage venues.

## Target Customer

The first customer is a solo or small-team food trader in Australia:

- Uses Square, cash, or an external EFTPOS terminal today.
- Trades in places where network quality is unreliable.
- Wants customers to order faster without staff rewriting orders.
- Wants a simple BOH queue and printer without committing to a full custom POS.
- May have their own website/app later, but does not want to abandon Square on day one.

The product should be easy enough that the trader can keep their current Square setup and add ChowBox in one short setup session.

## Non-Goals

ChowBox v1 will not:

- Capture card or NFC payments directly.
- Replace Square POS, Square Terminal, or the Square merchant account.
- Promise final payment approval while the certified payment provider is offline.
- Require customers to use ChowBox for online card payment when there is no internet.
- Force a trader to migrate all menu, reporting, or payments away from Square.
- Depend on satellite, Starlink, or mobile network access for the local trading workflow.

These refusals are important. They keep the product from becoming a fragile Square clone.

## Modes

The product can support three marketable modes, but only one core system should be built.

### Mode 1: Walk-Up Stall

This is the v1 build target.

The trader plugs in ChowBox at the site. ChowBox creates the local network and serves a branded QR menu. Customers join the local network or scan a local QR code, place an order, and receive an order number or collection PIN. FOH takes payment using Square, cash, or an external terminal, then confirms the order into the kitchen queue. BOH sees confirmed orders locally, and the printer prints a kitchen/customer ticket.

### Mode 2: Service-Day Hub

This mode supports Hugheseys-style preorders, catering days, or event service.

Orders, menu, service windows, and customer references are loaded before the event. Onsite staff use ChowBox as the local service hub for arrivals, balance collection, BOH production, pickup status, and printer output. When internet returns, ChowBox syncs statuses, notes, and payment markers back to the brand system.

This should share the same local order, payment-state, BOH, print, and sync architecture as Walk-Up Stall mode.

### Mode 3: Done-For-You Trader Kit

This is a packaging and sales mode, not a separate software mode.

The bundle can include the Pi/ChowBox, FOH tablet, BOH tablet, receipt printer, Square device setup, QR signs, basic menu import, and trader training. The trader buys a working service setup rather than a pile of configurable software.

## Core Promise

ChowBox must make a bad-network trading day calmer:

1. The menu still loads.
2. Customers can still submit local orders.
3. FOH can still confirm payment state.
4. BOH still sees the queue.
5. The printer still prints.
6. Staff can still bump orders.
7. The trader can see what is working.
8. Cloud sync happens later without lying about payment certainty.

## Architecture

ChowBox is the local service brain. Square remains the certified payment rail.

### Local Components

- Raspberry Pi 5 with local SQLite on durable storage.
- Local Wi-Fi/AP and optional captive portal.
- FOH tablet running the ChowBox operator UI.
- BOH tablet running the local kitchen display.
- Customer QR ordering page served from the Pi.
- Receipt or kitchen printer connected through USB, Ethernet, or supported Bluetooth.
- Optional small Pi status screen.

### Cloud Components

- ChowNow/FoodTruc cloud remains the long-term tenant, menu, analytics, and sync destination.
- Brand systems such as Hugheseys or Street Meatz integrate through bridge APIs.
- Square remains the card payment account and final processor when used.
- SMS/email providers run only when internet exists.

### Payment Boundary

ChowBox records operational payment state. It does not process card data.

Supported v1 payment states:

- `unpaid`
- `cash_paid`
- `external_eftpos_paid`
- `square_paid_operator_confirmed`
- `square_offline_pending`
- `processor_confirmed`
- `processor_declined_late`
- `voided`
- `refund_required`

For v1, the default flow should be `unpaid -> square_paid_operator_confirmed` or `unpaid -> cash_paid` before sending the order to BOH. If Square offline integration is later added, `square_offline_pending` can be admitted to BOH under a trader-configured risk limit.

## Walk-Up Stall Workflow

1. Trader starts ChowBox.
2. FOH screen shows service status: local network, internet, printer, BOH devices, pending sync, and payment mode.
3. Customers scan a local QR code.
4. Customer creates an order from the locally cached menu.
5. Order appears in FOH as `unpaid`.
6. FOH takes payment in Square, cash, or external EFTPOS.
7. FOH confirms payment state.
8. Order enters BOH as `confirmed`.
9. Printer outputs kitchen ticket.
10. BOH bumps `confirmed -> cooking -> ready`.
11. Pickup screen or local status page updates.
12. SMS/cloud sync is queued until internet exists.
13. End-of-day reconciliation exports local orders and payment markers.

## Service-Day Hub Workflow

1. Trader loads event/menu/order data before service.
2. ChowBox runs locally at the event.
3. FOH looks up preorders, walk-ups, balances, and notes.
4. BOH sees production queue by status, pickup window, or priority.
5. Staff bump orders and print labels/tickets.
6. When internet returns, ChowBox syncs status changes and local orders back to the brand app.

This mode should not be implemented as a separate product. It is a different preset over the same local order system.

## Data Model Changes

The local and cloud order model should clearly separate payment certainty from operational readiness.

Recommended fields:

- `local_order_id`
- `cloud_order_id`
- `tenant_id`
- `service_mode`
- `source`
- `customer_name`
- `customer_phone`
- `items`
- `subtotal`
- `total`
- `status`
- `payment_state`
- `payment_method`
- `payment_provider`
- `provider_reference`
- `operator_confirmed_by`
- `payment_risk_level`
- `sync_state`
- `created_local_at`
- `updated_local_at`
- `synced_at`

The payment provider reference can store Square receipt numbers, client transaction IDs, external terminal references, or manual notes. It must never store card data.

## Sync Rules

ChowBox must sync with idempotency and explicit conflict behavior.

Rules:

- Every local order receives a durable `local_order_id`.
- Every sync attempt uses an idempotency key.
- Local orders can be created while cloud is unreachable.
- Cloud sync should not convert `square_offline_pending` into `processor_confirmed`.
- Cloud should preserve local operational history even if payment later declines.
- Late payment decline should create a visible exception, not silently rewrite the order history.
- Sync status should be visible to FOH and admin users.

## Status Screen

The small Pi screen should be operational, not decorative.

It should show:

- Service mode.
- Local network state.
- Internet state.
- Printer state.
- BOH/FOH device count.
- Orders in queue.
- Pending sync count.
- Pending payment risk amount.
- Storage health.
- Pi temperature/power warning if available.

The goal is for a stressed trader to glance at the box and know whether service can continue.

## Hardware Recommendation

Minimum pilot kit:

- Raspberry Pi 5.
- Official PSU.
- Active cooling case.
- High-endurance microSD or NVMe/M.2 storage.
- Local router/AP or Pi-hosted AP.
- FOH tablet.
- BOH tablet.
- 80mm receipt/kitchen printer or currently supported Dymo/Bluetooth printer path.
- Existing Square device or external EFTPOS terminal.

Preferred field kit:

- Pi 5 with NVMe storage.
- Industrial dual-SIM 4G/5G router.
- UPS or power bank suitable for Pi and router.
- Ethernet or USB printer over Bluetooth where possible.
- Optional Starlink Mini for remote venues.
- Optional satellite IoT only for telemetry, not v1 operation.

## User Experience Principles

The product should feel simpler than adding another POS.

Principles:

- Do not ask the trader to choose payment processors during service.
- Make Square the default payment assumption.
- Keep BOH screens large, direct, and low-text.
- Keep FOH actions obvious: take payment, send to kitchen, bump, print, void.
- Make offline/online state visible without drama.
- Never label an order as processor-paid unless the processor confirmed it.
- Prefer setup presets over complex settings.

## Build Sequence

### Phase 1: Spec and Local Product Shape

- Confirm Walk-Up Stall as v1.
- Define shared order/payment-state model.
- Identify current code gaps against the local workflow.
- Produce a short implementation plan.

### Phase 2: Local Walk-Up Pilot

- Harden Pi-hosted QR ordering.
- Ensure FOH unpaid orders are easy to confirm.
- Ensure BOH only sees orders that meet the trader's payment policy.
- Verify local print path.
- Add local service status surface.

### Phase 3: Square-Friendly Reconciliation

- Add fields for Square receipt/reference/operator confirmation.
- Add end-of-day export.
- Add cloud sync visibility.
- Later, test Square POS API or Square Mobile Payments SDK offline flows as a payment workstream.

### Phase 4: Service-Day Hub Preset

- Add event/preorder import.
- Add pickup-window and preorder lookup flows.
- Add bridge API contracts for Hugheseys/Street Meatz style apps.

## Risks

- Traders may decide Square alone is enough.
- Square offline payment behavior differs by hardware, country, app, and account settings.
- Customer QR ordering without internet may require local Wi-Fi onboarding that must be dead simple.
- Staff may resist extra screens unless FOH workflow is faster than paper.
- Printer reliability can make or break trust.
- Payment-state language must be legally and operationally honest.

## Success Test

The product is worth building if a trader can say yes to this after a short demo:

> I can keep Square, add this in about 10 minutes, and service feels easier when the internet is unreliable.

The first pilot should prove:

- A customer can place a local QR order without internet.
- FOH can accept Square/cash/external payment and send the order to kitchen.
- BOH can run the queue locally.
- Printer output works.
- The trader can see offline/sync/payment risk status.
- Orders can sync/export later without pretending Square has confirmed unprocessed payments.

