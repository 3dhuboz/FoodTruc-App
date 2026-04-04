import React, { useState } from 'react';
import { CheckCircle, ArrowRight, Package, Monitor, QrCode, CreditCard, Loader2 } from 'lucide-react';

const SignupSuccess: React.FC = () => {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const sessionId = params.get('session_id');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleStripeConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await fetch('/api/v1/stripe/connect-onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // If onboarding fails here they can do it later from Settings
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <img src="/logo-horizontal.png" alt="ChowNow" className="h-10 object-contain" />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg text-center">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
            <CheckCircle size={40} className="text-green-400" />
          </div>

          <h1 className="text-3xl md:text-4xl font-black mb-3">Welcome to ChowNow!</h1>
          <p className="text-gray-400 text-lg mb-8">
            Your account has been created and your subscription is active.
          </p>

          {/* Stripe Connect CTA */}
          <div className="bg-gradient-to-br from-orange-950/40 to-gray-900 border border-orange-600/30 rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <CreditCard size={24} className="text-orange-400" />
              </div>
              <div className="text-left">
                <p className="text-white font-black text-lg">Set up payments</p>
                <p className="text-gray-400 text-sm">Connect Stripe to start accepting orders</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4 text-left">
              Complete a quick Stripe onboarding to accept card payments, Apple Pay, and Google Pay. Stripe handles identity verification and payouts to your bank automatically.
            </p>
            <button
              onClick={handleStripeConnect}
              disabled={isConnecting}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-black px-6 py-4 rounded-xl text-lg transition active:scale-95 flex items-center justify-center gap-2"
            >
              {isConnecting
                ? <><Loader2 size={20} className="animate-spin" /> Setting up...</>
                : <><CreditCard size={20} /> Connect Stripe Now</>}
            </button>
            <p className="text-gray-600 text-xs mt-2">You can also do this later from your admin Settings.</p>
          </div>

          {/* Next Steps */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left space-y-5 mb-8">
            <h3 className="text-white font-bold text-lg">What happens next</h3>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
                <Package size={20} className="text-orange-400" />
              </div>
              <div>
                <p className="text-white font-bold">Your ChowBox is being built</p>
                <p className="text-gray-400 text-sm">We're preparing your ChowBox — the brains of your operation. It will be shipped to you pre-configured and ready to plug in.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
                <Monitor size={20} className="text-orange-400" />
              </div>
              <div>
                <p className="text-white font-bold">Set up your menu</p>
                <p className="text-gray-400 text-sm">Log into your admin dashboard to add menu items, set your business details, and customise your branding.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
                <QrCode size={20} className="text-orange-400" />
              </div>
              <div>
                <p className="text-white font-bold">Print your QR code</p>
                <p className="text-gray-400 text-sm">Generate your QR code from the admin panel and display it on your truck. Customers scan it to order directly from their phone.</p>
              </div>
            </div>
          </div>

          <p className="text-gray-500 text-sm mb-6">
            We'll send you an email with your login details and subdomain link once everything is ready.
            This usually takes less than 24 hours.
          </p>

          <a
            href="/"
            className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-black px-8 py-4 rounded-2xl text-lg transition active:scale-95"
          >
            Back to ChowNow <ArrowRight size={20} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default SignupSuccess;
