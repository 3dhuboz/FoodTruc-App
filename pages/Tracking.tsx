
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Package, Truck, ArrowRight, CheckCircle, MapPin, User, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const Tracking: React.FC = () => {
  const { user, orders } = useApp();
  const [orderId, setOrderId] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [error, setError] = useState('');

  // Get active shipments for logged in user
  const myShipments = user ? orders.filter(o => o.userId === user.id && o.status === 'Shipped') : [];

  const handleTrack = (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSearchResult(null);

      const found = orders.find(o => o.id.toLowerCase() === orderId.toLowerCase() || o.trackingNumber === orderId);
      
      if (found) {
          setSearchResult(found);
      } else {
          setError("Order or Tracking Number not found. Please check and try again.");
      }
  };

  return (
    <div className="animate-in fade-in duration-700 pb-20">
        
        {/* Header */}
        <div className="bg-black/50 border-b border-white/10 py-16 px-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-blue-900/20 pointer-events-none"></div>
            <div className="relative z-10">
                <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-full mb-6 text-purple-300 backdrop-blur-md border border-white/10">
                    <Truck size={32} />
                </div>
                <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">Track Your Shipment</h1>
                <p className="text-gray-400 max-w-xl mx-auto">Enter your Order ID or Tracking Number to see the status of your barbecue delivery.</p>
            </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 -mt-8 relative z-20">
            {/* Search Box */}
            <form onSubmit={handleTrack} className="bg-bbq-charcoal p-6 rounded-2xl shadow-2xl border border-gray-700 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-3.5 text-gray-500" size={20} />
                    <input 
                        value={orderId}
                        onChange={e => setOrderId(e.target.value)}
                        placeholder="Order ID (e.g. ord_123) or Tracking Number"
                        className="w-full bg-gray-900 border border-gray-600 rounded-xl p-3 pl-12 text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                    />
                </div>
                <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-8 py-3 rounded-xl w-full md:w-auto transition flex items-center justify-center gap-2">
                    Track <ArrowRight size={18}/>
                </button>
            </form>

            {/* Error Message */}
            {error && (
                <div className="mt-6 bg-red-900/20 border border-red-800 p-4 rounded-xl text-red-300 flex items-center gap-3 animate-in fade-in">
                    <AlertCircle size={20} className="shrink-0"/>
                    {error}
                </div>
            )}

            {/* Result Card */}
            {searchResult && (
                <div className="mt-8 bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 shadow-xl">
                    <div className="bg-gray-800 p-6 border-b border-gray-700 flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Order Status</div>
                            <div className="text-2xl font-bold text-white flex items-center gap-2">
                                {searchResult.status === 'Shipped' ? (
                                    <><span className="text-purple-400">On The Way</span> <Truck className="text-purple-400" size={24}/></>
                                ) : searchResult.status === 'Completed' ? (
                                    <><span className="text-green-400">Delivered</span> <CheckCircle className="text-green-400" size={24}/></>
                                ) : (
                                    <span>{searchResult.status}</span>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Estimated Delivery</div>
                            <div className="text-lg text-white font-mono">
                                {searchResult.status === 'Shipped' ? '3-5 Business Days' : 'Completed'}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-purple-900/30 rounded-full flex items-center justify-center text-purple-400 shrink-0">
                                <Package size={20}/>
                            </div>
                            <div>
                                <h4 className="font-bold text-white text-lg">Shipment Details</h4>
                                <p className="text-sm text-gray-400">Courier: <span className="text-white">{searchResult.courier || 'Australia Post'}</span></p>
                                <p className="text-sm text-gray-400">Tracking: <span className="font-mono text-bbq-gold">{searchResult.trackingNumber || 'Pending'}</span></p>
                                {searchResult.trackingNumber && (
                                    <a 
                                        href={`https://auspost.com.au/mypost/track/#/details/${searchResult.trackingNumber}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block mt-2 text-sm text-purple-400 hover:text-white underline"
                                    >
                                        View on Courier Website
                                    </a>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-gray-800 pt-6 flex items-start gap-4">
                            <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 shrink-0">
                                <MapPin size={20}/>
                            </div>
                            <div>
                                <h4 className="font-bold text-white text-lg">Delivery Address</h4>
                                <p className="text-sm text-gray-400">{searchResult.customerName}</p>
                                <p className="text-sm text-gray-400">{searchResult.deliveryAddress || 'Pickup / No Address Provided'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Logged In User Recent Shipments */}
            {user && myShipments.length > 0 && !searchResult && (
                <div className="mt-12">
                    <h3 className="text-xl font-bold text-white mb-6 border-b border-gray-800 pb-2">My Active Shipments</h3>
                    <div className="space-y-4">
                        {myShipments.map(order => (
                            <div key={order.id} className="bg-bbq-charcoal p-4 rounded-xl border border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-purple-500 transition">
                                <div className="flex items-center gap-4">
                                    <div className="bg-purple-900/20 p-3 rounded-lg text-purple-400">
                                        <Package size={24}/>
                                    </div>
                                    <div>
                                        <div className="font-bold text-white">{order.courier || 'Post'} - {order.trackingNumber}</div>
                                        <div className="text-xs text-gray-500">Order #{order.id} • {new Date(order.createdAt).toLocaleDateString()}</div>
                                    </div>
                                </div>
                                <a 
                                    href={`https://auspost.com.au/mypost/track/#/details/${order.trackingNumber}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-white text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-200 transition"
                                >
                                    Track Package
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default Tracking;
