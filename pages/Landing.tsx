import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CreditCard, Bell, Smartphone, Globe, Shield, Zap, Star,
  CheckCircle, ArrowRight, ChefHat, Clock, WifiOff, QrCode, Monitor,
  ChevronDown, X, Loader2, XCircle, Package, Cpu, Wifi, Plus, ShoppingCart,
  ClipboardList, Timer, BadgeDollarSign, Quote, MapPin, Users
} from 'lucide-react';

// ─── Intersection Observer Hook ─────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ─── Animated Counter ───────────────────────────────────────────
const Counter: React.FC<{ end: number; suffix?: string; duration?: number }> = ({ end, suffix = '', duration = 2000 }) => {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView();
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(end / (duration / 16));
    const timer = setInterval(() => { start += step; if (start >= end) { setCount(end); clearInterval(timer); } else setCount(start); }, 16);
    return () => clearInterval(timer);
  }, [inView, end, duration]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
};

// ─── Rotating Words ─────────────────────────────────────────────
const RotatingWords: React.FC = () => {
  const words = ['QR ordering.', 'Kitchen display.', 'Tap-to-pay.', 'Offline mode.'];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIdx(p => (p + 1) % words.length), 2500);
    return () => clearInterval(timer);
  }, []);
  // Render all words in a stacked container — the longest word sets the width,
  // only the active word is visible. This prevents layout shifts.
  return (
    <span className="inline-grid">
      {words.map((w, i) => (
        <span key={i} className={`col-start-1 row-start-1 text-orange-400 transition-opacity duration-500 ${i === idx ? 'opacity-100' : 'opacity-0'}`}>
          {w}
        </span>
      ))}
    </span>
  );
};

// ─── Signup Modal (preserved) ───────────────────────────────────
interface SignupModalProps { plan: 'starter' | 'pro'; onClose: () => void; }

const SignupModal: React.FC<SignupModalProps> = ({ plan, onClose }) => {
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [slug, setSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!slug || slug === toSlug(businessName.slice(0, -1))) setSlug(toSlug(businessName));
  }, [businessName]);

  useEffect(() => {
    setSlugAvailable(null);
    if (slug.length < 3) return;
    if (slugTimer.current) clearTimeout(slugTimer.current);
    slugTimer.current = setTimeout(async () => {
      setSlugChecking(true);
      try { const res = await fetch(`/api/v1/signup/check?slug=${encodeURIComponent(slug)}`); const data = await res.json(); setSlugAvailable(data.available); } catch { setSlugAvailable(null); }
      setSlugChecking(false);
    }, 500);
  }, [slug]);

  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!businessName || !email || !slug) { setError('Please fill in all required fields.'); return; }
    if (slugAvailable === false) { setError('That subdomain is taken. Try another.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessName, email, phone, slug, plan }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      window.location.href = data.url;
    } catch (err: any) { setError(err.message); setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-8 relative animate-scale-in" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 text-orange-400 px-3 py-1 rounded-full text-xs font-bold mb-3 border border-orange-500/20">
            {plan === 'pro' ? 'PRO' : 'STARTER'} PLAN
          </div>
          <h2 className="text-2xl font-black text-white">Get started with ChowNow</h2>
          <p className="text-gray-400 text-sm mt-1">{plan === 'pro' ? '$149/month' : '$99/month'} + $299 ChowBox</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 font-bold uppercase tracking-widest">Business Name *</label>
            <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Smoky Joe's BBQ" className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none transition" required />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold uppercase tracking-widest">Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="joe@smokyjoes.com.au" className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none transition" required />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold uppercase tracking-widest">Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0412 345 678" className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none transition" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-bold uppercase tracking-widest">Your Subdomain *</label>
            <div className="flex items-center mt-1 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden focus-within:border-orange-500 transition">
              <input type="text" value={slug} onChange={e => setSlug(toSlug(e.target.value))} placeholder="smokyjoes" className="flex-1 bg-transparent px-4 py-3 text-white placeholder-gray-600 focus:outline-none" required />
              <span className="text-gray-500 text-sm pr-4 whitespace-nowrap">.chownow.au</span>
            </div>
            <div className="mt-1 h-5 text-xs">
              {slugChecking && <span className="text-gray-500">Checking...</span>}
              {!slugChecking && slugAvailable === true && slug.length >= 3 && <span className="text-green-400">Available!</span>}
              {!slugChecking && slugAvailable === false && <span className="text-red-400">Taken — try another</span>}
            </div>
          </div>
          {error && <div className="text-red-400 text-sm bg-red-500/10 px-4 py-2 rounded-xl">{error}</div>}
          <button type="submit" disabled={submitting || slugAvailable === false} className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-gray-700 disabled:text-gray-500 text-white font-black py-3.5 rounded-xl transition flex items-center justify-center gap-2">
            {submitting ? <><Loader2 size={18} className="animate-spin" /> Processing...</> : <>Continue to Payment <ArrowRight size={18} /></>}
          </button>
          <p className="text-center text-gray-600 text-xs">Includes ChowBox hardware kit. Secure payment via Stripe.</p>
        </form>
      </div>
    </div>
  );
};

// ─── Section Wrapper with Scroll Animation ──────────────────────
const Section: React.FC<{ children: React.ReactNode; className?: string; id?: string }> = ({ children, className = '', id }) => {
  const { ref, inView } = useInView(0.02);
  return <section ref={ref} id={id} className={`${className} will-change-transform transition-all duration-700 ease-out ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>{children}</section>;
};

// ─── Landing Page ───────────────────────────────────────────────
const Landing: React.FC = () => {
  const [signupPlan, setSignupPlan] = useState<'starter' | 'pro' | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => setActiveTestimonial(p => (p + 1) % 3), 5000);
    return () => clearInterval(timer);
  }, []);

  const IMG = {
    foodTruck: 'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?auto=format&fit=crop&w=800&q=80',
    // Feature-specific images — food truck context
    qrScan: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80', // person holding phone scanning
    kitchenScreen: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80', // food being prepared/plated
    tabletPos: 'https://images.unsplash.com/photo-1513639776629-7b43c5ca3b12?auto=format&fit=crop&w=800&q=80', // food truck window serving customer
    smsPhone: 'https://images.unsplash.com/photo-1523966211575-eb4a01e7dd51?auto=format&fit=crop&w=800&q=80', // person checking phone
    wifiSignal: 'https://images.unsplash.com/photo-1569937756447-1d44f657dc69?auto=format&fit=crop&w=800&q=80', // outdoor festival/event
    contactless: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80', // contactless tap payment
    cloudServer: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80', // food market/festival crowd
    handshake: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80', // restaurant/food service
    // General
    kitchen: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80',
    burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    tacos: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=800&q=80',
    qr: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=800&q=80',
    tablet: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=80',
    // Testimonial avatars
    owner: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=400&q=80',
    owner2: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    owner3: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
  };

  const testimonials = [
    { name: 'Jake M.', biz: 'Smoky Jake\'s BBQ', loc: 'Gold Coast, QLD', quote: 'We cut our order wait time in half. Customers love scanning the QR instead of queuing at the window.', stars: 5, img: IMG.owner },
    { name: 'Sarah L.', biz: 'Taco Madre', loc: 'Melbourne, VIC', quote: 'The ChowBox saved us at a festival with zero phone signal. Every other truck was dead — we kept serving.', stars: 5, img: IMG.owner3 },
    { name: 'Dave R.', biz: 'The Burger Co', loc: 'Sydney, NSW', quote: 'Kitchen display changed everything. No more shouting orders. My team just watches the screen and cooks.', stars: 5, img: IMG.owner2 },
  ];

  const faqs = [
    { q: 'Do I need special hardware?', a: 'Your subscription includes a ChowBox — the brains of your operation. It\'s a small, pre-configured device that runs everything: ordering, kitchen display, payments, and offline mode. Beyond that, use any tablet or phone with a browser.' },
    { q: 'Does it work without internet?', a: 'Yes. The ChowBox creates its own WiFi hotspot — it\'s the brains of your truck. Customers order even at events with zero coverage. Orders sync when connectivity returns.' },
    { q: 'How do customers order?', a: 'They scan a QR code on your truck. A mobile-friendly menu opens in their browser — no app download. They order, pay, and get an SMS when food is ready.' },
    { q: 'What payment methods are supported?', a: 'Cash at counter, card via your existing terminal, plus Stripe Terminal for in-app tap-to-pay on Pro plans. Apple Pay and Google Pay supported.' },
    { q: 'Can I use it for events and festivals?', a: 'Absolutely. The ChowBox means no internet needed — it runs the whole show. QR ordering handles high volume without extra staff. The kitchen display keeps everything flowing.' },
    { q: 'Is there a contract?', a: 'No. Month-to-month. Cancel anytime. Your data is yours. We even help you export if you leave.' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white" style={{ overflowX: 'clip' }}>
      {signupPlan && <SignupModal plan={signupPlan} onClose={() => setSignupPlan(null)} />}

      {/* ─── Sticky Navbar ──────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/50 py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <img src="/logo-horizontal.png" alt="ChowNow" className="h-12 object-contain" />
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition font-medium">Features</a>
            <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition font-medium">Pricing</a>
            <a href="#faq" className="text-sm text-gray-400 hover:text-white transition font-medium">FAQ</a>
            <a href="/#/demo" className="text-sm text-gray-400 hover:text-white transition font-medium">Demo</a>
          </div>
          <button onClick={() => setSignupPlan('pro')} className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-5 py-2 rounded-full text-sm transition active:scale-95">
            Get Started
          </button>
        </div>
      </nav>

      {/* ─── Hero ───────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Clean gradient background — no busy video */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-orange-500/6 rounded-full blur-[150px]" />

        {/* Top section: headline + CTAs */}
        <div className="relative max-w-5xl mx-auto px-6 pt-32 pb-12 text-center">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 text-orange-400 px-5 py-2 rounded-full text-sm font-bold mb-8 border border-orange-500/20">
            <Zap size={14} /> The POS built for food trucks
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-[0.95] mb-6 tracking-tight">
            From first order to<br />full service. <span className="text-orange-400"><RotatingWords /></span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            QR ordering, kitchen display, front-of-house POS, and offline mode — all powered by the ChowBox. The brains of your truck.
          </p>
          <div className="flex flex-wrap gap-4 justify-center mb-6">
            <button onClick={() => setSignupPlan('pro')} className="bg-orange-500 hover:bg-orange-400 text-white font-black px-8 py-4 rounded-full text-lg transition active:scale-95 flex items-center gap-2 shadow-lg shadow-orange-500/20">
              Get Started <ArrowRight size={20} />
            </button>
            <a href="/#/demo" className="bg-white/5 hover:bg-white/10 text-white font-bold px-8 py-4 rounded-full text-lg transition border border-white/10 flex items-center gap-2">
              Try Demo
            </a>
          </div>
          <p className="text-sm text-gray-500 mb-12">No contracts. No lock-in. Cancel anytime.</p>
        </div>

      </div>

      {/* ─── The ChowNow Experience — Animated Scroll Story ─────── */}
      <Section className="relative">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 px-4 py-2 rounded-full text-sm font-bold mb-4 border border-blue-500/20">
              <Star size={14} /> The Customer Experience
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-4">See how it works. For real.</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">Follow a customer from arrival to collection. This is what happens when your truck runs ChowNow.</p>
          </div>

          {/* Story timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-red-500/50 via-orange-500/50 to-green-500/50" />

            {[
              {
                step: 1, title: 'The scene: lunch rush', side: 'left',
                desc: 'Your customer arrives at a food truck market. The truck next door has a 15-person queue. People are leaving.',
                detail: 'Long queues = lost customers. Every person who walks away is $20+ gone.',
                icon: Users, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20',
                gradient: 'from-red-900/30 to-red-950/50',
                visual: '🚛 👤👤👤👤👤👤👤👤👤👤👤👤 😤💨',
              },
              {
                step: 2, title: 'They spot your QR code', side: 'right',
                desc: 'No queue at your window — just a sign: "Scan to Order." They pull out their phone and scan in 2 seconds.',
                detail: 'No app to download. No signup. Menu opens instantly in their browser.',
                icon: QrCode, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20',
                gradient: 'from-orange-900/30 to-orange-950/50',
                visual: '📱 ← 📷 ← [QR] ← 🚛',
              },
              {
                step: 3, title: 'They browse your full menu', side: 'left',
                desc: 'Photos, descriptions, prices — all on their phone. They add a Smash Burger, Loaded Fries, and a Drink.',
                detail: 'Customers spend 30% more when they browse visually without queue pressure.',
                icon: ShoppingCart, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20',
                gradient: 'from-orange-900/30 to-orange-950/50',
                visual: '🍔 $16  |  🍟 $12  |  🥤 $5  →  🛒',
              },
              {
                step: 4, title: 'Order placed — they relax', side: 'right',
                desc: 'Name, phone number, tap "Place Order." Done. They sit down, chat with friends, check out other stalls.',
                detail: 'Your kitchen screen shows the order instantly. No handwriting. No errors.',
                icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20',
                gradient: 'from-blue-900/30 to-blue-950/50',
                visual: '✅ Order #47 confirmed → 🖥️ Kitchen',
              },
              {
                step: 5, title: 'Kitchen starts cooking', side: 'left',
                desc: 'Cook taps "Start" on the kitchen display. Customer gets an SMS: "Your order is being prepared!"',
                detail: 'No shouting names. No confusion. Customer knows exactly what\'s happening.',
                icon: ChefHat, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20',
                gradient: 'from-orange-900/30 to-orange-950/50',
                visual: '👨‍🍳 🔥 → 📱 "Being prepared!"',
              },
              {
                step: 6, title: 'Food is ready — SMS sent', side: 'right',
                desc: 'Cook taps "Ready." Customer gets SMS: "Your order is ready!" They walk straight to the window.',
                detail: 'No waiting. No guessing. No missed pickups. Collect and go.',
                icon: Bell, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20',
                gradient: 'from-green-900/30 to-green-950/50',
                visual: '📱 "Ready for pickup!" → 🏃 → 🍔🍟🥤',
              },
              {
                step: 7, title: 'Meanwhile, next door...', side: 'left',
                desc: 'Competitor\'s queue is still 12 deep. Three people walked away. You\'ve served 8 QR orders in the same time.',
                detail: 'More orders. Happier customers. Zero extra staff. That\'s ChowNow.',
                icon: Zap, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20',
                gradient: 'from-orange-900/30 to-orange-950/50',
                visual: '❌ 12 in queue  vs  ✅ 8 served + 😊',
              },
            ].map((scene, i) => {
              const isLeft = scene.side === 'left';
              return (
                <Section key={i} className="relative mb-12 last:mb-0">
                  <div className={`flex items-start gap-6 md:gap-12 ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'} flex-col md:flex-row`}>
                    {/* Timeline dot */}
                    <div className="absolute left-6 md:left-1/2 -translate-x-1/2 z-10">
                      <div className={`w-12 h-12 ${scene.bg} border rounded-xl flex items-center justify-center`}>
                        <scene.icon size={20} className={scene.color} />
                      </div>
                    </div>

                    {/* Content card */}
                    <div className={`ml-16 md:ml-0 md:w-[calc(50%-3rem)] ${isLeft ? 'md:pr-0' : 'md:pl-0 md:ml-auto'}`}>
                      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition">
                        {/* Visual scene */}
                        <div className={`bg-gradient-to-br ${scene.gradient} px-6 py-5 border-b border-gray-800`}>
                          <div className="text-2xl md:text-3xl tracking-wider select-none">{scene.visual}</div>
                        </div>
                        {/* Text */}
                        <div className="p-6">
                          <span className={`text-xs font-black ${scene.color} uppercase tracking-widest`}>Step {scene.step}</span>
                          <h3 className="text-white font-bold text-xl mt-2 mb-2">{scene.title}</h3>
                          <p className="text-gray-300 text-sm leading-relaxed mb-3">{scene.desc}</p>
                          <p className="text-gray-500 text-xs leading-relaxed italic">{scene.detail}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Section>
              );
            })}
          </div>

          {/* CTA after story */}
          <div className="text-center mt-16">
            <p className="text-gray-400 text-lg mb-6">Want to see it for yourself?</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a href="/#/demo" className="bg-orange-500 hover:bg-orange-400 text-white font-black px-8 py-4 rounded-full text-lg transition active:scale-95 flex items-center gap-2">
                Try the Live Demo <ArrowRight size={20} />
              </a>
              <button onClick={() => setSignupPlan('pro')} className="bg-white/5 hover:bg-white/10 text-white font-bold px-8 py-4 rounded-full text-lg transition border border-white/10">
                Get Started
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── Social Proof Bar ───────────────────────────────────── */}
      <Section className="border-y border-gray-800 bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-center gap-10 text-center">
          <div>
            <div className="text-3xl font-black text-orange-400"><Counter end={2} /> min</div>
            <div className="text-xs text-gray-500 uppercase tracking-widest mt-1">Setup time</div>
          </div>
          <div className="w-px h-10 bg-gray-800 hidden md:block" />
          <div>
            <div className="text-3xl font-black text-orange-400">$0</div>
            <div className="text-xs text-gray-500 uppercase tracking-widest mt-1">Per-transaction fees</div>
          </div>
          <div className="w-px h-10 bg-gray-800 hidden md:block" />
          <div>
            <div className="text-3xl font-black text-orange-400">Zero signal?</div>
            <div className="text-xs text-gray-500 uppercase tracking-widest mt-1">No problem — works offline</div>
          </div>
          <div className="w-px h-10 bg-gray-800 hidden md:block" />
          <div>
            <div className="text-3xl font-black text-green-400 flex items-center gap-2"><Package size={24} /> ChowBox</div>
            <div className="text-xs text-gray-500 uppercase tracking-widest mt-1">Hardware shipped to you</div>
          </div>
        </div>
      </Section>

      {/* ─── Problem vs Solution ────────────────────────────────── */}
      <Section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black mb-4">While you're using clipboards,<br /><span className="text-orange-400">competitors are using QR.</span></h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">Every missed order, every walkoff, every festival with no signal — it all costs you money.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* The Old Way */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-[60px]" />
            <h3 className="text-red-400 font-black text-lg uppercase tracking-widest mb-6 flex items-center gap-2"><XCircle size={20} /> The old way</h3>
            <ul className="space-y-4">
              {[
                'Handwritten orders — illegible, lost, wrong',
                'Shouting across the truck over the fryer',
                'Customers walk off when the queue is too long',
                'Festival with no signal = no payments',
                'No idea how many orders you did today',
              ].map((p, i) => (
                <li key={i} className="flex items-start gap-3 text-gray-400">
                  <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                  <span className="line-through decoration-red-400/40">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* The ChowNow Way */}
          <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-[60px]" />
            <h3 className="text-green-400 font-black text-lg uppercase tracking-widest mb-6 flex items-center gap-2"><CheckCircle size={20} /> The ChowNow way</h3>
            <ul className="space-y-4">
              {[
                'Digital orders — accurate, instant, tracked',
                'Kitchen display shows every order in real time',
                'QR ordering: customers order from the queue',
                'ChowBox creates its own WiFi — zero signal, no problem',
                'Full dashboard: orders, revenue, peak times',
              ].map((p, i) => (
                <li key={i} className="flex items-start gap-3 text-gray-300">
                  <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* ─── Features ───────────────────────────────────────────── */}
      <Section id="features" className="bg-gray-900/30 border-y border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">Everything your truck needs</h2>
            <p className="text-gray-400 max-w-xl mx-auto text-lg">One system. Built for how food trucks actually work.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 stagger-children">
            {[
              { icon: QrCode, title: 'QR Ordering', desc: 'Customers scan, browse, and order from their phone. No app download. No queue.' },
              { icon: Monitor, title: 'Kitchen Display', desc: 'Orders appear instantly. Tap to advance: New, Cooking, Ready. Auto-notifies customers.' },
              { icon: Smartphone, title: 'FOH Tablet POS', desc: 'Take walk-up orders on any device. Menu grid, cart, name — hits kitchen instantly.' },
              { icon: Bell, title: 'SMS Notifications', desc: 'Customers get a text when cooking starts and when food is ready. No shouting names.' },
              { icon: WifiOff, title: 'Works Offline', desc: 'ChowBox creates a WiFi hotspot — the brains of your truck. Orders queue locally and sync when internet returns.' },
              { icon: CreditCard, title: 'Tap to Pay', desc: 'Stripe Terminal for contactless payments. Apple Pay, Google Pay, or good old cash.' },
              { icon: Globe, title: 'Cloud Native', desc: 'Runs on Cloudflare\'s edge. Fast from anywhere — markets, events, festivals.' },
              { icon: Shield, title: 'No Lock-in', desc: 'Month-to-month. No contracts. No proprietary hardware. Your data is always yours.' },
            ].map((f, i) => (
              <div key={i} className="card-3d bg-gray-900 border border-gray-800 rounded-2xl p-6 group hover:border-orange-500/30 transition-all">
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-4 border border-orange-500/20 group-hover:bg-orange-500/20 transition">
                  <f.icon size={22} className="text-orange-400" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── How It Works ───────────────────────────────────────── */}
      <Section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black mb-4">Up and running in days</h2>
          <p className="text-gray-400 text-lg">Not weeks. Not months. Days.</p>
        </div>
        <div className="relative">
          {/* Connection line */}
          <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500 opacity-30" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { num: '1', title: 'Sign Up', desc: 'Pick your plan, enter your details, and pay. Takes 2 minutes.', icon: Zap },
              { num: '2', title: 'Get Your ChowBox', desc: 'We build and ship your ChowBox — the brains of your operation. Plug in and go.', icon: Package },
              { num: '3', title: 'Set Up Menu', desc: 'Log into admin, add items, set prices. Print your QR code.', icon: ClipboardList },
              { num: '4', title: 'Start Serving', desc: 'Customers scan, kitchen cooks, everyone\'s happy.', icon: ChefHat },
            ].map((s, i) => (
              <div key={i} className="text-center relative">
                <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-5 shadow-lg shadow-orange-500/30 rotate-3 hover:rotate-0 transition-transform">
                  <s.icon size={28} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── Live Demo Preview ──────────────────────────────────── */}
      <Section className="bg-gray-900/30 border-y border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">See it in action</h2>
            <p className="text-gray-400 text-lg">Three screens. One system. Zero chaos.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Customer QR Order',
                desc: 'Your customers scan the QR code on your truck, browse your full menu with photos, add items to cart, and place their order — all from their phone. No app to download.',
                link: '/#/demo',
                icon: QrCode,
                gradient: 'from-blue-600 to-blue-900',
                features: ['Scan & order in 30 seconds', 'Full menu with photos', 'Cart + checkout', 'SMS when ready'],
              },
              {
                title: 'Kitchen Display',
                desc: 'Every order appears on your kitchen screen the moment it\'s placed. Tap to advance through stages: New, Cooking, Ready. Customer gets notified automatically.',
                link: '/#/boh',
                icon: Monitor,
                gradient: 'from-orange-600 to-orange-900',
                features: ['Real-time order queue', 'Tap to bump', 'Auto SMS notifications', 'Audio chime alerts'],
              },
              {
                title: 'Front of House POS',
                desc: 'Take walk-up orders on any tablet. Full menu grid, customer name, cart — order hits the kitchen instantly. Track payments and manage the queue.',
                link: '/#/foh',
                icon: Smartphone,
                gradient: 'from-green-600 to-green-900',
                features: ['Walk-up ordering', 'Payment tracking', 'Order queue management', 'Works on any device'],
              },
            ].map((screen, i) => (
              <a key={i} href={screen.link} className="group block bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-orange-500/30 transition-all hover:-translate-y-1">
                {/* Icon header */}
                <div className={`bg-gradient-to-br ${screen.gradient} p-8 flex items-center justify-center`}>
                  <div className="w-20 h-20 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                    <screen.icon size={36} className="text-white" />
                  </div>
                </div>
                {/* Content */}
                <div className="p-6">
                  <h3 className="text-white font-bold text-xl mb-2">{screen.title}</h3>
                  <p className="text-gray-400 text-sm mb-4 leading-relaxed">{screen.desc}</p>
                  <ul className="space-y-1.5 mb-5">
                    {screen.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-gray-300 text-xs">
                        <CheckCircle size={12} className="text-green-400 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <span className="text-orange-400 text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                    Try it live <ArrowRight size={14} />
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── The Full Loop ──────────────────────────────────────── */}
      <Section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black mb-4">The full loop</h2>
          <p className="text-gray-400 text-lg">Every order. Same flow. Walk-up or QR.</p>
        </div>
        <div className="relative bg-gray-900/50 border border-gray-800 rounded-2xl p-8 md:p-12">
          {/* Animated connecting line */}
          <div className="hidden md:block absolute top-1/2 left-[10%] right-[10%] h-1 -translate-y-1/2">
            <div className="h-full bg-gradient-to-r from-blue-500 via-orange-500 to-green-500 rounded-full opacity-20" />
            <div className="absolute inset-0 h-full bg-gradient-to-r from-blue-500 via-orange-500 to-green-500 rounded-full opacity-60 blur-sm" />
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative">
            {[
              { label: 'Customer orders', sub: 'QR scan or tablet', color: 'bg-blue-500', glow: 'shadow-blue-500/30' },
              { label: 'Hits kitchen', sub: 'Instant display', color: 'bg-yellow-500', glow: 'shadow-yellow-500/30' },
              { label: 'Cooking', sub: 'SMS: "Being prepared"', color: 'bg-orange-500', glow: 'shadow-orange-500/30' },
              { label: 'Ready', sub: 'SMS + FOH chime', color: 'bg-green-500', glow: 'shadow-green-500/30' },
              { label: 'Collected', sub: 'Order complete', color: 'bg-gray-400', glow: 'shadow-gray-400/30' },
            ].map((step, i) => (
              <React.Fragment key={i}>
                <div className="flex flex-col items-center text-center z-10">
                  <div className={`w-12 h-12 ${step.color} rounded-full flex items-center justify-center shadow-lg ${step.glow} mb-3`}>
                    <span className="text-white font-black text-sm">{i + 1}</span>
                  </div>
                  <div className="text-white font-bold text-sm">{step.label}</div>
                  <div className="text-gray-500 text-xs mt-0.5">{step.sub}</div>
                </div>
                {i < 4 && <ArrowRight size={20} className="text-gray-700 hidden md:block shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── Testimonials ───────────────────────────────────────── */}
      <Section className="bg-gray-900/30 border-y border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black mb-4">Loved by truck owners</h2>
          </div>
          <div className="relative h-[220px]">
            {testimonials.map((t, i) => (
              <div key={i} className={`absolute inset-0 transition-all duration-500 ${i === activeTestimonial ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
                  <Quote size={32} className="text-orange-400/30 mx-auto mb-4" />
                  <p className="text-white text-lg md:text-xl font-medium mb-6 italic leading-relaxed">"{t.quote}"</p>
                  <div className="flex items-center justify-center gap-4">
                    <img src={t.img} alt={t.name} className="w-12 h-12 rounded-full object-cover border-2 border-orange-500/30" />
                    <div className="text-left">
                      <div className="text-white font-bold">{t.name}</div>
                      <div className="text-gray-400 text-sm">{t.biz} — {t.loc}</div>
                    </div>
                    <div className="flex gap-0.5 ml-4">
                      {Array.from({ length: t.stars }).map((_, s) => <Star key={s} size={14} className="text-orange-400 fill-orange-400" />)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Dots */}
          <div className="flex justify-center gap-2 mt-6">
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => setActiveTestimonial(i)} className={`w-2 h-2 rounded-full transition ${i === activeTestimonial ? 'bg-orange-400 w-6' : 'bg-gray-700'}`} />
            ))}
          </div>
        </div>
      </Section>

      {/* ─── Pricing ────────────────────────────────────────────── */}
      <Section id="pricing" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-6">
          <h2 className="text-3xl md:text-5xl font-black mb-4">Simple, honest pricing</h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">No hidden fees. No per-transaction charges. ChowBox hardware included in every plan.</p>
        </div>
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-full text-sm font-bold border border-green-500/20">
            <Timer size={14} /> Save 10+ hours/week on order management
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 perspective-1000">
          {/* Starter */}
          <div className="card-3d bg-gray-900 border border-gray-800 rounded-2xl p-7">
            <div className="text-gray-400 font-bold text-sm uppercase tracking-widest mb-2">Starter</div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-5xl font-black text-white">$99</span>
              <span className="text-gray-500 text-lg">/month</span>
            </div>
            <p className="text-gray-600 text-sm mb-6">+ $299 ChowBox (one-time)</p>
            <ul className="space-y-3 mb-8">
              {['FOH + BOH + QR ordering', 'Unlimited orders', 'SMS notifications', 'Offline mode', 'Up to 2 devices', '31-item menu'].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300 text-sm"><CheckCircle size={14} className="text-green-400 shrink-0" /> {f}</li>
              ))}
            </ul>
            <button onClick={() => setSignupPlan('starter')} className="block w-full text-center bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 rounded-xl border border-white/10 transition text-lg">Get Started</button>
          </div>

          {/* Pro */}
          <div className="card-3d relative bg-gray-900 border-2 border-orange-500/50 rounded-2xl p-7">
            <div className="absolute -top-3 right-6 bg-orange-500 text-white text-xs font-black px-4 py-1 rounded-full">POPULAR</div>
            <div className="text-orange-400 font-bold text-sm uppercase tracking-widest mb-2">Pro</div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-5xl font-black text-white">$149</span>
              <span className="text-gray-500 text-lg">/month</span>
            </div>
            <p className="text-gray-600 text-sm mb-6">+ $299 ChowBox (one-time)</p>
            <ul className="space-y-3 mb-8">
              {['Everything in Starter', 'Unlimited devices', 'Unlimited menu items', 'Stripe Terminal payments', 'Catering & event management', 'Custom branding', 'Priority support'].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300 text-sm"><CheckCircle size={14} className="text-green-400 shrink-0" /> {f}</li>
              ))}
            </ul>
            <button onClick={() => setSignupPlan('pro')} className="block w-full text-center bg-orange-500 hover:bg-orange-400 text-white font-black py-3.5 rounded-xl transition text-lg">Get Started</button>
          </div>

          {/* ChowBox */}
          <div className="card-3d bg-gray-900 border border-gray-800 rounded-2xl p-7">
            <div className="text-green-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2"><Package size={14} /> ChowBox</div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-5xl font-black text-white">$299</span>
              <span className="text-gray-500 text-lg">one-time</span>
            </div>
            <p className="text-gray-600 text-sm mb-6">The brains of your truck</p>
            <ul className="space-y-3 mb-8">
              {['Pre-configured hardware', 'Creates own WiFi hotspot', 'Works with zero signal', 'Plug in and go', 'Runs entire system offline', 'Shipped to your door'].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300 text-sm"><CheckCircle size={14} className="text-green-400 shrink-0" /> {f}</li>
              ))}
            </ul>
            <p className="text-center text-gray-500 text-sm font-medium">Included with every plan signup</p>
          </div>
        </div>
      </Section>

      {/* ─── FAQ ─────────────────────────────────────────────────── */}
      <Section id="faq" className="bg-gray-900/30 border-y border-gray-800">
        <div className="max-w-3xl mx-auto px-6 py-24">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-12">Got questions?</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden transition-all">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-6 py-5 text-left">
                  <span className="text-white font-bold">{faq.q}</span>
                  <ChevronDown size={18} className={`text-gray-500 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="px-6 pb-5 text-gray-400 text-sm leading-relaxed">{faq.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── Final CTA ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-orange-950/20 to-gray-950" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[150px]" />
        <Section className="relative max-w-3xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 text-orange-400 px-4 py-2 rounded-full text-sm font-bold mb-6 border border-orange-500/20">
            <Cpu size={14} /> Limited ChowBox builds each month
          </div>
          <h2 className="text-4xl md:text-5xl font-black mb-4">Get your ChowBox.<br />Start serving smarter.</h2>
          <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">Sign up today, get your hardware shipped, and be live in days. No setup calls. No onboarding hassle.</p>
          <button onClick={() => setSignupPlan('pro')} className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-black px-10 py-5 rounded-2xl text-xl transition active:scale-95 shadow-lg shadow-orange-500/20">
            Get Started <ArrowRight size={22} />
          </button>
          <div className="flex items-center justify-center gap-6 mt-6 text-sm text-gray-500">
            <span className="flex items-center gap-1"><Shield size={14} className="text-gray-600" /> No contracts</span>
            <span className="flex items-center gap-1"><CreditCard size={14} className="text-gray-600" /> Cancel anytime</span>
          </div>
        </Section>
      </div>

      {/* ─── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800 bg-gray-950">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <img src="/logo-horizontal.png" alt="ChowNow" className="h-10 object-contain mb-4" />
              <p className="text-gray-500 text-sm max-w-sm leading-relaxed">Food truck workflow, sorted. QR ordering, kitchen display, front-of-house POS, and offline mode — all in one box.</p>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
                <li><a href="/#/demo" className="hover:text-white transition">Demo</a></li>
                <li><a href="#faq" className="hover:text-white transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="mailto:hello@chownow.au" className="hover:text-white transition">Contact</a></li>
                <li><span className="flex items-center gap-1">Built in Australia <span className="text-base">🇦🇺</span></span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
            <span>&copy; {new Date().getFullYear()} ChowNow. All rights reserved.</span>
            <a href="/#/login" className="text-gray-700 hover:text-gray-500 transition text-xs">Admin</a>
            <span>Powered by Cloudflare</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
