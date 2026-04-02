/**
 * Stripe Terminal — Tap to Pay service.
 *
 * Wraps @capacitor-community/stripe-terminal for NFC payments.
 * Only works in native Capacitor app (iOS/Android).
 * Falls back gracefully in browser.
 */

import { Capacitor } from '@capacitor/core';

// Lazy import — only load the plugin in native context
let StripeTerminal: any = null;
let isInitialised = false;

/**
 * Check if we're running in a native Capacitor app (not browser).
 * Tap to Pay only works natively.
 */
export function isNativePaymentAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Initialise the Stripe Terminal SDK.
 * Must be called once before collecting payments.
 * The SDK fetches connection tokens from our backend.
 */
export async function initTerminal(): Promise<boolean> {
  if (!isNativePaymentAvailable()) {
    console.log('[Stripe] Not a native platform — Tap to Pay unavailable');
    return false;
  }

  if (isInitialised) return true;

  try {
    const module = await import('@capacitor-community/stripe-terminal');
    StripeTerminal = module.StripeTerminal;

    await StripeTerminal.initialize({
      tokenProviderEndpoint: '/api/v1/stripe/connection-token',
      isTest: false, // Set to true for Stripe test mode
    });

    isInitialised = true;
    console.log('[Stripe] Terminal SDK initialised');
    return true;
  } catch (err) {
    console.error('[Stripe] Failed to initialise Terminal:', err);
    return false;
  }
}

/**
 * Connect to the built-in Tap to Pay reader (phone's NFC).
 * Must be called after initTerminal().
 */
export async function connectTapToPay(): Promise<boolean> {
  if (!StripeTerminal || !isInitialised) {
    const ok = await initTerminal();
    if (!ok) return false;
  }

  try {
    // Discover the local Tap to Pay reader
    const { readers } = await StripeTerminal.discoverReaders({
      type: 'tapToPay', // Uses TerminalConnectTypes.TapToPay
    });

    if (!readers || readers.length === 0) {
      console.error('[Stripe] No Tap to Pay reader found on this device');
      return false;
    }

    // Connect to the first (and usually only) reader
    await StripeTerminal.connectReader({
      reader: readers[0],
    });

    console.log('[Stripe] Connected to Tap to Pay reader');
    return true;
  } catch (err) {
    console.error('[Stripe] Failed to connect reader:', err);
    return false;
  }
}

/**
 * Collect a payment via Tap to Pay.
 *
 * @param amountDollars - Amount in dollars (e.g., 36.50)
 * @param orderId - Order ID for metadata
 * @returns { success: boolean, paymentIntentId?: string, error?: string }
 */
export async function collectPayment(
  amountDollars: number,
  orderId: string
): Promise<{ success: boolean; paymentIntentId?: string; error?: string }> {
  if (!isNativePaymentAvailable()) {
    return { success: false, error: 'Tap to Pay only available in the native app' };
  }

  try {
    // 1. Create PaymentIntent on our backend
    const piRes = await fetch('/api/v1/stripe/payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(amountDollars * 100), // Convert to cents
        orderId,
        currency: 'aud',
      }),
    });

    if (!piRes.ok) {
      const err = await piRes.json();
      return { success: false, error: err.error || 'Failed to create payment' };
    }

    const { clientSecret, paymentIntentId } = await piRes.json();

    // 2. Collect payment via NFC (customer taps card)
    await StripeTerminal.collectPaymentMethod({ clientSecret });

    // 3. Confirm the payment
    await StripeTerminal.confirmPaymentIntent({ clientSecret });

    console.log(`[Stripe] Payment collected: ${paymentIntentId} — $${amountDollars}`);
    return { success: true, paymentIntentId };
  } catch (err: any) {
    // User cancelled or card declined
    const message = err?.message || String(err);
    if (message.includes('cancel')) {
      return { success: false, error: 'Payment cancelled' };
    }
    console.error('[Stripe] Payment failed:', err);
    return { success: false, error: message };
  }
}

/**
 * Cancel an in-progress payment collection.
 */
export async function cancelPayment(): Promise<void> {
  if (StripeTerminal && isInitialised) {
    try {
      await StripeTerminal.cancelCollectPaymentMethod();
    } catch {}
  }
}
