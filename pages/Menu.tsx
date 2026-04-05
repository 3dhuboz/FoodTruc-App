
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/Toast';
import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowRight, Package, Users, Calendar, X, Plus, Minus, Check, Truck, Info, Clock, Utensils, AlertCircle } from 'lucide-react';
import { PLACEHOLDER_IMG } from '../constants';
import { MenuItem } from '../types';

// --- ITEM DETAILS MODAL ---
interface ItemDetailsModalProps {
    item: MenuItem;
    onClose: () => void;
    onAddToCart: (qty: number, packSelections?: Record<string, string[]>, option?: string) => void;
}

const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({ item, onClose, onAddToCart }) => {
    const [qty, setQty] = useState(item.minQuantity || 1);
    const [selectedOption, setSelectedOption] = useState<string>(
        item.preparationOptions && item.preparationOptions.length > 0 ? item.preparationOptions[0] : ''
    );
    const [packSelections, setPackSelections] = useState<Record<string, string[]>>(() => {
        const init: Record<string, string[]> = {};
        if (item.isPack && item.packGroups) {
            item.packGroups.forEach(g => init[g.name] = []);
        }
        return init;
    });

    const handleIncrement = () => setQty(q => q + 1);
    const handleDecrement = () => setQty(q => Math.max(item.minQuantity || 1, q - 1));

    // Pack Logic
    const addPackOption = (groupName: string, option: string, limit: number) => {
        setPackSelections(prev => {
            const current = prev[groupName] || [];
            if (current.length >= limit) return prev;
            return { ...prev, [groupName]: [...current, option] };
        });
    };

    const removePackOption = (groupName: string, option: string) => {
        setPackSelections(prev => {
            const current = prev[groupName] || [];
            const idx = current.indexOf(option);
            if (idx === -1) return prev;
            const newArr = [...current];
            newArr.splice(idx, 1);
            return { ...prev, [groupName]: newArr };
        });
    };

    const isPackComplete = !item.isPack || (item.packGroups?.every(g => (packSelections[g.name]?.length || 0) === g.limit));

    const handleAdd = () => {
        onAddToCart(qty, item.isPack ? packSelections : undefined, selectedOption);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-bbq-charcoal w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden relative shadow-2xl flex flex-col animate-in zoom-in-95 border border-gray-700">
                
                {/* Close Button */}
                <button onClick={onClose} className="absolute top-4 right-4 z-20 bg-black/50 p-2 rounded-full text-white hover:bg-white hover:text-black transition">
                    <X size={20} />
                </button>

                {/* Hero Image */}
                <div className="h-64 shrink-0 relative">
                    <img src={item.image || PLACEHOLDER_IMG} alt={item.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-bbq-charcoal to-transparent"></div>
                    <div className="absolute bottom-4 left-6 right-6">
                        <h2 className="text-3xl font-display font-bold text-white leading-none shadow-black drop-shadow-md">{item.name}</h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-2xl font-bold text-bbq-gold">${item.price}</span>
                            {item.unit && <span className="text-gray-400 text-sm">/ {item.unit}</span>}
                        </div>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                    <p className="text-gray-300 leading-relaxed text-lg">{item.description}</p>

                    {/* Standard Options */}
                    {!item.isPack && item.preparationOptions && item.preparationOptions.length > 0 && (
                        <div>
                            <h4 className="font-bold text-white mb-2 uppercase text-sm tracking-wider">Select Option</h4>
                            <div className="flex flex-wrap gap-2">
                                {item.preparationOptions.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => setSelectedOption(opt)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${selectedOption === opt ? 'bg-white text-black border-white' : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'}`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pack Options (Using Visual Layout from Order.tsx Fix) */}
                    {item.isPack && item.packGroups && (
                        <div className="space-y-6 bg-black/20 p-4 rounded-xl border border-white/5">
                            {item.packGroups.map(group => {
                                const current = packSelections[group.name] || [];
                                const remaining = group.limit - current.length;
                                return (
                                    <div key={group.name}>
                                        <div className="flex justify-between items-end mb-3 border-b border-white/10 pb-1">
                                            <h4 className="font-bold text-bbq-gold uppercase text-sm tracking-wider">{group.name}</h4>
                                            <span className={`text-xs font-bold ${remaining === 0 ? 'text-green-500' : 'text-gray-400'}`}>
                                                {remaining === 0 ? <span className="flex items-center gap-1"><Check size={12}/> Complete</span> : `Choose ${remaining} more`}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {group.options.map(opt => {
                                                const count = current.filter(c => c === opt).length;
                                                return (
                                                    <div key={opt} className="bg-gray-800 p-2 rounded flex justify-between items-center border border-gray-700">
                                                        <span className="text-sm text-gray-200">{opt}</span>
                                                        <div className="flex items-center gap-2 bg-black/40 rounded p-1">
                                                            <button 
                                                                onClick={() => removePackOption(group.name, opt)}
                                                                disabled={count === 0}
                                                                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 border border-gray-600 rounded"
                                                            >-</button>
                                                            <span className="text-sm font-bold w-4 text-center">{count}</span>
                                                            <button 
                                                                onClick={() => addPackOption(group.name, opt, group.limit)}
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
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-black/40 border-t border-white/10">
                    <div className="flex gap-4">
                        <div className="flex items-center bg-gray-800 rounded-xl p-1 border border-gray-600">
                            <button onClick={handleDecrement} className="w-10 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"><Minus size={18}/></button>
                            <div className="w-12 text-center font-bold text-white text-lg">{qty}</div>
                            <button onClick={handleIncrement} className="w-10 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"><Plus size={18}/></button>
                        </div>
                        <button 
                            onClick={handleAdd}
                            disabled={!isPackComplete}
                            className="flex-1 bg-bbq-red text-white font-bold text-lg rounded-xl hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
                        >
                            Add to Order <span className="bg-black/20 px-2 py-0.5 rounded text-sm">${(item.price * qty).toFixed(2)}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Menu: React.FC = () => {
  const { menu, addToCart, user, cart, calendarEvents, selectedOrderDate, setSelectedOrderDate, settings, isDatePastCutoff } = useApp();
  const { toast } = useToast();
  
  // Logic to find upcoming cook dates (Filter out past dates AND cut off dates)
  const orderEvents = calendarEvents
    .filter(evt => {
        if (evt.type !== 'ORDER_PICKUP') return false;
        if (new Date(evt.date) < new Date(new Date().setHours(0,0,0,0))) return false;
        if (isDatePastCutoff(evt.date)) return false;
        return true;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Derived State
  const selectedEvent = orderEvents.find(e => e.date === selectedOrderDate);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Feedback State for buttons
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);

  // --- MENU FILTERING FIX ---
  const availableMenu = menu.filter(m => {
      // 1. Always show shippable items (Rubs, Sauces, Merch)
      if (['Rubs & Sauces', 'Merch'].includes(m.category as string)) return true;

      // 2. If no date selected, show everything that is 'everyday' OR 'specific_date' (in browse mode)
      if (!selectedOrderDate) return true;

      // 3. If date selected, apply strict availability
      if (m.availabilityType === 'everyday') return true;
      if (m.availabilityType === 'specific_date' && m.specificDate === selectedOrderDate) return true;
      return false;
  });

  const categories = Array.from(new Set(availableMenu.map(m => m.category))).filter(Boolean);
  // Custom Sorting: Family Packs First, then Rubs/Merch last
  const sortedCategories = categories.sort((a, b) => {
      if (a === 'Family Packs') return -1;
      if (b === 'Family Packs') return 1;
      
      const isMerchA = ['Rubs & Sauces', 'Merch'].includes(a as string);
      const isMerchB = ['Rubs & Sauces', 'Merch'].includes(b as string);
      
      if (isMerchA && !isMerchB) return 1;
      if (!isMerchA && isMerchB) return -1;
      
      return 0;
  });

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = PLACEHOLDER_IMG;
  };
  
  const handleItemClick = (item: MenuItem) => {
      setSelectedItem(item);
  };

  const triggerAddedFeedback = (itemId: string) => {
      setRecentlyAdded(itemId);
      setTimeout(() => setRecentlyAdded(null), 2000);
  };

  const handleAddToCartFromModal = (qty: number, packSelections?: Record<string, string[]>, option?: string) => {
      if (selectedItem) {
          // Construct object expected by context
          const itemToAdd = { 
              ...selectedItem, 
              packSelections, // Attach selections
              selectedOption: option // Attach specific option choice
          };
          // Pass selectedOrderDate (can be null for Merch, which is handled in Order.tsx)
          addToCart(itemToAdd as any, qty, selectedOrderDate || undefined);
          triggerAddedFeedback(selectedItem.id);
      }
  };

  const handleDateSelect = (date: string) => {
      if (selectedOrderDate === date) {
          setSelectedOrderDate(null); // Deselect
      } else {
          setSelectedOrderDate(date);
      }
  };

  // Helper for generating safe IDs
  const getCatId = (cat: string) => `cat-${(cat || 'unknown').replace(/\s+/g, '-')}`;

  // Pack images for hero collage
  const packImages = [
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80", // Platter
      "https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=800&q=80", // Meat Tray
      "https://images.unsplash.com/photo-1588347818036-558601350947?auto=format&fit=crop&w=800&q=80"  // Ribs
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-24 relative animate-in fade-in duration-500">
      
      {/* LEFT CONTENT (Menu) - SPANS 3 COLUMNS */}
      <div className="lg:col-span-3 space-y-8">
        
        {/* --- CATEGORY FILTER BAR (Sticky) --- */}
        <div className="sticky top-20 md:top-24 z-30 bg-bbq-charcoal/95 backdrop-blur-md border-y border-gray-700 py-3 px-4 -mx-4 md:mx-0 md:rounded-xl shadow-2xl">
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition ${!activeCategory ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >All</button>
                {sortedCategories.map(cat => (
                    <button
                      key={cat as string}
                      onClick={() => setActiveCategory(cat as string)}
                      className={`whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition ${activeCategory === cat ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                    >{cat as string}</button>
                ))}
            </div>
        </div>

        {/* --- MENU GRID --- */}
        {availableMenu.length === 0 ? (
            <div className="text-center py-20 bg-bbq-charcoal/50 rounded-xl border border-gray-800 border-dashed">
                <p className="text-gray-500 text-lg">Menu items loading or not available for this selection.</p>
            </div>
        ) : (
          sortedCategories.filter(cat => !activeCategory || cat === activeCategory).map(cat => (
              <div key={cat} id={getCatId(cat as string)} className="space-y-6 pt-8 scroll-mt-32">
              <div className="flex items-center gap-4">
                  <h3 className="text-3xl font-display font-bold text-white uppercase tracking-wide flex items-center gap-3">
                      {cat === 'Family Packs' && <Package className="text-purple-400" />}
                      {['Rubs & Sauces', 'Merch'].includes(cat as string) && <Truck className="text-bbq-gold" />}
                      {cat as string}
                  </h3>
                  <div className="h-px bg-gray-800 flex-1"></div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {availableMenu.filter(m => m.category === cat).map(item => (
                  <div 
                      key={item.id} 
                      onClick={() => handleItemClick(item)}
                      className={`group relative bg-[#1a1a1a] rounded-2xl overflow-hidden border transition-all duration-300 shadow-xl flex flex-col h-full cursor-pointer transform hover:-translate-y-1 ${item.isPack ? 'border-purple-500/30 hover:border-purple-500' : 'border-white/5 hover:border-bbq-red/50 hover:shadow-red-900/20'}`}
                  >
                      
                      {/* Image Side - Fixed Height */}
                      <div className="w-full h-48 relative overflow-hidden shrink-0">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-10" />
                      <img 
                          src={item.image || PLACEHOLDER_IMG} 
                          alt={item.name} 
                          onError={handleImageError}
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-700" 
                      />
                      {item.isPack && (
                          <div className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-20">
                              FAMILY PACK
                          </div>
                      )}
                      {['Rubs & Sauces', 'Merch'].includes(item.category) && (
                          <div className="absolute top-2 left-2 bg-bbq-gold text-black text-[10px] font-bold px-2 py-1 rounded shadow-lg z-20 flex items-center gap-1">
                              <Truck size={10}/> SHIPPABLE
                          </div>
                      )}
                      {/* Specific Date Badge */}
                      {item.availabilityType === 'specific_date' && (
                          <div className="absolute bottom-2 left-2 bg-black/80 text-bbq-gold text-[10px] font-bold px-2 py-1 rounded border border-bbq-gold z-20 backdrop-blur-md">
                              {item.specificDate ? new Date(item.specificDate).toLocaleDateString('en-AU', {month:'short', day:'numeric'}) : 'Special'} ONLY
                          </div>
                      )}
                      </div>

                      {/* Content Side (Flex-1 fills remaining height) */}
                      <div className="flex-1 p-5 flex flex-col justify-between relative">
                      
                      <div>
                          <div className="flex justify-between items-start mb-2 relative z-10">
                          <h4 className="text-xl font-display font-bold text-white leading-tight pr-4 group-hover:text-bbq-gold transition-colors">{item.name}</h4>
                          <span className="text-white font-display font-bold text-xl">${item.price}</span>
                          </div>
                          <p className="text-sm text-gray-400 leading-relaxed line-clamp-3 mb-4">{item.description}</p>
                      </div>
                      
                      {user?.role !== 'ADMIN' && (
                          <div className="mt-auto flex justify-between items-center border-t border-white/5 pt-4">
                              {item.isPack ? (
                                  <span className="text-xs text-purple-400 font-bold flex items-center gap-1"><Users size={12}/> Great for groups</span>
                              ) : (
                                  <span className="text-xs text-gray-500 font-bold flex items-center gap-1"></span>
                              )}
                              <button 
                                className={`ml-auto px-5 py-2 rounded-lg transition-all duration-300 flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${
                                    recentlyAdded === item.id 
                                    ? 'bg-green-600 text-white border border-green-500 scale-105' 
                                    : item.isPack ? 'bg-purple-900/50 text-white border border-purple-500' : 'bg-white text-black hover:bg-gray-200'
                                }`}
                              >
                                  {recentlyAdded === item.id ? <><Check size={16}/> Added!</> : <><Plus size={16} /> Select</>}
                              </button>
                          </div>
                      )}
                      </div>
                  </div>
                  ))}
              </div>
              </div>
          ))
        )}
      </div>

      {/* RIGHT CONTENT (Sticky Cart - Desktop) - SPANS 1 COLUMN */}
      <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-24 space-y-4">
              
              {/* Order Info Card */}
              <div className="bg-gradient-to-br from-gray-900 to-black p-5 rounded-xl border border-gray-700 shadow-xl">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Utensils size={14} className="text-bbq-gold"/> Order Info
                  </h4>
                  <p className="text-white font-bold text-sm">Order ahead and skip the queue</p>
                  <p className="text-gray-400 text-xs mt-1">We'll text you when it's ready for pickup.</p>
              </div>

              {/* Your Tray (Desktop) */}
              <div className="bg-bbq-charcoal rounded-xl border border-gray-700 overflow-hidden shadow-2xl">
                  <div className="p-4 bg-black/40 border-b border-gray-700 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center gap-2">
                          <ShoppingBag size={18} className="text-bbq-red"/> Your Tray
                      </h3>
                      <span className="bg-white text-black text-xs font-bold px-2 py-0.5 rounded-full">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
                  </div>
                  
                  <div className="p-4 max-h-[40vh] overflow-y-auto custom-scrollbar space-y-3">
                      {cart.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                              <p className="text-sm">Tray is empty.</p>
                              <p className="text-xs mt-1">Select items to begin.</p>
                          </div>
                      ) : (
                          cart.map((item, idx) => (
                              <div key={`${item.id}-${idx}`} className="flex justify-between items-start text-sm">
                                  <div className="flex-1">
                                      <div className="text-white font-bold flex gap-2">
                                          <span className="text-bbq-gold">{item.quantity}x</span> {item.name}
                                      </div>
                                      {item.packSelections && (
                                          <div className="text-[10px] text-gray-500 pl-4 mt-1 border-l border-gray-700">
                                              With selections
                                          </div>
                                      )}
                                  </div>
                                  <div className="text-gray-400 font-mono">${(item.price * item.quantity).toFixed(2)}</div>
                              </div>
                          ))
                      )}
                  </div>

                  {cart.length > 0 && (
                      <div className="p-4 border-t border-gray-700 bg-gray-900/50">
                          <div className="flex justify-between items-center mb-3">
                              <span className="text-gray-400 text-sm">Subtotal</span>
                              <span className="text-white font-bold text-lg">${cart.reduce((sum, i) => sum + (i.price * i.quantity), 0).toFixed(2)}</span>
                          </div>
                          <Link 
                              to="/order" 
                              className="block w-full bg-bbq-red text-white text-center py-3 rounded-lg font-bold hover:bg-red-700 transition uppercase text-sm tracking-wider"
                          >
                              Checkout
                          </Link>
                      </div>
                  )}
              </div>
          </div>
      </div>
      
      {/* ITEM MODAL */}
      {selectedItem && (
          <ItemDetailsModal 
            item={selectedItem} 
            onClose={() => setSelectedItem(null)} 
            onAddToCart={handleAddToCartFromModal}
          />
      )}
      
      {/* Sticky Cart Button (Mobile) - Updated with Date Info */}
      {user?.role !== 'ADMIN' && (
          <div className="fixed bottom-6 left-0 right-0 px-4 flex flex-col gap-2 z-40 lg:hidden pointer-events-none">
              
              {/* Mobile Next Date Banner (Only if cart empty or date not selected) */}
              {!selectedOrderDate && orderEvents.length > 0 && cart.length === 0 && (
                  <div className="bg-black/80 backdrop-blur-md border border-gray-700 p-3 rounded-xl shadow-xl flex items-center justify-between pointer-events-auto animate-in slide-in-from-bottom-4">
                      <div className="flex items-center gap-3">
                          <Calendar size={20} className="text-bbq-gold"/>
                          <div>
                              <p className="text-xs text-gray-400 uppercase font-bold">Next Cook</p>
                              <p className="text-white font-bold text-sm">{new Date(orderEvents[0].date).toLocaleDateString('en-AU', {weekday:'short', day:'numeric', month:'short'})}</p>
                          </div>
                      </div>
                      <button onClick={() => handleDateSelect(orderEvents[0].date)} className="text-xs bg-white text-black px-3 py-1.5 rounded font-bold">Order Now</button>
                  </div>
              )}

              {/* Cart Button */}
              {cart.length > 0 && (
                  <Link to="/order" className="pointer-events-auto bg-gradient-to-r from-bbq-red to-red-800 text-white shadow-2xl shadow-black rounded-full px-6 py-4 font-bold flex items-center justify-between animate-pulse border border-white/20 backdrop-blur-md">
                      <div className="flex items-center gap-3">
                          <div className="bg-white text-black w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold">{cart.length}</div>
                          <span className="uppercase tracking-wider text-sm">Checkout</span>
                      </div>
                      <div className="flex items-center gap-2">
                          <span className="font-mono text-white/80">${cart.reduce((sum, i) => sum + (i.price * i.quantity), 0).toFixed(2)}</span>
                          <ArrowRight size={18} />
                      </div>
                  </Link>
              )}
          </div>
      )}
    </div>
  );
};

export default Menu;
