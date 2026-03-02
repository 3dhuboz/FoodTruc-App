
import React, { useState } from 'react';
import { 
  Flame, ShoppingCart, CreditCard, Bell, CalendarDays, Users, BarChart3, 
  Smartphone, Globe, Palette, Shield, Zap, Star, CheckCircle, ArrowRight, 
  MessageCircle, Image as ImageIcon, TrendingUp, Award, Truck, ChefHat,
  Sparkles, Clock, MapPin, Gift, Mail, Bot, ChevronDown
} from 'lucide-react';

// Configurable pricing — these are the defaults, can be overridden via props or settings
interface LandingProps {
  setupFee?: number;
  monthlyFee?: number;
  businessName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

const Landing: React.FC<LandingProps> = ({ 
  setupFee = 999, 
  monthlyFee = 99,
  businessName = 'FoodTruck App',
  contactEmail = 'hello@foodtruckapp.com.au',
  contactPhone = ''
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const features = [
    { icon: ShoppingCart, title: 'Online Ordering', desc: 'Customers pre-order from your full menu with date/time selection, fulfillment options, and real-time availability.' },
    { icon: CreditCard, title: 'Square Payments', desc: 'Secure card payments via Square with automatic deposit holds, payment links, and webhook confirmation.' },
    { icon: Bell, title: 'SMS & Email Alerts', desc: 'Automated notifications at every stage — order placed, cooking started, ready for pickup — with Google Maps links.' },
    { icon: CalendarDays, title: 'Cook Day Planner', desc: 'Visual calendar to schedule cook days, block dates, and manage public events with pickup addresses.' },
    { icon: Users, title: 'Customer Database', desc: 'Full CRM with order history, dietary preferences, phone numbers, and automatic loyalty tracking.' },
    { icon: BarChart3, title: 'Order Management', desc: 'Admin dashboard with real-time order pipeline — Pending → Cooking → Ready → Collected — all one-tap actions.' },
    { icon: ChefHat, title: 'Catering Builder', desc: 'DIY catering packages with per-head pricing, meat/side selectors, and automatic deposit calculations.' },
    { icon: Gift, title: 'Loyalty & Rewards', desc: 'Digital stamp card with configurable prizes, staff PIN verification, and automatic prize wheel.' },
    { icon: Sparkles, title: 'AI Social Manager', desc: 'Claude-powered content scheduler that generates posts for Facebook & Instagram based on your cook days and menu.' },
    { icon: Bot, title: 'AI SMS Composer', desc: 'AI agent writes punchy SMS blasts in your brand voice — pick a tone, enter a topic, get 3 options instantly.' },
    { icon: ImageIcon, title: 'Fan Gallery', desc: 'Customer-submitted photo gallery with approval workflow, likes, and community engagement.' },
    { icon: MapPin, title: 'Live Tracking', desc: 'Shipping tracker for delivery orders with courier integration and real-time status updates for customers.' },
    { icon: Truck, title: 'Delivery & Shipping', desc: 'Support for pickup, delivery, and shipping with automatic fee calculations and address collection.' },
    { icon: Mail, title: 'Invoice System', desc: 'Generate and send branded invoices via email or SMS with Square payment links for catering quotes.' },
    { icon: Globe, title: 'PWA — Install as App', desc: 'Progressive Web App that customers install straight from their browser. No app store needed.' },
    { icon: Palette, title: 'Fully Brandable', desc: 'Your logo, your colours, your business name everywhere. White-label means zero mention of us.' },
  ];

  const workflow = [
    { step: '01', title: 'Customer Orders', desc: 'Browses menu → picks cook day → adds to cart → pays deposit via Square', color: 'from-red-600 to-orange-500' },
    { step: '02', title: 'You Get Notified', desc: 'Instant SMS + email alert with full order details and payment status', color: 'from-orange-500 to-yellow-500' },
    { step: '03', title: 'Cook Day Arrives', desc: 'One tap to start cooking → customer gets "order being prepared" notification', color: 'from-yellow-500 to-green-500' },
    { step: '04', title: 'Mark Ready', desc: 'Tap "Ready" → customer gets SMS with exact pickup address + Google Maps link', color: 'from-green-500 to-emerald-500' },
    { step: '05', title: 'Collect & Complete', desc: 'PIN verification → thank you email with app promo → loyalty stamp added', color: 'from-emerald-500 to-blue-500' },
  ];

  const faqs = [
    { q: 'Do I need any technical knowledge?', a: 'None at all. We handle the full setup — Firebase database, payment integration, domain connection, and deployment. You just log in and start managing your business.' },
    { q: 'Can I use my own domain?', a: 'Absolutely. We connect your custom domain (e.g. order.yourbusiness.com.au) and set up SSL certificates for free.' },
    { q: 'What payment processor do you use?', a: 'Square. It\'s the industry standard for food businesses in Australia. You keep your own Square account — we just connect it. No middleman on your payments.' },
    { q: 'Is there a lock-in contract?', a: 'No lock-in. Month-to-month billing. Cancel anytime. Your data is yours.' },
    { q: 'What\'s included in the monthly fee?', a: 'Hosting, SSL, database, AI features (Claude + Gemini), SMS/email infrastructure, ongoing updates, and priority support. Everything you need to run.' },
    { q: 'Can customers install it like a real app?', a: 'Yes — it\'s a Progressive Web App (PWA). Customers tap "Add to Home Screen" and it works exactly like a native app with push notifications, offline support, and full-screen mode.' },
    { q: 'How long does setup take?', a: 'Typically 24-48 hours. We configure your branding, connect your Square account, set up your menu, and hand you the keys.' },
    { q: 'Do you take a cut of my sales?', a: 'Never. Zero commission. Your Square payments go directly to your bank account. We only charge the flat monthly fee.' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center justify-center px-6 py-24 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[150px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-orange-500/8 rounded-full blur-[120px]"></div>
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent"></div>
        </div>
        
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-5 py-2 mb-8 text-sm">
            <Flame size={16} className="text-red-500" />
            <span className="text-gray-300">Built for food trucks, pop-ups & mobile kitchens</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-6">
            <span className="bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">Your Business.</span>
            <br />
            <span className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">Your App.</span>
          </h1>
          
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed font-sans normal-case tracking-normal">
            A complete ordering, payment, and customer management platform — branded 100% as yours. No app store. No commission. No code.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a href="#pricing" className="group bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-bold py-4 px-10 rounded-full text-lg transition-all duration-300 shadow-lg shadow-red-900/30 hover:shadow-red-900/50 hover:-translate-y-0.5 flex items-center gap-2 normal-case tracking-normal font-sans">
              Get Started <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </a>
            <a href="#features" className="text-gray-400 hover:text-white font-semibold py-4 px-8 rounded-full border border-white/10 hover:border-white/20 transition-all text-lg normal-case tracking-normal font-sans">
              See Features
            </a>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { value: '16+', label: 'Core Features' },
              { value: '0%', label: 'Sales Commission' },
              { value: '24hr', label: 'Setup Time' },
              { value: 'PWA', label: 'Works Like an App' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white font-display">{stat.value}</div>
                <div className="text-xs text-gray-500 uppercase tracking-widest mt-1 font-sans">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown size={24} className="text-gray-600" />
        </div>
      </section>

      {/* ===== PROBLEM → SOLUTION ===== */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6 leading-tight">
                <span className="text-red-500">Stop losing customers</span> to clunky ordering
              </h2>
              <div className="space-y-4 text-gray-400 text-base leading-relaxed font-sans normal-case tracking-normal">
                <p>Facebook DMs. Missed calls. Screenshot menus. Manual payment chasing. Sound familiar?</p>
                <p>Every food truck owner knows the pain of managing orders through social media and spreadsheets. You lose sales, miss messages, and spend hours on admin instead of cooking.</p>
                <p className="text-white font-semibold">There's a better way.</p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-8 space-y-5">
              {[
                { before: 'DMs & phone calls', after: 'Self-service online ordering', icon: ShoppingCart },
                { before: 'Chasing bank transfers', after: 'Instant Square payments', icon: CreditCard },
                { before: '"Is my order ready?"', after: 'Automated SMS with map link', icon: Bell },
                { before: 'Spreadsheet tracking', after: 'Live order dashboard', icon: BarChart3 },
                { before: 'Forgetting regulars', after: 'Customer database + loyalty', icon: Users },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-600/20 flex items-center justify-center shrink-0">
                    <item.icon size={18} className="text-red-500" />
                  </div>
                  <div className="font-sans normal-case tracking-normal">
                    <p className="text-gray-500 text-sm line-through">{item.before}</p>
                    <p className="text-white font-medium">{item.after}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES GRID ===== */}
      <section id="features" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 font-sans">
              <Zap size={12} /> Everything Included
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Built for Food Trucks. Not Retrofitted.</h2>
            <p className="text-gray-500 max-w-xl mx-auto font-sans normal-case tracking-normal">Every feature designed specifically for mobile food businesses — from pre-order cook days to pop-up location SMS blasts.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <div key={i} className="group bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 rounded-xl p-5 transition-all duration-300">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600/20 to-orange-500/10 border border-red-600/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <f.icon size={18} className="text-red-500" />
                </div>
                <h3 className="font-bold text-white text-sm mb-1.5">{f.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed font-sans normal-case tracking-normal">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-24 px-6 border-t border-white/5 bg-gradient-to-b from-transparent via-red-950/5 to-transparent">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works for Your Customers</h2>
            <p className="text-gray-500 font-sans normal-case tracking-normal">From order to collection in five seamless steps — all automated.</p>
          </div>

          <div className="space-y-6">
            {workflow.map((w, i) => (
              <div key={i} className="flex items-start gap-6 group">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${w.color} flex items-center justify-center shrink-0 text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform`}>
                  {w.step}
                </div>
                <div className="pt-2">
                  <h3 className="font-bold text-white text-lg mb-1">{w.title}</h3>
                  <p className="text-gray-400 text-sm font-sans normal-case tracking-normal">{w.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple, Honest Pricing</h2>
            <p className="text-gray-500 font-sans normal-case tracking-normal">No hidden fees. No commission. No lock-in contracts.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Setup */}
            <div className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 rounded-2xl p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 to-orange-500"></div>
              <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4 font-sans">One-Time Setup</div>
              <div className="flex items-baseline justify-center gap-1 mb-6">
                <span className="text-5xl font-bold text-white font-display">${setupFee.toLocaleString()}</span>
              </div>
              <ul className="text-sm text-gray-400 space-y-3 text-left font-sans normal-case tracking-normal">
                {[
                  'Full app build & branding',
                  'Firebase database setup',
                  'Square payment integration',
                  'Custom domain connection',
                  'Menu & content migration',
                  'Admin training session',
                  'Go-live support',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Monthly */}
            <div className="bg-gradient-to-b from-red-600/10 to-transparent border border-red-600/30 rounded-2xl p-8 text-center relative overflow-hidden shadow-lg shadow-red-900/10">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-yellow-500"></div>
              <div className="absolute top-4 right-4 bg-red-600 text-white text-[10px] font-bold uppercase px-2.5 py-1 rounded-full tracking-wider font-sans">Popular</div>
              <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4 font-sans">Monthly</div>
              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-5xl font-bold text-white font-display">${monthlyFee}</span>
                <span className="text-gray-500 text-sm font-sans normal-case">/month</span>
              </div>
              <p className="text-xs text-gray-500 mb-6 font-sans normal-case tracking-normal">Cancel anytime. No lock-in.</p>
              <ul className="text-sm text-gray-400 space-y-3 text-left font-sans normal-case tracking-normal">
                {[
                  'Hosting & SSL included',
                  'Unlimited orders & customers',
                  'AI features (Claude + Gemini)',
                  'SMS & email infrastructure',
                  'Automatic platform updates',
                  'Priority support',
                  'Zero sales commission',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <a 
              href={`mailto:${contactEmail}?subject=I'm interested in ${businessName}&body=Hi, I'd like to learn more about getting my own food truck app set up.`}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-bold py-4 px-10 rounded-full text-lg transition-all duration-300 shadow-lg shadow-red-900/30 hover:shadow-red-900/50 hover:-translate-y-0.5 normal-case tracking-normal font-sans"
            >
              Get Your App <ArrowRight size={18} />
            </a>
            <p className="text-xs text-gray-600 mt-4 font-sans normal-case tracking-normal">Typical turnaround: 24-48 hours</p>
          </div>
        </div>
      </section>

      {/* ===== WHAT YOU GET vs DIY ===== */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">Why This vs. Building Your Own?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8">
              <h3 className="font-bold text-red-500 text-lg mb-6 flex items-center gap-2"><Shield size={20} /> {businessName}</h3>
              <ul className="space-y-3 text-sm text-gray-300 font-sans normal-case tracking-normal">
                {[
                  `$${setupFee.toLocaleString()} setup + $${monthlyFee}/mo — predictable`,
                  'Live in 24-48 hours',
                  'Battle-tested with real food businesses',
                  'AI-powered social media & SMS',
                  'Ongoing updates & new features',
                  'Square payments — no middleman',
                  'Full admin control, no code needed',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 opacity-60">
              <h3 className="font-bold text-gray-400 text-lg mb-6 flex items-center gap-2">🛠️ Build It Yourself</h3>
              <ul className="space-y-3 text-sm text-gray-500 font-sans normal-case tracking-normal">
                {[
                  '$15,000-$50,000+ development costs',
                  '3-6 months minimum build time',
                  'Ongoing developer fees for changes',
                  'No AI features unless custom-built',
                  'You manage servers & security',
                  'Payment integration from scratch',
                  'Bugs and maintenance on you',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="text-red-500 shrink-0 mt-0.5">✗</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <button
                key={i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-xl p-5 transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-bold text-white text-sm font-sans normal-case tracking-normal">{faq.q}</h3>
                  <ChevronDown size={16} className={`text-gray-500 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </div>
                {openFaq === i && (
                  <p className="text-gray-400 text-sm mt-3 leading-relaxed font-sans normal-case tracking-normal">{faq.a}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-24 px-6 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-red-600/8 rounded-full blur-[150px]"></div>
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-3xl sm:text-5xl font-bold mb-6">Ready to Level Up Your Food Truck?</h2>
          <p className="text-gray-400 text-lg mb-10 font-sans normal-case tracking-normal">
            Join food truck owners who've replaced DMs, phone calls, and spreadsheets with a professional ordering platform that works 24/7.
          </p>
          <a 
            href={`mailto:${contactEmail}?subject=I want my own Food Truck App&body=Hi, I'd like to get started with my own branded food truck app. Here are my details:%0A%0ABusiness Name: %0APhone: %0AWebsite/Social: `}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-bold py-5 px-12 rounded-full text-xl transition-all duration-300 shadow-lg shadow-red-900/30 hover:shadow-red-900/50 hover:-translate-y-0.5 normal-case tracking-normal font-sans"
          >
            Get Started Today <ArrowRight size={20} />
          </a>
          {contactPhone && (
            <p className="text-sm text-gray-500 mt-6 font-sans normal-case tracking-normal">
              Or call us: <a href={`tel:${contactPhone}`} className="text-white hover:text-red-400 transition">{contactPhone}</a>
            </p>
          )}
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-8 px-6 border-t border-white/5 text-center">
        <p className="text-xs text-gray-600 font-sans normal-case tracking-normal">
          © {new Date().getFullYear()} {businessName}. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default Landing;
