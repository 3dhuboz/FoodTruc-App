import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/Toast';
import { CateringPackage } from '../../types';
import { Plus, Trash2, Edit2, Save, X, Image as ImageIcon, Wand2, Loader2 } from 'lucide-react';
import { generateMarketingImage, generateCateringDescription } from '../../services/gemini';

// Helper to compress base64 images
const compressImage = (base64Str: string, maxWidth = 800, quality = 0.6) => {
    return new Promise<string>((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Resize logic
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
        img.onerror = () => {
            resolve(base64Str);
        };
    });
};

const CateringManager: React.FC = () => {
  const { settings, updateSettings } = useApp();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editPkg, setEditPkg] = useState<Partial<CateringPackage>>({});
  const [isGenerating, setIsGenerating] = useState<'image' | 'desc' | null>(null);

  const packages = settings.cateringPackages || [];

  const handleAiGenerate = async (type: 'image' | 'desc') => {
      if (!editPkg.name) {
          toast('Please enter a package name first.', 'warning');
          return;
      }
      
      setIsGenerating(type);
      
      if (type === 'image') {
          const prompt = `${editPkg.name} BBQ catering spread. ${editPkg.description || ''}. Buffet style, professional food photography, delicious, abundant.`;
          const img = await generateMarketingImage(prompt);
          if (img) {
              const compressed = await compressImage(img);
              setEditPkg(prev => ({ ...prev, image: compressed }));
          }
      } else {
          const desc = await generateCateringDescription(editPkg.name, { 
              meats: editPkg.meatLimit || 2, 
              sides: editPkg.sideLimit || 2 
          });
          if (desc) setEditPkg(prev => ({ ...prev, description: desc }));
      }
      
      setIsGenerating(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPkg.name || !editPkg.price) return;

    let imageToSave = editPkg.image;
    // Safety check: Compress if it's a base64 string (from manual paste or AI)
    if (imageToSave && imageToSave.startsWith('data:image')) {
        try {
            imageToSave = await compressImage(imageToSave);
        } catch (e) {
            console.error("Compression failed", e);
        }
    }

    const pkgToSave = { ...editPkg, image: imageToSave };

    let newPackages = [...packages];
    if (editPkg.id) {
        newPackages = newPackages.map(p => p.id === editPkg.id ? pkgToSave as CateringPackage : p);
    } else {
        newPackages.push({ ...pkgToSave, id: `pkg_${Date.now()}` } as CateringPackage);
    }

    const success = await updateSettings({ cateringPackages: newPackages });
    if (success) {
        toast(editPkg.id ? 'Package updated!' : 'Package created!');
        setIsEditing(false);
        setEditPkg({});
    } else {
        toast('Failed to save package.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
      if (window.confirm("Are you sure you want to delete this package?")) {
          const newPackages = packages.filter(p => p.id !== id);
          await updateSettings({ cateringPackages: newPackages });
      }
  };

  const handleSeedDefaults = async () => {
      if (window.confirm("This will overwrite any existing packages with the default set. Continue?")) {
          const defaults: CateringPackage[] = [
            {
                id: 'pkg_essential',
                name: 'The Essentials',
                description: 'The "No Fuss" option. Perfect for casual backyard gatherings or office lunches.',
                price: 35,
                minPax: 10,
                meatLimit: 2,
                sideLimit: 2,
                image: "https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=800&q=80"
            },
            {
                id: 'pkg_pitmaster',
                name: 'The Pitmaster',
                description: 'Our Crowd Favorite. A balanced spread of our best smokers cuts and sides.',
                price: 48,
                minPax: 10,
                meatLimit: 3,
                sideLimit: 3,
                image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80"
            },
            {
                id: 'pkg_wholehog',
                name: 'The Whole Hog',
                description: 'The ultimate BBQ experience. Full variety of meats, sides, and premium additions.',
                price: 65,
                minPax: 10,
                meatLimit: 4,
                sideLimit: 4,
                image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80"
            }
          ];
          await updateSettings({ cateringPackages: defaults });
      }
  };

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center border-b border-gray-700 pb-2">
            <h3 className="text-xl font-bold text-white">Catering Packages</h3>
            <div className="flex gap-2">
                {packages.length === 0 && (
                    <button 
                        onClick={handleSeedDefaults}
                        className="bg-gray-700 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-gray-600 text-white"
                    >
                        <Wand2 size={16} /> Populate Defaults
                    </button>
                )}
                <button 
                    onClick={() => { setIsEditing(true); setEditPkg({ minPax: 10, meatLimit: 2, sideLimit: 2 }); }}
                    className="bg-bbq-red px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-red-700 text-white"
                >
                    <Plus size={16} /> Add Package
                </button>
            </div>
        </div>

        {isEditing && (
            <form onSubmit={handleSave} className="bg-gray-900 p-6 rounded-lg border border-gray-700 space-y-4 animate-in slide-in-from-top-4">
                <h4 className="font-bold text-lg text-white">{editPkg.id ? 'Edit Package' : 'New Package'}</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                        <input 
                            placeholder="Package Name"
                            value={editPkg.name || ''}
                            onChange={e => setEditPkg({...editPkg, name: e.target.value})}
                            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"
                            required
                        />
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-xs text-gray-400 block mb-1">Price Per Head</label>
                                <input 
                                    type="number"
                                    placeholder="Price"
                                    value={editPkg.price || ''}
                                    onChange={e => setEditPkg({...editPkg, price: parseFloat(e.target.value)})}
                                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"
                                    required
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-gray-400 block mb-1">Min Pax</label>
                                <input 
                                    type="number"
                                    placeholder="Min Pax"
                                    value={editPkg.minPax || ''}
                                    onChange={e => setEditPkg({...editPkg, minPax: parseInt(e.target.value)})}
                                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"
                                    required
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-xs text-gray-400 block mb-1">Meat Choices</label>
                                <input 
                                    type="number"
                                    value={editPkg.meatLimit || ''}
                                    onChange={e => setEditPkg({...editPkg, meatLimit: parseInt(e.target.value)})}
                                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"
                                    required
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-gray-400 block mb-1">Side Choices</label>
                                <input 
                                    type="number"
                                    value={editPkg.sideLimit || ''}
                                    onChange={e => setEditPkg({...editPkg, sideLimit: parseInt(e.target.value)})}
                                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <textarea 
                                placeholder="Description"
                                value={editPkg.description || ''}
                                onChange={e => setEditPkg({...editPkg, description: e.target.value})}
                                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white h-24 pr-10"
                                required
                            />
                            <button 
                                type="button"
                                onClick={() => handleAiGenerate('desc')}
                                disabled={!!isGenerating}
                                className="absolute top-2 right-2 text-bbq-gold hover:text-white p-1 rounded bg-black/50"
                                title="Auto-Generate Description"
                            >
                                {isGenerating === 'desc' ? <Loader2 size={16} className="animate-spin"/> : <Wand2 size={16}/>}
                            </button>
                        </div>
                        
                        <div className="flex gap-2">
                            <input 
                                placeholder="Image URL"
                                value={editPkg.image || ''}
                                onChange={e => setEditPkg({...editPkg, image: e.target.value})}
                                className="flex-1 bg-gray-800 border border-gray-700 rounded p-2 text-white"
                            />
                            <button 
                                type="button"
                                onClick={() => handleAiGenerate('image')}
                                disabled={!!isGenerating}
                                className="bg-bbq-gold text-black p-2 rounded hover:bg-yellow-500 disabled:opacity-50"
                                title="Generate Image"
                            >
                                {isGenerating === 'image' ? <Loader2 size={20} className="animate-spin"/> : <Wand2 size={20}/>}
                            </button>
                        </div>
                        {editPkg.image && (
                            <div className="h-24 rounded overflow-hidden border border-gray-700">
                                <img src={editPkg.image} className="w-full h-full object-cover" alt="Preview"/>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-800">
                    <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-bbq-red text-white rounded font-bold flex items-center gap-2">
                        <Save size={16}/> Save Package
                    </button>
                </div>
            </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map(pkg => (
                <div key={pkg.id} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 group">
                    <div className="h-40 relative">
                        <img src={pkg.image} className="w-full h-full object-cover" alt={pkg.name}/>
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition"/>
                        <div className="absolute top-2 right-2 flex gap-2">
                            <button onClick={() => { setEditPkg(pkg); setIsEditing(true); }} className="p-2 bg-black/50 text-white rounded hover:bg-bbq-gold hover:text-black transition"><Edit2 size={16}/></button>
                            <button onClick={() => handleDelete(pkg.id)} className="p-2 bg-black/50 text-red-400 rounded hover:bg-red-600 hover:text-white transition"><Trash2 size={16}/></button>
                        </div>
                    </div>
                    <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-white text-lg">{pkg.name}</h4>
                            <span className="text-bbq-gold font-bold">${pkg.price}<span className="text-xs text-gray-500">/pp</span></span>
                        </div>
                        <p className="text-gray-400 text-xs mb-4 line-clamp-2">{pkg.description}</p>
                        <div className="flex gap-2 text-[10px] font-bold text-gray-300 uppercase">
                            <span className="bg-gray-700 px-2 py-1 rounded">{pkg.meatLimit} Meats</span>
                            <span className="bg-gray-700 px-2 py-1 rounded">{pkg.sideLimit} Sides</span>
                            <span className="bg-gray-700 px-2 py-1 rounded">Min {pkg.minPax}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};

export default CateringManager;
