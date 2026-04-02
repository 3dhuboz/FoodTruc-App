import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Order } from '../types';
import { pollSingleOrder } from '../services/syncEngine';
import { CheckCircle, Clock, Flame, Package, ChefHat, AlertCircle, ArrowLeft, CreditCard } from 'lucide-react';

type TrackableStatus = 'Confirmed' | 'Cooking' | 'Ready' | 'Completed' | 'Cancelled' | 'Rejected';

const STEPS: { status: TrackableStatus; label: string; icon: React.ReactNode }[] = [
  { status: 'Confirmed', label: 'Order Confirmed', icon: <CheckCircle size={20} /> },
  { status: 'Cooking', label: 'Cooking Now', icon: <Flame size={20} /> },
  { status: 'Ready', label: 'Ready for Pickup!', icon: <Package size={20} /> },
  { status: 'Completed', label: 'Collected', icon: <CheckCircle size={20} /> },
];

const STATUS_INDEX: Partial<Record<string, number>> = {
  Confirmed: 0,
  Cooking: 1,
  Ready: 2,
  Completed: 3,
};

const OrderStatus: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const isPaidRedirect = searchParams.get('paid') === 'true';
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) { setError('No order ID provided.'); setLoading(false); return; }

    let mounted = true;
    let timer: ReturnType<typeof setInterval>;

    const poll = async () => {
      try {
        const result = await pollSingleOrder(orderId);
        if (!mounted) return;
        if (!result) { setError('Order not found.'); setLoading(false); return; }
        setOrder(result);
        setLoading(false);
        setError(null);
      } catch {
        if (!mounted) return;
        if (!order) { setError('Unable to load order status.'); setLoading(false); }
      }
    };

    poll();
    timer = setInterval(poll, 3000); // Poll every 3s for near-real-time

    return () => { mounted = false; clearInterval(timer); };
  }, [orderId]);

  const isCancelled = order?.status === 'Cancelled' || order?.status === 'Rejected';
  const currentStep = order ? (STATUS_INDEX[order.status] ?? 0) : 0;
  const isReady = order?.status === 'Ready';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-10">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <ChefHat size={28} className="text-orange-400" />
        <span className="font-black text-xl text-white">Order Status</span>
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-4 mt-20">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading your order...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-2xl p-6 flex items-center gap-4 max-w-sm w-full mt-8">
          <AlertCircle size={28} className="text-red-400 shrink-0" />
          <div>
            <p className="font-bold text-red-300">Something went wrong</p>
            <p className="text-sm text-red-400 mt-1">{error}</p>
          </div>
        </div>
      )}

      {order && !isCancelled && (
        <div className="w-full max-w-sm space-y-6">
          {/* Payment confirmed banner (shown after Stripe redirect) */}
          {isPaidRedirect && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center gap-3">
              <CreditCard size={20} className="text-green-400 shrink-0" />
              <div>
                <div className="text-green-400 font-bold text-sm">Payment confirmed</div>
                <div className="text-green-400/70 text-xs">Your order is being prepared</div>
              </div>
            </div>
          )}

          {/* Awaiting payment notice */}
          {order.status === 'Awaiting Payment' && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 text-center">
              <div className="text-yellow-400 font-bold">Processing payment...</div>
              <div className="text-yellow-400/70 text-xs mt-1">This page will update automatically</div>
            </div>
          )}

          {/* Pending payment notice (pay at window) */}
          {order.status === 'Pending' && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 text-center">
              <div className="text-purple-400 font-bold">Pay at the window</div>
              <div className="text-purple-400/70 text-xs mt-1">Your order will start once payment is confirmed</div>
            </div>
          )}

          {/* Order Header */}
          <div className="bg-gray-900 rounded-2xl p-6 text-center border border-gray-800">
            <div className="text-gray-400 text-sm mb-1">Your order code</div>
            <div className="text-5xl font-black text-orange-400 font-mono">
              {order.collectionPin || '#' + order.id.slice(-4).toUpperCase()}
            </div>
            <div className="text-gray-500 text-xs mt-1 mb-1">Show this at the window</div>
            <div className="text-gray-300">{order.customerName}</div>
            {order.pickupLocation && (
              <div className="text-orange-400 text-sm mt-2">📍 {order.pickupLocation}</div>
            )}
          </div>

          {/* Ready Banner */}
          {isReady && (
            <div className="bg-green-500 rounded-2xl p-6 text-center animate-pulse">
              <div className="text-4xl mb-2">🎉</div>
              <div className="text-black font-black text-2xl">Your order is READY!</div>
              <div className="text-green-900 font-semibold mt-1">Come collect it now</div>
            </div>
          )}

          {/* Progress Steps */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
            {STEPS.map((step, index) => {
              const done = currentStep > index;
              const active = currentStep === index;
              return (
                <div key={step.status} className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition ${
                    done ? 'bg-green-500 text-white' :
                    active ? 'bg-orange-500 text-white animate-pulse' :
                    'bg-gray-800 text-gray-600'
                  }`}>
                    {step.icon}
                  </div>
                  <div>
                    <div className={`font-bold ${active ? 'text-white' : done ? 'text-green-400' : 'text-gray-600'}`}>
                      {step.label}
                    </div>
                    {active && step.status === 'Confirmed' && (
                      <div className="text-gray-400 text-xs">Waiting for kitchen to pick up</div>
                    )}
                    {active && step.status === 'Cooking' && (
                      <div className="text-orange-400 text-xs">Your food is being prepared 🔥</div>
                    )}
                    {active && step.status === 'Ready' && (
                      <div className="text-green-400 text-xs">Come collect your order!</div>
                    )}
                  </div>
                  {active && (
                    <div className="ml-auto">
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-ping" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Items */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Your Order</h3>
            <div className="space-y-2">
              {order.items.map((line, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-300">{line.quantity}× {line.item.name}</span>
                  <span className="text-white font-semibold">${(line.item.price * line.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-gray-700 pt-2 flex justify-between font-bold">
                <span className="text-white">Total</span>
                <span className="text-orange-400">${order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <p className="text-center text-gray-600 text-xs">
            This page updates automatically. No need to refresh.
          </p>
        </div>
      )}

      {order && isCancelled && (
        <div className="bg-red-900/20 border border-red-800 rounded-2xl p-8 max-w-sm w-full text-center space-y-3 mt-8">
          <AlertCircle size={40} className="text-red-400 mx-auto" />
          <h2 className="text-red-300 font-black text-xl">Order Cancelled</h2>
          <p className="text-red-400 text-sm">Your order #{order.id.slice(-4).toUpperCase()} was cancelled.</p>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mt-2 transition">
            <ArrowLeft size={14} /> Back to menu
          </Link>
        </div>
      )}
    </div>
  );
};

export default OrderStatus;
