
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/Toast';
import { useNavigate } from 'react-router-dom';
import { ChefHat, Users, Clock, ArrowRight, Calendar, CheckCircle, AlertCircle, ShoppingCart, Truck, MapPin, Flame, Snowflake, CreditCard, Lock, Package, Info, Plus, Minus, ArrowLeft, Edit3, ShieldCheck, DollarSign, Check, ChevronUp, ChevronDown, X, Utensils, Ticket, Trash2, Coffee, Cake } from 'lucide-react';
import { MenuItem } from '../types';
import SquarePaymentForm from '../components/SquarePaymentForm';

const DIY: React.FC = () => {
  const { menu, checkAvailability, createOrder, user, settings, isDatePastCutoff } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Dynamic Catering Packages based on Settings
  const CATERING_PACKAGES = (settings.cateringPackages && settings.cateringPackages.length > 0) 
    ? settings.cateringPackages 
    : [
    {
        id: 'pkg_essential',
        name: 'The Essentials',
        description: 'The "No Fuss" option. Perfect for casual backyard gatherings or office lunches.',
        price: 35, // Per Head
        minPax: 10,
        meatLimit: 2,
        sideLimit: 2,
        image: settings.cateringPackageImages?.essential || "https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: 'pkg_pitmaster',
        name: 'The Pitmaster',
        description: 'Our Crowd Favorite. A balanced spread of our best smokers cuts and sides.',
        price: 48, // Per Head
        minPax: 10,
        meatLimit: 3,
        sideLimit: 3,
        image: settings.cateringPackageImages?.pitmaster || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: 'pkg_wholehog',
        name: 'The Whole Hog',
        description: 'The ultimate BBQ experience. Full variety of meats, sides, and premium additions.',
        price: 65, // Per Head
        minPax: 10,
        meatLimit: 4,
        sideLimit: 4,
        image: settings.cateringPackageImages?.wholehog || "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80"
    }
  ];

  // Workflow State
  const [step, setStep] = useState<1 | 2 | 3>(1); 
  
  // Step 1: Details
  const [selectedDate, setSelectedDate] = useState('');
  const [pickupTime, setPickupTime] = useState('12:00');
  const [guestCount, setGuestCount] = useState(10);
  const [fulfillment, setFulfillment] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [temperature, setTemperature] = useState<'HOT' | 'COLD'>('HOT');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  // Step 2: Selection Data
  // -- Package Mode Data --
  const [selectionMode, setSelectionMode] = useState<'CHOICE' | 'PACKAGES' | 'CUSTOM'>('CHOICE');
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [pkgSelections, setPkgSelections] = useState<{meats: string[], sides: string[]}>({ meats: [], sides: [] });
  const [isPackageConfigOpen, setIsPackageConfigOpen] = useState(false);
  const [customCart, setCustomCart] = useState<Record<string, number>>({});

  // Step 3: Payment
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const DELIVERY_FEE = 25.00;

  // Helpers
  const activePackage = CATERING_PACKAGES.find(p => p.id === selectedPackageId);
  
  // Filter for Package Modal Selection
  const explicitMeats = menu.filter(m => m.availableForCatering && m.cateringCategory === 'Meat');
  const explicitSides = menu.filter(m => m.availableForCatering && m.cateringCategory === 'Side');

  const meatsMenu = explicitMeats.length > 0 ? explicitMeats : menu.filter(m => 
      ['Bulk Meats', 'Meats', 'Trays', 'Burgers', 'Family Packs', 'Platters'].includes(m.category)
  );
  const sidesMenu = explicitSides.length > 0 ? explicitSides : menu.filter(m => 
      ['Hot Sides', 'Cold Sides', 'Sides', 'Bakery', 'Salads'].includes(m.category)
  );

  // A La Carte Items
  const aLaCarteItems = menu.filter(m => m.availableForCatering);
  const aLaCarteCategories = Array.from(new Set(aLaCarteItems.map(m => m.category)));

  const checkDate = () => {
    if (!selectedDate || !pickupTime) return;
    const available = checkAvailability(selectedDate);
    setIsAvailable(available);
    if (available) {
        setTimeout(() => setStep(2), 300); 
    }
  };

  const addPackageItem = (id: string, type: 'meats' | 'sides', limit: number) => {
      const list = pkgSelections[type];
      if (list.length < limit) {
          setPkgSelections({ ...pkgSelections, [type]: [...list, id] });
      }
  };

  const removePackageItem = (id: string, type: 'meats' | 'sides') => {
      const list = pkgSelections[type];
      const index = list.indexOf(id);
      if (index > -1) {
          const newList = [...list];
          newList.splice(index, 1);
          setPkgSelections({ ...pkgSelections, [type]: newList });
      }
  };

  const selectPackage = (pkgId: string) => {
      if (pkgId === 'pkg_custom') {
          setSelectedPackageId(pkgId);
          setPkgSelections({ meats: [], sides: [] });
          setIsPackageConfigOpen(true);
      } else {
          setSelectedPackageId(pkgId);
          setStep(3);
      }
  };

  const updateCustomCart = (id: string, delta: number, moq: number = 1) => {
      setCustomCart(prev => {
          const current = prev[id] || 0;
          let next = current + delta;
          
          if (delta > 0 && current === 0) {
              next = Math.max(moq, 1); 
          } else if (delta < 0 && next < moq) {
              next = 0; 
          }
          
          const updated = { ...prev };
          if (next <= 0) {
              delete updated[id];
          } else {
              updated[id] = next;
          }
          return updated;
      });
  };

  const calculateCustomTotal = () => {
      let total = 0;
      Object.entries(customCart).forEach(([id, qty]) => {
          const item = menu.find(m => m.id === id);
          if (item) {
              total += item.price * qty;
          }
      });
      return total;
  };

  const calculateTotal = () => {
      let subtotal = 0;
      if (selectedPackageId === 'pkg_custom') {
          subtotal = calculateCustomTotal();
      } else if (activePackage) {
          subtotal = activePackage.price * guestCount;
      }
      if (fulfillment === 'DELIVERY') subtotal += DELIVERY_FEE;
      return subtotal;
  };

  const createRequest = async () => {
    if (!user) return;
    const total = calculateTotal();
    const depositAmount = total * 0.5;

    const orderItems = [];
    
    if (selectedPackageId === 'pkg_custom') {
        Object.entries(customCart).forEach(([id, qty]) => {
            const item = menu.find(m => m.id === id);
            if (item) {
                orderItems.push({
                    item,
                    quantity: qty
                });
            }
        });
    } else if (activePackage) {
        orderItems.push({
            item: {
                id: activePackage.id,
                name: `${activePackage.name} Package (${guestCount}pax)`,
                price: activePackage.price,
                description: activePackage.description,
                image: activePackage.image,
                category: 'Catering Packs' as any,
                available: true,
                availabilityType: 'everyday' as any
            },
            quantity: guestCount,
            packSelections: activePackage.id === 'pkg_custom' ? {
                "Meats": pkgSelections.meats.map(id => meatsMenu.find(m => m.id === id)?.name || id),
                "Sides": pkgSelections.sides.map(id => sidesMenu.find(m => m.id === id)?.name || id)
            } : {
                "Meats": [],
                "Sides": []
            }
        });
    }

    const newOrder = {
        id: `ord_cat_${Date.now()}`,
        userId: user.id,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone,
        items: orderItems,
        total: total,
        depositAmount: depositAmount,
        status: 'Pending' as any, 
        cookDay: selectedDate, 
        type: 'CATERING' as any,
        pickupTime: pickupTime,
        createdAt: new Date().toISOString(),
        temperature,
        fulfillmentMethod: fulfillment,
        deliveryAddress: fulfillment === 'DELIVERY' ? deliveryAddress : undefined,
        deliveryFee: fulfillment === 'DELIVERY' ? DELIVERY_FEE : 0
    };

    createOrder(newOrder);

    // Send Email + SMS Notification to Admin
    try {
        await Promise.allSettled([
            fetch('/api/v1/email/order-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: settings.emailSettings, order: newOrder })
            }),
            fetch('/api/v1/sms/order-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: settings.smsSettings, order: newOrder })
            })
        ]);
    } catch (e) {
        console.error("Failed to send order notification", e);
    }

    toast(`Request sent! 50% deposit ($${depositAmount.toFixed(2)}) authorized. Admin notified — check your email for confirmation.`);
    navigate('/profile');
  };

  const handleSquareToken = async (token: string) => {
      console.log("Deposit Tokenized:", token);
      try {
          const res = await fetch('/api/v1/payment/square-pay', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  sourceId: token,
                  amount: total * 0.5,
                  currency: 'AUD',
                  locationId: settings.squareLocationId,
                  accessToken: settings.squareAccessToken,
                  environment: settings.squareEnvironment || 'sandbox',
                  customerEmail: user?.email,
              }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Payment failed');
          createRequest();
      } catch (error: any) {
          console.error("Square Payment Error:", error);
          toast(`Payment failed: ${error.message}`, 'error');
      }
  };

  const total = calculateTotal();
  const deposit = total * 0.5;

  return (
    <div className="animate-in fade-in duration-700 pb-20">
       {/* Hero Section */}
       <div className="relative h-[40vh] min-h-[300px] rounded-2xl overflow-hidden shadow-2xl mb-8">
          <div className="absolute inset-0 bg-black/60 z-10" />
          <img
            src={settings.diyHeroImage || "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1950&q=80"}
            className="absolute inset-0 w-full h-full object-cover"
            alt="DIY BBQ Catering Spread"
          />
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-6">
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-2 tracking-tight uppercase">
              Catering <span className="text-bbq-red">Request</span>
            </h1>
            <p className="text-gray-200 max-w-xl font-light text-lg">
              Select a curated package and customize your meats and sides.
            </p>
          </div>
       </div>

       {/* PROMOTER BANNER */}
       <div className="max-w-6xl mx-auto px-6 mb-8">
           <div className="bg-gradient-to-r from-yellow-900/40 via-bbq-charcoal to-yellow-900/40 border border-bbq-gold/30 p-4 rounded-xl flex items-center justify-center gap-4 text-center shadow-[0_0_20px_rgba(234,179,8,0.1)]">
               <Ticket className="text-bbq-gold shrink-0" size={24}/>
               <div>
                   <h4 className="text-white font-bold uppercase tracking-wider text-sm md:text-base">Host Rewards Program</h4>
                   <p className="text-gray-400 text-xs">Spend over <strong>$1,000</strong> on catering and receive a <strong>10% Discount</strong> on your next order!</p>
               </div>
               <Ticket className="text-bbq-gold shrink-0" size={24}/>
           </div>
       </div>

       {/* --- WIZARD STEPS --- */}
       <div className="max-w-6xl mx-auto px-4">
         
         {/* Progress Bar */}
         <div className="flex justify-between items-center mb-8 relative max-w-2xl mx-auto">
            <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-800 -z-10"></div>
            {[1, 2, 3, 4].map(num => (
                <div key={num} className={`flex flex-col items-center gap-2 ${step >= num ? 'text-bbq-red' : 'text-gray-600'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all ${step >= num ? 'bg-bbq-red text-white' : 'bg-gray-800'}`}>
                        {num}
                    </div>
                </div>
            ))}
         </div>

         {/* STEP 1: LOGISTICS */}
         {step === 1 && (
            <div className="max-w-3xl mx-auto bg-bbq-charcoal p-8 rounded-xl border border-gray-800 text-left animate-in slide-in-from-right-8 shadow-xl">
                <h2 className="text-2xl font-bold mb-6 text-white text-center">Event Logistics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-gray-400 mb-2 text-sm font-bold">Event Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3.5 text-bbq-red" size={20} />
                                <input 
                                    type="date" 
                                    min={new Date().toISOString().split('T')[0]}
                                    value={selectedDate}
                                    onChange={(e) => { setSelectedDate(e.target.value); setIsAvailable(null); }}
                                    className="w-full bg-gray-900 border border-gray-700 rounded p-3 pl-10 text-white text-lg focus:border-bbq-red outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-400 mb-2 text-sm font-bold">Eat Time</label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-3.5 text-bbq-red" size={20} />
                                <select 
                                    value={pickupTime}
                                    onChange={(e) => setPickupTime(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded p-3 pl-10 text-white text-lg focus:border-bbq-red outline-none appearance-none"
                                >
                                    <option>11:00 AM</option>
                                    <option>12:00 PM</option>
                                    <option>01:00 PM</option>
                                    <option>02:00 PM</option>
                                    <option>03:00 PM</option>
                                    <option>04:00 PM</option>
                                    <option>05:00 PM</option>
                                    <option>06:00 PM</option>
                                    <option>07:00 PM</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-400 mb-2 text-sm font-bold">Number of Guests</label>
                            <div className="relative">
                                <Users className="absolute left-3 top-3.5 text-bbq-red" size={20} />
                                <input 
                                    type="number"
                                    min="10"
                                    value={guestCount}
                                    onChange={(e) => setGuestCount(parseInt(e.target.value))}
                                    className="w-full bg-gray-900 border border-gray-700 rounded p-3 pl-10 text-white text-lg focus:border-bbq-red outline-none"
                                />
                                <span className="absolute right-4 top-4 text-xs text-gray-500">Min 10 pax</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-gray-400 mb-2 text-sm font-bold">Service Type</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => setFulfillment('PICKUP')}
                                    className={`p-3 rounded border text-sm font-bold flex flex-col items-center gap-1 ${fulfillment === 'PICKUP' ? 'bg-bbq-red text-white border-red-500' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                                >
                                    <ChefHat size={20}/> Pickup (Free)
                                </button>
                                <button 
                                    onClick={() => setFulfillment('DELIVERY')}
                                    className={`p-3 rounded border text-sm font-bold flex flex-col items-center gap-1 ${fulfillment === 'DELIVERY' ? 'bg-bbq-red text-white border-red-500' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                                >
                                    <Truck size={20}/> Delivery (+$25)
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-400 mb-2 text-sm font-bold">Temperature</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => setTemperature('HOT')}
                                    className={`p-3 rounded border text-sm font-bold flex flex-col items-center gap-1 ${temperature === 'HOT' ? 'bg-orange-900/50 text-orange-200 border-orange-500' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                                >
                                    <Flame size={20}/> Ready to Eat
                                </button>
                                <button 
                                    onClick={() => setTemperature('COLD')}
                                    className={`p-3 rounded border text-sm font-bold flex flex-col items-center gap-1 ${temperature === 'COLD' ? 'bg-blue-900/50 text-blue-200 border-blue-500' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                                >
                                    <Snowflake size={20}/> Cold (Reheat)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                {fulfillment === 'DELIVERY' && (
                    <div className="mt-6">
                        <label className="block text-gray-400 mb-2 text-sm font-bold">Delivery Address</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3.5 text-bbq-red" size={20} />
                            <input 
                                value={deliveryAddress}
                                onChange={e => setDeliveryAddress(e.target.value)}
                                placeholder="123 Example St, Suburb..."
                                className="w-full bg-gray-900 border border-gray-700 rounded p-3 pl-10 text-white focus:border-bbq-red outline-none"
                            />
                        </div>
                    </div>
                )}

                <button 
                    onClick={checkDate}
                    disabled={!selectedDate || !pickupTime || guestCount < 10 || (fulfillment === 'DELIVERY' && !deliveryAddress)}
                    className="w-full bg-white text-black font-bold py-4 rounded hover:bg-gray-200 disabled:opacity-50 transition shadow-lg mt-8 text-lg"
                >
                    Next: Choose Menu <ArrowRight className="inline ml-2" size={20}/>
                </button>

                {isAvailable === false && (
                    <div className="mt-4 p-4 bg-red-900/30 border border-red-600 text-red-200 rounded flex items-center justify-center gap-2">
                        <AlertCircle /> Sorry, we are fully booked on this date.
                    </div>
                )}
            </div>
         )}

         {/* STEP 2: SELECTION */}
         {step === 2 && (
             <div className="animate-in slide-in-from-right-8">
                 
                 {/* CHOICE MODE: Curated vs Custom */}
                 {selectionMode === 'CHOICE' && (
                     <div className="max-w-5xl mx-auto">
                         <div className="text-center mb-10">
                            <h2 className="text-3xl font-display font-bold text-white uppercase tracking-wider">How Do You Want To Order?</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                            {/* Option 1: Curated Packages */}
                            <div 
                                onClick={() => setSelectionMode('PACKAGES')}
                                className="bg-bbq-charcoal rounded-2xl border border-gray-800 overflow-hidden flex flex-col group hover:border-bbq-gold transition shadow-xl relative h-[400px] cursor-pointer"
                            >
                                <img 
                                    src={settings.diyCardCuratedImage || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80"} 
                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                                    alt="Curated Packages" 
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                                
                                <div className="relative z-10 flex-1 p-8 flex flex-col justify-end h-full">
                                    <div className="w-12 h-12 bg-bbq-gold rounded-full flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                                        <Package size={24} className="text-black" />
                                    </div>
                                    <h3 className="text-3xl font-display font-bold text-white mb-3 uppercase tracking-wide group-hover:text-bbq-gold transition-colors">Curated Packages</h3>
                                    <p className="text-gray-300 text-sm mb-6 max-w-md">Per-head pricing with optimal meat & side combinations. Easiest for groups.</p>
                                    
                                    <button 
                                        className="text-bbq-gold font-bold flex items-center gap-2 uppercase tracking-wide text-sm hover:text-yellow-400 transition w-fit group-hover:translate-x-2 duration-300"
                                    >
                                        View Packages <ArrowRight size={16}/>
                                    </button>
                                </div>
                            </div>

                            {/* Option 2: Build Your Own */}
                            <div 
                                onClick={() => selectPackage('pkg_custom')}
                                className="bg-bbq-charcoal rounded-2xl border border-gray-800 overflow-hidden flex flex-col group hover:border-bbq-red transition shadow-xl relative h-[400px] cursor-pointer"
                            >
                                <img 
                                    src={settings.diyCardCustomImage || "https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=800&q=80"} 
                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                                    alt="Build Your Own" 
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                                
                                <div className="relative z-10 flex-1 p-8 flex flex-col justify-end h-full">
                                    <div className="w-12 h-12 bg-bbq-red rounded-full flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
                                        <ChefHat size={24} className="text-white" />
                                    </div>
                                    <h3 className="text-3xl font-display font-bold text-white mb-3 uppercase tracking-wide group-hover:text-bbq-red transition-colors">Build Your Own</h3>
                                    <p className="text-gray-300 text-sm mb-6 max-w-md">Total control. Order bulk meats by KG and sides by the tray.</p>
                                    
                                    <button 
                                        className="text-bbq-red font-bold flex items-center gap-2 uppercase tracking-wide text-sm hover:text-red-400 transition w-fit group-hover:translate-x-2 duration-300"
                                    >
                                        Start Building <ArrowRight size={16}/>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="text-center mt-8">
                            <button onClick={() => setStep(1)} className="text-gray-500 hover:text-white underline text-sm transition">Back to Logistics</button>
                        </div>
                     </div>
                 )}

                 {/* PACKAGE LIST MODE */}
                 {selectionMode === 'PACKAGES' && (
                    <>
                    <div className="flex items-center justify-between mb-8">
                        <button onClick={() => setSelectionMode('CHOICE')} className="text-gray-400 hover:text-white flex items-center gap-2 font-bold text-sm"><ArrowLeft size={16}/> Back</button>
                        <h2 className="text-2xl font-bold text-white">Select a Package</h2>
                        <div className="w-16"></div>
                    </div>

                        <div className="space-y-6 max-w-4xl mx-auto">
                            {(settings.cateringPackages || CATERING_PACKAGES).map(pkg => (
                                <div key={pkg.id} className="bg-bbq-charcoal rounded-2xl border border-gray-800 overflow-hidden flex flex-col md:flex-row group hover:border-gray-600 transition shadow-xl relative">
                                    <div className="absolute top-4 left-4 bg-bbq-gold text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider z-10 shadow-lg">
                                        Best Value
                                    </div>
                                    <div className="w-full md:w-1/3 h-48 md:h-auto relative">
                                        <img src={pkg.image} className="w-full h-full object-cover" alt={pkg.name} />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:bg-gradient-to-r"></div>
                                    </div>
                                    
                                    <div className="flex-1 p-6 flex flex-col justify-center">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-2xl font-display font-bold text-white">{pkg.name}</h3>
                                            <div className="text-right">
                                                <div className="text-2xl font-bold text-bbq-gold">${pkg.price}</div>
                                                <div className="text-xs text-gray-500 uppercase font-bold">Per Head</div>
                                            </div>
                                        </div>
                                        <p className="text-gray-400 text-sm mb-6">{pkg.description}</p>
                                        
                                        <div className="flex flex-wrap gap-4 mb-6">
                                            <div className="bg-black/30 px-3 py-2 rounded text-xs font-bold text-gray-300 flex items-center gap-2">
                                                <CheckCircle size={14} className="text-green-500"/> Minimum {pkg.minPax} Pax
                                            </div>
                                        </div>

                                        <button 
                                            onClick={() => selectPackage(pkg.id)}
                                            className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-bbq-gold hover:text-black transition flex justify-center items-center gap-2 uppercase tracking-wide text-sm"
                                        >
                                            Select Package <ArrowRight size={16}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                 )}

                 {/* PACKAGE CUSTOMIZATION OVERLAY (For Curated Packages) */}
                 {isPackageConfigOpen && activePackage && (
                            <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4">
                                <div className="w-full max-w-5xl h-[90vh] bg-bbq-charcoal rounded-2xl overflow-hidden flex flex-col md:flex-row border border-gray-700 shadow-2xl animate-in zoom-in-95">
                                    
                                    <div className="hidden md:flex flex-col w-1/3 bg-gray-900 border-r border-gray-800 p-8">
                                        <h3 className="font-display font-bold text-3xl text-white mb-2 uppercase">{activePackage.name}</h3>
                                        <p className="text-gray-400 text-sm mb-6">{activePackage.description}</p>
                                        
                                        <div className="space-y-4 mb-8">
                                            <div className="flex justify-between items-center text-sm border-b border-gray-800 pb-2">
                                                <span className="text-gray-500">Guests</span>
                                                <div className="flex items-center gap-2 bg-black/40 rounded p-1">
                                                    <button 
                                                        onClick={() => setGuestCount(Math.max(activePackage.minPax, guestCount - 1))}
                                                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white bg-gray-800 rounded hover:bg-gray-700 transition"
                                                    >
                                                        <Minus size={14}/>
                                                    </button>
                                                    <span className="font-bold text-white w-6 text-center">{guestCount}</span>
                                                    <button 
                                                        onClick={() => setGuestCount(guestCount + 1)}
                                                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white bg-gray-800 rounded hover:bg-gray-700 transition"
                                                    >
                                                        <Plus size={14}/>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center text-sm border-b border-gray-800 pb-2">
                                                <span className="text-gray-500">Price per head</span>
                                                <span className="font-bold text-white">${activePackage.price}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xl font-bold pt-2">
                                                <span className="text-white">Total</span>
                                                <span className="text-bbq-gold">${(activePackage.price * guestCount).toFixed(2)}</span>
                                            </div>
                                        </div>

                                        <div className="mt-auto">
                                            <img src={activePackage.image} className="w-full h-48 object-cover rounded-lg opacity-50 grayscale" alt="Visual"/>
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col h-full bg-bbq-charcoal relative">
                                        
                                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900 md:bg-transparent">
                                            <div>
                                                <h3 className="font-bold text-white md:hidden">{activePackage.name}</h3>
                                                <p className="text-xs text-gray-400 md:hidden">Customize your menu</p>
                                                <h3 className="font-bold text-white hidden md:block text-lg">Customize Menu</h3>
                                            </div>
                                            <button onClick={() => {
                                                setIsPackageConfigOpen(false);
                                                setSelectionMode('CHOICE');
                                            }} className="bg-gray-800 p-2 rounded-full hover:bg-white hover:text-black transition">
                                                <X size={20}/>
                                            </button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                                            
                                            <div>
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2">
                                                        <Flame className="text-bbq-red" size={18}/> Select Meats
                                                    </h4>
                                                    <span className={`text-xs font-bold px-2 py-1 rounded ${pkgSelections.meats.length === activePackage.meatLimit ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                                                        {pkgSelections.meats.length} / {activePackage.meatLimit} Selected
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {meatsMenu.map(m => {
                                                        const count = pkgSelections.meats.filter(id => id === m.id).length;
                                                        const isLimitReached = pkgSelections.meats.length >= activePackage.meatLimit;
                                                        
                                                        return (
                                                            <div 
                                                                key={m.id}
                                                                className={`p-3 rounded-lg border flex items-center justify-between transition ${count > 0 ? 'bg-gray-800 border-red-500 shadow-md' : 'bg-gray-800 border-gray-700 opacity-90'}`}
                                                            >
                                                                <span className={`font-bold text-sm ${count > 0 ? 'text-white' : 'text-gray-400'}`}>{m.name}</span>
                                                                
                                                                <div className="flex items-center gap-2 bg-black/40 rounded p-1">
                                                                    <button 
                                                                        onClick={() => removePackageItem(m.id, 'meats')}
                                                                        disabled={count === 0}
                                                                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 rounded hover:bg-white/10"
                                                                    ><Minus size={14}/></button>
                                                                    <span className={`text-sm font-bold w-6 text-center ${count > 0 ? 'text-white' : 'text-gray-500'}`}>{count}</span>
                                                                    <button 
                                                                        onClick={() => addPackageItem(m.id, 'meats', activePackage.meatLimit)}
                                                                        disabled={isLimitReached}
                                                                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 rounded hover:bg-white/10"
                                                                    ><Plus size={14}/></button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2">
                                                        <Utensils size={18} className="text-bbq-gold"/> Select Sides
                                                    </h4>
                                                    <span className={`text-xs font-bold px-2 py-1 rounded ${pkgSelections.sides.length === activePackage.sideLimit ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                                                        {pkgSelections.sides.length} / {activePackage.sideLimit} Selected
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {sidesMenu.map(m => {
                                                        const count = pkgSelections.sides.filter(id => id === m.id).length;
                                                        const isLimitReached = pkgSelections.sides.length >= activePackage.sideLimit;
                                                        return (
                                                            <div 
                                                                key={m.id}
                                                                className={`p-3 rounded-lg border flex items-center justify-between transition ${count > 0 ? 'bg-gray-800 border-yellow-500 shadow-md' : 'bg-gray-800 border-gray-700 opacity-90'}`}
                                                            >
                                                                <span className={`font-bold text-sm ${count > 0 ? 'text-white' : 'text-gray-400'}`}>{m.name}</span>
                                                                
                                                                <div className="flex items-center gap-2 bg-black/40 rounded p-1">
                                                                    <button 
                                                                        onClick={() => removePackageItem(m.id, 'sides')}
                                                                        disabled={count === 0}
                                                                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 rounded hover:bg-white/10"
                                                                    ><Minus size={14}/></button>
                                                                    <span className={`text-sm font-bold w-6 text-center ${count > 0 ? 'text-white' : 'text-gray-500'}`}>{count}</span>
                                                                    <button 
                                                                        onClick={() => addPackageItem(m.id, 'sides', activePackage.sideLimit)}
                                                                        disabled={isLimitReached}
                                                                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 rounded hover:bg-white/10"
                                                                    ><Plus size={14}/></button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 border-t border-gray-700 bg-gray-900">
                                            <button 
                                                onClick={() => {
                                                    setIsPackageConfigOpen(false);
                                                    setStep(3);
                                                }}
                                                disabled={pkgSelections.meats.length !== activePackage.meatLimit || pkgSelections.sides.length !== activePackage.sideLimit}
                                                className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 disabled:opacity-50 text-lg shadow-xl transition flex justify-center items-center gap-2"
                                            >
                                                {pkgSelections.meats.length !== activePackage.meatLimit || pkgSelections.sides.length !== activePackage.sideLimit 
                                                    ? 'Incomplete Selection' 
                                                    : 'Confirm & Authorize'
                                                }
                                                {(pkgSelections.meats.length === activePackage.meatLimit && pkgSelections.sides.length === activePackage.sideLimit) && <ArrowRight size={20}/>}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                         )}

                 {/* PACKAGE CUSTOMIZATION OVERLAY (For Custom Package) */}
                 {isPackageConfigOpen && selectedPackageId === 'pkg_custom' && (
                    <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4">
                        <div className="w-full max-w-5xl h-[90vh] bg-bbq-charcoal rounded-2xl overflow-hidden flex flex-col md:flex-row border border-gray-700 shadow-2xl animate-in zoom-in-95">
                            
                            <div className="hidden md:flex flex-col w-1/3 bg-gray-900 border-r border-gray-800 p-8">
                                <h3 className="font-display font-bold text-3xl text-white mb-2 uppercase">Build Your Own</h3>
                                <p className="text-gray-400 text-sm mb-6">Create a menu perfectly tailored to your event. Select individual meats and sides.</p>
                                
                                <div className="space-y-4 mb-8 flex-1 overflow-y-auto custom-scrollbar">
                                    {Object.entries(customCart).length === 0 ? (
                                        <p className="text-gray-500 text-sm italic">Your cart is empty.</p>
                                    ) : (
                                        Object.entries(customCart).map(([id, qty]) => {
                                            const item = menu.find(m => m.id === id);
                                            if (!item) return null;
                                            return (
                                                <div key={id} className="flex justify-between items-start text-sm border-b border-gray-800 pb-2">
                                                    <div>
                                                        <div className="text-white font-bold">{item.name}</div>
                                                        <div className="text-gray-500">{qty} x ${item.price}</div>
                                                    </div>
                                                    <span className="font-bold text-bbq-gold">${(item.price * qty).toFixed(2)}</span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="mt-auto pt-4 border-t border-gray-800">
                                    <div className="flex justify-between items-center text-xl font-bold pt-2">
                                        <span className="text-white">Total</span>
                                        <span className="text-bbq-gold">${calculateCustomTotal().toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col h-full bg-bbq-charcoal relative">
                                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900 md:bg-transparent">
                                    <div>
                                        <h3 className="font-bold text-white md:hidden">Build Your Own</h3>
                                        <p className="text-xs text-gray-400 md:hidden">Customize your menu</p>
                                        <h3 className="font-bold text-white hidden md:block text-lg">Select Items</h3>
                                    </div>
                                    <button onClick={() => {
                                        setIsPackageConfigOpen(false);
                                        setSelectionMode('CHOICE');
                                    }} className="bg-gray-800 p-2 rounded-full hover:bg-white hover:text-black transition">
                                        <X size={20}/>
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-12 custom-scrollbar">
                                    
                                    {['Meat', 'Burgers', 'Side', 'Dessert', 'Drink'].map(catType => {
                                        const items = aLaCarteItems.filter(m => {
                                            if (catType === 'Meat') {
                                                if (m.cateringCategory === 'Meat' && m.category !== 'Burgers') return true;
                                                if (!m.cateringCategory && ['Meats', 'Bulk Meats', 'Platters', 'Family Packs'].includes(m.category)) return true;
                                            }
                                            if (catType === 'Burgers') {
                                                if (m.category === 'Burgers') return true;
                                            }
                                            if (catType === 'Side') {
                                                if (m.cateringCategory === 'Side') return true;
                                                if (!m.cateringCategory && ['Sides', 'Hot Sides', 'Cold Sides', 'Salads', 'Bakery'].includes(m.category)) return true;
                                            }
                                            if (catType === 'Dessert') {
                                                if (m.cateringCategory === 'Dessert') return true;
                                                if (!m.cateringCategory && (m.category as any) === 'Desserts') return true;
                                            }
                                            if (catType === 'Drink') {
                                                if (m.cateringCategory === 'Drink') return true;
                                                if (!m.cateringCategory && m.category === 'Drinks') return true;
                                            }
                                            return false;
                                        });

                                        if (items.length === 0) return null;

                                        let title = 'Extras & Service';
                                        let Icon = Plus;
                                        if (catType === 'Meat') { title = 'Meats'; Icon = Flame; }
                                        if (catType === 'Burgers') { title = 'Burgers'; Icon = Flame; }
                                        if (catType === 'Side') { title = 'Sides'; Icon = Utensils; }
                                        if (catType === 'Drink') { title = 'Drinks'; Icon = Coffee; }
                                        if (catType === 'Dessert') { title = 'Desserts'; Icon = Cake; }

                                        return (
                                            <div key={catType} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                                <div className="flex items-center gap-4 mb-6 border-b border-gray-800 pb-4">
                                                    <div className="bg-bbq-gold text-black p-3 rounded-xl shadow-lg shadow-bbq-gold/20">
                                                        <Icon size={24} strokeWidth={2.5} />
                                                    </div>
                                                    <h4 className="font-display font-bold text-2xl text-white uppercase tracking-wider">
                                                        {title}
                                                    </h4>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {items.map(m => {
                                                        const qty = customCart[m.id] || 0;
                                                        const moq = m.moq || 1;
                                                        
                                                        return (
                                                            <div 
                                                                key={m.id}
                                                                className={`rounded-xl border overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:border-gray-600 group ${qty > 0 ? 'bg-gray-800 border-bbq-red shadow-lg ring-1 ring-bbq-red/50' : 'bg-gray-800/60 border-gray-800'}`}
                                                            >
                                                                <div className="h-48 w-full relative overflow-hidden">
                                                                    <img 
                                                                        src={m.image} 
                                                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                                                        alt={m.name} 
                                                                    />
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90"></div>
                                                                    
                                                                    <div className="absolute bottom-0 left-0 right-0 p-4">
                                                                        <div className="flex justify-between items-end mb-1">
                                                                            <span className={`font-display font-bold text-lg leading-tight ${qty > 0 ? 'text-white' : 'text-gray-100'}`}>{m.name}</span>
                                                                            <div className="text-right shrink-0 ml-2">
                                                                                <span className="text-bbq-gold font-bold text-lg block">${m.price}</span>
                                                                            </div>
                                                                        </div>
                                                                        {moq > 1 && (
                                                                            <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm border border-white/10">
                                                                                Min Order: {moq}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="p-4 flex flex-col gap-3 bg-gray-900/40 flex-1 backdrop-blur-sm">
                                                                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed min-h-[2.5em]">{m.description}</p>
                                                                    
                                                                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-800/50">
                                                                        <span className="text-xs text-gray-500 font-mono uppercase tracking-wider font-bold">{m.unit ? `Per ${m.unit}` : 'Each'}</span>
                                                                        
                                                                        <div className={`flex items-center gap-3 rounded-lg p-1 transition-colors ${qty > 0 ? 'bg-bbq-red/20 border border-bbq-red/30' : 'bg-black/40 border border-white/5'}`}>
                                                                            <button 
                                                                                onClick={() => updateCustomCart(m.id, -1, moq)}
                                                                                disabled={qty === 0}
                                                                                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 rounded-md hover:bg-white/10 transition active:scale-95"
                                                                            ><Minus size={16}/></button>
                                                                            
                                                                            <span className={`text-lg font-bold w-8 text-center font-mono ${qty > 0 ? 'text-white' : 'text-gray-500'}`}>{qty}</span>
                                                                            
                                                                            <button 
                                                                                onClick={() => updateCustomCart(m.id, 1, moq)}
                                                                                className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/10 rounded-md transition active:scale-95 bg-white/5"
                                                                            ><Plus size={16}/></button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {aLaCarteItems.length === 0 && (
                                        <div className="text-center text-gray-500 py-20 flex flex-col items-center gap-4 border-2 border-dashed border-gray-800 rounded-2xl">
                                            <ChefHat size={48} className="text-gray-700"/>
                                            <p className="text-lg">No catering items available at the moment.</p>
                                            <p className="text-sm text-gray-600">Please check back later or contact us directly.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 border-t border-gray-700 bg-gray-900">
                                    <button 
                                        onClick={() => {
                                            setIsPackageConfigOpen(false);
                                            setStep(3);
                                        }}
                                        disabled={Object.keys(customCart).length === 0}
                                        className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 disabled:opacity-50 text-lg shadow-xl transition flex justify-center items-center gap-2"
                                    >
                                        {Object.keys(customCart).length === 0 
                                            ? 'Select Items to Continue' 
                                            : 'Confirm & Authorize'
                                        }
                                        {Object.keys(customCart).length > 0 && <ArrowRight size={20}/>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
              </div>
         )}

         {/* STEP 3: AUTHORIZATION */}
         {step === 3 && (
             <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-right-8">
                 <div className="space-y-6">
                     <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
                         <h3 className="text-xl font-bold text-white mb-4">Request Summary</h3>
                         <div className="space-y-4 text-sm">
                             <div className="flex justify-between border-b border-gray-800 pb-2">
                                 <span className="text-gray-400">Date</span>
                                 <span className="font-bold text-white">{new Date(selectedDate).toLocaleDateString()}</span>
                             </div>
                             <div className="flex justify-between border-b border-gray-800 pb-2">
                                 <span className="text-gray-400">Time</span>
                                 <span className="font-bold text-white">{pickupTime}</span>
                             </div>
                             
                             {activePackage && selectedPackageId !== 'pkg_custom' && (
                                <>
                                    <div className="flex justify-between border-b border-gray-800 pb-2">
                                        <span className="text-gray-400">Package</span>
                                        <span className="font-bold text-white">{activePackage.name}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-800 pb-2">
                                        <span className="text-gray-400">Guests</span>
                                        <span className="font-bold text-white">{guestCount} pax</span>
                                    </div>
                                    <div className="bg-black/30 p-3 rounded text-xs text-gray-300">
                                        <strong className="block text-gray-500 mb-1 uppercase">Selections:</strong>
                                        {pkgSelections.meats.map(id => meatsMenu.find(m => m.id === id)?.name).join(', ')}<br/>
                                        {pkgSelections.sides.map(id => sidesMenu.find(m => m.id === id)?.name).join(', ')}
                                    </div>
                                </>
                             )}
                             {selectedPackageId === 'pkg_custom' && (
                                <>
                                    <div className="flex justify-between border-b border-gray-800 pb-2">
                                        <span className="text-gray-400">Package</span>
                                        <span className="font-bold text-white">Build Your Own</span>
                                    </div>
                                    <div className="bg-black/30 p-3 rounded text-xs text-gray-300 space-y-2">
                                        <strong className="block text-gray-500 uppercase">Items:</strong>
                                        {Object.entries(customCart).map(([id, qty]) => {
                                            const item = menu.find(m => m.id === id);
                                            if (!item) return null;
                                            return (
                                                <div key={id} className="flex justify-between">
                                                    <span>{qty}x {item.name}</span>
                                                    <span>${(item.price * qty).toFixed(2)}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </>
                             )}

                             <div className="pt-2">
                                 <div className="flex justify-between items-center text-sm text-gray-400 mb-1">
                                     <span>Full Estimated Total</span>
                                     <span>${total.toFixed(2)}</span>
                                 </div>
                                 <div className="flex justify-between items-center text-lg font-bold text-white border-t border-gray-700 pt-2">
                                     <span>50% Deposit Due Now</span>
                                     <span className="text-bbq-gold">${deposit.toFixed(2)}</span>
                                 </div>
                             </div>
                         </div>
                     </div>
                     <button onClick={() => {
                         setStep(2);
                         setSelectionMode('CHOICE');
                     }} className="text-gray-500 hover:text-white text-sm underline">Change Package</button>
                 </div>

                 {/* Payment Auth Form */}
                 <div className="bg-white text-gray-900 p-8 rounded-xl shadow-2xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-10">
                         <Lock size={100} />
                     </div>
                     
                     <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                         <CreditCard className="text-bbq-red"/> Authorize Deposit
                     </h3>
                     
                     <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-6 text-xs text-yellow-800 flex gap-2">
                         <Info className="shrink-0" size={16}/>
                         <p>
                             <strong>Pay 50% Deposit.</strong> A hold for <strong>${deposit.toFixed(2)}</strong> is placed. Payment is processed <strong>only</strong> if Admin approves the date. Remaining balance due on day of function.
                         </p>
                     </div>

                     {settings.squareConnected && settings.squareApplicationId && settings.squareLocationId ? (
                         <SquarePaymentForm 
                            applicationId={settings.squareApplicationId}
                            locationId={settings.squareLocationId}
                            amount={deposit}
                            onTokenize={handleSquareToken}
                         />
                     ) : (
                         <div className="bg-yellow-50 border border-yellow-300 p-6 rounded-xl text-center space-y-3">
                             <AlertCircle size={32} className="text-yellow-600 mx-auto"/>
                             <h4 className="font-bold text-gray-900">Payment Gateway Not Configured</h4>
                             <p className="text-sm text-gray-600">Online payments are currently unavailable. Please contact us directly to book your catering.</p>
                             <a href="tel:+61480259884" className="inline-block bg-bbq-red text-white font-bold py-2 px-6 rounded-lg text-sm hover:bg-red-700 transition">Call to Book</a>
                         </div>
                     )}
                 </div>
             </div>
         )}

       </div>
    </div>
  );
};

export default DIY;
