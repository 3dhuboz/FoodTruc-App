
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/Toast';
import { User, UserRole } from '../types';
import { Save, User as UserIcon, MapPin, Phone, Mail, ShoppingBag, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

const CustomerProfile: React.FC = () => {
  const { user, updateUserProfile, orders } = useApp();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<User | null>(user);

  if (!user) return <div className="text-center py-20">Please login to view your profile.</div>;

  // Filter orders for this specific customer
  const myOrders = orders.filter(o => o.userId === user.id);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      updateUserProfile(formData);
      setIsEditing(false);
      toast('Profile updated successfully!');
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Pending': return 'text-yellow-500';
      case 'Ready': return 'text-green-500';
      case 'Shipped': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-20">
      
      {/* Profile Details Column */}
      <div className="md:col-span-1">
        <div className="bg-bbq-charcoal border border-gray-800 rounded-xl p-6 sticky top-24">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
              <UserIcon className="text-bbq-red" /> My Profile
            </h2>
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className="text-sm text-bbq-gold hover:underline"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={formData?.name} 
                  onChange={e => setFormData({...formData!, name: e.target.value})}
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <input 
                  type="email" 
                  value={formData?.email} 
                  onChange={e => setFormData({...formData!, email: e.target.value})}
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone</label>
                <input 
                  type="text" 
                  value={formData?.phone || ''} 
                  onChange={e => setFormData({...formData!, phone: e.target.value})}
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Delivery/Billing Address</label>
                <textarea 
                  value={formData?.address || ''} 
                  onChange={e => setFormData({...formData!, address: e.target.value})}
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white h-20"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Dietary Preferences</label>
                <input 
                  type="text" 
                  value={formData?.dietaryPreferences || ''} 
                  onChange={e => setFormData({...formData!, dietaryPreferences: e.target.value})}
                  placeholder="e.g. No gluten, Extra spicy"
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                />
              </div>
              <button type="submit" className="w-full bg-bbq-red hover:bg-red-700 text-white font-bold py-2 rounded flex items-center justify-center gap-2">
                <Save size={16} /> Save Changes
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <div className="bg-gray-800 p-2 rounded-full"><UserIcon size={16} /></div>
                <div>
                  <p className="text-xs text-gray-400">Name</p>
                  <p className="font-bold">{user.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-gray-800 p-2 rounded-full"><Mail size={16} /></div>
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="font-bold">{user.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-gray-800 p-2 rounded-full"><Phone size={16} /></div>
                <div>
                  <p className="text-xs text-gray-400">Phone</p>
                  <p className="font-bold">{user.phone || 'Not set'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-gray-800 p-2 rounded-full"><MapPin size={16} /></div>
                <div>
                  <p className="text-xs text-gray-400">Address</p>
                  <p className="font-bold">{user.address || 'Not set'}</p>
                </div>
              </div>
              {user.dietaryPreferences && (
                <div className="bg-blue-900/20 border border-blue-900 p-3 rounded text-sm text-blue-200">
                  <span className="font-bold">Preferences:</span> {user.dietaryPreferences}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Order History Column */}
      <div className="md:col-span-2 space-y-6">
        <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
          <ShoppingBag className="text-bbq-red" /> Order History
        </h2>
        
        {myOrders.length === 0 ? (
          <div className="bg-bbq-charcoal/50 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
            <p>You haven't placed any orders yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myOrders.map(order => (
              <div key={order.id} className="bg-bbq-charcoal border border-gray-800 rounded-xl p-6 hover:border-gray-600 transition">
                <div className="flex justify-between items-start mb-4 border-b border-gray-700 pb-2">
                  <div>
                    <span className="font-mono text-gray-500 text-sm">#{order.id}</span>
                    <p className="text-sm text-gray-300">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className={`font-bold ${getStatusColor(order.status)}`}>{order.status}</div>
                </div>
                
                <div className="space-y-2 mb-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.item.name}</span>
                      <span className="text-gray-400">${item.item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-between items-center font-bold text-lg pt-2 border-t border-gray-700">
                  <span className="text-sm font-normal text-gray-400">Total</span>
                  <span className="text-bbq-gold">${order.total.toFixed(2)}</span>
                </div>

                {order.status === 'Shipped' && order.trackingNumber && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase">Shipped via {order.courier || 'Post'}</p>
                                <p className="font-mono text-sm text-white">{order.trackingNumber}</p>
                            </div>
                            <a 
                                href={`https://auspost.com.au/mypost/track/#/details/${order.trackingNumber}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                            >
                                <Truck size={16}/> Track Package
                            </a>
                        </div>
                    </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default CustomerProfile;
