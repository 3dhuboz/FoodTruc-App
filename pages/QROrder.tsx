import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { MenuItem, CartItem, Order } from '../types';
import { Plus, Minus, ShoppingCart, X, ChefHat, CheckCircle, ChevronDown, WifiOff, Clock, Home } from 'lucide-react';

const newOrderId = () => `qr_${Date.now().toString(36)}`;

// ─── Item Detail Modal (Uber Eats style — slides up) ────────
const ItemDetail: React.FC<{
  item: MenuItem;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  onClose: () => void;
}> = ({ item, qty, onAdd, onRemove, onClose }) => (
  <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
    <div className="bg-gray-900 rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
      {/* Hero Image */}
      {item.image && (
        <div className="relative h-48 shrink-0">
          <img src={item.image} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.parentElement!.style.display = 'none')} />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
          <button onClick={onClose} className="absolute top-4 left-4 w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="p-5 space-y-3 overflow-y-auto">
        {!item.image && (
          <button onClick={onClose} className="text-gray-500 hover:text-white mb-2"><X size={20} /></button>
        )}
        <h2 className="text-white font-black text-2xl leading-tight normal-case">{item.name}</h2>
        {item.description && (
          <p className="text-gray-400 text-sm leading-relaxed">{item.description}</p>
        )}
        <div className="text-orange-400 font-black text-xl">${item.price.toFixed(2)}</div>
      </div>

      {/* Sticky Add-to-Cart Bar */}
      <div className="p-4 border-t border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          {qty > 0 ? (
            <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2">
              <button onClick={onRemove} className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white active:scale-90">
                <Minus size={16} />
              </button>
              <span className="text-white font-black text-lg w-6 text-center">{qty}</span>
              <button onClick={onAdd} className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white active:scale-90">
                <Plus size={16} />
              </button>
            </div>
          ) : null}
          <button onClick={() => { onAdd(); if (qty === 0) setTimeout(onClose, 200); }}
            className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-black py-3.5 rounded-xl transition active:scale-95 text-base">
            {qty > 0 ? `Update — $${(item.price * (qty)).toFixed(2)}` : `Add to Order — $${item.price.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Cart Bottom Sheet ───────────────────────────────────────
const CartSheet: React.FC<{
  cart: CartItem[]; total: number;
  onAdd: (item: MenuItem) => void; onRemove: (id: string) => void;
  onCheckout: () => void; onClose: () => void;
}> = ({ cart, total, onAdd, onRemove, onCheckout, onClose }) => (
  <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
    <div className="bg-gray-900 rounded-t-3xl max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
      {/* Handle */}
      <div className="flex justify-center pt-3 pb-1"><div className="w-9 h-1 bg-gray-700 rounded-full" /></div>
      <div className="flex items-center justify-between px-5 py-3">
        <h2 className="text-white font-black text-xl">Your Order</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={22} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-3">
        {cart.map(item => (
          <div key={item.id} className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-3">
            {item.image && <img src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" onError={e => (e.currentTarget.style.display = 'none')} />}
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm">{item.name}</div>
              <div className="text-orange-400 text-sm font-bold">${(item.price * item.quantity).toFixed(2)}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onRemove(item.id)} className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center text-white active:scale-90"><Minus size={12} /></button>
              <span className="text-white font-bold w-4 text-center text-sm">{item.quantity}</span>
              <button onClick={() => onAdd(item)} className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center text-white active:scale-90"><Plus size={12} /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 border-t border-gray-800">
        <div className="flex justify-between text-white font-black text-xl mb-3">
          <span>Total</span><span>${total.toFixed(2)}</span>
        </div>
        <button onClick={onCheckout}
          className="w-full bg-orange-500 hover:bg-orange-400 text-white font-black text-lg py-4 rounded-2xl transition active:scale-95">
          Continue — ${total.toFixed(2)}
        </button>
      </div>
    </div>
  </div>
);

// ─── Checkout ────────────────────────────────────────────────
const Checkout: React.FC<{
  cart: CartItem[]; total: number;
  onConfirm: (name: string, phone: string) => void;
  onPayOnline: (name: string, phone: string) => void;
  onBack: () => void; submitting: boolean;
}> = ({ cart, total, onConfirm, onPayOnline, onBack, submitting }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col overflow-y-auto">
      <div className="p-6 space-y-5 max-w-md mx-auto w-full">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm">← Back</button>
        <h2 className="text-white font-black text-2xl">Almost done!</h2>

        <div className="bg-gray-900 rounded-2xl p-4 space-y-1.5 border border-gray-800">
          {cart.map((item, i) => (
            <div key={i} className="flex justify-between text-sm text-gray-300">
              <span>{item.quantity}× {item.name}</span>
              <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-gray-700 pt-2 flex justify-between font-bold text-white text-base">
            <span>Total</span><span>${total.toFixed(2)}</span>
          </div>
        </div>

        <p className="text-gray-500 text-sm">Enter your details — we'll text you when it's ready.</p>

        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoFocus
          className="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-4 text-white placeholder-gray-600 outline-none focus:border-orange-500 text-lg" />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile for SMS notification" type="tel" inputMode="tel"
          className="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-4 text-white placeholder-gray-600 outline-none focus:border-orange-500 text-lg" />

        {/* Pay Now — Stripe Checkout (Apple Pay, Google Pay, card) */}
        <button onClick={() => name.trim() && onPayOnline(name.trim(), phone.trim())} disabled={!name.trim() || submitting}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black text-xl py-5 rounded-2xl transition active:scale-95 flex items-center justify-center gap-2">
          {submitting ? 'Redirecting...' : `Pay Now — $${total.toFixed(2)}`}
        </button>
        <p className="text-center text-gray-600 text-xs -mt-2">Apple Pay, Google Pay, or card</p>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-gray-800" />
          <span className="text-gray-600 text-xs font-bold uppercase">or</span>
          <div className="flex-1 border-t border-gray-800" />
        </div>

        {/* Pay at Window */}
        <button onClick={() => name.trim() && onConfirm(name.trim(), phone.trim())} disabled={!name.trim() || submitting}
          className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white font-bold text-base py-4 rounded-2xl transition active:scale-95">
          Pay at the Window
        </button>
        <p className="text-center text-gray-600 text-xs -mt-2">Cash, card, or tap at the counter</p>
      </div>
    </div>
  );
};

// ─── Success ─────────────────────────────────────────────────
const Success: React.FC<{ orderId: string; name: string }> = ({ orderId, name }) => {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center p-8 z-50 gap-5 text-center">
      <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
        <CheckCircle size={48} className="text-green-400" />
      </div>
      <div className="text-white font-black text-3xl">Order placed!</div>
      <p className="text-gray-300">Thanks {name}!</p>
      <p className="text-gray-500 text-sm">Head to the window to pay — we'll text you when it's ready.</p>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-8 py-5">
        <div className="text-gray-500 text-sm mb-1">Your order number</div>
        <div className="text-orange-400 font-black text-4xl font-mono">#{orderId.slice(-4).toUpperCase()}</div>
      </div>
      <button onClick={() => navigate(`/order-status/${orderId}`)}
        className="bg-orange-500 text-white font-black px-8 py-4 rounded-2xl text-lg transition hover:bg-orange-400 active:scale-95 mt-2">
        Track My Order
      </button>
    </div>
  );
};

// ─── Main QR Order Page ──────────────────────────────────────
const QROrder: React.FC = () => {
  const { menu, settings, createOrder, isOnline } = useApp();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  const [successName, setSuccessName] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);

  const availableMenu = useMemo(() => menu.filter(i => i.available && !i.isPack), [menu]);
  const categories = useMemo(() => {
    const preferred = ['Burgers', 'Tacos', 'Sides', 'Kids', 'Drinks', 'Desserts', 'Specials', 'Family Packs'];
    const raw = [...new Set(availableMenu.map(i => i.category))];
    const sorted = raw.sort((a, b) => {
      const ai = preferred.indexOf(a);
      const bi = preferred.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    });
    return ['All', ...sorted];
  }, [availableMenu]);
  const filtered = useMemo(() => (
    activeCategory === 'All' ? availableMenu : availableMenu.filter(i => i.category === activeCategory)
  ), [availableMenu, activeCategory]);

  const cartQty = (id: string) => cart.find(c => c.id === id)?.quantity || 0;
  const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const addItem = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { ...item, quantity: 1 }];
    });
  };
  const removeItem = (id: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === id);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter(c => c.id !== id);
      return prev.map(c => c.id === id ? { ...c, quantity: c.quantity - 1 } : c);
    });
  };

  // Pay at Window — order goes in as "Pending" (unpaid)
  const handleConfirm = async (name: string, phone: string) => {
    setSubmitting(true);
    const orderId = newOrderId();
    const order: Order = {
      id: orderId, userId: 'qr_customer', customerName: name,
      customerPhone: phone || undefined,
      items: cart.map(c => ({ item: c, quantity: c.quantity })),
      total, status: 'Pending',
      cookDay: new Date().toISOString().split('T')[0],
      type: 'TAKEAWAY', temperature: 'HOT', fulfillmentMethod: 'PICKUP',
      createdAt: new Date().toISOString(), pickupLocation: settings.businessAddress,
    };
    try {
      await createOrder(order);
      setSuccessOrderId(orderId); setSuccessName(name); setCart([]);
    } finally { setSubmitting(false); }
  };

  // Pay Now — redirect to Stripe Checkout
  const handlePayOnline = async (name: string, phone: string) => {
    setSubmitting(true);
    const orderId = newOrderId();
    try {
      const res = await fetch('/api/v1/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          customerName: name,
          customerPhone: phone,
          items: cart.map(c => ({ name: c.name, price: c.price, quantity: c.quantity })),
          total,
          pickupLocation: settings.businessAddress,
        }),
      });
      const data = await res.json();
      if (data.url) {
        // Redirect to Stripe hosted checkout
        window.location.href = data.url;
      } else {
        alert(data.error || 'Payment setup failed. Try paying at the window.');
        setSubmitting(false);
      }
    } catch {
      alert('Could not connect to payment service. Try paying at the window.');
      setSubmitting(false);
    }
  };

  const qrPaused = (settings as any).qrOrdersPaused;

  if (successOrderId) return <Success orderId={successOrderId} name={successName} />;

  // Kitchen is backed up — show pause screen
  if (qrPaused) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-8 text-center gap-6">
        <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center">
          <Clock size={40} className="text-orange-400" />
        </div>
        <h1 className="text-white font-black text-2xl">Thanks for your patience!</h1>
        <p className="text-gray-400 max-w-sm leading-relaxed">
          We're cooking as fast as we can — the food is worth the wait, we promise! QR ordering is briefly paused so we can catch up.
        </p>
        <p className="text-orange-400 font-semibold">Head to the window to order directly</p>
        <p className="text-gray-600 text-sm mt-4">This page updates automatically — check back shortly.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-28">
      {/* Offline */}
      {!isOnline && (
        <div className="bg-yellow-600 text-black px-4 py-2 text-center text-sm font-bold flex items-center justify-center gap-2">
          <WifiOff size={14} /> Limited connectivity — your order will be queued
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-950 border-b border-gray-800 px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/20 shrink-0">
              <ChefHat size={22} className="text-orange-400" />
            </div>
            <div>
              <h1 className="text-white font-black text-xl leading-tight">{settings.businessName || 'Order Here'}</h1>
              <p className="text-gray-500 text-xs">Order ahead — we'll text you when it's ready</p>
            </div>
          </div>
          <a href="/" className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center transition" title="Back to home">
            <Home size={18} className="text-gray-400" />
          </a>
        </div>
      </div>

      {/* Category Pills — sticky */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-xl border-b border-gray-800 px-4 py-2.5 flex gap-2 overflow-x-auto scrollbar-hide">
        {categories.map(cat => (
          <button key={cat} onClick={() => { setActiveCategory(cat); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition ${
              activeCategory === cat ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'
            }`}>{cat}</button>
        ))}
      </div>

      {/* Menu Grid — 2-column cards */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(item => {
            const qty = cartQty(item.id);
            return (
              <button key={item.id} onClick={() => setDetailItem(item)}
                className={`bg-gray-900 rounded-2xl border overflow-hidden text-left transition active:scale-[0.97] ${
                  qty > 0 ? 'border-orange-500 ring-1 ring-orange-500/20' : 'border-gray-800'
                }`}>
                {item.image && (
                  <div className="relative">
                    <img src={item.image} alt="" className="w-full h-28 object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                    {qty > 0 && (
                      <span className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg">{qty}</span>
                    )}
                  </div>
                )}
                <div className="p-3">
                  <div className="text-white font-semibold text-sm leading-tight line-clamp-2">{item.name}</div>
                  {item.description && (
                    <div className="text-gray-500 text-xs line-clamp-1 mt-0.5">{item.description}</div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-orange-400 font-bold text-sm">${item.price.toFixed(2)}</span>
                    {qty === 0 && (
                      <span className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center text-white">
                        <Plus size={14} />
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Cart Button */}
      {cartCount > 0 && !showCart && !showCheckout && !detailItem && (
        <div className="fixed bottom-6 left-4 right-4 z-40 max-w-md mx-auto">
          <button onClick={() => setShowCart(true)}
            className="w-full bg-orange-500 text-white font-black py-4 px-5 rounded-2xl shadow-2xl shadow-orange-500/30 flex items-center gap-3 active:scale-95 transition">
            <span className="bg-white/20 rounded-full w-7 h-7 flex items-center justify-center text-sm">{cartCount}</span>
            <span className="flex-1 text-left text-base">View Order</span>
            <span className="text-base">${total.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Item Detail Modal */}
      {detailItem && (
        <ItemDetail
          item={detailItem}
          qty={cartQty(detailItem.id)}
          onAdd={() => addItem(detailItem)}
          onRemove={() => removeItem(detailItem.id)}
          onClose={() => setDetailItem(null)}
        />
      )}

      {/* Cart Sheet */}
      {showCart && !showCheckout && (
        <CartSheet cart={cart} total={total} onAdd={addItem} onRemove={removeItem}
          onCheckout={() => { setShowCart(false); setShowCheckout(true); }}
          onClose={() => setShowCart(false)} />
      )}

      {/* Checkout */}
      {showCheckout && (
        <Checkout cart={cart} total={total} onConfirm={handleConfirm} onPayOnline={handlePayOnline}
          onBack={() => { setShowCheckout(false); setShowCart(true); }} submitting={submitting} />
      )}
    </div>
  );
};

export default QROrder;
