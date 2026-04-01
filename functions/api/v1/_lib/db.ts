/**
 * D1 database helpers for Cloudflare Pages Functions.
 * Typed row converters: snake_case D1 → camelCase app types.
 */

export function getDB(env: any): D1Database {
  if (!env.DB) throw new Error('D1 database binding "DB" not configured');
  return env.DB;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function parseJson<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

export function rowToMenuItem(r: any) {
  return {
    id: r.id, name: r.name, description: r.description || '', price: r.price,
    unit: r.unit, minQuantity: r.min_quantity,
    preparationOptions: parseJson(r.preparation_options, undefined),
    image: r.image || '', category: r.category, available: !!r.available,
    availabilityType: r.availability_type || 'everyday',
    specificDate: r.specific_date, specificDates: parseJson(r.specific_dates, undefined),
    isPack: !!r.is_pack, packGroups: parseJson(r.pack_groups, undefined),
    availableForCatering: !!r.available_for_catering, cateringCategory: r.catering_category, moq: r.moq,
  };
}

export function rowToOrder(r: any) {
  return {
    id: r.id, userId: r.user_id, customerName: r.customer_name,
    customerEmail: r.customer_email, customerPhone: r.customer_phone,
    items: parseJson(r.items, []), total: r.total, depositAmount: r.deposit_amount,
    status: r.status, cookDay: r.cook_day, type: r.type, pickupTime: r.pickup_time,
    createdAt: r.created_at, temperature: r.temperature,
    fulfillmentMethod: r.fulfillment_method, deliveryAddress: r.delivery_address,
    deliveryFee: r.delivery_fee, trackingNumber: r.tracking_number, courier: r.courier,
    collectionPin: r.collection_pin, pickupLocation: r.pickup_location,
    discountApplied: !!r.discount_applied, paymentIntentId: r.payment_intent_id,
    squareCheckoutId: r.square_checkout_id, source: r.source || 'walk_up',
  };
}

export function rowToEvent(r: any) {
  return {
    id: r.id, date: r.date, type: r.type, title: r.title,
    description: r.description, location: r.location, time: r.time,
    startTime: r.start_time, endTime: r.end_time, orderId: r.order_id,
    image: r.image, tags: parseJson(r.tags, undefined),
  };
}

export function rowToUser(r: any) {
  return {
    id: r.id, name: r.name, email: r.email, role: r.role,
    isVerified: !!r.is_verified, phone: r.phone, address: r.address,
    dietaryPreferences: r.dietary_preferences, stamps: r.stamps || 0,
    hasCateringDiscount: !!r.has_catering_discount,
  };
}

export function rowToSocialPost(r: any) {
  return {
    id: r.id, platform: r.platform, content: r.content, image: r.image,
    scheduledFor: r.scheduled_for, status: r.status,
    hashtags: parseJson(r.hashtags, []),
  };
}

export function rowToGalleryPost(r: any) {
  return {
    id: r.id, userId: r.user_id, userName: r.user_name,
    imageUrl: r.image_url, caption: r.caption || '', createdAt: r.created_at,
    approved: !!r.approved, likes: r.likes || 0, likedBy: parseJson(r.liked_by, []),
  };
}
