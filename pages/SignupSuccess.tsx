import React from 'react';
import { CheckCircle, ArrowRight, ChefHat, Package, Monitor, QrCode } from 'lucide-react';

const SignupSuccess: React.FC = () => {
  // Extract session_id from URL if needed (for future receipt lookup)
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const sessionId = params.get('session_id');

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <img src="/logo-horizontal.png" alt="ChowNow" className="h-10 object-contain" />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg text-center">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
            <CheckCircle size={40} className="text-green-400" />
          </div>

          <h1 className="text-3xl md:text-4xl font-black mb-3">Welcome to ChowNow!</h1>
          <p className="text-gray-400 text-lg mb-8">
            Your account has been created and your subscription is active.
          </p>

          {/* Next Steps */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left space-y-5 mb-8">
            <h3 className="text-white font-bold text-lg">What happens next</h3>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
                <Package size={20} className="text-orange-400" />
              </div>
              <div>
                <p className="text-white font-bold">Your Pi is being built</p>
                <p className="text-gray-400 text-sm">We're preparing your ChowNow Pi hardware kit. It will be shipped to you with everything pre-configured and ready to plug in.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
                <Monitor size={20} className="text-orange-400" />
              </div>
              <div>
                <p className="text-white font-bold">Set up your menu</p>
                <p className="text-gray-400 text-sm">Once your subdomain is live, log into your admin dashboard to add your menu items, set your business details, and configure payments.</p>
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
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-black px-8 py-4 rounded-2xl text-lg transition active:scale-95"
          >
            Back to ChowNow <ArrowRight size={20} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default SignupSuccess;
