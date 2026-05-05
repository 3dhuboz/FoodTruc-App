
import { AppSettings, CalendarEvent } from './types';

// Use local uploaded logo
export const LOGO_URL = "/logo.png";

export const PLACEHOLDER_IMG = "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80";

// Helper for reliable BBQ images. Used by INITIAL_SETTINGS for the demo
// tenant's ticker + reward prizes; per-tenant data lives in D1 and is set
// up via the Setup Wizard or `/api/v1/seed`.
const BBQ_IMGS = {
  burger1: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=800&q=80",
  brisketPlate: "https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=800&q=80",
  wholeBrisket: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
  porkRibs: "https://images.unsplash.com/photo-1588347818036-558601350947?auto=format&fit=crop&w=800&q=80",
  wings: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=800&q=80",
  burger2: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
  fries: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80",
};

export const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: 'evt1',
    date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    type: 'ORDER_PICKUP',
    title: 'Manual Order Pickup',
    location: 'HQ - West End',
    time: '11:00 AM - 6:00 PM',
    description: 'Online pre-orders available.',
    image: BBQ_IMGS.wholeBrisket,
    tags: ['#preorder']
  },
  {
    id: 'evt2',
    date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    type: 'BLOCKED',
    title: 'Kitchen Closed'
  }
];

export const INITIAL_SETTINGS: AppSettings = {
  maintenanceMode: false,
  heroCateringImage: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80",
  heroCookImage: "https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=1200&q=80",
  homePromoterImage: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1950&q=80",

  menuHeroImage: "",

  diyHeroImage: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1950&q=80",
  diyCardPackageImage: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
  diyCardCustomImage: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80",
  cateringPackageImages: {
      essential: "https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=800&q=80",
      pitmaster: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
      wholehog: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80"
  },

  eventsHeroImage: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1950&q=80",

  promotersHeroImage: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1950&q=80",
  promotersSocialImage: "https://strummingbird.com.au/wp-content/uploads/2025/06/SB25-Website-Image-Resize-4-1024x576.jpg",

  galleryHeroImage: "https://images.unsplash.com/photo-1516054575922-f0b8eeadec1a?auto=format&fit=crop&w=1950&q=80",

  maintenanceImage: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1950&q=80",

  stripeConnected: false,
  squareConnected: false,
  squareApplicationId: "",
  squareLocationId: "",
  smartPayConnected: false,
  smartPayPublicKey: "",
  smartPaySecretKey: "",
  smsConnected: false,
  socialAiStudioUrl: '',
  facebookConnected: false,
  facebookAppId: "",
  facebookPageId: "",
  facebookPageAccessToken: "",
  manualTickerImages: [
    BBQ_IMGS.brisketPlate,
    BBQ_IMGS.burger1,
    BBQ_IMGS.porkRibs,
    BBQ_IMGS.wings,
    BBQ_IMGS.burger2,
    BBQ_IMGS.fries
  ],
  businessName: "", // Resolved from tenant context at runtime
  businessAddress: "",
  logoUrl: LOGO_URL,
  adminUsername: "admin",
  adminPassword: "admin123",
  rewards: {
    enabled: true,
    programName: "ChowNow Rewards",
    staffPin: "1234",
    maxStamps: 10,
    rewardTitle: "Free Burger", // Fallback
    rewardImage: BBQ_IMGS.burger1, // Fallback
    possiblePrizes: [
        { id: 'p1', title: 'Free Brisket Burger', image: BBQ_IMGS.burger1 },
        { id: 'p2', title: 'Loaded Fries', image: BBQ_IMGS.fries },
        { id: 'p3', title: 'Free Drink', image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80" }
    ]
  },
  cateringPackages: [
    {
        id: 'pkg_essential',
        name: 'The Essentials',
        description: 'The "No Fuss" option. Perfect for casual backyard gatherings or office lunches.',
        price: 35, // Per Head
        minPax: 10,
        meatLimit: 2,
        sideLimit: 2,
        image: "https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: 'pkg_pitmaster',
        name: 'The Pitmaster',
        description: 'Our crowd favourite. A balanced spread of our best smoker cuts and sides.',
        price: 48, // Per Head
        minPax: 10,
        meatLimit: 3,
        sideLimit: 3,
        image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: 'pkg_wholehog',
        name: 'The Whole Hog',
        description: 'The ultimate BBQ experience. Full variety of meats, sides, and premium additions.',
        price: 65, // Per Head
        minPax: 10,
        meatLimit: 4,
        sideLimit: 4,
        image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80"
    }
  ],
  emailSettings: {
    enabled: false,
    provider: 'smtp',
    fromEmail: 'noreply@chownow.au',
    fromName: 'Your Business',
    adminEmail: 'admin@chownow.au'
  },
  invoiceSettings: {
    paymentUrl: '',
    paymentLabel: 'Pay Now',
    headerColor: '#d9381e',
    accentColor: '#eab308',
    logoUrl: '',
    footerNote: 'Thank you for your business! If you have questions about this invoice, reply to this email or give us a call.',
    thankYouMessage: 'Here\'s your invoice. Please review the details below and arrange payment at your earliest convenience.',
    bankDetails: '',
    smsTemplate: 'Hi {name}, you have an invoice for ${total} from {business}. Order #{orderNum}.{payLink}\n\nCheers!'
  }
};
