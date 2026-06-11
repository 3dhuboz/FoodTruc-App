
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  primaryColor: string;
  plan: string;
  status: string;
}

export enum UserRole {
  GUEST = 'GUEST',
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  DEV = 'DEV'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
  phone?: string;
  address?: string;
  dietaryPreferences?: string;
  stamps?: number; 
  hasCateringDiscount?: boolean; // 10% off next order if previous spent > $1k
}

export interface PackGroup {
  name: string; // e.g., "Choose 4 Proteins"
  limit: number; // e.g., 4
  options: string[]; // e.g., ["Brisket", "Pork", "Sausage"]
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  unit?: string; 
  minQuantity?: number; 
  preparationOptions?: string[]; 
  image: string;
  category: 'Burgers' | 'Meats' | 'Sides' | 'Platters' | 'Drinks' | 'Bulk Meats' | 'Catering Packs' | 'Trays' | 'Hot Sides' | 'Cold Sides' | 'Bakery' | 'Service' | 'Family Packs' | 'Rubs & Sauces' | 'Merch' | 'Salads';
  available: boolean;
  availabilityType: 'everyday' | 'specific_date';
  specificDate?: string; 
  specificDates?: string[];
  // Pack Logic
  isPack?: boolean;
  packGroups?: PackGroup[];
  // Catering Logic
  availableForCatering?: boolean;
  cateringCategory?: 'Meat' | 'Side' | 'Extra' | 'Drink' | 'Dessert';
  moq?: number;
}

export interface CateringPackage {
  id: string;
  name: string;
  description: string;
  price: number; // Per Head
  minPax: number;
  meatLimit: number;
  sideLimit: number;
  image: string;
}

export interface CalendarEvent {
  id: string;
  date: string; 
  type: 'ORDER_PICKUP' | 'BLOCKED' | 'PUBLIC_EVENT';
  title: string;
  description?: string; 
  location?: string; 
  time?: string; // Display string e.g. "2pm - 6pm"
  startTime?: string; // "14:00"
  endTime?: string; // "18:00"
  orderId?: string; 
  image?: string; 
  tags?: string[]; 
}

export type OrderPaymentState =
  | 'unpaid'
  | 'cash_paid'
  | 'external_eftpos_paid'
  | 'square_paid_operator_confirmed'
  | 'square_offline_pending'
  | 'processor_confirmed'
  | 'processor_declined_late'
  | 'voided'
  | 'refund_required';

export type OrderPaymentMethod =
  | 'pay_at_window'
  | 'cash'
  | 'external_eftpos'
  | 'square'
  | 'stripe'
  | 'manual';

export type OrderPaymentRiskLevel = 'none' | 'low' | 'medium' | 'high';
export type OrderSource = 'walk_up' | 'qr' | 'foh' | 'service_day' | 'cloud' | 'unknown';

export type ChowBoxOperatingMode = 'walk_up_stall' | 'service_day_hub' | 'cloud_storefront';
export type PaymentCaptureMode =
  | 'square_terminal_operator_confirmed'
  | 'certified_eftpos_operator_confirmed'
  | 'online_checkout'
  | 'cash_only'
  | 'manual';

export interface WalkUpStallSettings {
  enabled: boolean;
  qrOrderingEnabled: boolean;
  fohEnabled: boolean;
  bohEnabled: boolean;
  pickupScreenEnabled: boolean;
  localPrinterEnabled: boolean;
  requireCustomerName: boolean;
  defaultPaymentMethod: OrderPaymentMethod;
  defaultOrderSource: OrderSource;
  statusScreenTitle: string;
  orderCodeMode: 'collection_pin' | 'short_id';
}

export interface Order {
  id: string;
  userId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  items: { 
    item: MenuItem; 
    quantity: number;
    selectedOption?: string; 
    packSelections?: Record<string, string[]>; // e.g. { "Proteins": ["Brisket", "Brisket"] }
  }[];
  total: number;
  depositAmount?: number; // New field for catering deposits
  status: 'Pending' | 'Awaiting Payment' | 'Paid' | 'Confirmed' | 'Cooking' | 'Ready' | 'Shipped' | 'Completed' | 'Cancelled' | 'Rejected';
  cookDay: string; 
  type: 'TAKEAWAY' | 'CATERING'; 
  pickupTime?: string;
  createdAt: string;
  // New Preferences
  temperature: 'HOT' | 'COLD';
  fulfillmentMethod: 'PICKUP' | 'DELIVERY';
  deliveryAddress?: string;
  deliveryFee?: number;
  // Tracking
  trackingNumber?: string;
  courier?: string;
  // Pop-up collection
  collectionPin?: string;
  pickupLocation?: string;
  discountApplied?: boolean; // If the 10% catering discount was used
  paymentIntentId?: string;
  squareCheckoutId?: string; // Square order ID from checkout link, used for webhook payment matching
  source?: OrderSource;
  paymentState?: OrderPaymentState;
  paymentMethod?: OrderPaymentMethod;
  paymentProvider?: 'square' | 'stripe' | 'cash' | 'external' | 'manual';
  providerReference?: string;
  operatorConfirmedBy?: string;
  paymentRiskLevel?: OrderPaymentRiskLevel;
  syncState?: 'local' | 'queued' | 'syncing' | 'synced' | 'conflict';
  // Status timestamps for analytics
  confirmedAt?: string;
  cookingAt?: string;
  readyAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

export interface CookDay {
  id: string;
  date: string;
  location: string;
  isOpen: boolean;
}

export interface SocialPost {
  id: string;
  platform: 'Facebook' | 'Instagram';
  content: string;
  image?: string;
  scheduledFor: string;
  status: 'Draft' | 'Scheduled' | 'Posted';
  hashtags: string[];
}

export interface GalleryPost {
  id: string;
  userId: string;
  userName: string;
  imageUrl: string;
  caption: string;
  createdAt: string;
  approved: boolean; 
  likes: number; // New: Total likes
  likedBy: string[]; // New: IDs of users who liked it
}

export interface CartItem extends MenuItem {
  quantity: number;
  selectedOption?: string;
  packSelections?: Record<string, string[]>;
}

export interface RewardPrize {
  id: string;
  title: string;
  image: string;
}

export interface RewardsConfig {
  enabled: boolean;
  programName: string; 
  staffPin: string; 
  maxStamps: number; 
  rewardTitle: string; // Deprecated but kept for fallback
  rewardImage: string; // Deprecated but kept for fallback
  possiblePrizes: RewardPrize[]; // New Prize Pool
}

export interface AppSettings {
  maintenanceMode: boolean;
  qrOrdersPaused?: boolean;
  chowboxMode?: ChowBoxOperatingMode;
  paymentCaptureMode?: PaymentCaptureMode;
  walkUpStall?: WalkUpStallSettings;

  // -- Images --
  // Home
  heroCateringImage?: string;
  heroCookImage?: string;
  homePromoterImage?: string;
  homeScheduleCardImage?: string;
  homeMenuCardImage?: string;
  // Menu
  menuHeroImage?: string;
  // DIY Catering
  diyHeroImage?: string;
  diyCardPackageImage?: string;
  diyCardCuratedImage?: string;
  diyCardCustomImage?: string;
  cateringPackageImages: {
      essential: string;
      pitmaster: string;
      wholehog: string;
  };
  // Events
  eventsHeroImage?: string;
  // Promoters
  promotersHeroImage?: string;
  promotersSocialImage?: string;
  // Gallery
  galleryHeroImage?: string;
  // System
  maintenanceImage?: string;
  
  stripeConnected: boolean;
  stripePublicKey?: string;
  squareConnected: boolean;
  // Square Specifics
  squareApplicationId?: string;
  squareLocationId?: string;
  squareAccessToken?: string;
  squareEnvironment?: 'sandbox' | 'production';

  smartPayConnected: boolean; 
  smartPayPublicKey?: string; 
  smartPaySecretKey?: string; 
  smsConnected: boolean;
  socialAiStudioUrl?: string;
  facebookConnected: boolean; 
  facebookAppId?: string; 
  facebookPageId?: string; 
  facebookPageAccessToken?: string; 
  instagramBusinessAccountId?: string;
  manualTickerImages: string[]; 
  businessName: string;
  businessAddress: string; 
  logoUrl: string;
  adminUsername?: string;
  adminPassword?: string;
  /** Set on tenant provisioning; cleared after the first credential rotation. */
  mustChangeCredentials?: boolean;
  /** Platform-managed AI key. Stripped from non-admin GETs. */
  geminiApiKey?: string;
  rewards: RewardsConfig;
  cateringPackages?: CateringPackage[];
  // Email Settings
  emailSettings?: {
    enabled: boolean;
    provider: 'smtp' | 'sendgrid' | 'mailgun';
    apiKey?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    fromEmail: string;
    fromName: string;
    adminEmail: string;
  };
  smsSettings?: {
    enabled: boolean;
    username: string;
    apiKey: string;
    fromNumber: string;
    adminPhone: string;
  };
  landingPricing?: {
    setupFee: number;
    monthlyFee: number;
    brandName: string;
    contactEmail: string;
    contactPhone: string;
  };
  invoiceSettings?: {
    paymentUrl: string;
    paymentLabel: string;
    headerColor: string;
    accentColor: string;
    logoUrl: string;
    footerNote: string;
    thankYouMessage: string;
    bankDetails: string;
    smsTemplate: string;
  };
  labelSettings?: {
    thankYou: string;
    tagline: string;
    socialUrl: string;
    logoUrl: string;
  };
}
