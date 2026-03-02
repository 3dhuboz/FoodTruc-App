import React, { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';

const InstallPwa: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // Check for iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
        setShowIOSPrompt(true);
        setTimeout(() => setShowIOSPrompt(false), 8000); // Hide after 8s
    }
  };

  if (!deferredPrompt && !isIOS) return null;

  return (
    <>
      <button 
        onClick={handleInstallClick}
        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-white transition animate-in fade-in"
      >
        <Download size={14} /> Install App
      </button>

      {/* iOS Instruction Tooltip */}
      {showIOSPrompt && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-64 bg-bbq-charcoal border border-white/20 p-4 rounded-xl shadow-2xl z-[100] text-center animate-in slide-in-from-bottom-4">
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-[8px] border-transparent border-t-bbq-charcoal"></div>
              <p className="text-white text-sm mb-2 font-bold">Install to Phone</p>
              <p className="text-gray-400 text-xs">
                  Tap <Share size={12} className="inline mx-1" /> below, then select <br/> <span className="text-white font-bold">"Add to Home Screen"</span>
              </p>
          </div>
      )}
    </>
  );
};

export default InstallPwa;