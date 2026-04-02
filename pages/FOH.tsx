import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { MenuItem, Order, CartItem } from '../types';
import {
  Plus, Minus, Trash2, ShoppingCart, ChefHat, X, CheckCircle, Search, Lock,
  Bell, Wifi, WifiOff, CloudOff, ClipboardList, Flame, Clock, Package, Users,
  CreditCard, Loader2, PauseCircle, PlayCircle
} from 'lucide-react';
import { isNativePaymentAvailable, initTerminal, connectTapToPay, collectPayment } from '../services/stripeTerminal';

const newOrderId = () => `wu_${Date.now().toString(36)}`;

const formatElapsed = (createdAt: string): string => {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  return `${Math.floor(diff / 60)}m`;
};

// ─── PIN Gate ────────────────────────────────────────────────
const PinGate: React.FC<{ pin: string; onUnlock: () => void }> = ({ pin, onUnlock }) => {
  const [entered, setEntered] = useState('');
  const [shake, setShake] = useState(false);
  const handleDigit = (d: string) => {
    const next = entered + d;
    if (next.length < pin.length) { setEntered(next); return; }
    if (next === pin) { onUnlock(); return; }
    setShake(true); setEntered('');
    setTimeout(() => setShake(false), 500);
  };
  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center gap-8">
      <div className="flex items-center gap-3 text-white text-2xl font-bold">
        <ChefHat size={32} className="text-orange-400" /> ChowNow POS
      </div>
      <div className={`flex gap-3 ${shake ? 'animate-bounce' : ''}`}>
        {Array.from({ length: pin.length }).map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 ${i < entered.length ? 'bg-orange-400 border-orange-400' : 'border-gray-600'}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <button key={i} onClick={() => d === '⌫' ? setEntered(e => e.slice(0, -1)) : d ? handleDigit(d) : undefined} disabled={!d}
            className={`w-20 h-20 rounded-2xl text-2xl font-bold transition ${d ? 'bg-gray-800 text-white hover:bg-gray-700 active:scale-95' : 'invisible'}`}>{d}</button>
        ))}
      </div>
      <p className="text-gray-500 text-sm">Enter staff PIN</p>
    </div>
  );
};

// ─── Customer Detail Modal ───────────────────────────────────
const CustomerModal: React.FC<{
  cart: CartItem[]; total: number;
  onConfirm: (name: string, phone: string, notes: string) => void;
  onClose: () => void;
}> = ({ cart, total, onConfirm, onClose }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Customer Details</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={22} /></button>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 space-y-1 max-h-32 overflow-y-auto">
          {cart.map((item, i) => (
            <div key={i} className="flex justify-between text-sm text-gray-300">
              <span>{item.quantity}× {item.name}</span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-gray-700 pt-2 mt-2 flex justify-between text-white font-bold">
            <span>Total</span><span>${total.toFixed(2)}</span>
          </div>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Customer name *" autoFocus
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-orange-500 text-lg" />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile (for SMS when ready)" type="tel"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-orange-500 text-lg" />
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special instructions..." rows={2}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-orange-500 resize-none" />
        <button onClick={() => name.trim() && onConfirm(name.trim(), phone.trim(), notes.trim())} disabled={!name.trim()}
          className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-black text-xl py-4 rounded-xl transition active:scale-95">
          Send to Kitchen — ${total.toFixed(2)}
        </button>
      </div>
    </div>
  );
};

// ─── Success Flash ───────────────────────────────────────────
const SuccessFlash: React.FC<{ orderNum: string; onDismiss: () => void }> = ({ orderNum, onDismiss }) => (
  <div className="fixed inset-0 bg-green-950/90 flex flex-col items-center justify-center z-50 gap-6 cursor-pointer" onClick={onDismiss}>
    <CheckCircle size={80} className="text-green-400" />
    <div className="text-white text-4xl font-black">Order Sent!</div>
    <div className="text-green-300 text-3xl font-mono">#{orderNum}</div>
    <p className="text-green-400 text-sm">Tap anywhere to continue</p>
  </div>
);

// ─── Order Queue Panel (right side) ──────────────────────────
const OrderQueue: React.FC<{
  orders: Order[];
  onMarkReady: (order: Order) => void;
  onMarkComplete: (order: Order) => void;
  onMarkPaid: (order: Order) => void;
  onCharge: (order: Order) => void;
  charging: string | null;
}> = ({ orders, onMarkReady, onMarkComplete, onMarkPaid, onCharge, charging }) => {
  const hasNfcPayment = isNativePaymentAvailable();
  const [elapsed, setElapsed] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      const map: Record<string, string> = {};
      orders.forEach(o => { map[o.id] = formatElapsed(o.createdAt); });
      setElapsed(map);
    }, 1000);
    return () => clearInterval(timer);
  }, [orders]);

  const pending = orders.filter(o => o.status === 'Pending');
  const confirmed = orders.filter(o => o.status === 'Confirmed');
  const cooking = orders.filter(o => o.status === 'Cooking');
  const ready = orders.filter(o => o.status === 'Ready');

  const isQrOrder = (o: Order) => o.userId === 'qr_customer' || (o as any).source === 'qr';

  const renderOrder = (order: Order) => {
    const qr = isQrOrder(order);
    const borderColor =
      order.status === 'Pending' ? 'border-purple-500 bg-purple-950/30' :
      order.status === 'Confirmed' ? 'border-yellow-500 bg-yellow-950/30' :
      order.status === 'Cooking' ? 'border-orange-500 bg-orange-950/30' :
      order.status === 'Ready' ? 'border-green-500 bg-green-950/30' : 'border-gray-700';
    const badge =
      order.status === 'Pending' ? 'bg-purple-500 text-white' :
      order.status === 'Confirmed' ? 'bg-yellow-500 text-black' :
      order.status === 'Cooking' ? 'bg-orange-500 text-white' :
      'bg-green-500 text-white';
    const badgeLabel =
      order.status === 'Pending' ? 'UNPAID' :
      order.status === 'Confirmed' ? 'NEW' :
      order.status === 'Cooking' ? 'COOKING' : 'READY';

    return (
      <div key={order.id} className={`rounded-xl border p-3 ${borderColor} transition`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${badge}`}>{badgeLabel}</span>
            <span className="text-white font-black text-sm">#{order.id.slice(-4).toUpperCase()}</span>
            {qr && <span className="text-[9px] font-bold bg-blue-500/10 text-blue-400 px-1 py-0.5 rounded">QR</span>}
          </div>
          <span className="text-gray-500 text-xs font-mono">{elapsed[order.id] || '0s'}</span>
        </div>
        <div className="text-gray-300 text-xs font-semibold mb-1">{order.customerName}</div>
        <div className="text-gray-500 text-[10px] mb-2">
          {order.items.map((l, i) => <span key={i}>{i > 0 && ' · '}{l.quantity}× {l.item.name}</span>)}
        </div>
        <div className="text-orange-400 text-xs font-bold mb-2">${order.total.toFixed(2)}</div>
        {order.status === 'Pending' && (
          <div className="space-y-1.5">
            {hasNfcPayment && (
              <button onClick={() => onCharge(order)} disabled={charging === order.id}
                className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-60 text-white text-xs font-bold py-2.5 rounded-lg transition active:scale-95 flex items-center justify-center gap-1.5">
                {charging === order.id ? <><Loader2 size={12} className="animate-spin" /> Tap card...</> : <><CreditCard size={12} /> Charge ${order.total.toFixed(2)}</>}
              </button>
            )}
            <button onClick={() => onMarkPaid(order)}
              className="w-full bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold py-2 rounded-lg transition active:scale-95">
              {hasNfcPayment ? 'Cash / External EFTPOS' : 'Mark Paid → Kitchen'}
            </button>
          </div>
        )}
        {order.status === 'Ready' && (
          <button onClick={() => onMarkComplete(order)}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-2 rounded-lg transition active:scale-95">
            Collected
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-2">
        <ClipboardList size={16} className="text-orange-400" />
        <span className="text-white font-black text-sm">Orders</span>
        <span className="text-gray-500 text-xs ml-auto">{orders.length} active</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {orders.length === 0 && (
          <div className="text-center text-gray-600 text-xs mt-8">No active orders</div>
        )}

        {pending.length > 0 && (
          <>
            <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1">
              <Users size={10} /> Awaiting Payment ({pending.length})
            </div>
            {pending.map(renderOrder)}
          </>
        )}

        {ready.length > 0 && (
          <>
            <div className="text-[10px] font-black text-green-500 uppercase tracking-widest flex items-center gap-1 mt-2">
              <Package size={10} /> Ready ({ready.length})
            </div>
            {ready.map(renderOrder)}
          </>
        )}

        {cooking.length > 0 && (
          <>
            <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1 mt-2">
              <Flame size={10} /> Cooking ({cooking.length})
            </div>
            {cooking.map(renderOrder)}
          </>
        )}

        {confirmed.length > 0 && (
          <>
            <div className="text-[10px] font-black text-yellow-500 uppercase tracking-widest flex items-center gap-1 mt-2">
              <Clock size={10} /> In Kitchen ({confirmed.length})
            </div>
            {confirmed.map(renderOrder)}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Main FOH POS ────────────────────────────────────────────
const FOH: React.FC = () => {
  const { menu, orders, createOrder, updateOrderStatus, settings, updateSettings, isOnline, pendingSyncCount } = useApp();
  const [unlocked, setUnlocked] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [showCustomer, setShowCustomer] = useState(false);
  const [lastOrderNum, setLastOrderNum] = useState<string | null>(null);
  const [readyAlerts, setReadyAlerts] = useState<Order[]>([]);
  const [activePanel, setActivePanel] = useState<'cart' | 'orders'>('cart');
  const prevReadyIds = useRef<Set<string>>(new Set());
  const audioCtx = useRef<AudioContext | null>(null);

  const staffPin = settings?.rewards?.staffPin || '1234';

  // Today's active orders
  const today = new Date().toISOString().split('T')[0];
  const activeOrders = useMemo(() =>
    orders.filter(o =>
      ['Pending', 'Confirmed', 'Cooking', 'Ready'].includes(o.status) &&
      (o.cookDay === today || o.createdAt?.startsWith(today))
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [orders, today]
  );

  // Detect ready orders — alert FOH
  useEffect(() => {
    const readyOrders = orders.filter(o => o.status === 'Ready');
    const newlyReady = readyOrders.filter(o => !prevReadyIds.current.has(o.id));
    if (newlyReady.length > 0 && unlocked) {
      setReadyAlerts(prev => [...prev, ...newlyReady]);
      try {
        if (!audioCtx.current) audioCtx.current = new AudioContext();
        const ctx = audioCtx.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.setValueAtTime(1500, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(1800, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.8);
      } catch {}
    }
    prevReadyIds.current = new Set(readyOrders.map(o => o.id));
  }, [orders, unlocked]);

  const dismissAlert = (id: string) => setReadyAlerts(prev => prev.filter(o => o.id !== id));

  const availableMenu = useMemo(() => menu.filter(i => i.available && !i.isPack), [menu]);
  const categories = useMemo(() => ['All', ...new Set(availableMenu.map(i => i.category))], [availableMenu]);
  const filtered = useMemo(() => {
    let items = availableMenu;
    if (activeCategory !== 'All') items = items.filter(i => i.category === activeCategory);
    if (search) items = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    return items;
  }, [availableMenu, activeCategory, search]);

  const cartQty = (id: string) => cart.find(c => c.id === id)?.quantity || 0;
  const addItem = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { ...item, quantity: 1 }];
    });
    setActivePanel('cart');
  };
  const removeItem = (id: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === id);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter(c => c.id !== id);
      return prev.map(c => c.id === id ? { ...c, quantity: c.quantity - 1 } : c);
    });
  };

  const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const readyCount = activeOrders.filter(o => o.status === 'Ready').length;

  const handleConfirm = (name: string, phone: string, notes: string) => {
    const orderId = newOrderId();
    const order: Order = {
      id: orderId, userId: 'walk_up', customerName: name,
      customerPhone: phone || undefined, customerEmail: undefined,
      items: cart.map(c => ({ item: c, quantity: c.quantity })),
      total, status: 'Confirmed',
      cookDay: new Date().toISOString().split('T')[0],
      type: 'TAKEAWAY', temperature: 'HOT', fulfillmentMethod: 'PICKUP',
      createdAt: new Date().toISOString(),
      pickupLocation: settings.businessAddress,
      ...(notes ? { pickupTime: notes } : {}),
    };
    createOrder(order);
    setCart([]); setShowCustomer(false);
    setLastOrderNum(orderId.slice(-4).toUpperCase());
  };

  const [charging, setCharging] = useState<string | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);

  // Init Stripe Terminal on mount if native
  useEffect(() => {
    if (isNativePaymentAvailable() && unlocked) {
      initTerminal().then(ok => {
        if (ok) connectTapToPay().then(setTerminalReady);
      });
    }
  }, [unlocked]);

  const handleCharge = async (order: Order) => {
    setCharging(order.id);
    try {
      const result = await collectPayment(order.total, order.id);
      if (result.success) {
        // Payment collected — send to kitchen
        await updateOrderStatus(order.id, 'Confirmed');
        // Play success chime
        try {
          if (!audioCtx.current) audioCtx.current = new AudioContext();
          const ctx = audioCtx.current;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
        } catch {}
      } else {
        alert(result.error || 'Payment failed');
      }
    } finally {
      setCharging(null);
    }
  };

  const handleMarkPaid = (order: Order) => {
    updateOrderStatus(order.id, 'Confirmed');
  };

  const handleMarkComplete = (order: Order) => {
    updateOrderStatus(order.id, 'Completed');
  };

  if (!unlocked) return <PinGate pin={staffPin} onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Ready Alerts */}
      {readyAlerts.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50">
          {readyAlerts.map(order => (
            <div key={order.id} className="bg-green-500 text-black px-6 py-3 flex items-center justify-between cursor-pointer" onClick={() => dismissAlert(order.id)}>
              <div className="flex items-center gap-3">
                <Bell size={22} className="animate-bounce" />
                <span className="font-black">READY — #{order.id.slice(-4).toUpperCase()} ({order.customerName})</span>
              </div>
              <span className="text-green-900 font-bold text-sm">Dismiss</span>
            </div>
          ))}
        </div>
      )}

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-yellow-600 text-black px-4 py-2 text-center text-sm font-bold flex items-center justify-center gap-2">
          <WifiOff size={14} /> OFFLINE MODE — Orders queued locally
          {pendingSyncCount > 0 && <span className="bg-black/20 px-2 py-0.5 rounded-full text-xs">{pendingSyncCount} pending</span>}
        </div>
      )}

      {/* Top Bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ChefHat size={20} className="text-orange-400" />
          <span className="text-white font-black">{settings.businessName || 'POS'}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isOnline ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
            {isOnline ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* QR Order Throttle Toggle */}
          <button
            onClick={() => updateSettings({ qrOrdersPaused: !(settings as any).qrOrdersPaused })}
            className={`text-[10px] px-3 py-1.5 rounded-full font-bold flex items-center gap-1 transition active:scale-95 ${
              (settings as any).qrOrdersPaused
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {(settings as any).qrOrdersPaused
              ? <><PauseCircle size={12} /> QR Paused</>
              : <><PlayCircle size={12} /> QR Open</>
            }
          </button>
          {pendingSyncCount > 0 && (
            <span className="text-[10px] bg-yellow-900 text-yellow-400 px-2 py-1 rounded-full font-bold flex items-center gap-1">
              <CloudOff size={8} /> {pendingSyncCount}
            </span>
          )}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              className="bg-gray-800 rounded-lg pl-7 pr-3 py-1.5 text-white text-xs outline-none focus:ring-1 focus:ring-orange-500 w-32" />
          </div>
          <button onClick={() => setUnlocked(false)} className="text-gray-600 hover:text-gray-400"><Lock size={16} /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Menu Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Category Tabs */}
          <div className="flex gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide border-b border-gray-800 bg-gray-900/50 shrink-0">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  activeCategory === cat ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}>{cat}</button>
            ))}
          </div>

          {/* Menu Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {filtered.map(item => {
                const qty = cartQty(item.id);
                return (
                  <button key={item.id} onClick={() => addItem(item)}
                    className={`relative bg-gray-900 border rounded-xl p-2 text-left transition active:scale-95 ${
                      qty > 0 ? 'border-orange-500 ring-1 ring-orange-500/30' : 'border-gray-800 hover:border-gray-600'
                    }`}>
                    {item.image && <img src={item.image} alt={item.name} className="w-full h-16 object-cover rounded-lg mb-1.5" />}
                    {qty > 0 && (
                      <span className="absolute top-1 right-1 bg-orange-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">{qty}</span>
                    )}
                    <div className="text-white font-semibold text-[11px] leading-tight line-clamp-2">{item.name}</div>
                    <div className="text-orange-400 font-bold text-xs mt-0.5">${item.price.toFixed(2)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel — Cart / Orders toggle */}
        <div className="w-72 lg:w-80 border-l border-gray-800 bg-gray-900 flex flex-col shrink-0">
          {/* Panel Toggle */}
          <div className="flex border-b border-gray-800 shrink-0">
            <button onClick={() => setActivePanel('cart')}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition ${
                activePanel === 'cart' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-500 hover:text-gray-300'
              }`}>
              <ShoppingCart size={14} /> Cart {cartCount > 0 && <span className="bg-orange-500 text-white rounded-full px-1.5 text-[10px]">{cartCount}</span>}
            </button>
            <button onClick={() => setActivePanel('orders')}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition ${
                activePanel === 'orders' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-500 hover:text-gray-300'
              }`}>
              <ClipboardList size={14} /> Orders
              {readyCount > 0 && <span className="bg-green-500 text-white rounded-full px-1.5 text-[10px] animate-pulse">{readyCount}</span>}
              {activeOrders.length > 0 && readyCount === 0 && <span className="bg-gray-600 text-white rounded-full px-1.5 text-[10px]">{activeOrders.length}</span>}
            </button>
          </div>

          {/* Cart Panel */}
          {activePanel === 'cart' && (
            <div className="flex flex-col flex-1">
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {cart.length === 0 && <p className="text-gray-600 text-xs text-center mt-8">Tap menu items to add</p>}
                {cart.map(item => (
                  <div key={item.id} className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-semibold truncate">{item.name}</div>
                      <div className="text-orange-400 text-[10px] font-bold">${(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => removeItem(item.id)} className="w-6 h-6 bg-gray-700 rounded flex items-center justify-center text-white hover:bg-gray-600"><Minus size={10} /></button>
                      <span className="text-white font-bold w-4 text-center text-xs">{item.quantity}</span>
                      <button onClick={() => addItem(item)} className="w-6 h-6 bg-gray-700 rounded flex items-center justify-center text-white hover:bg-gray-600"><Plus size={10} /></button>
                      <button onClick={() => setCart(prev => prev.filter(c => c.id !== item.id))} className="w-6 h-6 bg-red-900/30 rounded flex items-center justify-center text-red-400 hover:bg-red-900/60 ml-0.5"><Trash2 size={10} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-gray-800 space-y-2">
                <div className="flex justify-between text-white font-black text-lg">
                  <span>Total</span><span>${total.toFixed(2)}</span>
                </div>
                <button onClick={() => cart.length > 0 && setShowCustomer(true)} disabled={cart.length === 0}
                  className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-black text-base py-3.5 rounded-xl transition active:scale-95">
                  Send to Kitchen
                </button>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="w-full text-gray-500 hover:text-red-400 text-xs font-semibold py-1.5 transition">Clear</button>
                )}
              </div>
            </div>
          )}

          {/* Orders Panel */}
          {activePanel === 'orders' && (
            <OrderQueue orders={activeOrders} onMarkReady={() => {}} onMarkComplete={handleMarkComplete} onMarkPaid={handleMarkPaid} onCharge={handleCharge} charging={charging} />
          )}
        </div>
      </div>

      {showCustomer && <CustomerModal cart={cart} total={total} onConfirm={handleConfirm} onClose={() => setShowCustomer(false)} />}
      {lastOrderNum && <SuccessFlash orderNum={lastOrderNum} onDismiss={() => setLastOrderNum(null)} />}
    </div>
  );
};

export default FOH;
