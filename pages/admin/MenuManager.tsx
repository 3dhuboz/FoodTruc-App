
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/Toast';
import { Plus, Edit2, Calendar, Wand2, Loader2, Image as ImageIcon, Trash2, Package, CheckSquare, Square, ChevronDown, ChevronUp, HelpCircle, ChefHat } from 'lucide-react';
import { MenuItem, PackGroup } from '../../types';
import { generateMarketingImage } from '../../services/gemini';
import { PLACEHOLDER_IMG } from '../../constants';

// Helper to compress images (handles both data URIs and external URLs)
const compressImage = (imgUrl: string, maxWidth = 800, quality = 0.6) => {
    return new Promise<string>((resolve) => {
        const img = new Image();
        // Allow cross-origin for external URLs (needed to draw to canvas)
        if (!imgUrl.startsWith('data:')) img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(imgUrl);
        img.src = imgUrl;
    });
};

const MenuManager: React.FC = () => {
  const { menu, addMenuItem, updateMenuItem, deleteMenuItem, calendarEvents } = useApp();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  
  const [editItem, setEditItem] = useState<Partial<MenuItem>>({
    availabilityType: 'everyday',
    isPack: false,
    packGroups: []
  });

  // State for Item Picker in Packs
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);

  // Filter for valid Order Pickup days from the planner
  const orderDays = calendarEvents
    .filter(evt => evt.type === 'ORDER_PICKUP' && new Date(evt.date) >= new Date(new Date().setHours(0,0,0,0)))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Group items by category for the picker (excluding Rubs & Sauces, Merch)
  const itemsByCategory = menu.reduce((acc, item) => {
      if (['Rubs & Sauces', 'Merch'].includes(item.category)) return acc;
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
  }, {} as Record<string, MenuItem[]>);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editItem.name && editItem.price) {
      const itemToSave = { ...editItem, category: editItem.category || 'Meats' };
      try {
        if (editItem.id) {
          await updateMenuItem(itemToSave as MenuItem);
          toast('Menu item updated!');
        } else {
          await addMenuItem({ ...itemToSave, id: `m${Date.now()}`, available: true } as MenuItem);
          toast('Menu item added!');
        }
        setIsEditing(false);
        setEditItem({ availabilityType: 'everyday', isPack: false, packGroups: [] });
      } catch (err: any) {
        console.error('[MenuManager] Save failed:', err);
        toast(`Save failed: ${err.message || 'Unknown error'}`, 'error');
      }
    }
  };

  // Pack Group Helpers
  const addPackGroup = () => {
      setEditItem(prev => ({
          ...prev,
          packGroups: [...(prev.packGroups || []), { name: '', limit: 1, options: [] }]
      }));
  };

  const updatePackGroup = (index: number, field: keyof PackGroup, value: any) => {
      const newGroups = [...(editItem.packGroups || [])];
      newGroups[index] = { ...newGroups[index], [field]: value };
      setEditItem(prev => ({ ...prev, packGroups: newGroups }));
  };

  const toggleItemInGroup = (groupIndex: number, itemName: string) => {
      const group = editItem.packGroups?.[groupIndex];
      if (!group) return;

      const currentOptions = group.options || [];
      let newOptions;
      if (currentOptions.includes(itemName)) {
          newOptions = currentOptions.filter(o => o !== itemName);
      } else {
          newOptions = [...currentOptions, itemName];
      }
      updatePackGroup(groupIndex, 'options', newOptions);
  };

  const removePackGroup = (index: number) => {
      setEditItem(prev => ({
          ...prev,
          packGroups: prev.packGroups?.filter((_, i) => i !== index)
      }));
  };

  const handleAiImage = async () => {
     if (!editItem.name && !editItem.description) {
         toast('Please enter a name or description first.', 'warning');
         return;
     }

     setIsGeneratingImage(true);
     try {
       const prompt = `${editItem.name || 'BBQ Food'}. ${editItem.description || ''}. Authentic, delicious, professional food photography.`;
       const imageUrl = await generateMarketingImage(prompt);

       if (imageUrl) {
           const compressed = await compressImage(imageUrl);
           setEditItem(prev => ({ ...prev, image: compressed }));
           toast('Image generated!', 'success');
       } else {
           toast('No image returned. Check your OpenRouter API key in Settings.', 'error');
       }
     } catch (err: any) {
       toast(err.message || 'Image generation failed.', 'error');
     }
     setIsGeneratingImage(false);
  };

  return (
    <div className="space-y-6">
      
      {/* GUIDE SECTION */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
          <button 
            onClick={() => setShowGuide(!showGuide)}
            className="w-full flex justify-between items-center text-blue-200 font-bold"
          >
              <span className="flex items-center gap-2"><HelpCircle size={18}/> Menu Management Guide</span>
              {showGuide ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
          </button>
          
          {showGuide && (
              <div className="mt-4 text-sm text-gray-300 space-y-4 animate-in fade-in">
                  <div>
                      <h5 className="font-bold text-white mb-1">1. Adding Basic Items</h5>
                      <p>Click "Add Item". Fill in Name, Price, and Description. Use the AI wand to auto-generate an image.</p>
                  </div>
                  <div>
                      <h5 className="font-bold text-white mb-1">2. Creating Family Packs</h5>
                      <p>Check the <strong>"This is a Pack"</strong> box. A pack acts as a "Parent" item (e.g. "Family Feast $80").</p>
                      <ul className="list-disc pl-5 mt-1 space-y-1 text-gray-400">
                          <li>Click <strong>"+ Add Choice Group"</strong> to define a selection area (e.g., "Choose 2 Burgers").</li>
                          <li>Set the <strong>Limit</strong> (e.g. 2).</li>
                          <li>Click <strong>"+ Add Items"</strong> inside the group to open the Picker.</li>
                          <li>Check the boxes of existing menu items (e.g., "OG Burger", "Pulled Pork Burger") to allow them in this group.</li>
                          <li>Repeat for other groups (e.g. "Choose 2 Sides").</li>
                      </ul>
                  </div>
                  <div>
                      <h5 className="font-bold text-white mb-1">3. Availability</h5>
                      <p><strong>Everyday:</strong> Item appears on the general menu and all cook days.</p>
                      <p><strong>Specific Date:</strong> Item only appears when the user selects that specific date in the menu calendar.</p>
                  </div>
              </div>
          )}
      </div>

      <div className="flex justify-between items-center border-b border-gray-700 pb-2">
        <h3 className="text-xl font-bold">Menu Items</h3>
        <button 
          onClick={() => { setIsEditing(true); setEditItem({ availabilityType: 'everyday', isPack: false, packGroups: [] }); }}
          className="bg-bbq-red px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-red-700"
        >
          <Plus size={16} /> Add Item
        </button>
      </div>

      {isEditing && (
        <form onSubmit={handleSave} className="bg-gray-900 p-4 rounded-lg space-y-4 border border-gray-700 animate-in slide-in-from-top-4">
          <h4 className="font-bold text-lg">{editItem.id ? 'Edit Item' : 'New Item'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
                <input 
                  placeholder="Name" 
                  value={editItem.name || ''} 
                  onChange={e => setEditItem({...editItem, name: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white" 
                  required
                />
                
                <div className="flex gap-2">
                    <input 
                      type="number"
                      placeholder="Price" 
                      value={editItem.price || ''} 
                      onChange={e => setEditItem({...editItem, price: parseFloat(e.target.value)})}
                      className="bg-gray-800 border border-gray-700 rounded p-2 text-white flex-1" 
                      required
                    />
                    <select
                       value={editItem.category || 'Meats'}
                       onChange={e => setEditItem({...editItem, category: e.target.value as any})}
                       className="bg-gray-800 border border-gray-700 rounded p-2 text-white flex-1"
                    >
                      <option value="Meats">Meats</option>
                      <option value="Burgers">Burgers</option>
                      <option value="Sides">Sides</option>
                      <option value="Platters">Platters</option>
                      <option value="Drinks">Drinks</option>
                      <option value="Bulk Meats">Bulk Meats</option>
                      <option value="Family Packs">Family Packs</option>
                      <option value="Hot Sides">Hot Sides</option>
                      <option value="Cold Sides">Cold Sides</option>
                      <option value="Bakery">Bakery</option>
                      <option value="Service">Service</option>
                      <option value="Rubs & Sauces">Rubs & Sauces</option>
                      <option value="Merch">Merch</option>
                    </select>
                </div>

                <div className="flex gap-2">
                    <input 
                      placeholder="Unit (e.g. kg, ea)" 
                      value={editItem.unit || ''} 
                      onChange={e => setEditItem({...editItem, unit: e.target.value})}
                      className="bg-gray-800 border border-gray-700 rounded p-2 text-white flex-1 text-sm" 
                    />
                    <input 
                      type="number"
                      placeholder="Min Qty (MOQ)" 
                      value={editItem.minQuantity || ''} 
                      onChange={e => setEditItem({...editItem, minQuantity: parseInt(e.target.value)})}
                      className="bg-gray-800 border border-gray-700 rounded p-2 text-white flex-1 text-sm" 
                    />
                </div>
            </div>
            
            <div className="space-y-4">
                <div className="flex gap-2">
                     <input 
                      placeholder="Image URL (or use AI wand)" 
                      value={editItem.image || ''} 
                      onChange={e => setEditItem({...editItem, image: e.target.value})}
                      className="bg-gray-800 border border-gray-700 rounded p-2 text-white flex-1" 
                    />
                    <button 
                        type="button" 
                        onClick={handleAiImage}
                        disabled={isGeneratingImage}
                        className="bg-bbq-gold text-black p-2 rounded hover:bg-yellow-500 disabled:opacity-50"
                        title="Generate with AI"
                    >
                        {isGeneratingImage ? <Loader2 className="animate-spin" size={20}/> : <Wand2 size={20} />}
                    </button>
                </div>
                {editItem.image && (
                    <div className="w-full h-32 rounded overflow-hidden border border-gray-700">
                        <img src={editItem.image} alt="Preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }} />
                    </div>
                )}
            </div>
          </div>

          <textarea 
            placeholder="Description (Serving Sizes etc.)" 
            value={editItem.description || ''}
            onChange={e => setEditItem({...editItem, description: e.target.value})}
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"
            rows={3}
          />
          
          {/* CATERING & BUILD YOUR OWN CONFIGURATION */}
          <div className="bg-black/20 p-4 rounded border border-gray-700">
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={editItem.availableForCatering || false}
                    onChange={e => setEditItem({...editItem, availableForCatering: e.target.checked})}
                    className="rounded text-bbq-red focus:ring-bbq-red w-5 h-5"
                  />
                  <span className="font-bold text-white flex items-center gap-2 text-lg"><ChefHat size={20}/> Available for Catering & Build Your Own</span>
              </label>
              
              {editItem.availableForCatering && (
                  <div className="mt-4 pl-4 border-l-2 border-bbq-red space-y-4 animate-in fade-in">
                      <div className="bg-gray-800/50 p-3 rounded">
                          <label className="block text-sm font-bold text-white mb-1">Catering Category (for Package Limits)</label>
                          <p className="text-xs text-gray-400 mb-2">Determines if this item counts towards a "Meat" or "Side" limit in fixed packages. Select 'Extra' if it's only for Build Your Own.</p>
                          <select
                            value={editItem.cateringCategory || 'Meat'}
                            onChange={e => setEditItem({...editItem, cateringCategory: e.target.value as any})}
                            className="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm w-full"
                          >
                              <option value="Meat">Meat (Counts towards Meat Limit)</option>
                              <option value="Side">Side (Counts towards Side Limit)</option>
                              <option value="Extra">Extra / Add-on (Not in Packages)</option>
                              <option value="Drink">Drink (Not in Packages)</option>
                              <option value="Dessert">Dessert (Not in Packages)</option>
                          </select>
                      </div>

                      <div className="bg-gray-800/50 p-3 rounded">
                          <label className="block text-sm font-bold text-white mb-1">Minimum Order Quantity (MOQ)</label>
                          <p className="text-xs text-gray-400 mb-2">Required minimum amount for "Build Your Own" orders (e.g. 10 burgers).</p>
                          <div className="flex items-center gap-2">
                              <input 
                                  type="number"
                                  min="1"
                                  placeholder="e.g. 10"
                                  value={editItem.moq || ''}
                                  onChange={e => setEditItem({...editItem, moq: parseInt(e.target.value) || 1})}
                                  className="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm w-24 text-center font-bold"
                              />
                              <span className="text-sm text-gray-400">units</span>
                          </div>
                      </div>
                  </div>
              )}
          </div>

          {/* PACK CONFIGURATION */}
          <div className="bg-black/20 p-3 rounded border border-gray-700">
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={editItem.isPack || false}
                    onChange={e => setEditItem({...editItem, isPack: e.target.checked})}
                    className="rounded text-bbq-red focus:ring-bbq-red"
                  />
                  <span className="font-bold text-white flex items-center gap-1"><Package size={16}/> This is a "Pack" (Requires Selections)</span>
              </label>
              
              {editItem.isPack && (
                  <div className="space-y-3 mt-2 pl-4 border-l-2 border-bbq-red">
                      <p className="text-xs text-gray-400">Define the choice groups. e.g. "Select 2 Burgers", "Select 1 Side".</p>
                      {editItem.packGroups?.map((group, idx) => (
                          <div key={idx} className="bg-gray-800 p-3 rounded border border-gray-700">
                              <div className="flex gap-2 items-center mb-3">
                                  <input 
                                    placeholder="Group Name (e.g. Burgers)"
                                    value={group.name}
                                    onChange={e => updatePackGroup(idx, 'name', e.target.value)}
                                    className="bg-gray-700 border border-gray-600 rounded p-2 text-white text-xs flex-1 font-bold"
                                  />
                                  <div className="flex items-center gap-2 bg-gray-700 px-2 rounded border border-gray-600">
                                      <span className="text-[10px] text-gray-400 uppercase font-bold">Limit:</span>
                                      <input 
                                        type="number"
                                        value={group.limit}
                                        onChange={e => updatePackGroup(idx, 'limit', parseInt(e.target.value))}
                                        className="bg-transparent w-8 p-1 text-white text-xs text-center outline-none"
                                      />
                                  </div>
                                  <button type="button" onClick={() => removePackGroup(idx)} className="text-red-400 hover:text-red-300 ml-2"><Trash2 size={16}/></button>
                              </div>

                              {/* Selected Options Tags */}
                              <div className="flex flex-wrap gap-2 mb-3">
                                  {group.options.map(opt => (
                                      <span key={opt} className="bg-bbq-red text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                          {opt} <button type="button" onClick={() => toggleItemInGroup(idx, opt)}><Trash2 size={10}/></button>
                                      </span>
                                  ))}
                                  <button 
                                    type="button" 
                                    onClick={() => setActiveGroupIndex(activeGroupIndex === idx ? null : idx)}
                                    className="bg-gray-700 text-gray-300 hover:text-white text-xs px-2 py-1 rounded flex items-center gap-1"
                                  >
                                      <Plus size={10}/> Add Items
                                  </button>
                              </div>

                              {/* Item Picker (Accordion Style) */}
                              {activeGroupIndex === idx && (
                                  <div className="bg-gray-900 border border-gray-600 rounded p-3 mt-2 animate-in fade-in">
                                      <div className="flex justify-between items-center mb-2">
                                          <span className="text-xs font-bold text-gray-400 uppercase">Select items allowed in this group:</span>
                                          <button type="button" onClick={() => setActiveGroupIndex(null)} className="text-gray-500 hover:text-white"><ChevronUp size={16}/></button>
                                      </div>
                                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                          {Object.entries(itemsByCategory).map(([catName, items]: [string, MenuItem[]]) => (
                                              <div key={catName}>
                                                  <div className="text-[10px] font-bold text-bbq-gold uppercase bg-black/20 px-2 py-1 mb-1 rounded">{catName}</div>
                                                  <div className="grid grid-cols-2 gap-1">
                                                      {items.map(m => {
                                                          const isSelected = group.options.includes(m.name);
                                                          return (
                                                              <div 
                                                                key={m.id} 
                                                                onClick={() => toggleItemInGroup(idx, m.name)}
                                                                className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs transition ${isSelected ? 'bg-green-900/30 text-green-300' : 'hover:bg-gray-800 text-gray-400'}`}
                                                              >
                                                                  {isSelected ? <CheckSquare size={12}/> : <Square size={12}/>}
                                                                  <span className="truncate">{m.name}</span>
                                                              </div>
                                                          );
                                                      })}
                                                  </div>
                                              </div>
                                          ))}
                                          
                                          {/* Manual Add Fallback */}
                                          <div className="pt-2 mt-2 border-t border-gray-700">
                                              <label className="text-[10px] text-gray-500 block mb-1">Or add custom option manually:</label>
                                              <div className="flex gap-2">
                                                  <input 
                                                    id={`manual-opt-${idx}`}
                                                    placeholder="e.g. Napkins"
                                                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                                                  />
                                                  <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const input = document.getElementById(`manual-opt-${idx}`) as HTMLInputElement;
                                                        if (input.value) {
                                                            toggleItemInGroup(idx, input.value);
                                                            input.value = '';
                                                        }
                                                    }}
                                                    className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs"
                                                  >Add</button>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              )}
                          </div>
                      ))}
                      <button type="button" onClick={addPackGroup} className="w-full py-2 border border-dashed border-gray-600 rounded text-xs font-bold text-bbq-gold hover:bg-gray-800 transition">+ Add Choice Group</button>
                  </div>
              )}
          </div>

          {/* Availability Configuration */}
          <div className="bg-black/20 p-3 rounded border border-gray-700">
             <label className="block text-sm font-bold mb-2">Availability</label>
             <div className="flex gap-4">
               <label className="flex items-center gap-2 cursor-pointer">
                 <input 
                   type="radio" 
                   name="availability" 
                   checked={editItem.availabilityType === 'everyday'}
                   onChange={() => setEditItem({...editItem, availabilityType: 'everyday'})}
                   className="text-bbq-red focus:ring-bbq-red"
                 />
                 <span className="text-sm">Everyday Menu</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer">
                 <input 
                   type="radio" 
                   name="availability" 
                   checked={editItem.availabilityType === 'specific_date'}
                   onChange={() => setEditItem({...editItem, availabilityType: 'specific_date'})}
                   className="text-bbq-red focus:ring-bbq-red"
                 />
                 <span className="text-sm">Specific Date Only</span>
               </label>
             </div>
             {editItem.availabilityType === 'specific_date' && (
               <div className="mt-3">
                 <label className="text-xs text-gray-400 font-bold mb-1 block">Select Order Dates (from Planner)</label>
                 <div className="max-h-40 overflow-y-auto border border-gray-700 rounded p-2 bg-gray-800 space-y-1 custom-scrollbar">
                   {orderDays.length === 0 ? (
                       <div className="text-xs text-gray-500 italic">No Order days scheduled in Planner.</div>
                   ) : (
                       orderDays.map(evt => {
                        const currentDates = editItem.specificDates || (editItem.specificDate ? [editItem.specificDate] : []);
                        const isSelected = currentDates.includes(evt.date);
                        
                        return (
                        <label key={evt.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 p-1 rounded transition">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                                let newDates = [...currentDates];
                                if (e.target.checked) {
                                    newDates.push(evt.date);
                                } else {
                                    newDates = newDates.filter(d => d !== evt.date);
                                }
                                setEditItem({
                                    ...editItem, 
                                    specificDates: newDates,
                                    specificDate: newDates.length > 0 ? newDates[0] : undefined // Legacy support
                                });
                            }}
                            className="rounded text-bbq-red focus:ring-bbq-red bg-gray-900 border-gray-600"
                          />
                          <span className="text-xs text-white">
                             {new Date(evt.date).toLocaleDateString()} - {evt.location} ({evt.title})
                          </span>
                        </label>
                        );
                       })
                   )}
                 </div>
                 <p className="text-[10px] text-gray-500 mt-1">Select all dates this item should appear on.</p>
               </div>
             )}
             <p className="text-[10px] text-gray-500 mt-2 italic">
                 Note: Items marked "Everyday" will also appear on specific cook dates automatically.
             </p>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-400">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-bbq-red rounded font-bold">Save Item</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {menu.map(item => (
          <div key={item.id} className="flex justify-between items-center p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-4">
              <img src={item.image || PLACEHOLDER_IMG} alt={item.name} className="w-12 h-12 rounded object-cover" onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }} />
              <div>
                <div className="font-bold flex items-center gap-2">
                    {item.name}
                    {item.isPack && <span className="text-[10px] bg-purple-900 text-purple-200 px-1 rounded border border-purple-500">PACK</span>}
                </div>
                <div className="text-sm text-gray-400">
                    ${item.price} • {item.category}
                    {item.minQuantity && item.minQuantity > 1 && <span className="text-xs text-yellow-500 ml-2">(Min: {item.minQuantity})</span>}
                </div>
                {item.availabilityType === 'specific_date' && (
                  <div className="text-xs text-bbq-gold flex items-center gap-1 mt-1">
                    <Calendar size={12} /> Only: {item.specificDates && item.specificDates.length > 0 
                        ? item.specificDates.map(d => new Date(d).toLocaleDateString()).join(', ') 
                        : (item.specificDate ? new Date(item.specificDate).toLocaleDateString() : 'N/A')}
                  </div>
                )}
                {item.availabilityType === 'everyday' && (
                    <div className="text-[10px] text-green-400 mt-1">Available Everyday</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => { setIsEditing(true); setEditItem(item); }}
                className="p-2 text-gray-400 hover:text-white"
                title="Edit"
              >
                <Edit2 size={18} />
              </button>
              <button 
                onClick={() => { if (window.confirm(`Delete "${item.name}"? This cannot be undone.`)) deleteMenuItem(item.id); }}
                className="p-2 text-red-500 hover:text-red-300 hover:bg-red-900/30 rounded"
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MenuManager;
