# FoodTruck App - White-Label Mobile Ordering Platform

A fully-featured, mobile-first food truck and catering ordering web app. Built with React 19, TypeScript, Firebase, and Square Payments. White-label ready  rebrand for any food business.

## Features

- **Online Ordering**  Takeaway and catering orders with real-time tracking
- **Catering Builder (DIY)**  Customers build custom catering packs
- **Square Payments**  Auto-generated payment links for invoices, webhook for payment confirmation
- **AI Assistant**  Powered by Google Gemini for chat, social content, and image generation
- **Admin Dashboard**  Orders, planner, menu management, customers, social & AI, settings
- **Rewards Program**  Configurable loyalty stamps system
- **Email & SMS**  Invoice sending, order notifications, SMS blasts (Twilio/MessageBird)
- **PWA**  Installable progressive web app with offline support
- **Events & Gallery**  Manage cook days, events, and photo gallery
- **Fully Configurable**  Business name, colors, logos, menus all editable from admin settings

## Tech Stack

- **Frontend:** React 19, TypeScript, TailwindCSS 4, Lucide Icons
- **Backend:** Express 5 (dev server), Vercel Serverless Functions (production)
- **Database:** Firebase (Auth, Firestore, Storage)
- **Payments:** Square (Checkout API + Webhooks)
- **AI:** Google Gemini, Anthropic Claude
- **Email:** Nodemailer (SMTP), SendGrid, Amazon SES
- **SMS:** Twilio, MessageBird
- **Build:** Vite 6

## Quick Start

1. Clone this repo
2. Copy `.env.example` to `.env` and fill in your Firebase + API keys
3. Install dependencies:
   ```
   npm install
   ```
4. Start the dev server:
   ```
   npm run dev
   ```
5. Open http://localhost:5173

## Configuration

### Firebase Setup
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication (Email/Password)
3. Create a Firestore database
4. Enable Storage
5. Copy your config values into `.env`

### Square Payments Setup
1. Create a Square Developer account at https://developer.squareup.com
2. Get your Access Token and Location ID
3. Configure in Admin > Dev Tools > Payment Gateway
4. Set up webhook URL: `https://your-domain.com/api/v1/payment/square-webhook`
5. Subscribe to `payment.completed` events

### Admin Login
Default admin credentials are configured in Settings. First-time setup available at `/setup`.

### Environment Variables
See `.env.example` for all required and optional environment variables.

## Deployment

### Vercel (Recommended)
1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy  serverless API routes are auto-detected from `/api` folder

### Custom Server
The Express server in `server.ts` handles both the Vite dev middleware and all API routes for local development.

## Project Structure

```
/api/v1/           Vercel serverless API routes
/components/       Shared React components (Layout, Toast, etc.)
/context/          AppContext (global state management)
/pages/            All page components (Home, Menu, Order, Admin, etc.)
/pages/admin/      Admin dashboard tabs
/public/           Static assets, PWA manifest
/services/         Firebase, Gemini AI, Data Seeder
server.ts          Express dev server with all API routes
constants.ts       Default settings and seed data
types.ts           TypeScript interfaces
```

## License

Private  All rights reserved.
