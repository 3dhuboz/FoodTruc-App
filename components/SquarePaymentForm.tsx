
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

interface SquarePaymentFormProps {
  applicationId: string;
  locationId: string;
  amount: number;
  onTokenize: (token: string) => void;
}

declare global {
  interface Window {
    Square: any;
  }
}

const SquarePaymentForm: React.FC<SquarePaymentFormProps> = ({ applicationId, locationId, amount, onTokenize }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<any>(null);
  const paymentsRef = useRef<any>(null);

  useEffect(() => {
    // Load Script
    const script = document.createElement('script');
    script.src = 'https://web.squarecdn.com/v1/square.js';
    script.onload = () => {
        setIsLoaded(true);
        initializePaymentForm();
    };
    script.onerror = () => {
        setError("Failed to load Square payment script.");
    };
    document.body.appendChild(script);

    return () => {
        if (cardRef.current) {
            cardRef.current.destroy();
        }
        document.body.removeChild(script);
    };
  }, []);

  const initializePaymentForm = async () => {
      if (!window.Square) return;
      try {
          if (!paymentsRef.current) {
              paymentsRef.current = window.Square.payments(applicationId, locationId);
          }
          const card = await paymentsRef.current.card();
          await card.attach('#card-container');
          cardRef.current = card;
      } catch (e: any) {
          console.error("Square Init Error:", e);
          setError("Failed to initialize payment form. Check credentials.");
      }
  };

  const handlePay = async () => {
      if (!cardRef.current) return;
      try {
          const result = await cardRef.current.tokenize();
          if (result.status === 'OK') {
              onTokenize(result.token);
          } else {
              setError(result.errors[0].message);
          }
      } catch (e) {
          setError("Payment processing failed.");
      }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center justify-between">
            <span>Pay with Card</span>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Square Secure</span>
        </h3>
        
        {!isLoaded && <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="animate-spin" size={16}/> Loading Secure Form...</div>}
        
        <div id="card-container" className="min-h-[100px]"></div>
        
        {error && (
            <div className="text-red-600 text-sm mt-2 flex items-center gap-2 bg-red-50 p-2 rounded">
                <AlertCircle size={16}/> {error}
            </div>
        )}

        <button 
            onClick={handlePay}
            disabled={!isLoaded || !!error}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg mt-4 transition shadow-md disabled:opacity-50"
        >
            Pay ${amount.toFixed(2)}
        </button>
        <div className="text-center mt-2">
            <span className="text-[10px] text-gray-400">Payments processed securely by Square.</span>
        </div>
    </div>
  );
};

export default SquarePaymentForm;
