import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Order } from '../types';
import { Lock, Bell, BellOff, Wifi, WifiOff } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-8">
      <div className="text-white text-3xl font-black tracking-wider">KITCHEN</div>
      <div className={`flex gap-3 ${shake ? 'animate-bounce' : ''}`}>
        {Array.from({ length: pin.length }).map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 ${i < entered.length ? 'bg-orange-400 border-orange-400' : 'border-gray-700'}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <button key={i} onClick={() => d === '⌫' ? setEntered(e => e.slice(0, -1)) : d ? handleDigit(d) : undefined} disabled={!d}
            className={`w-20 h-20 rounded-2xl text-2xl font-bold ${d ? 'bg-gray-900 text-white hover:bg-gray-800 active:scale-95' : 'invisible'}`}>{d}</button>
        ))}
      </div>
    </div>
  );
};

// ─── Elapsed time formatting ─────────────────────────────────
const formatTime = (createdAt: string): { text: string; urgency: 'fresh' | 'normal' | 'late' | 'overdue' } => {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins < 1) return { text: 'JUST IN', urgency: 'fresh' };
  if (mins < 8) return { text: `${mins}m`, urgency: 'fresh' };
  if (mins < 15) return { text: `${mins}m`, urgency: 'normal' };
  if (mins < 25) return { text: `${mins}m`, urgency: 'late' };
  return { text: `${mins}m`, urgency: 'overdue' };
};

const urgencyColor = (u: string) => {
  if (u === 'fresh') return 'text-green-400';
  if (u === 'normal') return 'text-yellow-400';
  if (u === 'late') return 'text-orange-400';
  return 'text-red-400 animate-pulse';
};

const urgencyBorder = (u: string) => {
  if (u === 'fresh') return 'border-gray-700';
  if (u === 'normal') return 'border-yellow-800';
  if (u === 'late') return 'border-orange-700';
  return 'border-red-700';
};

// ─── Main BOH ────────────────────────────────────────────────
const BOH: React.FC = () => {
  const { orders, updateOrderStatus, settings, isOnline, pendingSyncCount } = useApp();
  const [unlocked, setUnlocked] = useState(false);
  const [bumping, setBumping] = useState<string | null>(null);
  const [bumped, setBumped] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [elapsed, setElapsed] = useState<Record<string, ReturnType<typeof formatTime>>>({});
  const prevIds = useRef<Set<string>>(new Set());
  const audioCtx = useRef<AudioContext | null>(null);

  const staffPin = settings?.rewards?.staffPin || '1234';

  // Active orders = Confirmed or Cooking, sorted oldest first
  const activeOrders = orders
    .filter(o => o.status === 'Confirmed' || o.status === 'Cooking')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Elapsed timer
  useEffect(() => {
    const tick = () => {
      const map: Record<string, ReturnType<typeof formatTime>> = {};
      activeOrders.forEach(o => { map[o.id] = formatTime(o.createdAt); });
      setElapsed(map);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [orders]);

  // Chime on new orders
  useEffect(() => {
    const ids = new Set(activeOrders.map(o => o.id));
    const newOnes = activeOrders.filter(o => !prevIds.current.has(o.id));
    if (newOnes.length > 0 && unlocked && soundEnabled) playChime();
    prevIds.current = ids;
  }, [orders, unlocked, soundEnabled]);

  const playChime = () => {
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const ctx = audioCtx.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
    } catch {}
  };

  // BUMP = advance order status: Confirmed → Cooking (+ print label) → Ready (+ notify customer)
  const handleBump = async (order: Order) => {
    setBumping(order.id);

    // Determine target status based on current status
    const targetStatus = order.status === 'Confirmed' ? 'Cooking' : 'Ready';

    // Only animate out if going to Ready (leaving the board)
    if (targetStatus === 'Ready') setBumped(order.id);

    try {
      await updateOrderStatus(order.id, targetStatus);

      // When moving to COOKING → print label + SMS customer
      if (targetStatus === 'Cooking') {
        const cookingPayload = { ...order, status: 'Cooking' };
        // Fire and forget — don't block the UI
        Promise.allSettled([
          fetch('/api/v1/print/order', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cookingPayload),
          }),
          order.customerPhone && settings.smsSettings?.enabled
            ? fetch('/api/v1/sms/cooking-started', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: settings.smsSettings, order: cookingPayload, businessName: settings.businessName }),
              })
            : Promise.resolve(),
        ]).catch(() => {});
      }

      // When moving to READY → notify customer via SMS + email
      if (targetStatus === 'Ready' && order.customerPhone && settings.smsSettings?.enabled) {
        const payload = { ...order, status: 'Ready', pickupLocation: order.pickupLocation || settings.businessAddress };
        await Promise.allSettled([
          fetch('/api/v1/sms/order-ready', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: settings.smsSettings, order: payload, businessName: settings.businessName }),
          }),
          fetch('/api/v1/email/order-ready', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: settings.emailSettings, order: payload, businessName: settings.businessName }),
          }),
        ]);
      }
    } finally {
      setBumping(null);
      if (targetStatus === 'Ready') setTimeout(() => setBumped(null), 600);
    }
  };

  if (!unlocked) return <PinGate pin={staffPin} onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden select-none">
      {/* Top Bar — minimal */}
      <div className="bg-black border-b border-gray-800/50 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black tracking-wider">KITCHEN</span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${isOnline ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
            {isOnline ? <><Wifi size={10} className="inline mr-1" />LIVE</> : <><WifiOff size={10} className="inline mr-1" />LOCAL</>}
          </span>
          {pendingSyncCount > 0 && (
            <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2.5 py-1 rounded-full font-bold">{pendingSyncCount} queued</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-4xl font-black tabular-nums text-orange-400">{activeOrders.length}</span>
          <span className="text-gray-500 text-sm font-bold uppercase">orders</span>
          <button onClick={() => setSoundEnabled(s => !s)} className="ml-4 text-gray-600 hover:text-white transition p-2">
            {soundEnabled ? <Bell size={20} /> : <BellOff size={20} />}
          </button>
          <button onClick={() => setUnlocked(false)} className="text-gray-700 hover:text-gray-500 transition p-2">
            <Lock size={18} />
          </button>
        </div>
      </div>

      {/* Orders Grid */}
      {activeOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-6xl opacity-10">🍳</div>
          <div className="text-gray-600 text-xl font-bold">Waiting for orders</div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-min">
            {activeOrders.map(order => {
              const time = elapsed[order.id] || { text: '...', urgency: 'fresh' as const };
              const isBumped = bumped === order.id;
              const isBumping = bumping === order.id;

              return (
                <div
                  key={order.id}
                  className={`bg-gray-900 rounded-2xl border-2 ${urgencyBorder(time.urgency)} flex flex-col overflow-hidden transition-all duration-500 ${
                    isBumped ? 'opacity-0 scale-75 -translate-y-8' : 'opacity-100 scale-100'
                  }`}
                >
                  {/* Header */}
                  <div className="px-5 pt-4 pb-2 flex items-start justify-between">
                    <div>
                      <div className="text-3xl font-black tracking-tight">{order.collectionPin || '#' + order.id.slice(-4).toUpperCase()}</div>
                      <div className="text-gray-400 text-base font-semibold mt-0.5">{order.customerName}</div>
                      {order.status === 'Cooking' && <div className="text-orange-400 text-xs font-bold mt-1 animate-pulse">COOKING</div>}
                    </div>
                    <div className={`text-right ${urgencyColor(time.urgency)}`}>
                      <div className="text-2xl font-black tabular-nums">{time.text}</div>
                    </div>
                  </div>

                  {/* Items — THIS IS THE HERO */}
                  <div className="px-5 py-3 flex-1">
                    {order.items.map((line, i) => (
                      <div key={i} className="flex items-baseline gap-3 py-1.5 border-b border-gray-800/50 last:border-0">
                        <span className="text-orange-400 font-black text-xl min-w-[2rem] text-right">{line.quantity}×</span>
                        <span className="text-white font-bold text-lg">{line.item.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Source tag */}
                  {(order as any).source === 'qr' && (
                    <div className="px-5 pb-1">
                      <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full uppercase">QR Order</span>
                    </div>
                  )}

                  {/* BUMP Button — changes based on status */}
                  <div className="p-4 pt-2">
                    <button
                      onClick={() => handleBump(order)}
                      disabled={isBumping}
                      className={`w-full py-5 rounded-xl font-black text-xl tracking-wide transition active:scale-95 disabled:opacity-50 ${
                        order.status === 'Confirmed'
                          ? 'bg-orange-500 hover:bg-orange-400 text-black'
                          : 'bg-green-500 hover:bg-green-400 text-black'
                      }`}
                    >
                      {isBumping ? '...' : order.status === 'Confirmed' ? 'START COOKING' : 'READY'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default BOH;
