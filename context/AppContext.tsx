
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, MenuItem, Order, CookDay, UserRole, CartItem, SocialPost, AppSettings, CalendarEvent, GalleryPost } from '../types';
import { INITIAL_MENU, INITIAL_COOK_DAYS, INITIAL_ADMIN_USER, INITIAL_DEV_USER, INITIAL_POSTS, INITIAL_SETTINGS, INITIAL_EVENTS } from '../constants';
import { db, auth, isFirebaseConfigured } from '../services/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  where,
  deleteField,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';

interface AppContextType {
  user: User | null;
  users: User[]; 
  login: (role: UserRole, email?: string, password?: string, name?: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  addUser: (newUser: User) => void; 
  updateUserProfile: (updatedUser: User) => void; 
  adminUpdateUser: (updatedUser: User) => void; 
  deleteUser: (userId: string) => void;
  
  menu: MenuItem[];
  addMenuItem: (item: MenuItem) => Promise<void>;
  updateMenuItem: (item: MenuItem) => Promise<void>;
  deleteMenuItem: (itemId: string) => Promise<void>;
  
  cookDays: CookDay[];
  addCookDay: (day: CookDay) => void;
  
  // Calendar & Events
  calendarEvents: CalendarEvent[];
  addCalendarEvent: (event: CalendarEvent) => void;
  updateCalendarEvent: (event: CalendarEvent) => void;
  removeCalendarEvent: (eventId: string) => void;
  checkAvailability: (date: string) => boolean;
  isDatePastCutoff: (dateStr: string) => boolean; 
  
  orders: Order[];
  createOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  updateOrder: (order: Order) => void;
  
  cart: CartItem[];
  addToCart: (item: MenuItem, quantity?: number, specificDate?: string) => void;
  updateCartItemQuantity: (itemId: string, delta: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  
  socialPosts: SocialPost[];
  addSocialPost: (post: SocialPost) => void;
  updateSocialPost: (post: SocialPost) => void;
  deleteSocialPost: (postId: string) => void;

  galleryPosts: GalleryPost[];
  addGalleryPost: (post: GalleryPost) => void;
  toggleGalleryLike: (postId: string) => Promise<void>;
  
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<boolean>;

  // Reminders
  reminders: string[];
  toggleReminder: (eventId: string) => void;

  // Rewards
  verifyStaffPin: (pin: string, action: 'ADD' | 'REDEEM') => boolean;
  
  // New State
  selectedOrderDate: string | null;
  setSelectedOrderDate: (date: string | null) => void;
  
  isLoading: boolean;
  connectionError: string | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- KEY BUCKETS FOR SPLIT STORAGE ---
const HOME_KEYS = ['heroCateringImage', 'heroCookImage', 'homePromoterImage'];
const CATERING_KEYS = ['diyHeroImage', 'diyCardPackageImage', 'diyCardCustomImage', 'cateringPackageImages', 'cateringPackages'];
const PAGE_KEYS = ['eventsHeroImage', 'promotersHeroImage', 'promotersSocialImage', 'maintenanceImage', 'logoUrl', 'menuHeroImage', 'galleryHeroImage'];
const TICKER_KEYS = ['manualTickerImages'];
const REWARDS_KEYS = ['rewards'];

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Data States
  const [users, setUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(() => {
      const saved = localStorage.getItem('sm_user');
      return saved ? JSON.parse(saved) : null;
  });

  const [menu, setMenu] = useState<MenuItem[]>(() => {
      const saved = localStorage.getItem('sm_menu');
      return saved ? JSON.parse(saved) : [];
  });

  const [cookDays, setCookDays] = useState<CookDay[]>([]);
  
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => {
      const saved = localStorage.getItem('sm_events');
      return saved ? JSON.parse(saved) : [];
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [galleryPosts, setGalleryPosts] = useState<GalleryPost[]>([]);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
      const saved = localStorage.getItem('sm_settings');
      return saved ? { ...INITIAL_SETTINGS, ...JSON.parse(saved) } : INITIAL_SETTINGS;
  });
  
  // Local States
  const [cart, setCart] = useState<CartItem[]>(() => {
      const saved = localStorage.getItem('sm_cart');
      return saved ? JSON.parse(saved) : [];
  });

  const [reminders, setReminders] = useState<string[]>([]);
  
  const [selectedOrderDate, setSelectedOrderDate] = useState<string | null>(() => {
      return localStorage.getItem('sm_selected_date');
  });

  // --- LOCAL PERSISTENCE EFFECTS ---
  useEffect(() => {
      try {
        localStorage.setItem('sm_cart', JSON.stringify(cart));
      } catch (e) { console.error("LS Error", e); }
  }, [cart]);

  useEffect(() => {
      try {
        if (selectedOrderDate) localStorage.setItem('sm_selected_date', selectedOrderDate);
        else localStorage.removeItem('sm_selected_date');
      } catch (e) { console.error("LS Error", e); }
  }, [selectedOrderDate]);

  useEffect(() => {
      try {
        if (user) localStorage.setItem('sm_user', JSON.stringify(user));
        else localStorage.removeItem('sm_user');
      } catch (e) { console.error("LS Error", e); }
  }, [user]);

  // --- FIREBASE LISTENERS ---
  useEffect(() => {
    if (!isFirebaseConfigured) {
        setConnectionError("Firebase API Key Missing. Please configure VITE_FIREBASE_API_KEY in .env");
        setIsLoading(false);
        return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (!fbUser) {
            setUser(currentUser => {
                if (currentUser && currentUser.role === UserRole.ADMIN && currentUser.id === 'admin1') {
                    return currentUser;
                }
                return null;
            });
        }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const handleError = (source: string) => (error: any) => {
        if (error.code === 'permission-denied') {
            setConnectionError('Database Access Denied.');
        } else {
            console.error(`Firebase Sync Error (${source}):`, error);
        }
        markLoaded(source);
    };

    // Track first snapshot from each core listener before hiding loading screen
    const loaded = new Set<string>();
    const REQUIRED = ['Menu', 'Orders', 'Settings'];
    const markLoaded = (source: string) => {
        loaded.add(source);
        if (REQUIRED.every(s => loaded.has(s))) {
            setIsLoading(false);
        }
    };
    // Timeout fallback: show whatever we have after 5s even if Firestore is slow/offline
    const fallbackTimer = setTimeout(() => setIsLoading(false), 5000);

    const unsubMenu = onSnapshot(collection(db, 'menu'), async (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MenuItem));
        const existingIds = new Set(data.map(d => d.id));
        const missingSeedItems = INITIAL_MENU.filter(item => !existingIds.has(item.id));

        if (missingSeedItems.length > 0) {
            // Add any missing seed items to Firestore (handles fresh DB and partial loss)
            try {
                const batch = writeBatch(db);
                missingSeedItems.forEach(item => batch.set(doc(db, 'menu', item.id), item));
                await batch.commit();
                // onSnapshot will fire again with the full set — skip setState here
            } catch (e) {
                console.warn("Failed to restore seed menu items:", e);
                // Fallback: merge locally
                setMenu([...data, ...missingSeedItems]);
            }
        } else if (data.length > 0) { 
            setMenu(data); 
            try { 
                // Strip images from local storage to prevent quota exceeded errors
                const minimalMenu = data.map(item => ({ ...item, image: '' }));
                localStorage.setItem('sm_menu', JSON.stringify(minimalMenu)); 
            } catch (e) { 
                console.warn("LS Error: Menu too large for local storage", e); 
            }
        }
        setConnectionError(null);
        markLoaded('Menu');
    }, handleError('Menu'));

    const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Order));
        setOrders(data);
        setConnectionError(null);
        markLoaded('Orders');
    }, handleError('Orders'));

    const unsubEvents = onSnapshot(collection(db, 'events'), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CalendarEvent));
        if (data.length === 0 && calendarEvents.length === 0) setCalendarEvents(INITIAL_EVENTS);
        else if (data.length > 0) { 
            setCalendarEvents(data); 
            try { localStorage.setItem('sm_events', JSON.stringify(data)); } catch (e) { console.error("LS Error", e); }
        }
        setConnectionError(null);
    }, handleError('Events'));

    // Gallery Listener
    const unsubGallery = onSnapshot(query(collection(db, 'gallery_posts'), orderBy('createdAt', 'desc')), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as GalleryPost));
        setGalleryPosts(data);
    }, handleError('Gallery'));

    const unsubSocialPosts = onSnapshot(query(collection(db, 'social_posts'), orderBy('scheduledFor', 'desc')), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SocialPost));
        setSocialPosts(data);
    }, handleError('SocialPosts'));

    // Settings Listeners
    const mergeSettings = (docData: any) => {
        if (!docData) return;
        setSettings(prev => {
            const updated = { ...prev, ...docData } as AppSettings;
            try {
                localStorage.setItem('sm_settings', JSON.stringify(updated));
            } catch (e: any) {
                if (e.name === 'QuotaExceededError' || e.code === 22) {
                    console.warn("Local Storage Quota Exceeded for Settings. Caching disabled for this item.");
                } else {
                    console.error("Local Storage Error (Settings)", e);
                }
            }
            return updated;
        });
    };
    const unsubGeneral = onSnapshot(doc(db, 'settings', 'general'), snap => { mergeSettings(snap.data()); markLoaded('Settings'); }, handleError('Settings'));
    const unsubTicker = onSnapshot(doc(db, 'settings', 'ticker'), snap => mergeSettings(snap.data()), handleError('Ticker'));
    const unsubImgHome = onSnapshot(doc(db, 'settings', 'img_home'), snap => mergeSettings(snap.data()), handleError('Img Home'));
    const unsubImgCat = onSnapshot(doc(db, 'settings', 'img_catering'), snap => mergeSettings(snap.data()), handleError('Img Cat'));
    const unsubImgPages = onSnapshot(doc(db, 'settings', 'img_pages'), snap => mergeSettings(snap.data()), handleError('Img Pages'));
    const unsubRewards = onSnapshot(doc(db, 'settings', 'rewards'), snap => mergeSettings(snap.data()), handleError('Rewards'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setUsers(data);
        if (auth.currentUser) {
            const me = data.find(u => u.id === auth.currentUser?.uid);
            if (me) setUser(me);
        }
        setConnectionError(null);
    }, handleError('Users'));

    return () => {
        clearTimeout(fallbackTimer);
        unsubMenu(); unsubOrders(); unsubEvents(); unsubGallery(); unsubSocialPosts();
        unsubGeneral(); unsubTicker(); unsubImgHome(); unsubImgCat(); unsubImgPages(); unsubRewards();
        unsubUsers();
    };
  }, []);

  // --- ACTIONS ---

  const login = async (role: UserRole, email?: string, password?: string, name?: string, rememberMe: boolean = true) => {
    try {
        if (role === UserRole.ADMIN) {
            // Dev backdoor — hardcoded, not in Firestore
            if (email === 'dev' && password === '123') {
                setUser(INITIAL_DEV_USER);
                return;
            }
            if (email === settings.adminUsername && password === settings.adminPassword) {
                setUser(INITIAL_ADMIN_USER);
                return;
            }
            throw new Error('Invalid admin credentials');
        } 
        if (email && password) {
            await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (e: any) {
                if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
                    const res = await createUserWithEmailAndPassword(auth, email, password);
                    const newUser: User = { id: res.user.uid, name: name || 'New User', email: email, role: UserRole.CUSTOMER, isVerified: true, stamps: 0 };
                    await setDoc(doc(db, 'users', res.user.uid), newUser);
                } else { throw e; }
            }
        }
    } catch (e) {
        console.error("Auth Error", e);
        console.error("Authentication failed. Please check credentials.");
        throw e;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    localStorage.removeItem('sm_user');
  };

  const addUser = async (newUser: User) => {
      await setDoc(doc(db, 'users', newUser.id), newUser);
  };

  const updateUserProfile = async (updatedUser: User) => {
      await setDoc(doc(db, 'users', updatedUser.id), updatedUser, { merge: true });
  };

  const adminUpdateUser = async (updatedUser: User) => {
      await setDoc(doc(db, 'users', updatedUser.id), updatedUser, { merge: true });
  };

  const deleteUser = async (userId: string) => {
      await deleteDoc(doc(db, 'users', userId));
  };

  const addMenuItem = async (item: MenuItem) => {
      await setDoc(doc(db, 'menu', item.id), item);
  };

  const updateMenuItem = async (item: MenuItem) => {
      await updateDoc(doc(db, 'menu', item.id), { ...item });
  };

  const deleteMenuItem = async (itemId: string) => {
      await deleteDoc(doc(db, 'menu', itemId));
  };

  const addCalendarEvent = async (event: CalendarEvent) => {
      await setDoc(doc(db, 'events', event.id), event);
  };

  const updateCalendarEvent = async (event: CalendarEvent) => {
      await updateDoc(doc(db, 'events', event.id), { ...event });
  };

  const removeCalendarEvent = async (eventId: string) => {
      await deleteDoc(doc(db, 'events', eventId));
  };

  // STRICT CUTOFF LOGIC: 9AM Morning PRIOR to cook date
  const isDatePastCutoff = (dateStr: string): boolean => {
      const cookDate = new Date(dateStr);
      // Create cutoff date: 1 day before cook date
      const cutoffDate = new Date(cookDate);
      cutoffDate.setDate(cookDate.getDate() - 1);
      cutoffDate.setHours(9, 0, 0, 0); // 9:00 AM

      const now = new Date();
      return now > cutoffDate;
  };

  const checkAvailability = (dateStr: string): boolean => {
    // 1. Check cut off
    if (isDatePastCutoff(dateStr)) return false;

    // 2. Check blocks
    const blocked = calendarEvents.find(e => e.date === dateStr && e.type === 'BLOCKED');
    if (blocked) return false;

    // 3. Check capacity
    const ordersOnDay = orders.filter(o => o.cookDay === dateStr && o.type === 'CATERING');
    if (ordersOnDay.length >= 2) return false;
    
    return true;
  };

  const createOrder = async (order: Order) => {
      await setDoc(doc(db, 'orders', order.id), order);
      
      // If the user had a discount and used it, remove it from their profile
      if (order.discountApplied && user && user.hasCateringDiscount) {
          const updatedUser = { ...user, hasCateringDiscount: false };
          setUser(updatedUser); // Optimistic UI update
          await updateUserProfile(updatedUser);
      }

      clearCart();
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { status });
      
      if (status === 'Confirmed') {
          const order = orders.find(o => o.id === orderId);
          if (order && order.type === 'CATERING') {
               const dateStr = new Date(order.cookDay).toISOString().split('T')[0];
               const newEvent: CalendarEvent = {
                id: `evt_o_${order.id}`,
                date: dateStr,
                type: 'ORDER_PICKUP',
                title: `Pickup: ${order.customerName}`,
                orderId: order.id
              };
              await setDoc(doc(db, 'events', newEvent.id), newEvent);
          }
      }
  };

  const updateOrder = async (updatedOrder: Order) => {
      await setDoc(doc(db, 'orders', updatedOrder.id), updatedOrder);
  };

  const addToCart = (item: MenuItem, quantity: number = 1, specificDate?: string) => {
    if (specificDate && selectedOrderDate && selectedOrderDate !== specificDate) {
        if (!window.confirm(`Your cart contains items for ${new Date(selectedOrderDate).toLocaleDateString()}. Clear cart to add items for ${new Date(specificDate).toLocaleDateString()}?`)) {
            return;
        }
        setCart([]); 
        setSelectedOrderDate(specificDate);
    }

    if (!selectedOrderDate && specificDate) {
        setSelectedOrderDate(specificDate);
    }
    
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { ...item, quantity: quantity }];
    });
  };

  const updateCartItemQuantity = (itemId: string, delta: number) => {
      setCart(prev => {
          return prev.map(item => {
              if (item.id === itemId) {
                  return { ...item, quantity: Math.max(0, item.quantity + delta) };
              }
              return item;
          }).filter(i => i.quantity > 0);
      });
  };

  const removeFromCart = (itemId: string) => setCart(prev => prev.filter(i => i.id !== itemId));
  const clearCart = () => setCart([]);

  const addSocialPost = async (post: SocialPost) => {
      await setDoc(doc(db, 'social_posts', post.id), post);
      setSocialPosts(prev => [post, ...prev]);
  };

  const updateSocialPost = async (post: SocialPost) => {
      await setDoc(doc(db, 'social_posts', post.id), post);
      setSocialPosts(prev => prev.map(p => p.id === post.id ? post : p));
  };

  const deleteSocialPost = async (postId: string) => {
      await deleteDoc(doc(db, 'social_posts', postId));
      setSocialPosts(prev => prev.filter(p => p.id !== postId));
  };
  
  const addGalleryPost = async (post: GalleryPost) => {
      await setDoc(doc(db, 'gallery_posts', post.id), post);
  };

  const toggleGalleryLike = async (postId: string) => {
      if (!user) return;
      const post = galleryPosts.find(p => p.id === postId);
      if (!post) return;

      const isLiked = post.likedBy?.includes(user.id);
      const postRef = doc(db, 'gallery_posts', postId);

      if (isLiked) {
          // Unlike
          await updateDoc(postRef, {
              likes: increment(-1),
              likedBy: arrayRemove(user.id)
          });
      } else {
          // Like
          await updateDoc(postRef, {
              likes: increment(1),
              likedBy: arrayUnion(user.id)
          });
      }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
      const merged = { ...settings, ...newSettings };
      setSettings(merged);
      
      const generalPayload: Partial<AppSettings> = {};
      const homePayload: Partial<AppSettings> = {};
      const cateringPayload: Partial<AppSettings> = {};
      const pagePayload: Partial<AppSettings> = {};
      const tickerPayload: Partial<AppSettings> = {};
      const rewardsPayload: Partial<AppSettings> = {};

      Object.keys(merged).forEach(key => {
          if (TICKER_KEYS.includes(key)) { // @ts-ignore
              tickerPayload[key] = merged[key]; // @ts-ignore
              generalPayload[key] = deleteField();
          } else if (HOME_KEYS.includes(key)) { // @ts-ignore
              homePayload[key] = merged[key]; // @ts-ignore
              generalPayload[key] = deleteField();
          } else if (CATERING_KEYS.includes(key)) { // @ts-ignore
              cateringPayload[key] = merged[key]; // @ts-ignore
              generalPayload[key] = deleteField();
          } else if (PAGE_KEYS.includes(key)) { // @ts-ignore
              pagePayload[key] = merged[key]; // @ts-ignore
              generalPayload[key] = deleteField();
          } else if (REWARDS_KEYS.includes(key)) { // @ts-ignore
              rewardsPayload[key] = merged[key]; // @ts-ignore
              generalPayload[key] = deleteField();
          } else { // @ts-ignore
              generalPayload[key] = merged[key];
          }
      });

      try {
          const promises = [];
          if (Object.keys(generalPayload).length > 0) promises.push(setDoc(doc(db, 'settings', 'general'), generalPayload, { merge: true }));
          if (Object.keys(tickerPayload).length > 0) promises.push(setDoc(doc(db, 'settings', 'ticker'), tickerPayload, { merge: true }));
          if (Object.keys(rewardsPayload).length > 0) promises.push(setDoc(doc(db, 'settings', 'rewards'), rewardsPayload, { merge: true }));
          if (Object.keys(homePayload).length > 0) promises.push(setDoc(doc(db, 'settings', 'img_home'), homePayload, { merge: true }));
          if (Object.keys(cateringPayload).length > 0) promises.push(setDoc(doc(db, 'settings', 'img_catering'), cateringPayload, { merge: true }));
          if (Object.keys(pagePayload).length > 0) promises.push(setDoc(doc(db, 'settings', 'img_pages'), pagePayload, { merge: true }));
          await Promise.all(promises);
          return true;
      } catch (error: any) {
          console.error("Save settings error:", error);
          console.error("Failed to save settings. Please check your internet connection.");
          return false;
      }
  };

  const addCookDay = (day: CookDay) => setCookDays(prev => [...prev, day]);

  const toggleReminder = (eventId: string) => {
      let newReminders;
      if (reminders.includes(eventId)) newReminders = reminders.filter(id => id !== eventId);
      else newReminders = [...reminders, eventId];
      setReminders(newReminders);
      localStorage.setItem('sm_reminders', JSON.stringify(newReminders));
  };

  const verifyStaffPin = (pin: string, action: 'ADD' | 'REDEEM'): boolean => {
      if (pin !== settings.rewards.staffPin) return false;
      if (user) {
          const currentStamps = user.stamps || 0;
          let newStamps = currentStamps;
          if (action === 'ADD') newStamps = currentStamps + 1;
          else if (action === 'REDEEM') newStamps = Math.max(0, currentStamps - settings.rewards.maxStamps);
          
          const updatedUser = { ...user, stamps: newStamps };
          setUser(updatedUser);
          updateUserProfile(updatedUser);
      }
      return true;
  };

  return (
    <AppContext.Provider value={{
      user, users, login, logout, addUser, updateUserProfile, adminUpdateUser, deleteUser,
      menu, addMenuItem, updateMenuItem, deleteMenuItem,
      cookDays, addCookDay,
      calendarEvents, addCalendarEvent, updateCalendarEvent, removeCalendarEvent, checkAvailability, isDatePastCutoff,
      orders, createOrder, updateOrderStatus, updateOrder,
      cart, addToCart, updateCartItemQuantity, removeFromCart, clearCart,
      socialPosts, addSocialPost, updateSocialPost, deleteSocialPost,
      galleryPosts, addGalleryPost, toggleGalleryLike,
      settings, updateSettings,
      reminders, toggleReminder,
      verifyStaffPin,
      selectedOrderDate, setSelectedOrderDate,
      isLoading,
      connectionError
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
