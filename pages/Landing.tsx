import React, { useState } from 'react';
import {
  ShoppingCart, CreditCard, Bell, Smartphone, Globe, Shield, Zap, Star,
  CheckCircle, ArrowRight, ChefHat, Clock, WifiOff, QrCode, Monitor,
  Users, ChevronDown, TrendingUp, DollarSign
} from 'lucide-react';

const Landing: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const features = [
    { icon: QrCode, title: 'QR Skip-the-Queue', desc: 'Customers scan a QR code, order from their phone, and get an SMS when food is ready. No app download needed.' },
    { icon: Monitor, title: 'Kitchen Display (KDS)', desc: 'Back-of-house sees orders in real-time. Tap to advance: New → Cooking → Ready. Auto-notifies customers and FOH.' },
    { icon: Smartphone, title: 'FOH Tablet Ordering', desc: 'Take walk-up orders on a tablet. Menu grid, cart, customer name — order hits the kitchen instantly.' },
    { icon: Bell, title: 'Instant Notifications', desc: 'SMS + email when order starts cooking and when it\'s ready. FOH gets an audio chime + visual alert.' },
    { icon: WifiOff, title: 'Works Offline', desc: 'No WiFi? No problem. Orders are queued locally and sync automatically when connectivity returns. Like Square, but built for trucks.' },
    { icon: CreditCard, title: 'Flexible Payments', desc: 'Stripe Terminal for tap-to-pay, Square integration, or cash at the counter. Your choice.' },
    { icon: Globe, title: 'Works Everywhere', desc: 'Cloud-native on Cloudflare\'s edge network. Fast from any location — events, markets, festivals.' },
    { icon: Shield, title: 'No Lock-in', desc: 'No contracts. No proprietary hardware. Runs on any tablet, phone, or laptop with a browser.' },
  ];

  const steps = [
    { num: '1', title: 'Open FOH + BOH', desc: 'Open Front of House on your order tablet, Kitchen Display on your kitchen screen.' },
    { num: '2', title: 'Print Your QR Code', desc: 'Generate a QR code from the admin panel. Display it on your truck for customers.' },
    { num: '3', title: 'Take Orders', desc: 'Walk-up orders via FOH tablet. Queue orders via customer QR scan. Both hit the same kitchen queue.' },
    { num: '4', title: 'Cook + Notify', desc: 'Kitchen taps orders to advance. Customer gets SMS when ready. FOH gets a chime.' },
  ];

  const faqs = [
    { q: 'Do I need special hardware?', a: 'No. Street Eats runs in any web browser. Use an iPad, Android tablet, old laptop — whatever you have. For payments, plug in a Stripe Terminal reader or use Tap to Pay on your phone.' },
    { q: 'Does it work without internet?', a: 'Yes. Street Eats has a full offline mode. Orders are saved locally in IndexedDB and sync automatically when connectivity returns. Menu stays cached so customers can still browse.' },
    { q: 'How do customers order?', a: 'They scan a QR code displayed on your truck. This opens a mobile-friendly menu in their browser — no app download. They add items, enter their name and phone, and place the order. They get an SMS when food is ready.' },
    { q: 'What about payments?', a: 'Currently supports pay-at-counter (cash or card via your existing terminal). Stripe Terminal integration for in-app tap-to-pay is coming soon.' },
    { q: 'Can I use it for events and festivals?', a: 'Absolutely. The QR ordering is perfect for high-volume events — customers order from the queue instead of waiting at the window. The kitchen display handles the volume.' },
    { q: 'Is there a contract or lock-in?', a: 'No. Month-to-month. Cancel anytime. Your data is yours.' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-900/30 via-gray-950 to-gray-950" />
        <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-orange-500/10 text-orange-400 px-4 py-2 rounded-full text-sm font-bold mb-6 border border-orange-500/20">
              <Zap size={14} /> Built for Australian food trucks
            </div>
            <h1 className="text-5xl md:text-7xl font-black leading-[0.9] mb-6">
              Your food truck,<br />
              <span className="text-orange-400">fully digital.</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-xl mb-8 leading-relaxed">
              Front of house. Back of house. QR ordering. Kitchen display. Offline mode.
              Everything a food truck needs — nothing it doesn't.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="#/qr-order" className="bg-orange-500 hover:bg-orange-400 text-white font-black px-8 py-4 rounded-2xl text-lg transition active:scale-95 flex items-center gap-2">
                Try the Demo <ArrowRight size={20} />
              </a>
              <a href="#pricing" className="bg-white/5 hover:bg-white/10 text-white font-bold px-8 py-4 rounded-2xl text-lg transition border border-white/10">
                See Pricing
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Social Proof Bar */}
      <div className="border-y border-gray-800 bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-center gap-8 text-center">
          <div>
            <div className="text-2xl font-black text-orange-400">3s</div>
            <div className="text-xs text-gray-500 uppercase tracking-widest">Order poll speed</div>
          </div>
          <div className="w-px h-8 bg-gray-800 hidden md:block" />
          <div>
            <div className="text-2xl font-black text-orange-400">282KB</div>
            <div className="text-xs text-gray-500 uppercase tracking-widest">Total bundle</div>
          </div>
          <div className="w-px h-8 bg-gray-800 hidden md:block" />
          <div>
            <div className="text-2xl font-black text-orange-400">100%</div>
            <div className="text-xs text-gray-500 uppercase tracking-widest">Offline capable</div>
          </div>
          <div className="w-px h-8 bg-gray-800 hidden md:block" />
          <div>
            <div className="text-2xl font-black text-green-400">$0</div>
            <div className="text-xs text-gray-500 uppercase tracking-widest">Hardware required</div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black mb-3">Everything your truck needs</h2>
          <p className="text-gray-400 max-w-xl mx-auto">No restaurant POS crammed into a truck. No QR tool that doesn't talk to the kitchen. One system, built for how food trucks actually work.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-orange-500/30 transition">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center mb-4">
                <f.icon size={20} className="text-orange-400" />
              </div>
              <h3 className="text-white font-bold mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-gray-900/50 border-y border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black mb-3">How it works</h2>
            <p className="text-gray-400">Set up in minutes. No onboarding call needed.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-black text-xl mx-auto mb-4">{s.num}</div>
                <h3 className="text-white font-bold text-lg mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* The Loop Diagram */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black mb-3">The full loop</h2>
          <p className="text-gray-400">Every order follows the same flow, whether walk-up or QR.</p>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-0">
          {[
            { label: 'Customer orders', sub: 'QR scan or FOH tablet', color: 'bg-blue-500' },
            { label: 'Hits kitchen', sub: 'BOH sees it instantly', color: 'bg-yellow-500' },
            { label: 'Start cooking', sub: 'SMS: "Being prepared"', color: 'bg-orange-500' },
            { label: 'Mark ready', sub: 'SMS + FOH chime', color: 'bg-green-500' },
            { label: 'Collected', sub: 'Order complete', color: 'bg-gray-500' },
          ].map((step, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center text-center min-w-[120px]">
                <div className={`w-4 h-4 ${step.color} rounded-full mb-2`} />
                <div className="text-white font-bold text-sm">{step.label}</div>
                <div className="text-gray-500 text-xs">{step.sub}</div>
              </div>
              {i < 4 && <ArrowRight size={16} className="text-gray-700 hidden md:block mx-2 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div id="pricing" className="bg-gray-900/50 border-y border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black mb-3">Simple pricing</h2>
            <p className="text-gray-400">No hidden fees. No per-transaction charges. No contracts.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <div className="text-orange-400 font-bold text-sm uppercase tracking-widest mb-2">Starter</div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-black text-white">$49</span>
                <span className="text-gray-500">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['FOH + BOH + QR ordering', 'Unlimited orders', 'SMS notifications (BYO Twilio)', 'Offline mode', 'Up to 2 devices', '31-item menu'].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-300 text-sm">
                    <CheckCircle size={16} className="text-green-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <a href="mailto:hello@streeteats.com.au" className="block text-center bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl border border-white/10 transition">
                Get Started
              </a>
            </div>
            <div className="bg-gray-900 border-2 border-orange-500 rounded-2xl p-8 relative">
              <div className="absolute -top-3 right-6 bg-orange-500 text-white text-xs font-black px-3 py-1 rounded-full">POPULAR</div>
              <div className="text-orange-400 font-bold text-sm uppercase tracking-widest mb-2">Pro</div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-black text-white">$99</span>
                <span className="text-gray-500">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['Everything in Starter', 'Unlimited devices', 'Unlimited menu items', 'Stripe Terminal payments', 'Catering & event management', 'Custom branding', 'Priority support'].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-300 text-sm">
                    <CheckCircle size={16} className="text-green-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <a href="mailto:hello@streeteats.com.au" className="block text-center bg-orange-500 hover:bg-orange-400 text-white font-black py-3 rounded-xl transition">
                Get Started
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-black text-center mb-10">Frequently asked questions</h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <span className="text-white font-bold">{faq.q}</span>
                <ChevronDown size={18} className={`text-gray-500 transition ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && (
                <div className="px-6 pb-4 text-gray-400 text-sm leading-relaxed">{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-4">Ready to ditch the clipboard?</h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">Set up Street Eats in minutes. No hardware, no contracts, no onboarding calls. Just a better way to run your truck.</p>
          <a href="#/qr-order" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-black px-8 py-4 rounded-2xl text-lg transition active:scale-95">
            Try the Demo <ArrowRight size={20} />
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <ChefHat size={18} className="text-orange-400" />
            <span className="font-bold text-white">Street Eats</span>
          </div>
          <div>Built in Australia. Powered by Cloudflare.</div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
