/**
 * API client for Cloudflare D1 backend.
 * All data goes through /api/v1/* endpoints.
 */
import type { MenuItem, Order, CalendarEvent, User, SocialPost, GalleryPost, AppSettings, Tenant } from '../types';

let getToken: () => Promise<string | null> = async () => null;
export const initApi = (tokenFn: () => Promise<string | null>) => { getToken = tokenFn; };

// Dev-mode tenant override (set via TenantContext when running on localhost)
let devTenantId: string | null = null;
export const setDevTenantId = (id: string | null) => { devTenantId = id; };

// Auto-detect local mode (Pi server) vs cloud mode
function getBaseUrl(): string {
  const host = window.location.hostname;
  // If we're on a local/private IP, we're on the Pi
  if (host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.') || host === 'localhost') {
    return ''; // Same origin — Pi serves both static + API
  }
  return ''; // Cloud — also same origin (CF Pages Functions)
}

/** True if running on a local Pi server (no internet required) */
export const isLocalMode = (): boolean => {
  const host = window.location.hostname;
  return host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
};

async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (devTenantId && isLocalMode()) headers['X-Tenant-ID'] = devTenantId;
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/v1${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Menu
export const fetchMenu = () => apiFetch<MenuItem[]>('/menu');
export const upsertMenuItem = (item: Partial<MenuItem> & { id: string }) =>
  apiFetch<MenuItem>('/menu', { method: 'POST', body: JSON.stringify(item) });
export const deleteMenuItem = (id: string) =>
  apiFetch(`/menu/${id}`, { method: 'DELETE' });

// Orders
export const fetchOrders = (params?: { since?: string; status?: string; today?: string }) => {
  const qs = new URLSearchParams();
  if (params?.since) qs.set('since', params.since);
  if (params?.status) qs.set('status', params.status);
  if (params?.today) qs.set('today', params.today);
  const q = qs.toString();
  return apiFetch<Order[]>(`/orders${q ? '?' + q : ''}`);
};
export const fetchOrder = (id: string) => apiFetch<Order>(`/orders/${id}`);
export const createOrderApi = (order: Partial<Order>) =>
  apiFetch<Order>('/orders', { method: 'POST', body: JSON.stringify(order) });
export const updateOrderApi = (id: string, data: Partial<Order>) =>
  apiFetch<Order>(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteOrderApi = (id: string) =>
  apiFetch(`/orders/${id}`, { method: 'DELETE' });

// Settings
export const fetchSettings = () => apiFetch<AppSettings>('/settings');
export const updateSettingsApi = (data: Partial<AppSettings>) =>
  apiFetch<AppSettings>('/settings', { method: 'PUT', body: JSON.stringify(data) });

// Users
export const fetchUsers = () => apiFetch<User[]>('/users');
export const fetchCurrentUser = () => apiFetch<User>('/users/me');
export const createUserApi = (data: Partial<User>) =>
  apiFetch<User>('/users', { method: 'POST', body: JSON.stringify(data) });
export const updateUserApi = (id: string, data: Partial<User>) =>
  apiFetch<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// Events
export const fetchEvents = () => apiFetch<CalendarEvent[]>('/events');
export const upsertEvent = (event: Partial<CalendarEvent> & { id: string }) =>
  apiFetch<CalendarEvent>('/events', { method: 'POST', body: JSON.stringify(event) });
export const deleteEventApi = (id: string) =>
  apiFetch(`/events/${id}`, { method: 'DELETE' });

// Social Posts
export const fetchSocialPosts = () => apiFetch<SocialPost[]>('/social-posts');
export const upsertSocialPost = (post: Partial<SocialPost> & { id: string }) =>
  apiFetch<SocialPost>('/social-posts', { method: 'POST', body: JSON.stringify(post) });
export const deleteSocialPostApi = (id: string) =>
  apiFetch(`/social-posts/${id}`, { method: 'DELETE' });

// Gallery
export const fetchGalleryPosts = () => apiFetch<GalleryPost[]>('/gallery');
export const submitGalleryPost = (post: Partial<GalleryPost>) =>
  apiFetch<GalleryPost>('/gallery', { method: 'POST', body: JSON.stringify(post) });
export const toggleGalleryLikeApi = (id: string) =>
  apiFetch(`/gallery/${id}/like`, { method: 'POST' });

// SMS & Email (fire-and-forget notifications)
export const sendSms = (endpoint: string, payload: any) =>
  apiFetch(`/sms/${endpoint}`, { method: 'POST', body: JSON.stringify(payload) }).catch(() => {});
export const sendEmail = (endpoint: string, payload: any) =>
  apiFetch(`/email/${endpoint}`, { method: 'POST', body: JSON.stringify(payload) }).catch(() => {});

// Tenant (no auth required — used on bootstrap)
export const fetchTenant = () => apiFetch<Tenant>('/tenant');
