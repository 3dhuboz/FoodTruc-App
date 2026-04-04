# ChowNow — Project Context for Claude

## What This Is
ChowNow (chownow.au) is a multi-tenant SaaS food truck POS system. Food truck owners subscribe ($99/$149/month), get a ChowBox (Raspberry Pi 5 + Seagate SSD, $299 one-time), and run their entire operation: QR ordering, kitchen display, FOH POS, offline mode, SMS notifications.

## Architecture

### Frontend
- React 19 + TypeScript + Vite + Tailwind CSS 4
- HashRouter SPA deployed to Cloudflare Pages
- Offline-first: IndexedDB cache + outbox queue + auto-sync

### Backend
- Cloudflare Pages Functions (API at `/api/v1/*`)
- Cloudflare D1 (SQLite) — multi-tenant, all tables scoped by `tenant_id`
- Stripe for subscription billing + one-time ChowBox purchase

### ChowBox (Pi Server)
- Raspberry Pi 5 + Seagate One Touch SSD
- Node.js native HTTP server (no Express) + better-sqlite3
- Serves built frontend + same API endpoints as cloud
- WiFi hotspot for offline events (captive portal)
- Syncs to cloud D1 when internet available
- Thermal printer support (ESC/POS over USB)
- Heartbeats to cloud every 30s for fleet management
- Cloudflare Tunnel for remote access

## Multi-Tenancy
- **Platform tenant** (`id='default'`, slug='chownow'): Shows Landing page at chownow.au
- **Customer tenants** (e.g., slug='smokyjoes'): Shows food truck app at smokyjoes.chownow.au
- Tenant resolved from subdomain via `functions/api/v1/_lib/tenant.ts`
- `TenantContext.tsx` wraps the frontend, `TenantGate` in `App.tsx` decides Landing vs App
- All API endpoints scope queries by `tenant_id`

## Key URLs
- Landing page: `chownow.au` (platform tenant → shows Landing.tsx)
- Super Admin: `chownow.au/#/super-admin`
- Product Demo: `chownow.au/#/demo` (7-step animated walkthrough)
- QR Order Demo: `chownow.au/#/qr-order`
- Customer app: `{slug}.chownow.au` (tenant's branded app)

## Database (D1)
Schema at `schema.sql`, migrations in `functions/api/v1/migrate.ts` (v1-v8):
- `tenants` — multi-tenant with Stripe billing fields + `stripe_account_id`, `stripe_onboarding_complete`
- `users`, `menu_items`, `orders`, `calendar_events`, `social_posts`, `gallery_posts`, `settings`, `cook_days` — all tenant-scoped
- `orders` — includes per-status timestamps: `confirmed_at`, `cooking_at`, `ready_at`, `completed_at`, `cancelled_at`
- `chowbox_devices` — fleet tracking (heartbeats from Pi servers)
- `schema_versions` — migration tracking
- Platform settings stored in `settings` table with `tenant_id='default'`, `key='platform'`

## Stripe Integration
- Signup flow: Landing → signup form → `POST /api/v1/signup` → Stripe Checkout (subscription + ChowBox one-time)
- Webhook at `/api/v1/stripe/webhook` handles: `customer.subscription.created` (provisions tenant + auto-creates Express account), `customer.subscription.deleted`, `invoice.payment_failed`, `account.updated` (Connect onboarding)
- Secrets: `STRIPE_SECRET_KEY`, `STRIPE_STARTER_PRICE_ID` ($99/mo), `STRIPE_PRO_PRICE_ID` ($149/mo), `STRIPE_PI_PRICE_ID` ($299 one-time)
- Order payments: Stripe Checkout (QR orders) + Stripe Terminal (NFC tap-to-pay)

### Stripe Connect (Payment Gateway)
- Each food truck tenant gets a **Stripe Express connected account** (auto-created on signup)
- Customer pays → money goes to truck's Stripe account → platform fee deducted automatically
- Platform fee: configurable via Super Admin Settings (default 1.5%)
- Endpoints: `POST /api/v1/stripe/connect-onboard` (create Express account + onboarding URL), `GET /api/v1/stripe/connect-status` (check onboarding + dashboard link)
- Tenant onboarding: prompted on signup success page + available in tenant Settings
- Fallback: tenants without connected accounts still process payments (to platform account)

## Platform Settings (Super Admin)
- Super Admin at `/#/super-admin` has 4 tabs: Overview, Tenants, Fleet, **Settings**
- Platform settings stored in D1 (`tenant_id='default'`, `key='platform'`)
- API: `GET/PUT /api/v1/admin/settings`
- Controls: platform fee %, admin notification email, support email, branding, signups toggle, maintenance mode
- OpenRouter API key managed at platform level — all tenants use this key for AI features
- Tenant-level Email/SMS/Invoice settings removed — these are platform-managed services

## Key Features Implemented
1. **QR Ordering** — customers scan, browse menu, order from phone
2. **Kitchen Display (BOH)** — real-time orders, two-step bump (Cooking → Ready)
3. **FOH POS** — tablet-based walk-up ordering
4. **Collection PIN** — auto-generated codes (e.g., "A47") shown on customer phone, BOH, FOH, SMS, printed labels
5. **Thermal Printer** — ESC/POS label printing from BOH when cook taps "Start Cooking"
6. **SMS/Email Notifications** — Twilio/SendGrid for order status updates
7. **Offline Mode** — IndexedDB + outbox queue, Pi creates WiFi hotspot
8. **Multi-tenant SaaS** — signup, Stripe billing, auto-provisioning
9. **Fleet Management** — ChowBox heartbeats, admin panel, Cloudflare Tunnel remote access
10. **Super Admin Panel** — `/#/super-admin` with Overview, Tenants, Fleet, Settings tabs
11. **Stripe Connect** — each tenant gets Express account, configurable platform fee on all sales
12. **Order Analytics** — timing metrics (cook time, wait time), CSV export, workflow insights

## Branding
- Logo files in `public/`: `logo.png` (icon), `logo-horizontal.png` (horizontal with tagline), `logo-full.png` (stacked), `favicon.png`, `icon-512.png`
- Brand color: `#f97316` (orange), applied via `--brand-color` CSS custom property
- "ChowBox" = the Pi hardware device ("the brains of your truck")

## Pi Server Files
- `pi-server/server.js` — main server (native HTTP, SQLite, sync, heartbeat)
- `pi-server/printer.js` — ESC/POS thermal printer module
- `pi-server/admin.html` — local diagnostic dashboard at `/admin`
- `pi-server/setup-chowbox.sh` — one-line setup script (install Node, clone repo, build, systemd service, optional Cloudflare Tunnel)
- `pi-server/setup-db.js` — SQLite database initialization

## Cloudflare Tunnel
- Tunnel created: `chowbox-default` (ID: `f1b534f3-d8bb-4f62-8b61-4232656fc37e`)
- DNS: `box-default.chownow.au` → tunnel
- Token: `eyJhIjoiNjcwMDQyM2I3NjY3MWEwNWQxOTY5MTZiNDM0MTA0NTgiLCJzIjoibE8yVGJMNEhMNklYUU5qb2dRSjJHRGhQOGJ2eU9hdnY1ZzlYSzBBU1NzOD0iLCJ0IjoiZjFiNTM0ZjMtZDhiYi00ZjYyLThiNjEtNDIzMjY1NmZjMzdlIn0=`
- Setup: `sudo ./setup-chowbox.sh <tunnel-token>`

## Current State — Pi Setup
- Seagate One Touch SSD flashed with Pi OS Lite 64-bit (Bookworm)
- Boot partition configured with: `custom.toml` (SSH + user + WiFi), `firstrun.sh`, `network-config`, `userconf.txt`, `ssh` file, `wpa_supplicant.conf`
- `usb_max_current_enable=1` added to `config.txt` for SSD power
- Pi 5 connected to Eero router via ethernet
- WiFi: SSID `Hellyers`, password `/60tpprx7`
- SSH credentials: user `pi`, password `chowbox`
- **NEXT STEP**: Boot the Pi, verify SSH works at the IP it gets, then run:
  ```bash
  curl -sL https://raw.githubusercontent.com/3dhuboz/FoodTruc-App/main/pi-server/setup-chowbox.sh | sudo bash
  ```
  Then set up Cloudflare Tunnel:
  ```bash
  sudo /opt/chowbox/pi-server/setup-chowbox.sh eyJhIjoiNjcwMDQyM2I3NjY3MWEwNWQxOTY5MTZiNDM0MTA0NTgiLCJzIjoibE8yVGJMNEhMNklYUU5qb2dRSjJHRGhQOGJ2eU9hdnY1ZzlYSzBBU1NzOD0iLCJ0IjoiZjFiNTM0ZjMtZDhiYi00ZjYyLThiNjEtNDIzMjY1NmZjMzdlIn0=
  ```

## Pending Work
- **Landing page**: Has animated demo, scroll story, pricing, signup modal — needs ongoing polish
- **Pi boot**: Getting the Pi 5 to boot from Seagate SSD with SSH enabled has been difficult. custom.toml is the Bookworm-native method. All config files are on the boot partition.

## Deploy Commands
```bash
cd ~/Desktop/GitHub/FoodTruc-App
npm run dev          # Local dev (Vite + wrangler)
npm run build        # Build for production
npm run deploy       # Build + deploy to CF Pages
npx wrangler d1 execute foodtruck-db --remote --command "SQL"  # Run SQL on live D1
```

## Git Repo
- GitHub: https://github.com/3dhuboz/FoodTruc-App
- Branch: main
- Latest significant commits cover: multi-tenant umbrella, ChowNow rebrand, SaaS signup, landing page redesign, thermal printer, fleet management, collection PINs, super admin panel, Stripe Connect, platform settings, order analytics
