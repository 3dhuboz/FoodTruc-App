import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, UserRole } from '../../types';
import { Search, Edit2, Trash2, Check, X, Plus } from 'lucide-react';

const CustomerManager: React.FC = () => {
  const { users, addUser, adminUpdateUser, deleteUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<User | null>(null);
  
  // Add User State
  const [isAdding, setIsAdding] = useState(false);
  const [newUserForm, setNewUserForm] = useState<Partial<User>>({
    name: '',
    email: '',
    phone: '',
    role: UserRole.CUSTOMER,
    isVerified: true
  });

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setEditForm(user);
    setIsAdding(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = () => {
    if (editForm) {
      adminUpdateUser(editForm);
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUserForm.name && newUserForm.email) {
      addUser({
        id: `u${Date.now()}`,
        name: newUserForm.name,
        email: newUserForm.email,
        phone: newUserForm.phone,
        role: newUserForm.role || UserRole.CUSTOMER,
        isVerified: true,
        address: ''
      });
      setIsAdding(false);
      setNewUserForm({ name: '', email: '', phone: '', role: UserRole.CUSTOMER });
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this user? This cannot be undone.")) {
      deleteUser(id);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center border-b border-gray-700 pb-4">
        <div>
          <h3 className="text-2xl font-bold text-white">Customer Management</h3>
          <p className="text-gray-400">View and edit registered accounts.</p>
        </div>
        <div className="flex items-center gap-4">
           <button 
             onClick={() => setIsAdding(!isAdding)}
             className="bg-bbq-red px-4 py-2 rounded text-white font-bold flex items-center gap-2 hover:bg-red-700"
           >
             <Plus size={18} /> Add Customer
           </button>
           <div className="relative">
             <Search className="absolute left-3 top-3 text-gray-500" size={18} />
             <input 
               placeholder="Search customers..." 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-bbq-red w-64"
             />
           </div>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleCreateUser} className="bg-gray-900 border border-gray-700 p-4 rounded-lg animate-in slide-in-from-top-4">
          <h4 className="font-bold text-lg mb-4">Add New User</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
             <input 
               placeholder="Full Name"
               value={newUserForm.name}
               onChange={e => setNewUserForm({...newUserForm, name: e.target.value})}
               className="bg-gray-800 border border-gray-600 rounded p-2 text-white"
               required
             />
             <input 
               placeholder="Email"
               type="email"
               value={newUserForm.email}
               onChange={e => setNewUserForm({...newUserForm, email: e.target.value})}
               className="bg-gray-800 border border-gray-600 rounded p-2 text-white"
               required
             />
             <input 
               placeholder="Phone"
               value={newUserForm.phone}
               onChange={e => setNewUserForm({...newUserForm, phone: e.target.value})}
               className="bg-gray-800 border border-gray-600 rounded p-2 text-white"
             />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-gray-400">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-green-600 rounded text-white font-bold hover:bg-green-500">Create User</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-900/50 text-gray-400">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4">Contact</th>
              <th className="p-4">Role</th>
              <th className="p-4">Details</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-white/5 transition">
                
                {/* Name Field */}
                <td className="p-4">
                  {editingId === user.id ? (
                    <input 
                      value={editForm?.name} 
                      onChange={e => setEditForm({...editForm!, name: e.target.value})}
                      className="bg-gray-800 border border-gray-600 rounded p-1 text-white w-full"
                    />
                  ) : (
                    <div className="font-bold text-white">{user.name}</div>
                  )}
                </td>

                {/* Contact Field */}
                <td className="p-4">
                  {editingId === user.id ? (
                    <div className="space-y-1">
                      <input 
                        value={editForm?.email} 
                        onChange={e => setEditForm({...editForm!, email: e.target.value})}
                        className="bg-gray-800 border border-gray-600 rounded p-1 text-white text-xs w-full"
                        placeholder="Email"
                      />
                      <input 
                        value={editForm?.phone || ''} 
                        onChange={e => setEditForm({...editForm!, phone: e.target.value})}
                        className="bg-gray-800 border border-gray-600 rounded p-1 text-white text-xs w-full"
                        placeholder="Phone"
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm">{user.email}</div>
                      <div className="text-xs text-gray-500">{user.phone || '-'}</div>
                    </div>
                  )}
                </td>

                {/* Role Field */}
                <td className="p-4">
                   {editingId === user.id ? (
                    <select 
                      value={editForm?.role} 
                      onChange={e => setEditForm({...editForm!, role: e.target.value as UserRole})}
                      className="bg-gray-800 border border-gray-600 rounded p-1 text-white text-xs"
                    >
                      <option value="CUSTOMER">Customer</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                   ) : (
                    <span className={`text-xs px-2 py-1 rounded font-bold ${user.role === 'ADMIN' ? 'bg-red-900 text-red-200' : 'bg-blue-900 text-blue-200'}`}>
                      {user.role}
                    </span>
                   )}
                </td>

                {/* Details Field */}
                <td className="p-4 text-sm text-gray-400">
                   {editingId === user.id ? (
                     <textarea 
                        value={editForm?.address || ''}
                        onChange={e => setEditForm({...editForm!, address: e.target.value})}
                        className="bg-gray-800 border border-gray-600 rounded p-1 text-white text-xs w-full"
                        placeholder="Address"
                        rows={2}
                     />
                   ) : (
                     <div className="max-w-[150px] truncate" title={user.address}>
                       {user.address || 'No address'}
                     </div>
                   )}
                </td>

                {/* Actions */}
                <td className="p-4 text-right">
                  {editingId === user.id ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={saveEdit} className="p-2 bg-green-600 hover:bg-green-500 rounded text-white" title="Save"><Check size={16}/></button>
                      <button onClick={cancelEdit} className="p-2 bg-gray-600 hover:bg-gray-500 rounded text-white" title="Cancel"><X size={16}/></button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(user)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"><Edit2 size={16}/></button>
                      <button onClick={() => handleDelete(user.id)} className="p-2 text-red-400 hover:text-red-200 hover:bg-red-900/50 rounded"><Trash2 size={16}/></button>
                    </div>
                  )}
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomerManager;
