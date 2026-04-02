# Street Eats

An offline-first food truck POS system with QR ordering, kitchen display, and Raspberry Pi local mode.

## What It Does

- **QR Ordering** — Customers scan a QR code, browse the menu, order from their phone, and pay via Stripe (Apple Pay, Google Pay, card) or at the window
- **Front of House (FOH)** — Tablet-based POS for walk-up orders, order queue with payment status, NFC tap-to-pay via Stripe Terminal, QR throttle toggle
- **Back of House (BOH)** — Kitchen display system with bump-to-complete workflow, auto-SMS when food is ready
- **Offline-First** — Works without internet. Orders queue locally in IndexedDB and sync to cloud when connectivity returns
- **Raspberry Pi Mode** — Self-contained local server with WiFi hotspot for events with no mobile coverage

## Live Demo

- **Customer ordering:** https://foodtruck-app.pages.dev/#/qr-order
- **Kitchen display:** https://foodtruck-app.pages.dev/#/boh (PIN: 1234)
- **Front of house POS:** https://foodtruck-app.pages.dev/#/foh (PIN: 1234)
- **Admin panel:** https://foodtruck-app.pages.dev/#/admin (admin / admin123)
- **Product page:** https://foodtruck-app.pages.dev/#/landing

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, TailwindCSS 4 |
| Backend | Cloudflare Pages Functions |
| Database | Cloudflare D1 (SQLite, Sydney) |
| Offline | IndexedDB + outbox queue + auto-sync |
| Payments | Stripe Checkout + Stripe Terminal (NFC) |
| Native App | Capacitor 8 (Android + iOS) |
| AI | OpenRouter (Gemini 2.5 Flash) |
| Pi Server | Node.js + better-sqlite3 |
| PWA | vite-plugin-pwa + service worker |

## Quick Start

```bash
npm install
npm run dev          # Vite + wrangler pages dev
npm run build        # Build for production
npm run deploy       # Build + deploy to CF Pages
```

## Raspberry Pi Setup

```bash
git clone https://github.com/3dhuboz/FoodTruc-App.git ~/street-eats
cd ~/street-eats && npm run build
cd pi-server && sudo chmod +x setup-pi.sh && sudo ./setup-pi.sh
sudo street-eats-connect-phone.sh "YourPhone" "password"
```

Hardware: Raspberry Pi 5 + USB WiFi adapter with antenna (~$35 AUD)

## Stripe Setup

```bash
npx wrangler pages secret put STRIPE_SECRET_KEY --project-name foodtruck-app
```

Webhook: `https://foodtruck-app.pages.dev/api/v1/stripe/webhook` → `checkout.session.completed`

## Order Flow

```
Customer scans QR → browses menu → places order
  → Pays online (Stripe) → "Confirmed" → kitchen
  → Or pays at window → FOH marks paid → "Confirmed" → kitchen
  → BOH cooks → BUMP → customer gets SMS → collects food
  → No food without payment. No walk-offs.
```

## License

Private — All rights reserved.
