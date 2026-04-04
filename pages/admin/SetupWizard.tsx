import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import {
  ChefHat, Store, UtensilsCrossed, CreditCard, CalendarDays,
  Rocket, ArrowRight, ArrowLeft, Check, Plus, Trash2, Wand2,
  Loader2, QrCode, Download, ExternalLink,
} from 'lucide-react';
import { generateMarketingImage } from '../../services/gemini';
import { MenuItem } from '../../types';

// ─── Types ──────────────────────────────────────────────────

type MenuCategory = 'Burgers' | 'Meats' | 'Sides' | 'Drinks' | 'Platters' | 'Desserts';

interface WizardMenuItem {
  name: string;
  price: string;
  category: MenuCategory;
  image: string;
  generatingImage: boolean;
}

interface StepConfig {
  title: string;
  icon: React.ReactNode;
}

// ─── Constants ──────────────────────────────────────────────

const CATEGORIES: MenuCategory[] = ['Burgers', 'Meats', 'Sides', 'Drinks', 'Platters', 'Desserts'];

const STEPS: StepConfig[] = [
  { title: 'Your Truck', icon: <Store className="w-5 h-5" /> },
  { title: 'Your Menu', icon: <UtensilsCrossed className="w-5 h-5" /> },
  { title: 'Get Paid', icon: <CreditCard className="w-5 h-5" /> },
  { title: 'Your Schedule', icon: <CalendarDays className="w-5 h-5" /> },
  { title: 'Go Live!', icon: <Rocket className="w-5 h-5" /> },
];

// ─── Helpers ────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getNext7Days(): { date: string; dayName: string; dayNum: number; monthShort: string }[] {
  const days: { date: string; dayName: string; dayNum: number; monthShort: string }[] = [];
  const today = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      date: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('en-AU', { weekday: 'short' }),
      dayNum: d.getDate(),
      monthShort: d.toLocaleDateString('en-AU', { month: 'short' }),
    });
  }
  return days;
}

// ─── Component ──────────────────────────────────────────────

const SetupWizard: React.FC = () => {
  const { settings, updateSettings, menu, addMenuItem, addCalendarEvent } = useApp();
  const navigate = useNavigate();

  // Wizard state
  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Step 1 — Your Truck
  const [businessName, setBusinessName] = useState(settings.businessName || '');
  const [businessAddress, setBusinessAddress] = useState(settings.businessAddress || '');
  const [logoPreview, setLogoPreview] = useState<string>(settings.logoUrl || '');
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Step 2 — Your Menu
  const [menuItems, setMenuItems] = useState<WizardMenuItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<MenuCategory>('Burgers');

  // Step 3 — Get Paid
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(settings.stripeConnected || false);
  const [stripePolling, setStripePolling] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 4 — Your Schedule
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const next7Days = getNext7Days();

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // ─── Step 1 handlers ─────────────────────────────────────

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setLogoPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const saveStep1 = async () => {
    if (!businessName.trim()) return;
    await updateSettings({
      businessName: businessName.trim(),
      businessAddress: businessAddress.trim(),
      logoUrl: logoPreview,
    });
    markComplete(0);
  };

  // ─── Step 2 handlers ─────────────────────────────────────

  const addItem = () => {
    if (!newItemName.trim() || !newItemPrice.trim()) return;
    const price = parseFloat(newItemPrice);
    if (isNaN(price) || price <= 0) return;
    setMenuItems(prev => [
      ...prev,
      {
        name: newItemName.trim(),
        price: price.toFixed(2),
        category: newItemCategory,
        image: '',
        generatingImage: false,
      },
    ]);
    setNewItemName('');
    setNewItemPrice('');
  };

  const removeItem = (index: number) => {
    setMenuItems(prev => prev.filter((_, i) => i !== index));
  };

  const generateAiImage = async (index: number) => {
    setMenuItems(prev =>
      prev.map((item, i) => (i === index ? { ...item, generatingImage: true } : item))
    );
    try {
      const result = await generateMarketingImage(menuItems[index].name);
      setMenuItems(prev =>
        prev.map((item, i) =>
          i === index ? { ...item, image: result || '', generatingImage: false } : item
        )
      );
    } catch {
      setMenuItems(prev =>
        prev.map((item, i) => (i === index ? { ...item, generatingImage: false } : item))
      );
    }
  };

  const saveStep2 = async () => {
    for (const item of menuItems) {
      const menuItem: MenuItem = {
        id: generateId(),
        name: item.name,
        description: '',
        price: parseFloat(item.price),
        image: item.image,
        category: item.category as MenuItem['category'],
        available: true,
        availabilityType: 'everyday',
      };
      await addMenuItem(menuItem);
    }
    if (menuItems.length > 0) markComplete(1);
  };

  // ─── Step 3 handlers ─────────────────────────────────────

  const handleStripeConnect = async () => {
    setStripeLoading(true);
    try {
      const res = await fetch('/api/v1/stripe/connect-onboard', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
        startStripePolling();
      }
    } catch (err) {
      console.error('[SetupWizard] Stripe connect error:', err);
    } finally {
      setStripeLoading(false);
    }
  };

  const startStripePolling = () => {
    setStripePolling(true);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/v1/stripe/connect-status');
        const data = await res.json();
        if (data.stripeConnected) {
          setStripeConnected(true);
          setStripePolling(false);
          markComplete(2);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch {
        // keep polling
      }
    }, 3000);
  };

  // ─── Step 4 handlers ─────────────────────────────────────

  const handleDateSelect = async (date: string) => {
    setSelectedDate(date);
    await addCalendarEvent({
      id: `evt_${generateId()}`,
      date,
      type: 'ORDER_PICKUP',
      title: 'Cook Day',
    });
    markComplete(3);
  };

  // ─── Navigation ───────────────────────────────────────────

  const markComplete = (s: number) => {
    setCompletedSteps(prev => new Set([...prev, s]));
  };

  const handleNext = async () => {
    if (step === 0) await saveStep1();
    if (step === 1) await saveStep2();
    if (step === 2) markComplete(2);
    if (step === 3 && selectedDate) markComplete(3);
    if (step < 4) setStep(step + 1);
    if (step === 4) {
      markComplete(4);
      navigate('/admin');
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSkip = () => {
    if (step < 4) setStep(step + 1);
  };

  const canProceed = (): boolean => {
    if (step === 0) return businessName.trim().length > 0;
    return true;
  };

  // ─── QR Code URL for Step 5 ──────────────────────────────

  const qrOrderUrl = `${window.location.origin}#/qr-order`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrOrderUrl)}`;

  // ─── Render Steps ─────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Store className="w-12 h-12 text-orange-500 mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-white">Tell us about your truck</h2>
        <p className="text-gray-400 mt-1">This info appears on your QR menu and receipts.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Business Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={businessName}
          onChange={e => setBusinessName(e.target.value)}
          placeholder="e.g. Smoky Joe's BBQ"
          className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Business Address
        </label>
        <input
          type="text"
          value={businessAddress}
          onChange={e => setBusinessAddress(e.target.value)}
          placeholder="e.g. 123 Food Truck Lane, Melbourne VIC"
          className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Logo</label>
        <div className="flex items-center gap-4">
          {logoPreview ? (
            <img
              src={logoPreview}
              alt="Logo preview"
              className="w-16 h-16 rounded-lg object-cover border border-gray-700"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
              <ChefHat className="w-8 h-8 text-gray-600" />
            </div>
          )}
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-sm font-medium"
          >
            {logoPreview ? 'Change Logo' : 'Upload Logo'}
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <UtensilsCrossed className="w-12 h-12 text-orange-500 mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-white">Build your menu</h2>
        <p className="text-gray-400 mt-1">Add at least one item to get started. You can always add more later.</p>
      </div>

      {/* Added items list */}
      {menuItems.length > 0 && (
        <div className="space-y-2">
          {menuItems.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50"
            >
              {item.image ? (
                <img src={item.image} alt={item.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <UtensilsCrossed className="w-5 h-5 text-gray-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{item.name}</p>
                <p className="text-gray-400 text-sm">${item.price}</p>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-medium flex-shrink-0">
                {item.category}
              </span>
              <button
                type="button"
                onClick={() => generateAiImage(index)}
                disabled={item.generatingImage}
                className="p-2 rounded-lg text-gray-400 hover:text-purple-400 hover:bg-gray-700 transition-colors disabled:opacity-50 flex-shrink-0"
                title="Generate AI image"
              >
                {item.generatingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors flex-shrink-0"
                title="Remove item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add item form */}
      <div className="p-4 rounded-lg bg-gray-800 border border-gray-700 space-y-3">
        <p className="text-sm font-medium text-gray-300">Add an item</p>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={newItemName}
            onChange={e => setNewItemName(e.target.value)}
            placeholder="Item name"
            className="col-span-2 sm:col-span-1 px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          />
          <input
            type="number"
            value={newItemPrice}
            onChange={e => setNewItemPrice(e.target.value)}
            placeholder="Price"
            min="0"
            step="0.01"
            className="px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          />
          <select
            value={newItemCategory}
            onChange={e => setNewItemCategory(e.target.value as MenuCategory)}
            className="px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
          >
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={addItem}
          disabled={!newItemName.trim() || !newItemPrice.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {menuItems.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-4">
          No items yet. Add your first menu item above.
        </p>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <CreditCard className="w-12 h-12 text-orange-500 mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-white">Connect Stripe to receive payments</h2>
        <p className="text-gray-400 mt-2 max-w-md mx-auto">
          Customers pay via Stripe Checkout. Money goes straight to your bank. ChowNow takes a small 1.5% platform fee.
        </p>
      </div>

      <div className="flex flex-col items-center gap-6">
        {stripeConnected ? (
          <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-green-500/10 border border-green-500/30">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-green-400 font-semibold text-lg">Stripe Connected!</p>
            <p className="text-gray-400 text-sm">You are ready to accept payments.</p>
          </div>
        ) : stripePolling ? (
          <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-gray-800 border border-gray-700">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
            <p className="text-gray-300 font-medium">Checking...</p>
            <p className="text-gray-500 text-sm">Complete the Stripe setup in the window that opened.</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStripeConnect}
            disabled={stripeLoading}
            className="flex items-center gap-3 px-8 py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg transition-colors disabled:opacity-60 shadow-lg shadow-orange-500/20"
          >
            {stripeLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <CreditCard className="w-6 h-6" />
            )}
            Connect Stripe
          </button>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <CalendarDays className="w-12 h-12 text-orange-500 mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-white">When's your first cook day?</h2>
        <p className="text-gray-400 mt-1">Pick a day from the next week to start taking orders.</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-w-lg mx-auto">
        {next7Days.map(day => {
          const isSelected = selectedDate === day.date;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => handleDateSelect(day.date)}
              className={`flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/30'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600 hover:bg-gray-750'
              }`}
            >
              <span className={`text-xs font-medium uppercase tracking-wide ${isSelected ? 'text-orange-400' : 'text-gray-500'}`}>
                {day.dayName}
              </span>
              <span className={`text-2xl font-bold ${isSelected ? 'text-orange-400' : 'text-white'}`}>
                {day.dayNum}
              </span>
              <span className={`text-xs ${isSelected ? 'text-orange-400/70' : 'text-gray-500'}`}>
                {day.monthShort}
              </span>
              {isSelected && (
                <Check className="w-4 h-4 text-orange-400 mt-1" />
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <p className="text-center text-green-400 text-sm font-medium mt-4">
          First cook day set for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-AU', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
      )}
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-8">
      <div className="text-center mb-4">
        <div className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
          <Rocket className="w-10 h-10 text-orange-500" />
        </div>
        <h2 className="text-3xl font-bold text-white">You're all set!</h2>
        <p className="text-gray-400 mt-2">Your food truck is ready to take orders. Here are your next steps.</p>
      </div>

      <div className="grid gap-4">
        {/* QR Code Card */}
        <div className="p-5 rounded-xl bg-gray-800 border border-gray-700">
          <div className="flex items-start gap-5">
            <div className="bg-white p-2 rounded-lg flex-shrink-0">
              <img
                src={qrImageUrl}
                alt="QR Code for ordering"
                className="w-[140px] h-[140px]"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <QrCode className="w-5 h-5 text-orange-500" />
                <h3 className="text-white font-semibold">Your QR Code</h3>
              </div>
              <p className="text-gray-400 text-sm mb-3">
                Print this and stick it on your truck. Customers scan to order from their phone.
              </p>
              <a
                href={qrImageUrl}
                download="chownow-qr-code.png"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Download QR
              </a>
            </div>
          </div>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href="#/foh"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl bg-gray-800 border border-gray-700 hover:border-orange-500/50 hover:bg-gray-800/80 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Store className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium">Open Front of House</p>
              <p className="text-gray-500 text-xs">Walk-up POS for in-person orders</p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-orange-400 transition-colors flex-shrink-0" />
          </a>

          <a
            href="#/boh"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl bg-gray-800 border border-gray-700 hover:border-orange-500/50 hover:bg-gray-800/80 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <ChefHat className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium">Open Kitchen Display</p>
              <p className="text-gray-500 text-xs">Real-time orders for the kitchen</p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-orange-400 transition-colors flex-shrink-0" />
          </a>
        </div>
      </div>

      {/* Go to Dashboard */}
      <button
        type="button"
        onClick={() => navigate('/admin')}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg transition-colors shadow-lg shadow-orange-500/20"
      >
        Go to Dashboard
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );

  const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5];

  // ─── Main Render ──────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Step indicator */}
      <div className="pt-8 pb-4 px-4">
        <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
          {STEPS.map((s, i) => {
            const isActive = i === step;
            const isComplete = completedSteps.has(i);
            return (
              <React.Fragment key={i}>
                <button
                  type="button"
                  onClick={() => {
                    if (i < step || isComplete) setStep(i);
                  }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all flex-shrink-0 ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-orange-500 text-white ring-4 ring-orange-500/30'
                        : 'bg-gray-800 text-gray-500 border border-gray-700'
                  } ${i < step || isComplete ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
                  title={s.title}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : i + 1}
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 max-w-[40px] rounded transition-colors ${
                      i < step ? 'bg-green-500' : 'bg-gray-800'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <p className="text-center text-gray-500 text-sm mt-3">{STEPS[step].title}</p>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <div className="max-w-2xl mx-auto py-4">
          {stepRenderers[step]()}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 inset-x-0 bg-gray-950/95 backdrop-blur border-t border-gray-800">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-4">
          {/* Left — Back */}
          <div className="w-24">
            {step > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>

          {/* Center — Step counter */}
          <p className="text-gray-600 text-sm font-medium">
            Step {step + 1} of {STEPS.length}
          </p>

          {/* Right — Next / Skip / Finish */}
          <div className="w-24 flex justify-end gap-2">
            {step < 4 && step !== 0 && (
              <button
                type="button"
                onClick={handleSkip}
                className="px-3 py-2 rounded-lg text-gray-500 hover:text-gray-300 transition-colors text-sm"
              >
                Skip
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                step === 4
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {step === 4 ? 'Finish' : 'Next'}
              {step < 4 && <ArrowRight className="w-4 h-4" />}
              {step === 4 && <Check className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
