import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'au.com.streeteats.app',
  appName: 'Street Eats',
  webDir: 'dist',
  server: {
    // Allow loading images from Unsplash (menu item photos)
    allowNavigation: ['images.unsplash.com'],
  },
  plugins: {
    // Stripe Terminal will be configured here after plugin install
  },
};

export default config;
