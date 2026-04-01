/**
 * AppContext — Cloudflare D1 + Offline-First
 *
 * Data flow:
 * 1. Bootstrap: load from IndexedDB (instant, even offline)
 * 2. Start sync engine: poll D1 API, merge into IndexedDB + React state
 * 3. Writes: try API first → fallback to outbox queue if offline
 * 4. Outbox auto-replays when connectivity returns
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, MenuItem, Order, CookDay, UserRole, CartItem, SocialPost, AppSettings, CalendarEvent, GalleryPost } from '../types';
import { INITIAL_SETTINGS, INITIAL_EVENTS } from '../constants';
import {
  fetchMenu as apiFetchMenu, upsertMenuItem, deleteMenuItem as apiDeleteMenuItem,
  fetchOrders as apiFetchOrders, createOrderApi, updateOrderApi, deleteOrderApi,
  fetchSettings as apiFetchSettings, updateSettingsApi,
  fetchEvents as apiFetchEvents, upsertEvent, deleteEventApi,
  fetchSocialPosts as apiFetchSocialPosts, upsertSocialPost, deleteSocialPostApi,
  fetchGalleryPosts as apiFetchGalleryPosts, submitGalleryPost, toggleGalleryLikeApi,
} from '../services/api';
import {
  cacheMenu, cacheOrders, cacheOrder, cacheSettings, cacheEvents,
  getCachedMenu, getCachedOrders, getCachedSettings, getCachedEvents,
  addToOutbox, getOutboxCount,
} from '../services/offlineStore';
import { startSync, stopSync, onSync, getOnlineStatus, bootstrap } from '../services/syncEngine';

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

  reminders: string[];
  toggleReminder: (eventId: string) => void;
  verifyStaffPin: (pin: string, action: 'ADD' | 'REDEEM') => boolean;

  selectedOrderDate: string | null;
  setSelectedOrderDate: (date: string | null) => void;

  isLoading: boolean;
  connectionError: string | null;

  // Offline-first additions
  isOnline: boolean;
  pendingSyncCount: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const BUILD_VERSION = '2026.04.01a';
  console.log(`[Street Eats] Build ${BUILD_VERSION} — Cloudflare D1 + Offline-First`);

  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const [users, setUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cookDays, setCookDays] = useState<CookDay[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [galleryPosts, setGalleryPosts] = useState<GalleryPost[]>([]);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [reminders, setReminders] = useState<string[]>([]);

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('sm_cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedOrderDate, setSelectedOrderDate] = useState<string | null>(() =>
    localStorage.getItem('sm_selected_date')
  );

  // Local persistence
  useEffect(() => {
    try { localStorage.setItem('sm_cart', JSON.stringify(cart)); } catch {}
  }, [cart]);

  useEffect(() => {
    try {
      if (selectedOrderDate) localStorage.setItem('sm_selected_date', selectedOrderDate);
      else localStorage.removeItem('sm_selected_date');
    } catch {}
  }, [selectedOrderDate]);

  // ─── Bootstrap + Sync Engine ───────────────────────────────

  useEffect(() => {
    let mounted = true;

    async function init() {
      // 1. Instant load from IndexedDB cache
      try {
        const cached = await bootstrap();
        if (!mounted) return;
        if (cached.menu.length > 0) setMenu(cached.menu);
        if (cached.orders.length > 0) setOrders(cached.orders);
        if (cached.settings && Object.keys(cached.settings).length > 0) {
          setSettings(prev => ({ ...prev, ...cached.settings }));
        }
        if (cached.events.length > 0) setCalendarEvents(cached.events);
        console.log('[Bootstrap] Loaded from IndexedDB cache');
      } catch (e) {
        console.warn('[Bootstrap] IndexedDB failed:', e);
      }

      setIsLoading(false);

      // 2. Start sync engine (polls D1 API)
      startSync(3000, 30000);

      // 3. Check outbox
      const count = await getOutboxCount();
      if (mounted) setPendingSyncCount(count);
    }

    // Listen for sync events
    const unsub = onSync((event) => {
      if (!mounted) return;
      switch (event.type) {
        case 'orders_updated':
          setOrders(event.data);
          break;
        case 'menu_updated':
          setMenu(event.data);
          break;
        case 'settings_updated':
          setSettings(prev => ({ ...prev, ...event.data }));
          break;
        case 'events_updated':
          setCalendarEvents(event.data);
          break;
        case 'online':
          setIsOnline(true);
          setConnectionError(null);
          break;
        case 'offline':
          setIsOnline(false);
          setConnectionError('Offline — orders will sync when connection returns');
          break;
        case 'outbox_synced':
          getOutboxCount().then(c => mounted && setPendingSyncCount(c));
          break;
        case 'outbox_failed':
          getOutboxCount().then(c => mounted && setPendingSyncCount(c));
          break;
      }
    });

    init();

    return () => {
      mounted = false;
      unsub();
      stopSync();
    };
  }, []);

  // ─── Auth (simplified — admin credentials, no Firebase) ────

  const login = async (role: UserRole, email?: string, password?: string) => {
    if (role === UserRole.ADMIN) {
      if (email === 'dev' && password === '123') {
        setUser({ id: 'dev1', name: 'Developer', email: 'dev@local', role: UserRole.DEV, isVerified: true });
        return;
      }
      if (email === settings.adminUsername && password === settings.adminPassword) {
        setUser({ id: 'admin1', name: 'Admin', email: email || '', role: UserRole.ADMIN, isVerified: true });
        return;
      }
      throw new Error('Invalid admin credentials');
    }
  };

  const logout = () => setUser(null);
  const addUser = () => {};
  const updateUserProfile = () => {};
  const adminUpdateUser = () => {};
  const deleteUser = () => {};

  // ─── Menu ──────────────────────────────────────────────────

  const addMenuItem = async (item: MenuItem) => {
    setMenu(prev => [...prev.filter(m => m.id !== item.id), item]);
    try {
      await upsertMenuItem(item as any);
    } catch { /* will sync via outbox */ }
  };

  const updateMenuItem = async (item: MenuItem) => {
    setMenu(prev => prev.map(m => m.id === item.id ? item : m));
    try {
      await upsertMenuItem(item as any);
    } catch { /* will sync via outbox */ }
  };

  const deleteMenuItem = async (itemId: string) => {
    setMenu(prev => prev.filter(m => m.id !== itemId));
    try {
      await apiDeleteMenuItem(itemId);
    } catch { /* will sync via outbox */ }
  };

  // ─── Calendar Events ──────────────────────────────────────

  const addCalendarEvent = async (event: CalendarEvent) => {
    setCalendarEvents(prev => [...prev.filter(e => e.id !== event.id), event]);
    try { await upsertEvent(event as any); } catch {}
  };

  const updateCalendarEvent = async (event: CalendarEvent) => {
    setCalendarEvents(prev => prev.map(e => e.id === event.id ? event : e));
    try { await upsertEvent(event as any); } catch {}
  };

  const removeCalendarEvent = async (eventId: string) => {
    setCalendarEvents(prev => prev.filter(e => e.id !== eventId));
    try { await deleteEventApi(eventId); } catch {}
  };

  const isDatePastCutoff = (dateStr: string): boolean => {
    const cookDate = new Date(dateStr);
    const cutoffDate = new Date(cookDate);
    cutoffDate.setDate(cookDate.getDate() - 1);
    cutoffDate.setHours(9, 0, 0, 0);
    return new Date() > cutoffDate;
  };

  const checkAvailability = (dateStr: string): boolean => {
    if (isDatePastCutoff(dateStr)) return false;
    if (calendarEvents.find(e => e.date === dateStr && e.type === 'BLOCKED')) return false;
    if (orders.filter(o => o.cookDay === dateStr && o.type === 'CATERING').length >= 2) return false;
    return true;
  };

  // ─── Orders (offline-first) ────────────────────────────────

  const createOrder = async (order: Order) => {
    // Optimistically add to state + cache
    setOrders(prev => [order, ...prev]);
    await cacheOrder(order);
    clearCart();

    if (getOnlineStatus()) {
      try {
        const created = await createOrderApi(order);
        await cacheOrder(created);
        // Update state with server version (may have server-set fields)
        setOrders(prev => prev.map(o => o.id === order.id ? created : o));
      } catch {
        // Failed — queue for later sync
        await addToOutbox('CREATE_ORDER', order);
        setPendingSyncCount(await getOutboxCount());
        console.warn('[Offline] Order queued for sync:', order.id);
      }
    } else {
      // Offline — queue immediately
      await addToOutbox('CREATE_ORDER', order);
      setPendingSyncCount(await getOutboxCount());
      console.log('[Offline] Order queued:', order.id);
    }
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    const updated = orders.find(o => o.id === orderId);
    if (updated) await cacheOrder({ ...updated, status });

    if (getOnlineStatus()) {
      try {
        await updateOrderApi(orderId, { status });
      } catch {
        await addToOutbox('UPDATE_STATUS', { id: orderId, status });
        setPendingSyncCount(await getOutboxCount());
      }
    } else {
      await addToOutbox('UPDATE_STATUS', { id: orderId, status });
      setPendingSyncCount(await getOutboxCount());
    }

    // Auto-create calendar event for confirmed catering orders
    if (status === 'Confirmed' && updated?.type === 'CATERING') {
      const dateStr = new Date(updated.cookDay).toISOString().split('T')[0];
      const newEvent: CalendarEvent = {
        id: `evt_o_${updated.id}`, date: dateStr, type: 'ORDER_PICKUP',
        title: `Pickup: ${updated.customerName}`, orderId: updated.id,
      };
      addCalendarEvent(newEvent);
    }
  };

  const updateOrder = async (updatedOrder: Order) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    await cacheOrder(updatedOrder);
    if (getOnlineStatus()) {
      try { await updateOrderApi(updatedOrder.id, updatedOrder); } catch {
        await addToOutbox('UPDATE_ORDER', updatedOrder);
        setPendingSyncCount(await getOutboxCount());
      }
    } else {
      await addToOutbox('UPDATE_ORDER', updatedOrder);
      setPendingSyncCount(await getOutboxCount());
    }
  };

  // ─── Cart ──────────────────────────────────────────────────

  const addToCart = (item: MenuItem, quantity: number = 1, specificDate?: string) => {
    if (specificDate && selectedOrderDate && selectedOrderDate !== specificDate) {
      if (!window.confirm(`Your cart has items for ${new Date(selectedOrderDate).toLocaleDateString()}. Clear for ${new Date(specificDate).toLocaleDateString()}?`)) return;
      setCart([]);
      setSelectedOrderDate(specificDate);
    }
    if (!selectedOrderDate && specificDate) setSelectedOrderDate(specificDate);
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i);
      return [...prev, { ...item, quantity }];
    });
  };

  const updateCartItemQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(item =>
      item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
    ).filter(i => i.quantity > 0));
  };

  const removeFromCart = (itemId: string) => setCart(prev => prev.filter(i => i.id !== itemId));
  const clearCart = () => setCart([]);

  // ─── Social Posts ──────────────────────────────────────────

  const addSocialPost = async (post: SocialPost) => {
    setSocialPosts(prev => [post, ...prev]);
    try { await upsertSocialPost(post as any); } catch {}
  };

  const updateSocialPost = async (post: SocialPost) => {
    setSocialPosts(prev => prev.map(p => p.id === post.id ? post : p));
    try { await upsertSocialPost(post as any); } catch {}
  };

  const deleteSocialPost = async (postId: string) => {
    setSocialPosts(prev => prev.filter(p => p.id !== postId));
    try { await deleteSocialPostApi(postId); } catch {}
  };

  // ─── Gallery ───────────────────────────────────────────────

  const addGalleryPost = async (post: GalleryPost) => {
    try { await submitGalleryPost(post); } catch {}
  };

  const toggleGalleryLike = async (postId: string) => {
    if (!user) return;
    try { await toggleGalleryLikeApi(postId); } catch {}
  };

  // ─── Settings ──────────────────────────────────────────────

  const updateSettings = async (newSettings: Partial<AppSettings>): Promise<boolean> => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    await cacheSettings(merged);
    try {
      await updateSettingsApi(newSettings);
      return true;
    } catch (err: any) {
      console.error('[Settings] Save failed:', err.message);
      return false;
    }
  };

  // ─── Misc ──────────────────────────────────────────────────

  const addCookDay = (day: CookDay) => setCookDays(prev => [...prev, day]);

  const toggleReminder = (eventId: string) => {
    setReminders(prev =>
      prev.includes(eventId) ? prev.filter(id => id !== eventId) : [...prev, eventId]
    );
  };

  const verifyStaffPin = (pin: string, action: 'ADD' | 'REDEEM'): boolean => {
    if (pin !== settings.rewards?.staffPin) return false;
    if (user) {
      const currentStamps = user.stamps || 0;
      let newStamps = action === 'ADD' ? currentStamps + 1 : Math.max(0, currentStamps - (settings.rewards?.maxStamps || 10));
      setUser({ ...user, stamps: newStamps });
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
      reminders, toggleReminder, verifyStaffPin,
      selectedOrderDate, setSelectedOrderDate,
      isLoading, connectionError,
      isOnline, pendingSyncCount,
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
