
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/Toast';
import { ShoppingBag, Trash2, CheckCircle, Clock, User, Mail, Phone, AlertCircle, ArrowRight, Truck, Check, Plus, Minus, Flame, Snowflake, X, Package, MapPin, CreditCard, Lock, Info, Ticket } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { MenuItem, CartItem, PackGroup } from '../types';
import SquarePaymentForm from '../components/SquarePaymentForm';
import { PLACEHOLDER_IMG } from '../constants';

// --- PACK MODAL COMPONENT ---
interface PackModalProps {
    item: MenuItem;
    onClose: () => void;
    onConfirm: (selections: Record<string, string[]>) => void;
}

const PackModal: React.FC<PackModalProps> = ({ item, onClose, onConfirm }) => {
    const [selections, setSelections] = useState<Record<string, string[]>>({});

    // Initialize selections
    useEffect(() => {
        const init: Record<string, string[]> = {};
        item.packGroups?.forEach(g => init[g.name] = []);
        setSelections(init);
    }, [item]);

    const addOption = (groupName: string, option: string, limit: number) => {
        setSelections(prev => {
            const current = prev[groupName] || [];
            if (current.length >= limit) return prev; // Limit reached
            return { ...prev, [groupName]: [...current, option] };
        });
    };

    const removeOption = (groupName: string, option: string) => {
        setSelections(prev => {
            const current = prev[groupName] || [];
            const idx = current.indexOf(option);
            if (idx === -1) return prev;
            const newArr = [...current];
            newArr.splice(idx, 1);
            return { ...prev, [groupName]: newArr };
        });
    };

    const isComplete = item.packGroups?.every(g => (selections[g.name]?.length || 0) === g.limit);

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="bg-bbq-charcoal border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-black/20">
                    <h3 className="font-bold text-white text-lg">Build Your {item.name}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20}/></button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {item.packGroups?.map((group) => {
                        const currentSelected = selections[group.name] || [];
                        const remaining = group.limit - currentSelected.length;
                        
                        return (
                            <div key={group.name} className="space-y-3">
                                <div className="flex justify-between items-end border-b border-gray-700 pb-1">
                                    <h4 className="font-bold text-bbq-gold uppercase text-sm">{group.name}</h4>
                                    <span className={`text-xs font-bold ${remaining === 0 ? 'text-green-500' : 'text-gray-400'}`}>
                                        Select {remaining} more
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {group.options.map(opt => {
                                        const count = currentSelected.filter(s => s === opt).length;
                                        return (
                                            <div key={opt} className="bg-gray-800 p-2 rounded flex justify-between items-center border border-gray-700">
                                                <span className="text-sm pr-2 text-white">{opt}</span>
                                                <div className="flex items-center gap-2 bg-black/30 rounded p-1">
                                                    <button 
                                                        onClick={() => removeOption(group.name, opt)}
                                                        disabled={count === 0}
                                                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 border border-gray-600 rounded"
                                                    >-</button>
                                                    <span className="text-sm font-bold w-4 text-center">{count}</span>
                                                    <button 
                                                        onClick={() => addOption(group.name, opt, group.limit)}
                                                        disabled={remaining === 0}
                                                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 border border-gray-600 rounded"
                                                    >+</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="p-4 border-t border-gray-700 bg-black/20">
                    <button 
                        onClick={() => onConfirm(selections)}
                        disabled={!isComplete}
                        className="w-full bg-bbq-red text-white font-bold py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        {isComplete ? 'Add Pack to Order' : 'Complete Selections'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Sub-component for individual menu item card ---
const MenuItemCard: React.FC<{ item: MenuItem, onAdd: (qty: number, packSelections?: Record<string, string[]>) => void }> = ({ item, onAdd }) => {
    const [qty, setQty] = useState(1);
    const [isAdded, setIsAdded] = useState(false);
    const [showPackModal, setShowPackModal] = useState(false);

    const handleIncrement = () => setQty(q => q + 1);
    const handleDecrement = () => setQty(q => Math.max(1, q - 1));

    const handleClick = () => {
        if (item.isPack) {
            setShowPackModal(true);
        } else {
            triggerAdd();
        }
    };

    const triggerAdd = (packSelections?: Record<string, string[]>) => {
        onAdd(qty, packSelections);
        setQty(1); 
        setIsAdded(true);
        setShowPackModal(false);
        setTimeout(() => setIsAdded(false), 2000);
    }

    return (
        <>
            <div className="bg-bbq-charcoal rounded-xl overflow-hidden border border-gray-800 hover:border-gray-600 transition shadow-lg group flex flex-col h-full">
                <div className="relative h-48 overflow-hidden">
                    <img src={item.image || PLACEHOLDER_IMG} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }} />
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-bbq-gold font-bold px-3 py-1 rounded-full text-sm border border-white/10">
                        ${item.price}
                    </div>
                    {item.isPack && (
                        <div className="absolute bottom-2 left-2 bg-purple-900/90 text-white text-xs font-bold px-2 py-1 rounded border border-purple-500 shadow-lg">
                            FAMILY PACK
                        </div>
                    )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                    <div className="flex-1">
                        <h4 className="font-bold text-lg text-white mb-1 leading-tight">{item.name}</h4>
                        <p className="text-sm text-gray-400 line-clamp-2 mb-4">{item.description}</p>
                    </div>
                    
                    <div className="mt-auto pt-4 border-t border-gray-700">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center bg-black/40 rounded-lg p-1 border border-gray-700">
                                <button onClick={handleDecrement} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"><Minus size={14}/></button>
                                <div className="w-8 text-center font-bold text-white text-sm">{qty}</div>
                                <button onClick={handleIncrement} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"><Plus size={14}/></button>
                            </div>
                            
                            <button 
                                onClick={handleClick}
                                disabled={isAdded}
                                className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${isAdded ? 'bg-green-600 text-white' : 'bg-white hover:bg-gray-200 text-black'}`}
                            >
                                {isAdded ? <><Check size={16}/> Added</> : (item.isPack ? 'Customize' : 'Add')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            {showPackModal && (
                <PackModal 
                    item={item} 
                    onClose={() => setShowPackModal(false)}
                    onConfirm={(selections) => triggerAdd(selections)}
                />
            )}
        </>
    );
};

const OrderPage: React.FC = () => {
  const { calendarEvents, cart, addToCart: addToCartContext, removeFromCart, updateCartItemQuantity, createOrder, user, updateUserProfile, menu, isDatePastCutoff, settings } = useApp();
  const { toast } = useToast();
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [pickupTime, setPickupTime] = useState<string>('');
  const [temperature, setTemperature] = useState<'HOT' | 'COLD'>('HOT');
  const [fulfillment, setFulfillment] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [contactInfo, setContactInfo] = useState({ name: '', email: '', phone: '' });
  const [showPayment, setShowPayment] = useState(false);
  
  // Generic Payment State (Fallback)
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  
  const navigate = useNavigate();

  // Detect Cart Mode
  const isShippableOnly = cart.length > 0 && cart.every(item => ['Rubs & Sauces', 'Merch'].includes(item.category));
  const SHIPPING_COST = 15.00;

  // Filter Order Events: Must be Future AND Not Past Cutoff
  const orderEvents = calendarEvents
      .filter(e => {
          if (e.type !== 'ORDER_PICKUP') return false;
          // Is it in the past?
          if (new Date(e.date) < new Date(new Date().setHours(0,0,0,0))) return false;
          // Is it past cutoff (9am morning prior)?
          if (isDatePastCutoff(e.date)) return false;
          return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const selectedEvent = orderEvents.find(e => e.id === selectedDayId);
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Discount Logic
  const hasLoyaltyDiscount = user?.hasCateringDiscount === true;
  const discountAmount = hasLoyaltyDiscount ? cartTotal * 0.10 : 0;
  
  const totalBeforeShipping = cartTotal - discountAmount;
  const finalTotal = fulfillment === 'DELIVERY' && isShippableOnly ? totalBeforeShipping + SHIPPING_COST : totalBeforeShipping;

  // Filter items available for this day OR General items + Packs
  const availableItems = menu.filter(item => {
    // Show Packs always available or specific date logic
    if (item.availabilityType === 'everyday') return true;
    if (item.availabilityType === 'specific_date' && selectedEvent && item.specificDate === selectedEvent.date) return true;
    return false;
  });

  // Dynamic Time Slots based on Event Window
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  useEffect(() => {
      if (selectedEvent) {
          const slots = [];
          // Default window if not set: 11am to 6pm
          let startHour = parseInt(selectedEvent.startTime?.split(':')[0] || '11');
          let endHour = parseInt(selectedEvent.endTime?.split(':')[0] || '18');
          
          for (let h = startHour; h < endHour; h++) {
              slots.push(`${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`);
              slots.push(`${h > 12 ? h - 12 : h}:30 ${h >= 12 ? 'PM' : 'AM'}`);
          }
          setTimeSlots(slots);
      } else {
          setTimeSlots([]);
      }
  }, [selectedEvent]);

  useEffect(() => {
    if (user) {
      setContactInfo({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || ''
      });
      // Use profile address if available
      if (user.address) setDeliveryAddress(user.address);
    }
  }, [user]);

  // Auto-select first event if none selected (for standard orders)
  useEffect(() => {
      if (!isShippableOnly && orderEvents.length > 0 && !selectedDayId) {
          setSelectedDayId(orderEvents[0].id);
      }
  }, [orderEvents, selectedDayId, isShippableOnly]);

  // Wrapper for addToCart to handle packs
  const handleAddToCart = (item: MenuItem, quantity: number, packSelections?: Record<string, string[]>) => {
      const cartItemObj = { ...item, packSelections };
      addToCartContext(cartItemObj as any, quantity); 
  };

  const handleStartCheckout = () => {
    if (!user) return navigate('/login');
    
    // Validation
    if (!isShippableOnly) {
        if (!selectedDayId) {
            toast('Please select a pickup date!', 'warning');
            document.getElementById('date-selection')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        if (!pickupTime) {
            toast('Please select a pickup time!', 'warning');
            document.getElementById('collection-details')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    } else {
        // Shippable Logic
        if (fulfillment === 'DELIVERY' && !deliveryAddress.trim()) {
            toast('Please enter your shipping address.', 'warning'); return;
        }
    }
    
    if (!contactInfo.name.trim() || !contactInfo.email.trim() || !contactInfo.phone.trim()) {
        toast('Please provide your Name, Email, and Phone number to proceed.', 'warning');
        return;
    }

    setShowPayment(true);
  };

  const processOrder = async (paymentIntentId?: string, depositAmount?: number) => {
        if (!user) return;
        const orderId = `o${Date.now()}`;
        createOrder({
          id: orderId,
          userId: user.id,
          customerName: contactInfo.name,
          customerEmail: contactInfo.email,
          customerPhone: contactInfo.phone,
          items: cart.map(i => ({ 
              item: i, 
              quantity: i.quantity,
              packSelections: i.packSelections // Persist choices
          })),
          total: finalTotal,
          depositAmount: depositAmount,
          paymentIntentId: paymentIntentId,
          status: 'Pending', // Pending Admin Approval
          cookDay: isShippableOnly ? new Date().toISOString() : (selectedEvent?.date || new Date().toISOString()),
          type: 'TAKEAWAY',
          pickupTime: isShippableOnly ? 'Anytime' : pickupTime,
          createdAt: new Date().toISOString(),
          temperature: isShippableOnly ? 'COLD' : temperature, // Default to cold for merch/pantry
          fulfillmentMethod: fulfillment,
          deliveryAddress: fulfillment === 'DELIVERY' ? deliveryAddress : undefined,
          deliveryFee: fulfillment === 'DELIVERY' && isShippableOnly ? SHIPPING_COST : 0,
          discountApplied: hasLoyaltyDiscount
        });

        // Notify Admin (Email + SMS)
        const orderPayload = {
            id: orderId,
            customerName: contactInfo.name,
            customerEmail: contactInfo.email,
            customerPhone: contactInfo.phone,
            cookDay: isShippableOnly ? new Date().toISOString() : (selectedEvent?.date || new Date().toISOString()),
            pickupTime: isShippableOnly ? 'Anytime' : pickupTime,
            type: 'TAKEAWAY',
            total: finalTotal,
            depositAmount: depositAmount || 0,
            items: cart.map(i => ({ quantity: i.quantity, name: i.name, price: i.price }))
        };
        try {
            await Promise.allSettled([
                fetch('/api/v1/email/order-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: settings.emailSettings, order: orderPayload })
                }),
                fetch('/api/v1/sms/order-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: settings.smsSettings, order: orderPayload })
                })
            ]);
        } catch (e) {
            console.error("Failed to notify admin", e);
        }

        setIsSuccess(true);
  };

  const handleSquareSuccess = async (token: string) => {
      console.log("Square Token Received:", token);
      
      if (user && (user.name !== contactInfo.name || user.email !== contactInfo.email || user.phone !== contactInfo.phone)) {
        updateUserProfile({
            ...user,
            name: contactInfo.name,
            email: contactInfo.email,
            phone: contactInfo.phone,
            address: fulfillment === 'DELIVERY' ? deliveryAddress : user.address
        });
      }
      
      const depositAmount = finalTotal * 0.5;
      
      try {
          const res = await fetch('/api/v1/payment/square-pay', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  sourceId: token,
                  amount: depositAmount,
                  currency: 'AUD',
                  locationId: settings.squareLocationId,
                  accessToken: settings.squareAccessToken,
                  environment: settings.squareEnvironment || 'sandbox',
                  customerEmail: contactInfo.email,
              }),
          });
          
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Payment failed');
          
          processOrder(data.paymentId, depositAmount);
      } catch (error: any) {
          console.error("Square Payment Error:", error);
          toast(`Payment failed: ${error.message}`, 'error');
      }
  };

  const handleGenericPayment = async () => {
    if (!cardNumber || !expiry || !cvc) {
        toast('Please enter valid payment details.', 'warning');
        return;
    }

    if (user && (user.name !== contactInfo.name || user.email !== contactInfo.email || user.phone !== contactInfo.phone)) {
        updateUserProfile({
            ...user,
            name: contactInfo.name,
            email: contactInfo.email,
            phone: contactInfo.phone,
            address: fulfillment === 'DELIVERY' ? deliveryAddress : user.address
        });
    }

    // Authorize 50% Deposit
    const depositAmount = finalTotal * 0.5;
    
    try {
        const res = await fetch('/api/payment/authorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: depositAmount }),
        });
        
        if (!res.ok) throw new Error('Payment authorization failed');
        
        const { id: paymentIntentId } = await res.json();
        
        // Process order with authorized payment intent
        processOrder(paymentIntentId, depositAmount);
        
    } catch (error) {
        console.error("Payment Error:", error);
        toast('Payment authorization failed. Please try again.', 'error');
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-8 animate-in zoom-in">
        <div className="w-32 h-32 bg-green-500/10 rounded-full flex items-center justify-center border-2 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
            <CheckCircle className="text-green-500 w-16 h-16" />
        </div>
        <div>
            <h2 className="text-4xl font-display font-bold text-white mb-2">ORDER RECEIVED</h2>
            <p className="text-gray-400">Your order is pending approval. A 50% hold has been placed on your card.</p>
            <p className="text-sm text-gray-500 mt-2">We'll notify you once the Pitmaster confirms availability.</p>
        </div>
        
        <div className="bg-bbq-charcoal p-6 rounded-xl border border-gray-700 max-w-md w-full text-left space-y-4">
           {isShippableOnly && fulfillment === 'DELIVERY' ? (
                <div className="flex justify-between border-b border-gray-700 pb-2">
                    <span className="text-gray-500">Method</span>
                    <span className="text-white font-bold flex items-center gap-1"><Truck size={14}/> Shipping</span>
                </div>
           ) : (
                <div className="flex justify-between border-b border-gray-700 pb-2">
                    <span className="text-gray-500">Pickup Location</span>
                    <span className="text-white font-bold text-sm">
                        {isShippableOnly ? 'West End HQ' : 'Ipswich, QLD (Exact location sent via SMS/Email when Ready)'}
                    </span>
                </div>
           )}
           
           {!isShippableOnly && (
               <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-500">Time</span>
                  <span className="text-bbq-gold font-bold">{pickupTime}</span>
               </div>
           )}
           
           <div className="flex justify-between border-b border-gray-700 pb-2">
              <span className="text-gray-500">Total Order Value</span>
              <span className="text-white font-bold">${finalTotal.toFixed(2)}</span>
           </div>
           <div className="flex justify-between border-b border-gray-700 pb-2">
              <span className="text-gray-500">Authorized Deposit (50%)</span>
              <span className="text-bbq-gold font-bold">${(finalTotal * 0.5).toFixed(2)}</span>
           </div>
           <div className="text-center text-xs text-gray-500 pt-2">
             You will only be charged if the order is accepted.
           </div>
        </div>

        <Link to="/" className="bg-white text-black px-10 py-3 rounded-full font-bold hover:bg-gray-200 transition uppercase tracking-widest text-sm">Back Home</Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-24">
      
      {/* Left Column: Selection & Menu (Span 8) */}
      <div className="lg:col-span-8 space-y-8">
        
        {/* Header Block */}
        <div className="bg-gradient-to-r from-gray-900 to-black p-8 rounded-3xl border border-white/5 relative overflow-hidden">
            <div className="relative z-10">
                <h1 className="text-4xl font-display font-bold text-white mb-2">
                    {isShippableOnly ? 'PANTRY & MERCH' : 'PRE-ORDER PICKUP'}
                </h1>
                <p className="text-gray-400">
                    {isShippableOnly ? 'Stock up on rubs, sauces, and gear. Ship to door or pickup.' : 'Secure your smoked meats before they sell out.'}
                </p>
                {!isShippableOnly && (
                    <div className="mt-4 text-xs font-bold bg-red-900/40 text-red-200 inline-flex items-center gap-2 px-4 py-2 rounded border border-red-500/50">
                        <AlertCircle size={16} className="text-red-500"/> 
                        <span>
                            ORDER CUTOFF: <strong>9:00 AM</strong> on the morning PRIOR to cook day. 
                            <br/><span className="font-normal opacity-80">We need time to trim, rub, and rest the meat!</span>
                        </span>
                    </div>
                )}
            </div>
            <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-bbq-red/20 to-transparent"></div>
        </div>

        {/* --- CONDITIONAL UI: SHIPPING MODE VS FOOD MODE --- */}
        
        {isShippableOnly ? (
            /* SHIPPABLE FLOW */
            <section className="bg-bbq-charcoal p-6 rounded-xl border border-gray-800 animate-in fade-in">
                <div className="flex items-center gap-3 mb-6">
                    <span className="w-8 h-8 rounded-full bg-bbq-gold text-black flex items-center justify-center text-sm font-bold">1</span>
                    <h2 className="text-xl font-bold text-white">FULFILLMENT METHOD</h2>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <button 
                        onClick={() => setFulfillment('PICKUP')}
                        className={`p-6 rounded-xl border flex flex-col items-center gap-2 transition ${fulfillment === 'PICKUP' ? 'bg-white text-black border-white shadow-lg' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                    >
                        <ShoppingBag size={32} />
                        <div className="text-center">
                            <span className="block font-bold text-lg">Pickup (HQ)</span>
                            <span className="text-xs opacity-70">West End, Brisbane</span>
                        </div>
                    </button>
                    
                    <button 
                        onClick={() => setFulfillment('DELIVERY')}
                        className={`p-6 rounded-xl border flex flex-col items-center gap-2 transition ${fulfillment === 'DELIVERY' ? 'bg-bbq-gold text-black border-yellow-500 shadow-lg' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                    >
                        <Truck size={32} />
                        <div className="text-center">
                            <span className="block font-bold text-lg">Shipping</span>
                            <span className="text-xs opacity-70">Standard Flat Rate ${SHIPPING_COST.toFixed(2)}</span>
                        </div>
                    </button>
                </div>

                {fulfillment === 'DELIVERY' && (
                    <div className="space-y-2 animate-in slide-in-from-top-2">
                        <label className="block text-xs text-gray-400 font-bold uppercase">Shipping Address</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3.5 text-bbq-gold" size={20} />
                            <input 
                                value={deliveryAddress}
                                onChange={e => setDeliveryAddress(e.target.value)}
                                placeholder="Street Address, Suburb, State, Postcode"
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-gold outline-none"
                            />
                        </div>
                    </div>
                )}
            </section>
        ) : (
            /* FOOD PICKUP FLOW */
            <>
                {/* Step 1: Cook Days */}
                <section id="date-selection">
                <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-full bg-bbq-red text-white flex items-center justify-center text-sm font-bold">1</span>
                    <h2 className="text-xl font-bold text-white">SELECT COOK DAY</h2>
                </div>
                
                {orderEvents.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-gray-700 rounded-xl bg-gray-900/50">
                        <p className="text-gray-500 italic">No pre-order dates available right now.</p>
                        <div className="mt-4 inline-block bg-black/40 px-4 py-2 rounded text-xs text-gray-400">
                            <strong>Note:</strong> Pre-ordering closes at 9AM the day before a scheduled cook.
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {orderEvents.map(evt => {
                            const pickupDate = new Date(evt.date);
                            pickupDate.setDate(pickupDate.getDate() + 1);
                            
                            return (
                            <button
                                key={evt.id}
                                onClick={() => { setSelectedDayId(evt.id); setPickupTime(''); }}
                                className={`p-5 rounded-xl border transition-all flex justify-between items-center group relative overflow-hidden text-left ${selectedDayId === evt.id ? 'border-bbq-red bg-bbq-red/10 shadow-[0_0_15px_rgba(217,56,30,0.2)]' : 'border-gray-800 bg-bbq-charcoal hover:border-gray-600'}`}
                            >
                                <div className="relative z-10">
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{evt.location}</div>
                                    <div className="font-bold text-xl text-white group-hover:text-bbq-gold transition">
                                        {pickupDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </div>
                                    <div className="text-[10px] text-red-400 font-bold uppercase mt-1 bg-red-900/20 px-2 py-0.5 rounded inline-block border border-red-900/30">
                                        Order by {new Date(evt.date).toLocaleDateString(undefined, {weekday:'short'})} 5pm
                                    </div>
                                    <div className="text-xs text-gray-400 mt-2 flex items-center gap-1 bg-black/20 px-2 py-1 rounded w-fit">
                                        <Clock size={10}/> {evt.startTime || '11:00'} - {evt.endTime || '18:00'}
                                    </div>
                                </div>
                                {selectedDayId === evt.id && <div className="absolute right-4 text-bbq-red"><CheckCircle size={24}/></div>}
                            </button>
                            );
                        })}
                    </div>
                )}
                </section>

                {/* Step 2: Time Selection & Preference */}
                <section id="collection-details" className={`transition-opacity duration-500 ${selectedDayId ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <div className="flex items-center gap-3 mb-4">
                        <span className="w-8 h-8 rounded-full bg-bbq-red text-white flex items-center justify-center text-sm font-bold">2</span>
                        <h2 className="text-xl font-bold text-white">COLLECTION DETAILS</h2>
                    </div>
                    
                    <div className={`space-y-6 bg-bbq-charcoal p-6 rounded-xl border ${!pickupTime && selectedDayId ? 'border-bbq-gold/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-gray-800'}`}>
                        {/* Temperature Toggle */}
                        <div>
                            <label className="text-xs text-gray-400 uppercase font-bold mb-3 block">Serving Temperature</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setTemperature('HOT')}
                                    className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition ${temperature === 'HOT' ? 'bg-orange-900/30 border-orange-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                                >
                                    <Flame size={24} className={temperature === 'HOT' ? 'text-orange-500' : 'text-gray-500'} />
                                    <span className="font-bold text-sm">HOT (Ready to Eat)</span>
                                </button>
                                <button 
                                    onClick={() => setTemperature('COLD')}
                                    className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition ${temperature === 'COLD' ? 'bg-blue-900/30 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                                >
                                    <Snowflake size={24} className={temperature === 'COLD' ? 'text-blue-400' : 'text-gray-500'} />
                                    <span className="font-bold text-sm">COLD (Heat at Home)</span>
                                </button>
                            </div>
                        </div>

                        {/* Pickup Time */}
                        <div>
                            <label className="text-xs text-gray-400 uppercase font-bold mb-3 block flex justify-between">
                                <span>Select Time Slot</span>
                                {!pickupTime && <span className="text-bbq-gold animate-pulse">Required</span>}
                            </label>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                {timeSlots.length > 0 ? timeSlots.map(time => (
                                    <button
                                        key={time}
                                        onClick={() => setPickupTime(time)}
                                        className={`py-3 px-2 rounded-lg text-sm font-bold transition border ${pickupTime === time ? 'bg-white text-black border-white shadow-lg scale-105' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'}`}
                                    >
                                        {time}
                                    </button>
                                )) : <div className="col-span-full text-sm text-gray-500 italic">No specific slots configured. Select a date first.</div>}
                            </div>
                        </div>
                    </div>
                </section>
            </>
        )}

        {/* Step 3: Menu Items */}
        <section>
           <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isShippableOnly ? 'bg-bbq-gold text-black' : 'bg-bbq-red text-white'}`}>
                    {isShippableOnly ? '2' : '3'}
                </span>
                <h2 className="text-xl font-bold text-white">ADD ITEMS</h2>
            </div>
             {!isShippableOnly && (
                 selectedEvent ? (
                     <span className="text-xs text-bbq-gold font-bold uppercase tracking-widest hidden sm:inline-block">
                         {new Date(selectedEvent.date).toLocaleDateString()} MENU
                     </span>
                 ) : (
                     <span className="text-xs text-red-500 font-bold uppercase tracking-widest animate-pulse">Select Date First</span>
                 )
             )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {(selectedEvent || isShippableOnly) ? (
               availableItems.length > 0 ? (
                 availableItems.map(item => (
                    <MenuItemCard 
                        key={item.id} 
                        item={item} 
                        onAdd={(qty, packSelections) => handleAddToCart(item, qty, packSelections)} 
                    />
                 ))
               ) : (
                   <div className="col-span-2 text-center py-12 text-gray-500 italic border border-dashed border-gray-800 rounded-xl">
                       No additional items available for selection.
                   </div>
               )
             ) : (
               <div className="col-span-2 text-center text-gray-500 py-16 border border-gray-800 rounded-xl bg-black/20">
                 <div className="mb-2">🔒</div>
                 Menu items are locked until a date is selected.
               </div>
             )}
          </div>
        </section>
      </div>

      {/* Right Column: Cart & Checkout (Span 4) */}
      <div className="lg:col-span-4">
          <div className="glass-card text-white rounded-2xl p-6 lg:sticky lg:top-24 border border-white/10 shadow-2xl">
            <h2 className="text-2xl font-display font-bold mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
            <ShoppingBag className="text-bbq-gold" /> YOUR ORDER
            </h2>
            
            {cart.length === 0 ? (
            <div className="text-center py-12">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-600">
                    <ShoppingBag size={24}/>
                </div>
                <p className="text-gray-500 italic">Your tray is empty.</p>
                <p className="text-xs text-gray-600 mt-2">Add some smoked goodness.</p>
            </div>
            ) : (
            <div className="space-y-6">
                {/* Cart Items */}
                <div className="max-h-[35vh] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                    {cart.map(item => (
                    <div key={item.id} className="group bg-black/20 p-3 rounded-lg border border-transparent hover:border-gray-700 transition">
                        <div className="flex justify-between items-start gap-3">
                            <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1 border border-gray-600 shrink-0 h-fit mt-1">
                                <button onClick={() => updateCartItemQuantity(item.id, -1)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"><Minus size={12}/></button>
                                <span className="w-6 text-center font-bold text-white text-xs">{item.quantity}</span>
                                <button onClick={() => updateCartItemQuantity(item.id, 1)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"><Plus size={12}/></button>
                            </div>
                            
                            <div className="flex-1">
                                <div className="font-bold text-sm text-gray-200 leading-tight">{item.name}</div>
                                <div className="text-xs text-gray-500 mt-1">${item.price} ea</div>
                                {/* Show Pack Choices */}
                                {item.packSelections && (
                                    <div className="mt-2 text-xs text-gray-400 space-y-1 border-l-2 border-gray-700 pl-2">
                                        {Object.entries(item.packSelections).map(([group, choices]) => (
                                            <div key={group}>
                                                <span className="text-gray-500 font-bold">{group}:</span> {Array.isArray(choices) ? choices.join(', ') : ''}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className="font-bold text-sm">${(item.price * item.quantity).toFixed(2)}</span>
                                <button onClick={() => removeFromCart(item.id)} className="text-gray-600 hover:text-red-500 transition p-1" title="Remove"><Trash2 size={14}/></button>
                            </div>
                        </div>
                    </div>
                    ))}
                </div>
                
                <div className="pt-4 border-t border-white/10 space-y-2">
                    <div className="flex justify-between items-center text-sm text-gray-400">
                        <span>Subtotal</span>
                        <span>${cartTotal.toFixed(2)}</span>
                    </div>
                    
                    {hasLoyaltyDiscount && (
                        <div className="flex justify-between items-center text-sm text-green-400">
                            <span className="flex items-center gap-1"><Ticket size={12}/> Loyalty Discount (10%)</span>
                            <span>-${discountAmount.toFixed(2)}</span>
                        </div>
                    )}

                    {isShippableOnly && fulfillment === 'DELIVERY' && (
                        <div className="flex justify-between items-center text-sm text-gray-400">
                            <span>Shipping</span>
                            <span>${SHIPPING_COST.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center text-xl font-bold pt-2">
                        <span>TOTAL</span>
                        <span className="text-bbq-gold">${finalTotal.toFixed(2)}</span>
                    </div>
                </div>

                {/* Mandatory Contact Fields */}
                <div className="space-y-3 bg-black/30 p-4 rounded-lg border border-white/5">
                    <h3 className="font-bold text-[10px] uppercase text-gray-400 tracking-widest flex items-center gap-1 mb-2">
                        Contact Details
                    </h3>
                    
                    <div className="relative">
                        <User className="absolute left-3 top-2.5 text-gray-500" size={16} />
                        <input 
                            placeholder="Full Name"
                            value={contactInfo.name}
                            onChange={e => setContactInfo({...contactInfo, name: e.target.value})}
                            className="w-full bg-gray-800 border border-gray-700 rounded p-2 pl-9 text-sm focus:border-bbq-red outline-none text-white transition-colors"
                        />
                    </div>
                    
                    <div className="relative">
                        <Mail className="absolute left-3 top-2.5 text-gray-500" size={16} />
                        <input 
                            type="email"
                            placeholder="Email Address"
                            value={contactInfo.email}
                            onChange={e => setContactInfo({...contactInfo, email: e.target.value})}
                            className="w-full bg-gray-800 border border-gray-700 rounded p-2 pl-9 text-sm focus:border-bbq-red outline-none text-white transition-colors"
                        />
                    </div>
                    
                    <div className="relative">
                        <Phone className="absolute left-3 top-2.5 text-gray-500" size={16} />
                        <input 
                            type="tel"
                            placeholder="Phone Number"
                            value={contactInfo.phone}
                            onChange={e => setContactInfo({...contactInfo, phone: e.target.value})}
                            className="w-full bg-gray-800 border border-gray-700 rounded p-2 pl-9 text-sm focus:border-bbq-red outline-none text-white transition-colors"
                        />
                    </div>
                </div>

                {/* Payment Section (Expanded) */}
                {showPayment ? (
                    <div className="mt-4 animate-in slide-in-from-bottom-2">
                        {settings.squareConnected && settings.squareApplicationId && settings.squareLocationId ? (
                            <SquarePaymentForm 
                                applicationId={settings.squareApplicationId}
                                locationId={settings.squareLocationId}
                                amount={finalTotal}
                                onTokenize={handleSquareSuccess}
                            />
                        ) : (
                            <div className="bg-gray-900 border border-yellow-600/40 p-6 rounded-xl text-center space-y-3">
                                <AlertCircle size={32} className="text-yellow-500 mx-auto"/>
                                <h3 className="font-bold text-white">Payment Gateway Not Configured</h3>
                                <p className="text-sm text-gray-400">Online payments are currently unavailable. Please contact us directly to place your order.</p>
                                <a href="tel:+61480259884" className="inline-block bg-bbq-red text-white font-bold py-2 px-6 rounded-lg text-sm hover:bg-red-700 transition">Call to Order</a>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Checkout Actions */
                    <div className="mt-6 space-y-3">
                        {!user ? (
                        <Link to="/login" className="block w-full bg-white text-black text-center py-4 rounded-lg font-bold hover:bg-gray-200 transition uppercase tracking-widest text-sm shadow-lg">
                            Login to Checkout
                        </Link>
                        ) : (
                        <button 
                            onClick={handleStartCheckout}
                            disabled={cart.length === 0}
                            className="w-full bg-gradient-to-r from-bbq-red to-red-800 text-white py-4 rounded-lg font-bold hover:shadow-[0_0_20px_rgba(217,56,30,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm shadow-xl flex justify-center items-center gap-2"
                        >
                            {isShippableOnly ? 'Proceed to Payment' : (!selectedDayId ? 'Select a Date' : !pickupTime ? 'Select a Time' : 'Proceed to Payment')}
                            <ArrowRight size={16}/>
                        </button>
                        )}
                        

                    </div>
                )}
            </div>
            )}
        </div>
      </div>

    </div>
  );
};

export default OrderPage;
