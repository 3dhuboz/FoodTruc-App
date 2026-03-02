
import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle, Loader2, AlertTriangle, Home, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PaymentSuccess: React.FC = () => {
  const { orders, settings } = useApp();
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'not_found'>('loading');

  useEffect(() => {
    // Extract orderId from hash query params: #/payment-success?orderId=xxx
    const hash = window.location.hash;
    const queryString = hash.split('?')[1] || '';
    const params = new URLSearchParams(queryString);
    const id = params.get('orderId');
    setOrderId(id);

    if (!id) {
      setStatus('not_found');
      return;
    }

    // Brief delay to allow Firestore listener to pick up the webhook update
    const timer = setTimeout(() => {
      const order = orders.find(o => o.id === id);
      if (order) {
        setStatus('success');
      } else {
        setStatus('success'); // Still show success - webhook will handle the rest
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [orders]);

  const order = orderId ? orders.find(o => o.id === orderId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {status === 'loading' && (
          <div className="animate-in fade-in duration-500">
            <Loader2 size={64} className="text-bbq-gold animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">Processing Payment...</h1>
            <p className="text-gray-400">Please wait while we confirm your payment.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="animate-in fade-in duration-500">
            <div className="bg-green-500/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-green-500">
              <CheckCircle size={48} className="text-green-400" />
            </div>
            <h1 className="text-3xl font-display font-bold text-white mb-3">Payment Received!</h1>
            <p className="text-gray-300 mb-2">
              Thank you for your payment{order ? ` of $${order.total.toFixed(2)}` : ''}.
            </p>
            {orderId && (
              <p className="text-sm text-gray-500 mb-6">
                Order Reference: <span className="font-mono text-gray-400">#{orderId.slice(-6)}</span>
              </p>
            )}

            {order && order.status === 'Paid' && (
              <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-6 text-left">
                <p className="text-green-300 text-sm font-bold mb-1">Order Status: Paid</p>
                <p className="text-gray-400 text-xs">Your order is now being processed. You'll receive a confirmation shortly via {order.customerEmail ? 'email' : ''}{order.customerEmail && order.customerPhone ? ' and ' : ''}{order.customerPhone ? 'SMS' : ''}.</p>
              </div>
            )}

            {order && order.status === 'Awaiting Payment' && (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-6 text-left">
                <p className="text-yellow-300 text-sm font-bold mb-1">Payment Processing</p>
                <p className="text-gray-400 text-xs">Your payment is being confirmed by Square. This usually takes a few moments. You'll receive a confirmation once complete.</p>
              </div>
            )}

            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-5 py-3 rounded-lg font-bold transition border border-gray-600"
              >
                <Home size={18} /> Home
              </button>
              {order && (
                <button
                  onClick={() => navigate('/tracking')}
                  className="flex items-center gap-2 bg-bbq-red hover:bg-red-700 text-white px-5 py-3 rounded-lg font-bold transition"
                >
                  <FileText size={18} /> Track Order
                </button>
              )}
            </div>

            <p className="text-xs text-gray-600 mt-8">
              {settings?.businessName || 'Your Business'} &bull; Powered by Square
            </p>
          </div>
        )}

        {status === 'not_found' && (
          <div className="animate-in fade-in duration-500">
            <div className="bg-yellow-500/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-yellow-500">
              <AlertTriangle size={48} className="text-yellow-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Order Not Found</h1>
            <p className="text-gray-400 mb-6">We couldn't find the order associated with this payment. If you've just paid, please allow a moment for processing.</p>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-5 py-3 rounded-lg font-bold transition border border-gray-600 mx-auto"
            >
              <Home size={18} /> Go Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;
