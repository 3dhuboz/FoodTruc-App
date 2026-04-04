import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'au.com.chownow.app',
  appName: 'ChowNow',
  webDir: 'dist',
  server: {
    allowNavigation: ['images.unsplash.com'],
  },
  plugins: {
    StripeTerminal: {
      tokenProviderEndpoint: '/api/v1/stripe/connection-token',
      isTest: false,
    },
  },
  android: {
    // Allow mixed content for local dev if needed
    allowMixedContent: true,
  },
};

export default config;
