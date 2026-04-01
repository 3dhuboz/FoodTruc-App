
import { MenuItem, CookDay, User, UserRole, SocialPost, AppSettings, CalendarEvent } from './types';

// Use local uploaded logo
export const LOGO_URL = "/logo.png";

export const PLACEHOLDER_IMG = "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80";

// Helper for reliable BBQ images
const BBQ_IMGS = {
  // Burgers
  burger1: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=800&q=80", 
  burger2: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80", 
  
  // Trays & Plates
  brisketPlate: "https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=800&q=80", 
  mixedPlatter: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80", 
  
  // Bulk Meats
  wholeBrisket: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80", 
  pulledPork: "https://images.unsplash.com/photo-1513185158878-8d8c2a2a3da3?auto=format&fit=crop&w=800&q=80", 
  porkBelly: "https://images.unsplash.com/photo-1544427920-c49ccfb85579?auto=format&fit=crop&w=800&q=80", 
  chicken: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80", 
  lamb: "https://images.unsplash.com/photo-1514516345957-556ca7d90a29?auto=format&fit=crop&w=800&q=80", 
  porkRibs: "https://images.unsplash.com/photo-1588347818036-558601350947?auto=format&fit=crop&w=800&q=80", 
  beefRibs: "https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=800&q=80", 
  wings: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=800&q=80", 
  sausage: "https://images.unsplash.com/photo-1565299507177-b0ac66763828?auto=format&fit=crop&w=800&q=80", 

  // Sides
  fries: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80",
  salad: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80",
  slaw: "https://images.unsplash.com/photo-1625938144755-652e08e359b7?auto=format&fit=crop&w=800&q=80",
  potatoSalad: "https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&w=800&q=80",
  corn: "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=800&q=80",
  veg: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80",
  potatoBake: "https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=800&q=80",
  mac: "https://images.unsplash.com/photo-1548369937-47519962c11a?auto=format&fit=crop&w=800&q=80",
  rolls: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
  brioche: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=800&q=80",
  cutlery: "https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?auto=format&fit=crop&w=800&q=80",
  
  // Rubs
  rub: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80",
  sauce: "https://images.unsplash.com/photo-1472476443507-c7a5948772fc?auto=format&fit=crop&w=800&q=80"
};

export const INITIAL_MENU: MenuItem[] = [
  // --- BURGERS ---
  {
    id: 'b1',
    name: 'The OG Brisket Burger',
    description: '150g of 12-hour smoked Black Angus brisket, melted American cheddar, house pickles, white onion & signature BBQ sauce on a toasted brioche bun.',
    price: 18,
    image: BBQ_IMGS.burger1,
    category: 'Burgers',
    available: true,
    availabilityType: 'everyday'
  },
  {
    id: 'b2',
    name: 'Pulled Pork Burger',
    description: 'Succulent 12hr smoked pork shoulder tossed in house rub, topped with crunchy apple slaw & tangy Carolina gold sauce on a soft milk bun.',
    price: 16,
    image: BBQ_IMGS.burger2,
    category: 'Burgers',
    available: true,
    availabilityType: 'everyday'
  },
  
  // --- MEAT PLATES ---
  {
    id: 'm1',
    name: 'Brisket Plate (200g)',
    description: 'Signature 12-hour smoked Black Angus brisket (200g), featuring a perfect smoke ring and bark. Served traditionally with house pickles, white onion, and soft white bread.',
    price: 32,
    image: BBQ_IMGS.brisketPlate,
    category: 'Meats',
    available: true,
    availabilityType: 'everyday'
  },
  
  // --- BULK MEATS (Catering) ---
  {
    id: 'bm1',
    name: 'Whole Smoked Brisket (Per KG)',
    description: 'Minimum 1kg order. Sliced ready to serve. 12hr smoked over Ironbark. The king of meats.',
    price: 85,
    unit: 'kg',
    minQuantity: 1,
    image: BBQ_IMGS.wholeBrisket,
    category: 'Bulk Meats',
    available: true,
    availabilityType: 'everyday'
  },
  {
    id: 'bm2',
    name: 'Pulled Pork (Per KG)',
    description: 'Juicy, tender pork shoulder, smoked for 12 hours and hand-pulled. Includes sauce on the side.',
    price: 65,
    unit: 'kg',
    minQuantity: 1,
    image: BBQ_IMGS.pulledPork,
    category: 'Bulk Meats',
    available: true,
    availabilityType: 'everyday'
  },
  {
    id: 'bm3',
    name: 'Pork Ribs (Full Rack)',
    description: 'St. Louis cut pork ribs, dry rubbed and glazed with our signature BBQ sauce.',
    price: 55,
    unit: 'rack',
    image: BBQ_IMGS.porkRibs,
    category: 'Bulk Meats',
    available: true,
    availabilityType: 'everyday'
  },

  // --- HOT SIDES (Catering) ---
  {
    id: 'hs1',
    name: 'Mac & Cheese Tray',
    description: 'Large catering tray of our famous 3-cheese Mac. Feeds 10-12 people.',
    price: 65,
    image: BBQ_IMGS.mac,
    category: 'Hot Sides',
    available: true,
    availabilityType: 'everyday'
  },
  {
    id: 'hs2',
    name: 'Roasted Corn Cobs',
    description: 'Tray of 12 corn cobs with butter and paprika salt.',
    price: 45,
    image: BBQ_IMGS.corn,
    category: 'Hot Sides',
    available: true,
    availabilityType: 'everyday'
  },

  // --- COLD SIDES ---
  {
    id: 'cs1',
    name: 'Crunchy Slaw Tray',
    description: 'Fresh cabbage and carrot slaw with a tangy dressing. Feeds 15-20.',
    price: 45,
    image: BBQ_IMGS.slaw,
    category: 'Cold Sides',
    available: true,
    availabilityType: 'everyday'
  },
  {
    id: 'cs2',
    name: 'Potato Salad Tray',
    description: 'Creamy southern style potato salad with egg and mustard. Feeds 15-20.',
    price: 55,
    image: BBQ_IMGS.potatoSalad,
    category: 'Cold Sides',
    available: true,
    availabilityType: 'everyday'
  },

  // --- BAKERY & SERVICE ---
  {
    id: 'bak1',
    name: 'Brioche Slider Buns (Dozen)',
    description: 'Pack of 12 soft brioche slider buns. Essential for pulled pork.',
    price: 15,
    category: 'Bakery',
    image: BBQ_IMGS.brioche,
    available: true,
    availabilityType: 'everyday'
  },
  {
    id: 'svc1',
    name: 'Eco Cutlery Pack (Per Person)',
    description: 'Wooden knife, fork, napkin and plate.',
    price: 1.50,
    category: 'Service',
    image: BBQ_IMGS.cutlery,
    available: true,
    availabilityType: 'everyday'
  },

  // --- RUBS & SAUCES (New) ---
  {
    id: 'rs1',
    name: 'Signature Brisket Rub (250g)',
    description: 'Our award-winning salt, pepper, and garlic blend. The secret to our bark. Use generously on beef.',
    price: 18,
    image: BBQ_IMGS.rub,
    category: 'Rubs & Sauces',
    available: true,
    availabilityType: 'everyday'
  },
  {
    id: 'rs2',
    name: 'Sweet Heat Pork Rub (250g)',
    description: 'Paprika based rub with brown sugar and a kick of cayenne. Perfect for ribs and pork shoulder.',
    price: 18,
    image: BBQ_IMGS.rub,
    category: 'Rubs & Sauces',
    available: true,
    availabilityType: 'everyday'
  },
  {
    id: 'rs3',
    name: 'Your Business Sauce (500ml)',
    description: 'Our house-made BBQ sauce. Sweet, tangy, and smoky. Great for glazing or dipping.',
    price: 15,
    image: BBQ_IMGS.sauce,
    category: 'Rubs & Sauces',
    available: true,
    availabilityType: 'everyday'
  },

  // --- SIDES (General Menu) ---
  {
    id: 's1',
    name: 'Loaded Fries',
    description: 'Crispy shoestring fries loaded with 12hr smoked pulled pork, drenched in warm liquid cheese and drizzled with house smoky BBQ sauce.',
    price: 15,
    image: BBQ_IMGS.fries,
    category: 'Sides',
    available: true,
    availabilityType: 'everyday'
  }
];

export const INITIAL_COOK_DAYS: CookDay[] = [
  {
    id: 'cd1',
    date: new Date(Date.now() + 86400000 * 2).toISOString(),
    location: 'Brewery Setup - West End',
    isOpen: true,  }
];

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

export const INITIAL_ADMIN_USER: User = {
  id: 'admin1',
  name: 'assistant Dave',
  email: 'admin@streeteats.com.au',
  role: UserRole.ADMIN,
  isVerified: true,
  stamps: 0,
};

export const INITIAL_DEV_USER: User = {
  id: 'dev1',
  name: 'Developer',
  email: 'dev@streeteats.com.au',
  role: UserRole.DEV,
  isVerified: true,
  stamps: 0,
};

export const INITIAL_POSTS: SocialPost[] = [
  {
    id: 'p1',
    platform: 'Instagram',
    content: 'Sold out of Brisket for today! 🍖🔥 Catch us next week at the Brewery.',
    hashtags: ['#soldout', '#brisket', '#streetmeatz', '#bbq'],
    scheduledFor: new Date().toISOString(),
    status: 'Posted',
    image: BBQ_IMGS.wholeBrisket
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
      assistant: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
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
  businessName: "Street Eats",
  businessAddress: "",
  logoUrl: LOGO_URL,
  adminUsername: "admin",
  adminPassword: "admin123",
  rewards: {
    enabled: true,
    programName: "Street Eats Rewards",
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
        id: 'pkg_assistant',
        name: 'The assistant',
        description: 'Our Crowd Favorite. A balanced spread of our best smokers cuts and sides.',
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
    fromEmail: 'noreply@foodtruckapp.com.au',
    fromName: 'Your Business',
    adminEmail: 'admin@foodtruckapp.com.au'
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
