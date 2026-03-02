
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, MenuItem, Order, CookDay, UserRole, CartItem, SocialPost, AppSettings, CalendarEvent, GalleryPost } from '../types';
import { INITIAL_MENU, INITIAL_COOK_DAYS, INITIAL_ADMIN_USER, INITIAL_DEV_USER, INITIAL_POSTS, INITIAL_SETTINGS, INITIAL_EVENTS } from '../constants';
import { db, auth, isFirebaseConfigured } from '../services/firebase';
import { setGeminiApiKey } from '../services/gemini';
import { restSetDoc, restGetDoc, restListDocs } from '../services/firestoreRest';
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
const HOME_KEYS = ['heroCateringImage', 'heroCookImage', 'homePromoterImage', 'homeScheduleCardImage', 'homeMenuCardImage'];
const CATERING_KEYS = ['diyHeroImage', 'diyCardPackageImage', 'diyCardCustomImage', 'cateringPackageImages', 'cateringPackages'];
const PAGE_KEYS = ['eventsHeroImage', 'promotersHeroImage', 'promotersSocialImage', 'maintenanceImage', 'logoUrl', 'menuHeroImage', 'galleryHeroImage'];
const TICKER_KEYS = ['manualTickerImages'];
const REWARDS_KEYS = ['rewards'];

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Data States
  const [users, setUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(null);

  const [menu, setMenu] = useState<MenuItem[]>([]);

  const [cookDays, setCookDays] = useState<CookDay[]>([]);
  
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [galleryPosts, setGalleryPosts] = useState<GalleryPost[]>([]);
  
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  
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

    // Settings merge helper
    const mergeSettings = (docData: any) => {
        if (!docData) return;
        // Set Gemini key immediately (not deferred inside React state batch)
        if (docData.geminiApiKey) {
            setGeminiApiKey(docData.geminiApiKey);
        }
        setSettings(prev => ({ ...prev, ...docData } as AppSettings));
    };

    // REST API bootstrap: load ALL core data immediately (SDK onSnapshot may be slow to connect)
    const settingsDocs = ['general', 'ticker', 'img_home', 'img_catering', 'img_pages', 'rewards'];
    Promise.all(settingsDocs.map(id => restGetDoc('settings', id).catch(() => null)))
      .then(results => {
        results.forEach(docData => {
          if (docData && Object.keys(docData).length > 0) {
            mergeSettings(docData);
          }
        });
        console.log('[REST Bootstrap] Settings loaded');
        markLoaded('Settings');
      })
      .catch(e => console.warn('[REST Bootstrap] Settings failed:', e));

    restListDocs('menu').then(docs => {
      if (docs.length > 0) {
        setMenu(docs as MenuItem[]);
        markLoaded('Menu');
        console.log(`[REST Bootstrap] Menu loaded (${docs.length} items)`);
      }
    }).catch(e => console.warn('[REST Bootstrap] Menu failed:', e));

    restListDocs('orders').then(docs => {
      if (docs.length > 0) {
        const sorted = (docs as Order[]).sort((a, b) => {
          const aTime = (a.createdAt as any)?.seconds || 0;
          const bTime = (b.createdAt as any)?.seconds || 0;
          return bTime - aTime;
        });
        setOrders(sorted);
        markLoaded('Orders');
        console.log(`[REST Bootstrap] Orders loaded (${docs.length})`);
      } else {
        markLoaded('Orders');
      }
    }).catch(e => { console.warn('[REST Bootstrap] Orders failed:', e); markLoaded('Orders'); });

    restListDocs('events').then(docs => {
      if (docs.length > 0) setCalendarEvents(docs as CalendarEvent[]);
      else if (calendarEvents.length === 0) setCalendarEvents(INITIAL_EVENTS);
      console.log(`[REST Bootstrap] Events loaded (${docs.length})`);
    }).catch(e => console.warn('[REST Bootstrap] Events failed:', e));
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
      
      // Only route the keys that were actually passed, not the entire settings blob
      const keysToSave = Object.keys(newSettings);
      const generalPayload: Record<string, any> = {};
      const homePayload: Record<string, any> = {};
      const cateringPayload: Record<string, any> = {};
      const pagePayload: Record<string, any> = {};
      const tickerPayload: Record<string, any> = {};
      const rewardsPayload: Record<string, any> = {};

      keysToSave.forEach(key => {
          const val = (newSettings as any)[key];
          if (TICKER_KEYS.includes(key)) tickerPayload[key] = val;
          else if (HOME_KEYS.includes(key)) homePayload[key] = val;
          else if (CATERING_KEYS.includes(key)) cateringPayload[key] = val;
          else if (PAGE_KEYS.includes(key)) pagePayload[key] = val;
          else if (REWARDS_KEYS.includes(key)) rewardsPayload[key] = val;
          else generalPayload[key] = val;
      });

      // Use REST API for writes (bypasses unreliable SDK WebChannel)
      const promises = [];
      if (Object.keys(generalPayload).length > 0) promises.push(restSetDoc('settings', 'general', generalPayload));
      if (Object.keys(tickerPayload).length > 0) promises.push(restSetDoc('settings', 'ticker', tickerPayload));
      if (Object.keys(rewardsPayload).length > 0) promises.push(restSetDoc('settings', 'rewards', rewardsPayload));
      if (Object.keys(homePayload).length > 0) promises.push(restSetDoc('settings', 'img_home', homePayload));
      if (Object.keys(cateringPayload).length > 0) promises.push(restSetDoc('settings', 'img_catering', cateringPayload));
      if (Object.keys(pagePayload).length > 0) promises.push(restSetDoc('settings', 'img_pages', pagePayload));
      try {
          await Promise.all(promises);
          console.log('[Settings] Saved via REST API');
          return true;
      } catch (err: any) {
          console.error('[Settings] REST write failed:', err.message);
          return false;
      }
  };

  const addCookDay = (day: CookDay) => setCookDays(prev => [...prev, day]);

  const toggleReminder = (eventId: string) => {
      let newReminders;
      if (reminders.includes(eventId)) newReminders = reminders.filter(id => id !== eventId);
      else newReminders = [...reminders, eventId];
      setReminders(newReminders);
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
