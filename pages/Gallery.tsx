
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/Toast';
import { Upload, Camera, Check, X, ShieldCheck, Image as ImageIcon, Heart, Share2, Instagram, Facebook } from 'lucide-react';
import { GalleryPost } from '../types';

// Helper to compress base64 images
const compressImage = (base64Str: string, maxWidth = 800, quality = 0.7) => {
    return new Promise<string>((resolve) => {
        const img = new Image();
        img.src = base64Str;
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
        img.onerror = () => resolve(base64Str);
    });
};

const FeedPost: React.FC<{ post: GalleryPost }> = ({ post }) => {
    const { user, toggleGalleryLike } = useApp();
    const { toast } = useToast();
    const isLiked = user ? post.likedBy?.includes(user.id) : false;
    const [likeAnim, setLikeAnim] = useState(false);

    const handleLike = () => {
        if (!user) {
            toast('Please login to like photos!', 'warning');
            return;
        }
        toggleGalleryLike(post.id);
        if (!isLiked) {
            setLikeAnim(true);
            setTimeout(() => setLikeAnim(false), 800);
        }
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: 'Your Business',
                text: `Check out this shot by @${post.userName}!`,
                url: window.location.href
            }).catch(() => {});
        } else {
            navigator.clipboard.writeText(window.location.href);
            toast('Link copied!');
        }
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8 max-w-md mx-auto shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 p-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-bbq-red to-orange-500 flex items-center justify-center font-bold text-white text-xs border border-white/10">
                    {post.userName.charAt(0).toUpperCase()}
                </div>
                <div>
                    <p className="text-sm font-bold text-white leading-none">{post.userName}</p>
                    <p className="text-[10px] text-gray-500">{new Date(post.createdAt).toLocaleDateString()}</p>
                </div>
            </div>

            {/* Image */}
            <div 
                className="relative w-full aspect-square bg-black group cursor-pointer"
                onDoubleClick={handleLike}
            >
                <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover" />
                
                {/* Heart Overlay Animation */}
                {likeAnim && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in zoom-in fade-out duration-700">
                        <Heart size={100} className="text-white fill-white drop-shadow-2xl opacity-80" />
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="p-4 pb-2">
                <div className="flex gap-4 mb-3">
                    <button onClick={handleLike} className="hover:scale-110 transition active:scale-95">
                        <Heart 
                            size={28} 
                            className={isLiked ? "text-red-500 fill-red-500" : "text-white"} 
                        />
                    </button>
                    <button onClick={handleShare} className="hover:scale-110 transition active:scale-95 text-white">
                        <Share2 size={28} />
                    </button>
                </div>
                <div className="text-sm font-bold text-white mb-2">
                    {post.likes || 0} likes
                </div>
                <div>
                    <span className="font-bold text-white mr-2 text-sm">{post.userName}</span>
                    <span className="text-gray-300 text-sm">{post.caption}</span>
                </div>
            </div>
        </div>
    );
};

const Gallery: React.FC = () => {
  const { galleryPosts, addGalleryPost, user, settings } = useApp();
  const { toast } = useToast();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Filter approved posts (Admin sees all in Social Manager, user sees approved here)
  const visiblePosts = galleryPosts.filter(p => p.approved || (user && p.userId === user.id));

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64 = reader.result as string;
              const compressed = await compressImage(base64);
              setSelectedImage(compressed);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleUpload = () => {
      if (!selectedImage || !user) return;
      if (!agreed) {
          toast('Please accept the terms to upload.', 'warning');
          return;
      }

      setIsUploading(true);
      setTimeout(() => {
          addGalleryPost({
              id: `gal_${Date.now()}`,
              userId: user.id,
              userName: user.name,
              imageUrl: selectedImage,
              caption: caption,
              createdAt: new Date().toISOString(),
              approved: true, // Auto-approve for demo
              likes: 0,
              likedBy: []
          });
          setIsUploading(false);
          setShowUploadModal(false);
          setSelectedImage(null);
          setCaption('');
          setAgreed(false);
          toast('Uploaded! Thanks for flexing your food.');
      }, 1500);
  };

  return (
    <div className="animate-in fade-in duration-700 pb-20">
      
      {/* Hero Section */}
      <div className="relative h-[40vh] min-h-[300px] rounded-2xl overflow-hidden shadow-2xl mb-8">
          <div className="absolute inset-0 bg-black/60 z-10" />
          <img
            src={settings.galleryHeroImage || "https://images.unsplash.com/photo-1516054575922-f0b8eeadec1a?auto=format&fit=crop&w=1950&q=80"}
            className="absolute inset-0 w-full h-full object-cover"
            alt="BBQ Gallery Hero"
          />
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-6">
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-4 tracking-tight uppercase drop-shadow-xl">
              FAN <span className="text-bbq-red">GALLERY</span>
            </h1>
            <p className="text-gray-200 max-w-xl font-light text-lg mb-6 leading-relaxed">
              Show us your Your Business spread! Upload your best shot for a chance to be featured on our official <span className="text-white font-bold inline-flex items-center gap-1 mx-1"><Instagram size={14}/> Instagram</span> & <span className="text-white font-bold inline-flex items-center gap-1 mx-1"><Facebook size={14}/> Facebook</span>.
            </p>
            <button 
                onClick={() => user ? setShowUploadModal(true) : toast('Please login to upload photos.', 'warning')}
                className="bg-white text-black font-bold uppercase tracking-widest px-8 py-3 rounded-full hover:bg-gray-200 transition shadow-xl transform hover:-translate-y-1 flex items-center gap-2"
            >
                <Camera size={18}/> Upload Your Flex
            </button>
          </div>
      </div>

      {/* Sticky Header (Secondary Nav) */}
      <div className="text-center py-4 bg-bbq-charcoal/80 border-y border-gray-800 sticky top-0 z-30 backdrop-blur-md mb-8">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Live Community Feed
          </h2>
      </div>

      {/* Feed */}
      <div className="max-w-2xl mx-auto px-4">
          {visiblePosts.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-xl">
                  <ImageIcon className="mx-auto text-gray-700 mb-4" size={48}/>
                  <p className="text-gray-500">No photos yet. Be the first to flex!</p>
                  <button 
                    onClick={() => user ? setShowUploadModal(true) : toast('Please login to upload photos.', 'warning')}
                    className="mt-4 text-bbq-gold hover:underline font-bold text-sm"
                  >
                      Upload Now
                  </button>
              </div>
          ) : (
              <div className="space-y-6">
                  {visiblePosts.map(post => (
                      <FeedPost key={post.id} post={post} />
                  ))}
              </div>
          )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
              <div className="bg-bbq-charcoal w-full max-w-md rounded-xl border border-gray-700 shadow-2xl overflow-hidden animate-in zoom-in-95">
                  <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                      <h3 className="font-bold text-white flex items-center gap-2"><Upload size={18}/> Upload Photo</h3>
                      <button onClick={() => setShowUploadModal(false)}><X className="text-gray-400 hover:text-white"/></button>
                  </div>
                  
                  <div className="p-6 space-y-6">
                      {!selectedImage ? (
                          <div className="border-2 border-dashed border-gray-600 rounded-xl h-64 flex flex-col items-center justify-center bg-black/20 hover:bg-black/40 transition relative">
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                              />
                              <Camera className="text-gray-500 mb-4" size={48}/>
                              <p className="text-gray-400 text-sm font-bold">Tap to Select Photo</p>
                          </div>
                      ) : (
                          <div className="relative rounded-xl overflow-hidden h-64 bg-black group">
                              <img src={selectedImage} className="w-full h-full object-contain" />
                              <button 
                                onClick={() => setSelectedImage(null)}
                                className="absolute top-2 right-2 bg-black/60 p-2 rounded-full text-white hover:bg-red-600 transition"
                              >
                                  <X size={16}/>
                              </button>
                          </div>
                      )}

                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Caption</label>
                          <input 
                            value={caption}
                            onChange={e => setCaption(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white focus:border-bbq-red outline-none"
                            placeholder="Write a caption..."
                          />
                      </div>

                      <div className="bg-blue-900/20 p-3 rounded border border-blue-800 text-xs text-blue-200">
                          <label className="flex gap-3 cursor-pointer items-start">
                              <input 
                                type="checkbox"
                                checked={agreed}
                                onChange={e => setAgreed(e.target.checked)}
                                className="mt-0.5 rounded bg-blue-900 border-blue-700"
                              />
                              <span>
                                  I grant <strong>Your Business</strong> permission to use this photo on their social media channels and website.
                              </span>
                          </label>
                      </div>

                      <button 
                        onClick={handleUpload}
                        disabled={!selectedImage || !agreed || isUploading}
                        className="w-full bg-bbq-red text-white font-bold py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                          {isUploading ? 'Uploading...' : 'Post to Feed'}
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default Gallery;
