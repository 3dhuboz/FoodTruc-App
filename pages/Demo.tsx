import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, QrCode, Monitor, Smartphone, Bell, ChefHat, CheckCircle, ShoppingCart, MessageSquare, Zap, Users, CreditCard, Package } from 'lucide-react';

const STEPS = [
  {
    id: 'arrive',
    title: 'Customer arrives at the market',
    subtitle: 'Lunch rush. Every truck has a queue.',
    narration: 'It\'s Saturday at the local food truck market. Your customer is hungry. The burger truck next door has a 15-person line. People are walking away.',
    screen: null,
    visual: 'scene',
    sceneEmoji: '🚛🚛🚛',
    sceneBg: 'from-amber-950 to-gray-950',
    sceneDetail: (
      <div className="space-y-3">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-2"><Users size={16} /> Competitor\'s Truck</div>
          <div className="flex gap-1 flex-wrap">
            {Array.from({length: 15}).map((_, i) => <div key={i} className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center text-[10px]">👤</div>)}
          </div>
          <p className="text-red-400/60 text-xs mt-2">15 in line. 3 just walked away. ~25 min wait.</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-400 font-bold text-sm mb-2"><Zap size={16} /> Your Truck (ChowNow)</div>
          <div className="flex gap-1">
            <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center text-[10px]">👤</div>
          </div>
          <p className="text-green-400/60 text-xs mt-2">No queue. Just a QR code on the counter.</p>
        </div>
      </div>
    ),
  },
  {
    id: 'scan',
    title: 'They scan your QR code',
    subtitle: '2 seconds. No app. No signup.',
    narration: 'Your customer spots the "Scan to Order" sign on your truck. They pull out their phone, point the camera at the QR code, and your menu opens instantly in their browser.',
    visual: 'phone',
    sceneBg: 'from-orange-950 to-gray-950',
    sceneDetail: (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 max-w-xs mx-auto">
        <div className="flex items-center justify-center mb-4">
          <div className="w-32 h-32 bg-white rounded-2xl p-3 flex items-center justify-center">
            <QrCode size={80} className="text-gray-900" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-lg">📱 Scan to Order</p>
          <p className="text-gray-500 text-sm mt-1">Camera opens → menu loads → done</p>
          <div className="mt-3 flex items-center justify-center gap-2 text-green-400 text-sm font-bold">
            <CheckCircle size={14} /> No app download needed
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'browse',
    title: 'They browse your menu',
    subtitle: 'Photos. Prices. Descriptions. On their phone.',
    narration: 'Your full menu appears with photos, descriptions, and prices. They tap through categories, read about your smoked brisket, and start adding items to their cart.',
    visual: 'phone',
    sceneBg: 'from-orange-950 to-gray-950',
    sceneDetail: (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden max-w-xs mx-auto">
        <div className="bg-gray-950 px-4 py-3 border-b border-gray-800">
          <p className="text-white font-bold text-sm">Your Truck Name</p>
          <p className="text-gray-500 text-xs">Order ahead — we'll text you</p>
        </div>
        <div className="flex gap-2 px-3 py-2 overflow-hidden">
          {['All', 'Burgers', 'Sides', 'Drinks'].map(c => (
            <span key={c} className={`text-xs px-3 py-1 rounded-full whitespace-nowrap ${c === 'All' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>{c}</span>
          ))}
        </div>
        <div className="p-3 space-y-2">
          {[
            { name: 'Smash Burger', price: '$16.50', desc: 'Double patty, cheese, sauce' },
            { name: 'Loaded Fries', price: '$12.00', desc: 'Pulled pork, cheese, jalapeños' },
            { name: 'Cold Brew', price: '$5.00', desc: 'House-made, served over ice' },
          ].map((item, i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-bold">{item.name}</p>
                <p className="text-gray-500 text-[10px]">{item.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-400 text-sm font-bold">{item.price}</span>
                <div className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">+</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 pt-0">
          <div className="bg-orange-500 rounded-xl py-2.5 text-center">
            <span className="text-white text-sm font-bold">View Cart — 3 items ($33.50)</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'order',
    title: 'They place their order',
    subtitle: 'Name. Phone. Done. They go sit down.',
    narration: 'They enter their name and phone number, tap "Place Order," and they\'re done. They can go sit with friends, browse other stalls, or check their phone. No standing in line.',
    visual: 'phone',
    sceneBg: 'from-blue-950 to-gray-950',
    sceneDetail: (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden max-w-xs mx-auto">
        <div className="p-5 space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-green-500/20">
              <CheckCircle size={28} className="text-green-400" />
            </div>
            <p className="text-white font-bold text-lg">Order Placed!</p>
            <p className="text-gray-500 text-sm">Order #47</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 space-y-1">
            <div className="flex justify-between text-sm"><span className="text-gray-400">Smash Burger</span><span className="text-white">$16.50</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Loaded Fries</span><span className="text-white">$12.00</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Cold Brew</span><span className="text-white">$5.00</span></div>
            <div className="border-t border-gray-700 pt-1 mt-1 flex justify-between text-sm font-bold"><span className="text-white">Total</span><span className="text-orange-400">$33.50</span></div>
          </div>
          <p className="text-center text-green-400 text-sm font-bold flex items-center justify-center gap-2"><MessageSquare size={14} /> We'll text you when it's ready</p>
        </div>
      </div>
    ),
  },
  {
    id: 'kitchen',
    title: 'Kitchen sees it instantly',
    subtitle: 'Order appears on the kitchen display. Cook taps "Start."',
    narration: 'The moment your customer places their order, it appears on your kitchen display screen. Your cook taps it to start cooking. The customer instantly gets an SMS: "Your order is being prepared!"',
    visual: 'screen',
    sceneBg: 'from-orange-950 to-gray-950',
    sceneDetail: (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="bg-gray-950 px-4 py-2 border-b border-gray-800 flex items-center gap-2">
          <Monitor size={14} className="text-orange-400" />
          <span className="text-white text-xs font-bold">Kitchen Display</span>
        </div>
        <div className="p-3 space-y-2">
          {[
            { name: 'Sarah #45', status: 'READY', color: 'bg-green-500', items: '1x Tacos, 1x Drink' },
            { name: 'Mike #46', status: 'COOKING', color: 'bg-orange-500', items: '2x Burger, 1x Fries' },
            { name: 'Jake #47', status: 'NEW', color: 'bg-blue-500', items: '1x Burger, 1x Fries, 1x Brew', highlight: true },
          ].map((o, i) => (
            <div key={i} className={`bg-gray-800 rounded-xl p-3 ${o.highlight ? 'ring-2 ring-blue-500/50 animate-pulse' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white text-sm font-bold">{o.name}</span>
                <span className={`${o.color} text-white text-[9px] font-black px-2.5 py-0.5 rounded-full`}>{o.status}</span>
              </div>
              <p className="text-gray-500 text-xs">{o.items}</p>
              {o.highlight && <p className="text-blue-400 text-xs mt-1 font-bold">← Just arrived! Tap to start cooking</p>}
            </div>
          ))}
        </div>
        <div className="p-3 pt-0">
          <div className="bg-gray-800 rounded-xl p-3 flex items-center gap-3">
            <MessageSquare size={16} className="text-green-400" />
            <div>
              <p className="text-green-400 text-xs font-bold">SMS sent to Jake</p>
              <p className="text-gray-500 text-[10px]">"Your order is being prepared!"</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'ready',
    title: 'Food is ready. SMS sent.',
    subtitle: 'Customer walks straight to the window.',
    narration: 'Your cook taps "Ready" on the kitchen display. The customer gets an SMS: "Your order is ready for pickup!" They walk to the window, grab their food, and go. No waiting. No guessing. No shouting names.',
    visual: 'screen',
    sceneBg: 'from-green-950 to-gray-950',
    sceneDetail: (
      <div className="space-y-3 max-w-sm mx-auto">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 text-center">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-green-500/20">
            <Bell size={28} className="text-green-400" />
          </div>
          <p className="text-white font-bold text-lg">Order #47 Ready!</p>
          <p className="text-gray-500 text-sm mb-3">Jake's Smash Burger, Fries & Brew</p>
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
            <p className="text-green-400 text-sm font-bold flex items-center justify-center gap-2"><MessageSquare size={14} /> SMS sent to Jake</p>
            <p className="text-green-400/60 text-xs mt-1">"Your order is ready for pickup!"</p>
          </div>
        </div>
        <div className="text-center text-gray-500 text-sm">
          🏃 → 🍔🍟☕ → 😊👍
        </div>
      </div>
    ),
  },
  {
    id: 'result',
    title: 'The result',
    subtitle: 'You served 8 orders. Zero extra staff. Zero queues.',
    narration: 'In the time the competitor served 3 people from their queue, you\'ve served 8 through QR ordering. No extra staff. No missed orders. No walkoffs. Just happy customers and more revenue.',
    visual: 'scene',
    sceneBg: 'from-orange-950 to-gray-950',
    sceneDetail: (
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-red-400 font-bold text-sm mb-3">Without ChowNow</p>
          <p className="text-4xl font-black text-red-400">3</p>
          <p className="text-gray-500 text-xs mt-1">orders in 30 min</p>
          <div className="mt-3 space-y-1 text-left">
            <p className="text-red-400/60 text-xs">❌ 5 customers walked away</p>
            <p className="text-red-400/60 text-xs">❌ $100+ lost revenue</p>
            <p className="text-red-400/60 text-xs">❌ Stressed staff</p>
          </div>
        </div>
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 text-center">
          <p className="text-green-400 font-bold text-sm mb-3">With ChowNow</p>
          <p className="text-4xl font-black text-green-400">8</p>
          <p className="text-gray-500 text-xs mt-1">orders in 30 min</p>
          <div className="mt-3 space-y-1 text-left">
            <p className="text-green-400/60 text-xs">✅ Zero walkoffs</p>
            <p className="text-green-400/60 text-xs">✅ 160% more revenue</p>
            <p className="text-green-400/60 text-xs">✅ Same staff count</p>
          </div>
        </div>
      </div>
    ),
  },
];

const Demo: React.FC = () => {
  const [step, setStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const current = STEPS[step];

  // Auto-advance every 6 seconds
  useEffect(() => {
    if (!autoPlay) return;
    const timer = setTimeout(() => {
      if (step < STEPS.length - 1) setStep(s => s + 1);
      else setAutoPlay(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, [step, autoPlay]);

  const goTo = (i: number) => { setStep(i); setAutoPlay(false); };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo-horizontal.png" alt="ChowNow" className="h-8 object-contain" />
          <span className="text-gray-600 text-sm">|</span>
          <span className="text-orange-400 text-sm font-bold">Product Demo</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-400 hover:text-white text-sm transition">Back to site</a>
          <a href="/#/qr-order" className="text-orange-400 hover:text-orange-300 text-sm font-bold transition">Try ordering →</a>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left: Narration */}
        <div className="lg:w-[400px] p-8 lg:border-r border-gray-800 flex flex-col">
          <div className="flex-1">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              <span className="text-orange-400 text-xs font-black uppercase tracking-widest">Step {step + 1} of {STEPS.length}</span>
              {autoPlay && <span className="text-gray-600 text-xs">(auto-playing)</span>}
            </div>

            {/* Progress dots */}
            <div className="flex gap-1.5 mb-8">
              {STEPS.map((_, i) => (
                <button key={i} onClick={() => goTo(i)} className={`h-1.5 rounded-full transition-all ${i === step ? 'bg-orange-500 w-8' : i < step ? 'bg-orange-500/30 w-4' : 'bg-gray-800 w-4'}`} />
              ))}
            </div>

            <h2 className="text-2xl lg:text-3xl font-black mb-2 transition-all">{current.title}</h2>
            <p className="text-orange-400 font-bold text-sm mb-4">{current.subtitle}</p>
            <p className="text-gray-400 leading-relaxed">{current.narration}</p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-800">
            <button
              onClick={() => goTo(Math.max(0, step - 1))}
              disabled={step === 0}
              className="flex items-center gap-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-sm"
            >
              <ArrowLeft size={16} /> Previous
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => goTo(step + 1)}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-5 py-2.5 rounded-xl transition text-sm"
              >
                Next <ArrowRight size={16} />
              </button>
            ) : (
              <a href="/" className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-5 py-2.5 rounded-xl transition text-sm">
                Get ChowNow <ArrowRight size={16} />
              </a>
            )}
          </div>
        </div>

        {/* Right: Visual */}
        <div className={`flex-1 bg-gradient-to-br ${current.sceneBg} flex items-center justify-center p-8 lg:p-12 min-h-[400px]`}>
          <div className="w-full max-w-lg transition-all duration-500">
            {current.sceneDetail}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Demo;
