
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/Toast';
import { MessageCircle, Check, Clock, XCircle, CheckCircle, AlertTriangle, Edit2, Plus, Trash2, X, Save, DollarSign, Mail, Smartphone, CreditCard, Flame, Snowflake, Truck, ShoppingBag, Package, Loader2, MapPin } from 'lucide-react';
import { Order, MenuItem } from '../../types';

const normalizePhone = (raw: string): string => {
  let phone = raw.replace(/[\s\-()]/g, '');
  if (phone.startsWith('+')) return phone;
  if (phone.startsWith('0')) phone = phone.slice(1);
  if (phone.startsWith('61')) return '+' + phone;
  return '+61' + phone;
};

  const OrderManager: React.FC = () => {
  const { orders, updateOrderStatus, checkAvailability, updateOrder, createOrder, menu, users, calendarEvents, updateUserProfile, settings } = useApp();
  const { toast } = useToast();
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  
  // Item Addition State
  const [newItemId, setNewItemId] = useState<string>('');
  const [isCustomItem, setIsCustomItem] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemDescription, setCustomItemDescription] = useState('');

  // Invoice State
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceContact, setInvoiceContact] = useState({ email: '', phone: '' });

  // Split orders
  const pendingRequests = orders.filter(o => o.status === 'Pending');
  const activeOrders = orders.filter(o => o.status !== 'Pending' && o.status !== 'Rejected' && o.status !== 'Cancelled');
  const rejectedOrders = orders.filter(o => o.status === 'Rejected' || o.status === 'Cancelled');

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'Pending': return 'text-yellow-500';
      case 'Awaiting Payment': return 'text-orange-400 animate-pulse';
      case 'Paid': return 'text-emerald-400';
      case 'Confirmed': return 'text-blue-400';
      case 'Cooking': return 'text-orange-600';
      case 'Ready': return 'text-green-500';
      case 'Shipped': return 'text-purple-400';
      case 'Completed': return 'text-gray-500';
      case 'Rejected': case 'Cancelled': return 'text-red-500';
      default: return 'text-white';
    }
  };

  const handleApprove = async (order: Order) => {
    // Safety check against calendar
    const isAvailable = checkAvailability(order.cookDay);
    if (!isAvailable) {
       const confirmOverride = window.confirm("Warning: This date is flagged as blocked or busy in your planner. Do you want to approve anyway?");
       if (!confirmOverride) return;
    }

    if (window.confirm(`Accept request for ${order.customerName}? This will capture the 50% deposit ($${order.depositAmount?.toFixed(2)}) and confirm the booking.`)) {
        try {
            // 1. Capture Payment (if Stripe)
            if (order.paymentIntentId && order.paymentIntentId.startsWith('pi_')) {
                const res = await fetch('/api/payment/capture', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paymentIntentId: order.paymentIntentId }),
                });
                if (!res.ok) throw new Error('Failed to capture payment');
            }

            // 2. Send Email + SMS
            await Promise.allSettled([
                fetch('/api/v1/email/order-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: settings.emailSettings, order: { ...order, status: 'Confirmed' } }),
                }),
                fetch('/api/v1/sms/order-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: settings.smsSettings, order: { ...order, status: 'Confirmed' } }),
                })
            ]);

            // 3. Update Status
            await updateOrderStatus(order.id, 'Confirmed');
            toast('Order approved! Deposit captured and confirmation sent (email + SMS).');

        } catch (error: any) {
            console.error("Approval Error:", error);
            toast(`Failed to approve order: ${error.message}`, 'error');
        }
    }
  };

  const handleDecline = async (order: Order) => {
      const reason = prompt("Enter a reason for rejection (this will be sent to the customer):", "Unfortunately we are fully booked on this date.");
      if (reason) {
          try {
              // 1. Void Payment (if Stripe)
              if (order.paymentIntentId && order.paymentIntentId.startsWith('pi_')) {
                  const res = await fetch('/api/payment/void', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ paymentIntentId: order.paymentIntentId }),
                  });
                  if (!res.ok) throw new Error('Failed to void payment');
              }

              // 2. Send Email + SMS
              await Promise.allSettled([
                  fetch('/api/v1/email/order-notification', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ settings: settings.emailSettings, order: { ...order, status: 'Rejected' } }),
                  }),
                  fetch('/api/v1/sms/order-notification', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ settings: settings.smsSettings, order: { ...order, status: 'Rejected' } }),
                  })
              ]);

              // 3. Update Status
              await updateOrderStatus(order.id, 'Rejected');
              toast(`Order rejected. Notification sent to ${order.customerName} (email + SMS).`);

          } catch (error: any) {
              console.error("Rejection Error:", error);
              toast(`Failed to reject order: ${error.message}`, 'error');
          }
      }
  };

  const handleEditClick = (order: Order) => {
    // Clone order to avoid direct mutation during edit
    setEditingOrder(JSON.parse(JSON.stringify(order)));
    // Reset item add state
    setNewItemId('');
    setIsCustomItem(false);
    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemDescription('');
  };

  const handleCreateOrder = () => {
      // Create a blank template for a new manual order
      setEditingOrder({
          id: `ord_man_${Date.now()}`,
          userId: 'admin_created',
          customerName: '',
          customerEmail: '',
          customerPhone: '',
          items: [],
          total: 0,
          status: 'Pending', // Default to Pending to enforce Invoice flow
          cookDay: new Date().toISOString(),
          type: 'TAKEAWAY',
          pickupTime: '12:00',
          createdAt: new Date().toISOString(),
          temperature: 'HOT',
          fulfillmentMethod: 'PICKUP'
      });
      // Reset item add state
      setNewItemId('');
      setIsCustomItem(false);
      setCustomItemName('');
      setCustomItemPrice('');
      setCustomItemDescription('');
  };

  const [isSendingInvoice, setIsSendingInvoice] = useState(false);

  const generateSquarePaymentLink = async (order: Order): Promise<{ url: string; squareOrderId?: string } | null> => {
    console.log('[Square] generateSquarePaymentLink called', { connected: settings.squareConnected, locationId: settings.squareLocationId, hasToken: !!settings.squareAccessToken, env: settings.squareEnvironment });
    if (!settings.squareConnected || !settings.squareLocationId || !settings.squareAccessToken) {
      const missing = [];
      if (!settings.squareConnected) missing.push('not connected');
      if (!settings.squareLocationId) missing.push('no location ID');
      if (!settings.squareAccessToken) missing.push('no access token');
      toast(`⚠️ Square payment link skipped: ${missing.join(', ')}`, 'warning');
      console.warn('[Square] Skipped — missing:', missing);
      return null;
    }
    try {
      const env = settings.squareEnvironment || 'production';

      toast(`Generating Square payment link (${env})...`, 'info');
      const origin = window.location.origin;
      const redirectUrl = `${origin}${window.location.pathname}#/payment-success?orderId=${encodeURIComponent(order.id)}`;

      const baseBody = {
        amount: order.total,
        currency: 'AUD',
        locationId: settings.squareLocationId,
        accessToken: settings.squareAccessToken,
        environment: env,
        orderId: order.id,
        description: `Order #${order.id?.slice(-6) || order.id}`,
        redirectUrl,
      };
      const bodyWithItems = {
        ...baseBody,
        items: order.items.map(li => ({
          name: li.item.name,
          price: li.item.price,
          quantity: li.quantity,
          selectedOption: li.selectedOption || '',
        })),
      };
      console.log('[Square] Calling checkout API with items:', { ...bodyWithItems, accessToken: '***' });

      let res = await fetch('/api/v1/payment/square-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyWithItems),
      });
      console.log('[Square] Checkout API response status:', res.status);

      // If first attempt with items fails, retry with simple quick_pay (no items)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown' }));
        console.warn('[Square] Items-based checkout failed, retrying with quick_pay:', err);
        res = await fetch('/api/v1/payment/square-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(baseBody),
        });
        console.log('[Square] Quick_pay retry response status:', res.status);
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown' }));
        console.error('[Square] Checkout API error (both attempts failed):', err);
        toast(`❌ Square link failed (${env}): ${err.error || err.detail || res.status}`, 'error');
        return null;
      }
      const data = await res.json();
      console.log('[Square] Checkout API success:', data);
      if (data.usedQuickPay) {
        console.warn('[Square] ⚠️ Fell back to quick_pay (no itemized checkout). Order creation error:', data.orderCreateError || 'unknown');
      }
      const url = data.url || data.longUrl || null;
      if (!url) {
        toast('❌ Square returned no payment URL — check API credentials', 'error');
        return null;
      }
      toast('✅ Square payment link generated!', 'success');
      return { url, squareOrderId: data.squareOrderId };
    } catch (e: any) {
      console.error('[Square] Error:', e);
      toast(`❌ Square payment link error: ${e.message || e}`, 'error');
      return null;
    }
  };

  const autoSendInvoice = async (order: Order) => {
    const orderPayload = {
      ...order,
      customerPhone: order.customerPhone ? normalizePhone(order.customerPhone) : '',
      items: order.items.map(li => ({ item: li.item, name: li.item.name, price: li.item.price, quantity: li.quantity }))
    };
    const results: string[] = [];

    // Auto-generate Square payment link if Square is connected
    let invoiceSettingsWithPayLink = { ...settings.invoiceSettings };
    const squareResult = await generateSquarePaymentLink(order);
    if (squareResult) {
      invoiceSettingsWithPayLink = { ...invoiceSettingsWithPayLink, paymentUrl: squareResult.url, paymentLabel: invoiceSettingsWithPayLink?.paymentLabel || 'Pay Now' };
      // Store Square checkout ID on the order for webhook payment matching
      if (squareResult.squareOrderId) {
        await updateOrder({ ...order, squareCheckoutId: squareResult.squareOrderId });
      }
    }

    // Try email
    if (order.customerEmail && settings.emailSettings?.enabled) {
      try {
        const res = await fetch('/api/v1/email/send-invoice', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: settings.emailSettings, order: orderPayload, businessName: settings.businessName, invoiceSettings: invoiceSettingsWithPayLink }),
        });
        if (res.ok) results.push('Email');
        else console.warn('Email invoice failed:', await res.text());
      } catch (e) { console.warn('Email invoice error:', e); }
    }

    // Try SMS
    if (order.customerPhone && settings.smsSettings?.enabled) {
      try {
        const res = await fetch('/api/v1/sms/send-invoice', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: settings.smsSettings, order: { ...orderPayload, customerPhone: normalizePhone(order.customerPhone) }, businessName: settings.businessName, invoiceSettings: invoiceSettingsWithPayLink }),
        });
        if (res.ok) results.push('SMS');
        else console.warn('SMS invoice failed:', await res.text());
      } catch (e) { console.warn('SMS invoice error:', e); }
    }

    return results;
  };

  const handleSaveEdit = async () => {
    if (editingOrder) {
      // Validation: Check Mandatory fields
      if (!editingOrder.customerName || !editingOrder.customerEmail || !editingOrder.customerPhone) {
          toast('Please fill in all mandatory fields: Customer Name, Email, and Phone Number.', 'warning');
          return;
      }

      // Check if it's an existing order or new
      const exists = orders.find(o => o.id === editingOrder.id);
      if (exists) {
          await updateOrder(editingOrder);
          toast('Order updated!');
      } else {
          // It's a new manual order
          if (editingOrder.items.length === 0) {
              toast('Cannot save an empty order. Add items first.', 'warning');
              return;
          }

          // Create the order
          const orderWithStatus = { ...editingOrder, status: 'Awaiting Payment' as const };
          await createOrder(orderWithStatus);
          toast('Order created! Sending invoice...');

          // Auto-send invoice
          setIsSendingInvoice(true);
          try {
            const sent = await autoSendInvoice(orderWithStatus);
            if (sent.length > 0) {
              toast(`Invoice sent via ${sent.join(' & ')}!`);
            } else {
              toast('Order created but no invoice channels are configured. Send manually from the order.', 'warning');
            }
          } catch (e) {
            toast('Order created but invoice send failed. You can resend from the order.', 'warning');
          } finally {
            setIsSendingInvoice(false);
          }
      }
      setEditingOrder(null);
    }
  };

  const handleItemQuantityChange = (index: number, delta: number) => {
    if (!editingOrder) return;
    const updatedItems = [...editingOrder.items];
    const item = updatedItems[index];
    
    // Update quantity
    const newQuantity = Math.max(0, item.quantity + delta);
    
    if (newQuantity === 0) {
      if (window.confirm("Remove item from order?")) {
        updatedItems.splice(index, 1);
      }
    } else {
       updatedItems[index] = { ...item, quantity: newQuantity };
    }

    // Recalculate total
    const newTotal = updatedItems.reduce((sum, line) => sum + (line.item.price * line.quantity), 0);
    setEditingOrder({ ...editingOrder, items: updatedItems, total: newTotal });
  };

  const handleAddItem = () => {
    if (!editingOrder) return;
    
    if (isCustomItem) {
        if (!customItemName || !customItemPrice) return;
        const price = parseFloat(customItemPrice);
        if (isNaN(price)) return;

        const customItem: MenuItem = {
            id: `custom_${Date.now()}`,
            name: customItemName,
            price: price,
            description: customItemDescription || 'Manual custom item',
            category: 'Service',
            image: '', // Placeholder or empty
            available: true,
            availabilityType: 'everyday'
        };

        const updatedItems = [...editingOrder.items, { item: customItem, quantity: 1 }];
        const newTotal = updatedItems.reduce((sum, line) => sum + (line.item.price * line.quantity), 0);
        setEditingOrder({ ...editingOrder, items: updatedItems, total: newTotal });
        
        // Reset inputs
        setCustomItemName('');
        setCustomItemPrice('');
        setCustomItemDescription('');
    } else {
        if (!newItemId) return;
        const menuItem = menu.find(m => m.id === newItemId);
        if (menuItem) {
            const updatedItems = [...editingOrder.items, { item: menuItem, quantity: 1 }];
            const newTotal = updatedItems.reduce((sum, line) => sum + (line.item.price * line.quantity), 0);
            setEditingOrder({ ...editingOrder, items: updatedItems, total: newTotal });
            setNewItemId('');
        }
    }
  };

  const handleOpenInvoiceModal = () => {
      if (!editingOrder) return;
      if (!editingOrder.customerName) {
          toast('Please enter a customer name first.', 'warning');
          return;
      }
      
      // Use data from the order itself first, fall back to user profile if linked
      const customer = users.find(u => u.id === editingOrder.userId);
      setInvoiceContact({
          email: editingOrder.customerEmail || customer?.email || '', 
          phone: editingOrder.customerPhone || customer?.phone || ''
      });
      setShowInvoiceModal(true);
  };

  const handleSendInvoice = async (method: 'EMAIL' | 'SMS') => {
      if (method === 'EMAIL' && !invoiceContact.email) {
          toast('Please enter an email address.', 'warning');
          return;
      }
      if (method === 'SMS' && !invoiceContact.phone) {
          toast('Please enter a mobile number.', 'warning');
          return;
      }
      if (!editingOrder) return;

      const destination = method === 'EMAIL' ? invoiceContact.email : normalizePhone(invoiceContact.phone);

      try {
          const orderPayload = {
              ...editingOrder,
              customerEmail: invoiceContact.email,
              customerPhone: normalizePhone(invoiceContact.phone),
              items: editingOrder.items.map(li => ({
                  item: li.item,
                  name: li.item.name,
                  description: li.item.description || '',
                  price: li.item.price,
                  quantity: li.quantity,
                  selectedOption: li.selectedOption || '',
                  packSelections: li.packSelections || {}
              }))
          };

          // Auto-generate Square payment link if Square is connected
          let invoiceSettingsWithPayLink = { ...settings.invoiceSettings };
          const squareResult = await generateSquarePaymentLink(editingOrder);
          if (squareResult) {
              invoiceSettingsWithPayLink = { ...invoiceSettingsWithPayLink, paymentUrl: squareResult.url, paymentLabel: invoiceSettingsWithPayLink?.paymentLabel || 'Pay Now' };
              if (squareResult.squareOrderId) {
                  await updateOrder({ ...editingOrder, squareCheckoutId: squareResult.squareOrderId });
              }
          }

          if (method === 'EMAIL') {
              const res = await fetch('/api/v1/email/send-invoice', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      settings: settings.emailSettings,
                      order: orderPayload,
                      businessName: settings.businessName,
                      invoiceSettings: invoiceSettingsWithPayLink
                  }),
              });
              if (!res.ok) {
                  const err = await res.json().catch(() => ({ error: 'Unknown error' }));
                  throw new Error(err.error || `Email failed (${res.status})`);
              }
          } else {
              const res = await fetch('/api/v1/sms/send-invoice', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      settings: settings.smsSettings,
                      order: orderPayload,
                      businessName: settings.businessName,
                      invoiceSettings: invoiceSettingsWithPayLink
                  }),
              });
              if (!res.ok) {
                  const err = await res.json().catch(() => ({ error: 'Unknown error' }));
                  throw new Error(err.error || `SMS failed (${res.status})`);
              }
          }

          toast(`Invoice sent via ${method} to ${destination}. Status: Awaiting Payment.`);

          // Move status to Awaiting Payment
          const updated = {
              ...editingOrder,
              status: 'Awaiting Payment' as const,
              customerEmail: invoiceContact.email,
              customerPhone: invoiceContact.phone
          };
          await updateOrder(updated);
          setEditingOrder(null);
          setShowInvoiceModal(false);

      } catch (error: any) {
          console.error(`Invoice ${method} Error:`, error);
          toast(`Failed to send invoice via ${method}: ${error.message}`, 'error');
      }
  };

  const handleMarkPaid = async (orderId: string) => {
      if(window.confirm("Confirm payment received? This will allow the order to be cooked.")) {
          updateOrderStatus(orderId, 'Paid');
          
          // --- LOYALTY LOGIC ---
          const order = orders.find(o => o.id === orderId);
          if (order && order.type === 'CATERING' && order.total > 1000) {
              const customer = users.find(u => u.id === order.userId);
              if (customer) {
                  await updateUserProfile({
                      ...customer,
                      hasCateringDiscount: true
                  });
                  toast(`Customer ${customer.name} earned a 10% catering discount!`, 'info');
              }
          }
      }
  };

  const handleStartCooking = async (order: Order) => {
      updateOrderStatus(order.id, 'Cooking');
      
      const businessName = settings.businessName || 'Street Meatz BBQ';
      const orderPayload = { customerName: order.customerName, customerEmail: order.customerEmail, customerPhone: order.customerPhone };
      
      try {
          await Promise.allSettled([
              // SMS: cooking started
              order.customerPhone && settings.smsSettings?.enabled
                  ? fetch('/api/v1/sms/cooking-started', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ settings: settings.smsSettings, order: orderPayload, businessName })
                  }) : Promise.resolve(),
              // Email: cooking started
              order.customerEmail && settings.emailSettings?.enabled
                  ? fetch('/api/v1/email/cooking-started', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ settings: settings.emailSettings, order: orderPayload, businessName })
                  }) : Promise.resolve()
          ]);
      } catch (e) { console.error("Cooking notification failed:", e); }
      
      toast(`Cooking started! ${order.customerName} has been notified.`);
  };

  const handleMarkReady = async (order: Order) => {
      // Resolve pickup location: order override → calendar event → business address → fallback
      const event = calendarEvents.find(e => e.date === order.cookDay.split('T')[0] && e.type === 'ORDER_PICKUP');
      const location = order.pickupLocation || event?.location || settings.businessAddress || "Ipswich, QLD";
      
      if(window.confirm(`Mark order for ${order.customerName} as Ready?\n\nPickup location: ${location}\nThis will send an SMS + email with a map link.`)) {
          const readyOrder = {
              customerName: order.customerName,
              customerEmail: order.customerEmail,
              customerPhone: order.customerPhone,
              collectionPin: order.collectionPin
          };
          const businessName = settings.businessName || 'Street Meatz BBQ';
          try {
              await Promise.allSettled([
                  fetch('/api/v1/email/order-ready', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ settings: settings.emailSettings, order: readyOrder, location, businessName })
                  }),
                  fetch('/api/v1/sms/order-ready', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ settings: settings.smsSettings, order: readyOrder, location, businessName })
                  })
              ]);
          } catch (e) {
              console.error("Failed to send ready notification:", e);
          }
          
          updateOrderStatus(order.id, 'Ready');
          toast(`Order marked Ready! Notification sent to ${order.customerName} (email + SMS).`);
      }
  }

  const handleMarkCollected = async (order: Order) => {
      if(window.confirm(`Mark order for ${order.customerName} as Collected?\n\nThis will complete the order and send a thank-you email.`)) {
          const businessName = settings.businessName || 'Street Meatz BBQ';
          const appUrl = window.location.origin;
          
          // Send thank-you + app promo email
          if (order.customerEmail && settings.emailSettings?.enabled) {
              try {
                  await fetch('/api/v1/email/order-thankyou', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          settings: settings.emailSettings,
                          order: { id: order.id, customerName: order.customerName, customerEmail: order.customerEmail },
                          businessName,
                          appUrl
                      })
                  });
              } catch (e) {
                  console.error("Failed to send thank-you email:", e);
              }
          }
          
          updateOrderStatus(order.id, 'Completed');
          toast(`Order collected! Thank-you email sent to ${order.customerName}.`);
      }
  };

  const handleShipAndNotify = async () => {
      if (!editingOrder) return;
      if (!editingOrder.trackingNumber) {
          toast('Please enter a tracking number first.', 'warning');
          return;
      }
      
      if(window.confirm(`Mark as Shipped and notify ${editingOrder.customerName}?`)) {
          const courier = editingOrder.courier || 'Australia Post';
          
          const orderPayload = {
              ...editingOrder,
              items: editingOrder.items.map(li => ({
                  item: li.item,
                  name: li.item.name,
                  description: li.item.description || '',
                  price: li.item.price,
                  quantity: li.quantity,
                  selectedOption: li.selectedOption || '',
                  packSelections: li.packSelections || {}
              }))
          };

          try {
              await Promise.allSettled([
                  fetch('/api/v1/email/shipping-notification', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          settings: settings.emailSettings,
                          order: orderPayload,
                          businessName: settings.businessName || 'Street Meatz BBQ',
                          invoiceSettings: settings.invoiceSettings || {},
                          trackingNumber: editingOrder.trackingNumber,
                          courier,
                      })
                  }),
                  fetch('/api/v1/sms/shipping-notification', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          settings: settings.smsSettings,
                          order: orderPayload,
                          businessName: settings.businessName || 'Street Meatz BBQ',
                          trackingNumber: editingOrder.trackingNumber,
                          courier,
                      })
                  })
              ]);
          } catch (e) {
              console.error("Failed to send shipping notification:", e);
          }
          
          toast(`Shipped! Tracking notification sent to ${editingOrder.customerName} (email + SMS).`);
          
          const updated = { ...editingOrder, status: 'Shipped' as const };
          await updateOrder(updated);
          setEditingOrder(null);
      }
  };

  // --- UPCOMING COOK DAYS VIEW ---
  const todayStr = new Date().toISOString().split('T')[0];

  const getDateLabel = (dateStr: string) => {
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    if (dateStr === todayStr) return 'Today';
    if (dateStr === tomorrowStr) return 'Tomorrow';
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const upcomingEventDates = calendarEvents
    .filter(e => e.type === 'ORDER_PICKUP' && e.date >= todayStr)
    .map(e => e.date);

  const upcomingOrderDates = orders
    .filter(o => !['Rejected', 'Cancelled', 'Completed'].includes(o.status) && o.cookDay.split('T')[0] >= todayStr)
    .map(o => o.cookDay.split('T')[0]);

  const allUpcomingDates = [...new Set([...upcomingEventDates, ...upcomingOrderDates])].sort();

  return (
    <div className="space-y-8 animate-in fade-in relative">
        <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold font-display">Order Management</h3>
            <button 
                onClick={handleCreateOrder}
                className="bg-bbq-red text-white px-4 py-2 rounded font-bold flex items-center gap-2 hover:bg-red-700 shadow-lg"
            >
                <Plus size={18} /> Create Manual Order
            </button>
        </div>

      {/* === UPCOMING COOK DAYS VIEW === */}
      {allUpcomingDates.length === 0 && (
        <div className="bg-gray-900/40 border border-gray-700 rounded-xl p-8 text-center text-gray-500 italic">
          No upcoming cook days or active orders scheduled.
        </div>
      )}
      {allUpcomingDates.map(dateStr => {
        const event = calendarEvents.find(e => e.date === dateStr && e.type === 'ORDER_PICKUP');
        const dateOrders = orders.filter(o =>
          o.cookDay.split('T')[0] === dateStr && !['Rejected', 'Cancelled', 'Completed'].includes(o.status)
        );
        const cookingDateOrders = dateOrders.filter(o => o.status === 'Cooking');
        const paidDateOrders = dateOrders.filter(o => o.status === 'Paid' || o.status === 'Confirmed');
        const readyDateOrders = dateOrders.filter(o => o.status === 'Ready');
        const pendingDateOrders = dateOrders.filter(o => o.status === 'Pending' || o.status === 'Awaiting Payment');
        const isToday = dateStr === todayStr;
        const dateLabel = getDateLabel(dateStr);
        const hasCatering = dateOrders.some(o => o.type === 'CATERING');

        return (
          <div key={dateStr} className={`rounded-xl overflow-hidden border ${
            isToday ? 'bg-gradient-to-r from-orange-950/40 to-red-950/30 border-orange-700' : 'bg-gray-900/40 border-gray-700'
          }`}>
            <div className={`p-4 border-b flex justify-between items-center ${
              isToday ? 'bg-orange-900/40 border-orange-700' : 'bg-gray-800/50 border-gray-700'
            }`}>
              <div className="flex items-center gap-3">
                <Flame className={isToday ? 'text-orange-500' : 'text-gray-500'} size={20}/>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      isToday ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-200'
                    }`}>{dateLabel}</span>
                    {event && <span className="font-bold text-white text-sm">{event.title}</span>}
                    {hasCatering && <span className="text-[10px] bg-purple-900/50 text-purple-300 border border-purple-700 px-1.5 py-0.5 rounded-full font-bold">CATERING</span>}
                  </div>
                  {event && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {event.location}{event.startTime ? ` · ${event.startTime}${event.endTime ? ` – ${event.endTime}` : ''}` : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className={`text-xl font-bold ${isToday ? 'text-white' : 'text-gray-300'}`}>{dateOrders.length}</span>
                <span className={`text-xs block ${isToday ? 'text-orange-300' : 'text-gray-500'}`}>orders</span>
              </div>
            </div>

            {dateOrders.length === 0 ? (
              <div className="p-6 text-center text-gray-600 italic text-sm">No active orders for this cook day.</div>
            ) : (
              <div className="p-4 space-y-3">
                {cookingDateOrders.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Clock size={12}/> Cooking Now ({cookingDateOrders.length})</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {cookingDateOrders.map(order => (
                        <div key={order.id} className="bg-black/30 border border-orange-800 rounded-lg p-3 flex justify-between items-center">
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">{order.customerName}
                              {order.type === 'CATERING' && <span className="text-[10px] bg-purple-900/50 text-purple-300 border border-purple-700 px-1.5 rounded-full">CAT</span>}
                            </div>
                            <div className="text-xs text-gray-400 truncate max-w-[220px]">{order.items.map(i => `${i.quantity}x ${i.item.name}`).join(', ')}</div>
                            <div className="text-xs text-gray-500 mt-1 flex gap-2">
                              <span>{order.pickupTime}</span>
                              <span className="flex items-center gap-1">{order.temperature === 'HOT' ? <Flame size={10} className="text-orange-500"/> : <Snowflake size={10} className="text-blue-400"/>} {order.temperature}</span>
                            </div>
                          </div>
                          <button onClick={() => handleMarkReady(order)} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg whitespace-nowrap">
                            <Check size={16}/> READY
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {paidDateOrders.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2"><CreditCard size={12}/> Paid &amp; Waiting ({paidDateOrders.length})</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {paidDateOrders.map(order => (
                        <div key={order.id} className="bg-black/30 border border-gray-700 rounded-lg p-3 flex justify-between items-center">
                          <div>
                            <div className="font-bold text-white text-sm flex items-center gap-1.5">{order.customerName}
                              {order.type === 'CATERING' && <span className="text-[10px] bg-purple-900/50 text-purple-300 border border-purple-700 px-1.5 rounded-full">CAT</span>}
                            </div>
                            <div className="text-xs text-gray-400 truncate max-w-[220px]">{order.items.map(i => `${i.quantity}x ${i.item.name}`).join(', ')}</div>
                            <div className="text-xs text-gray-500 mt-1">{order.pickupTime}</div>
                          </div>
                          <button onClick={() => handleStartCooking(order)} className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-2 rounded font-bold text-xs flex items-center gap-1">
                            <Flame size={14}/> Start
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {readyDateOrders.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-green-400 uppercase tracking-wider mb-2 flex items-center gap-2"><CheckCircle size={12}/> Ready for Pickup ({readyDateOrders.length})</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {readyDateOrders.map(order => (
                        <div key={order.id} className="bg-green-900/20 border border-green-800 rounded-lg p-3 flex justify-between items-center">
                          <div>
                            <div className="font-bold text-green-200 text-sm">{order.customerName}</div>
                            <div className="text-xs text-gray-400">{order.pickupTime} · {order.customerPhone}</div>
                          </div>
                          <button onClick={() => handleMarkCollected(order)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded font-bold text-xs flex items-center gap-1"><CheckCircle size={12}/> Collected</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pendingDateOrders.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-yellow-500 uppercase tracking-wider mb-2 flex items-center gap-2"><AlertTriangle size={12}/> Awaiting Action ({pendingDateOrders.length})</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {pendingDateOrders.map(order => (
                        <div key={order.id} className="bg-yellow-900/10 border border-yellow-800/40 rounded-lg p-3 flex justify-between items-center">
                          <div>
                            <div className="font-bold text-white text-sm flex items-center gap-1.5">{order.customerName}
                              {order.type === 'CATERING' && <span className="text-[10px] bg-purple-900/50 text-purple-300 border border-purple-700 px-1.5 rounded-full">CAT</span>}
                            </div>
                            <div className="text-xs text-yellow-600">{order.status}</div>
                            <div className="text-xs text-gray-500">${order.total.toFixed(2)}</div>
                          </div>
                          <button onClick={() => setEditingOrder(JSON.parse(JSON.stringify(order)))} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded font-bold text-xs flex items-center gap-1">
                            <Edit2 size={12}/> View
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      
      {/* EDIT MODAL */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-bbq-charcoal border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
             <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-900/50">
               <h3 className="text-xl font-bold text-white flex items-center gap-2">
                   {orders.find(o => o.id === editingOrder.id) ? <><Edit2 size={20}/> Edit Order</> : <><Plus size={20}/> Create Order</>}
               </h3>
               <div className="flex items-center gap-2">
                   {editingOrder.total > 0 && (
                       <button 
                           onClick={handleOpenInvoiceModal}
                           className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1"
                           title="Send Invoice"
                       >
                           <DollarSign size={14} /> Send Invoice
                       </button>
                   )}
                   <button onClick={() => setEditingOrder(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={20}/></button>
               </div>
             </div>
             
             <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-xs text-gray-400 uppercase font-bold flex gap-1">Customer Name <span className="text-red-500">*</span></label>
                      <input 
                         value={editingOrder.customerName}
                         onChange={e => setEditingOrder({...editingOrder, customerName: e.target.value})}
                         className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                         placeholder="Name..."
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-xs text-gray-400 uppercase font-bold flex gap-1">Email <span className="text-red-500">*</span></label>
                      <input 
                         type="email"
                         value={editingOrder.customerEmail || ''}
                         onChange={e => setEditingOrder({...editingOrder, customerEmail: e.target.value})}
                         className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                         placeholder="email@example.com"
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-xs text-gray-400 uppercase font-bold flex gap-1">Phone <span className="text-red-500">*</span></label>
                      <input 
                         value={editingOrder.customerPhone || ''}
                         onChange={e => setEditingOrder({...editingOrder, customerPhone: e.target.value})}
                         className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                         placeholder="0400 000 000"
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-xs text-gray-400 uppercase font-bold">Type</label>
                      <select 
                         value={editingOrder.type}
                         onChange={e => setEditingOrder({...editingOrder, type: e.target.value as any})}
                         className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                      >
                          <option value="TAKEAWAY">Takeaway</option>
                          <option value="CATERING">Catering</option>
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-xs text-gray-400 uppercase font-bold flex gap-1">Status <span className="text-red-500">*</span></label>
                      <select 
                         value={editingOrder.status}
                         onChange={e => setEditingOrder({...editingOrder, status: e.target.value as any})}
                         className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Awaiting Payment">Awaiting Payment</option>
                        <option value="Paid">Paid</option>
                        <option value="Confirmed">Confirmed (Legacy)</option>
                        <option value="Cooking">Cooking</option>
                        <option value="Ready">Ready</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Completed">Completed</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-xs text-gray-400 uppercase font-bold flex gap-1">Date (Cook Day) <span className="text-red-500">*</span></label>
                      <input 
                         type="date"
                         value={editingOrder.cookDay.split('T')[0]}
                         onChange={e => setEditingOrder({...editingOrder, cookDay: new Date(e.target.value).toISOString()})}
                         className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-xs text-gray-400 uppercase font-bold">Pickup Time</label>
                      <input 
                         value={editingOrder.pickupTime || ''}
                         onChange={e => setEditingOrder({...editingOrder, pickupTime: e.target.value})}
                         className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-xs text-gray-400 uppercase font-bold">Preferences</label>
                      <div className="flex gap-2">
                          <select 
                             value={editingOrder.temperature || 'HOT'}
                             onChange={e => setEditingOrder({...editingOrder, temperature: e.target.value as any})}
                             className="bg-gray-800 border border-gray-600 rounded p-2 text-white flex-1 text-xs"
                          >
                              <option value="HOT">HOT (Ready)</option>
                              <option value="COLD">COLD (Reheat)</option>
                          </select>
                          <select 
                             value={editingOrder.fulfillmentMethod || 'PICKUP'}
                             onChange={e => setEditingOrder({...editingOrder, fulfillmentMethod: e.target.value as any})}
                             className="bg-gray-800 border border-gray-600 rounded p-2 text-white flex-1 text-xs"
                          >
                              <option value="PICKUP">Pickup</option>
                              <option value="DELIVERY">Delivery</option>
                          </select>
                      </div>
                   </div>
                </div>

                {/* Pickup Location Override (for PICKUP orders) */}
                {editingOrder.fulfillmentMethod === 'PICKUP' && (
                    <div className="bg-green-900/20 border border-green-800 p-4 rounded-lg">
                        <h4 className="text-sm font-bold text-green-200 mb-3 flex items-center gap-2">
                            <MapPin size={16}/> Pickup Location
                        </h4>
                        <div className="space-y-1">
                            <label className="text-xs text-gray-400 uppercase font-bold">Collection Address</label>
                            <input 
                                value={editingOrder.pickupLocation || ''}
                                onChange={e => setEditingOrder({...editingOrder, pickupLocation: e.target.value})}
                                placeholder={settings.businessAddress || 'Leave blank to use calendar event / default address'}
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm"
                            />
                            <p className="text-[10px] text-gray-500">Override the default pickup address for this order (e.g. roadside pop-up location). Leave blank to use the cook day event location or business address.</p>
                        </div>
                    </div>
                )}

                {/* Tracking / Fulfillment Section */}
                {editingOrder.fulfillmentMethod === 'DELIVERY' && (
                    <div className="bg-purple-900/20 border border-purple-800 p-4 rounded-lg">
                        <h4 className="text-sm font-bold text-purple-200 mb-3 flex items-center gap-2">
                            <Truck size={16}/> Fulfillment Details
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs text-gray-400 uppercase font-bold">Courier</label>
                                <input 
                                    value={editingOrder.courier || 'Australia Post'}
                                    onChange={e => setEditingOrder({...editingOrder, courier: e.target.value})}
                                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-gray-400 uppercase font-bold">Tracking Number</label>
                                <input 
                                    value={editingOrder.trackingNumber || ''}
                                    onChange={e => setEditingOrder({...editingOrder, trackingNumber: e.target.value})}
                                    placeholder="e.g. 33K123456789"
                                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm font-mono"
                                />
                            </div>
                        </div>
                        <button 
                            onClick={handleShipAndNotify}
                            disabled={!editingOrder.trackingNumber}
                            className="mt-3 w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded text-xs flex justify-center items-center gap-2 disabled:opacity-50"
                        >
                            <Package size={14}/> Save, Mark Shipped & Notify Customer
                        </button>
                    </div>
                )}

                {/* Items Table */}
                <div>
                   <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Order Items</label>
                   <div className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-800 text-gray-400">
                          <tr>
                            <th className="p-3">Item</th>
                            <th className="p-3 text-center">Qty</th>
                            <th className="p-3 text-right">Price</th>
                            <th className="p-3 text-right">Total</th>
                            <th className="p-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {editingOrder.items.length === 0 ? (
                              <tr><td colSpan={5} className="p-4 text-center text-gray-500 italic">No items added.</td></tr>
                          ) : (
                            editingOrder.items.map((line, idx) => (
                                <tr key={idx}>
                                <td className="p-3">
                                    <div className="font-bold">{line.item.name}</div>
                                    <div className="text-xs text-gray-500">${line.item.price.toFixed(2)} ea</div>
                                    {line.item.description && <div className="text-xs text-gray-400 italic">{line.item.description}</div>}
                                    {line.selectedOption && <div className="text-xs text-bbq-red">{line.selectedOption}</div>}
                                </td>
                                <td className="p-3">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => handleItemQuantityChange(idx, -1)} className="w-6 h-6 bg-gray-700 rounded hover:bg-red-900">-</button>
                                        <span className="w-4 text-center">{line.quantity}</span>
                                        <button onClick={() => handleItemQuantityChange(idx, 1)} className="w-6 h-6 bg-gray-700 rounded hover:bg-green-900">+</button>
                                    </div>
                                </td>
                                <td className="p-3 text-right text-gray-400">${line.item.price.toFixed(2)}</td>
                                <td className="p-3 text-right font-bold">${(line.item.price * line.quantity).toFixed(2)}</td>
                                <td className="p-3 text-right">
                                    <button onClick={() => handleItemQuantityChange(idx, -line.quantity)} className="text-red-500 hover:text-red-400"><Trash2 size={16}/></button>
                                </td>
                                </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                      
                      {/* Add Item Row */}
                      <div className="p-3 bg-gray-800 border-t border-gray-700">
                        <div className="flex gap-4 mb-2">
                             <label className="flex items-center gap-2 text-xs cursor-pointer">
                                 <input 
                                    type="radio" 
                                    checked={!isCustomItem} 
                                    onChange={() => setIsCustomItem(false)} 
                                    className="text-bbq-red focus:ring-bbq-red"
                                 />
                                 <span className={!isCustomItem ? 'text-white font-bold' : 'text-gray-400'}>Select from Menu</span>
                             </label>
                             <label className="flex items-center gap-2 text-xs cursor-pointer">
                                 <input 
                                    type="radio" 
                                    checked={isCustomItem} 
                                    onChange={() => setIsCustomItem(true)} 
                                    className="text-bbq-red focus:ring-bbq-red"
                                 />
                                 <span className={isCustomItem ? 'text-white font-bold' : 'text-gray-400'}>Custom Item</span>
                             </label>
                        </div>

                        <div className="flex flex-col gap-2">
                            {isCustomItem ? (
                                <>
                                    <div className="flex gap-2">
                                        <input 
                                            placeholder="Item Name" 
                                            value={customItemName}
                                            onChange={e => setCustomItemName(e.target.value)}
                                            className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm"
                                        />
                                        <div className="relative w-24">
                                            <span className="absolute left-2 top-2 text-gray-500 text-sm">$</span>
                                            <input 
                                                type="number" 
                                                placeholder="0.00"
                                                value={customItemPrice}
                                                onChange={e => setCustomItemPrice(e.target.value)}
                                                className="w-full pl-5 bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <input 
                                            placeholder="Item Description (Optional)" 
                                            value={customItemDescription}
                                            onChange={e => setCustomItemDescription(e.target.value)}
                                            className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm"
                                        />
                                        <button 
                                            onClick={handleAddItem}
                                            disabled={!customItemName || !customItemPrice}
                                            className="bg-blue-600 text-white px-3 py-2 rounded font-bold text-sm hover:bg-blue-500 disabled:opacity-50"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex gap-2">
                                    <select 
                                        value={newItemId} 
                                        onChange={e => setNewItemId(e.target.value)}
                                        className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm"
                                    >
                                        <option value="">Select item to add...</option>
                                        {menu.map(m => (
                                            <option key={m.id} value={m.id}>{m.name} (${m.price})</option>
                                        ))}
                                    </select>
                                    <button 
                                        onClick={handleAddItem}
                                        disabled={!newItemId}
                                        className="bg-blue-600 text-white px-3 py-2 rounded font-bold text-sm hover:bg-blue-500 disabled:opacity-50"
                                    >
                                        Add
                                    </button>
                                </div>
                            )}
                        </div>
                      </div>
                   </div>
                </div>
             </div>

             <div className="p-4 bg-gray-900 border-t border-gray-700 flex justify-between items-center">
                <div className="text-xl font-bold">
                   Total: <span className="text-bbq-gold">${editingOrder.total.toFixed(2)}</span>
                   {editingOrder.depositAmount && (
                       <div className="text-xs text-green-400 font-normal">
                           Deposit Paid: ${editingOrder.depositAmount.toFixed(2)} (Due: ${(editingOrder.total - editingOrder.depositAmount).toFixed(2)})
                       </div>
                   )}
                </div>
                <div className="flex gap-2">
                   <button onClick={() => setEditingOrder(null)} className="px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
                   <button onClick={handleSaveEdit} className="px-6 py-2 bg-bbq-red text-white font-bold rounded flex items-center gap-2 hover:bg-red-700">
                      <Save size={18} /> {orders.find(o => o.id === editingOrder.id) ? 'Save Changes' : 'Create Order'}
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* INVOICE MODAL */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
             <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl animate-in zoom-in-95 p-6 space-y-4">
                 <div className="flex justify-between items-center mb-2">
                     <h3 className="text-xl font-bold text-white flex items-center gap-2"><DollarSign className="text-bbq-gold"/> Send Invoice</h3>
                     <button onClick={() => setShowInvoiceModal(false)}><X className="text-gray-400 hover:text-white"/></button>
                 </div>
                 
                 <p className="text-gray-400 text-sm">
                     Send a payment link for <strong>${editingOrder?.total.toFixed(2)}</strong> to {editingOrder?.customerName}.
                     <br/>
                     <span className="text-xs text-orange-400 mt-2 block">Note: This will move the order status to "Awaiting Payment".</span>
                 </p>
                 
                 <div className="space-y-3">
                     <div>
                         <label className="block text-xs font-bold text-gray-500 mb-1">Email Address</label>
                         <div className="flex gap-2">
                             <input 
                                value={invoiceContact.email}
                                onChange={e => setInvoiceContact({...invoiceContact, email: e.target.value})}
                                placeholder="customer@example.com"
                                className="flex-1 bg-gray-800 border border-gray-700 rounded p-2 text-white"
                             />
                             <button onClick={() => handleSendInvoice('EMAIL')} className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded font-bold text-sm flex items-center gap-2">
                                 <Mail size={16}/> Email
                             </button>
                         </div>
                     </div>
                     
                     <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-800"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-600 text-xs">OR</span>
                        <div className="flex-grow border-t border-gray-800"></div>
                     </div>

                     <div>
                         <label className="block text-xs font-bold text-gray-500 mb-1">Mobile Number</label>
                         <div className="flex gap-2">
                             <input 
                                value={invoiceContact.phone}
                                onChange={e => setInvoiceContact({...invoiceContact, phone: e.target.value})}
                                placeholder="0400 000 000"
                                className="flex-1 bg-gray-800 border border-gray-700 rounded p-2 text-white"
                             />
                             <button onClick={() => handleSendInvoice('SMS')} className="bg-green-600 hover:bg-green-500 text-white px-4 rounded font-bold text-sm flex items-center gap-2">
                                 <Smartphone size={16}/> SMS
                             </button>
                         </div>
                     </div>
                 </div>
             </div>
        </div>
      )}

      {/* PENDING REQUESTS SECTION */}
      {pendingRequests.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl overflow-hidden">
            <div className="p-4 bg-yellow-900/40 border-b border-yellow-700 flex items-center gap-2">
                <AlertTriangle className="text-yellow-500" />
                <h3 className="text-xl font-bold text-yellow-100">Pending Requests</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                         <tr className="text-yellow-200/50 border-b border-yellow-800/50 text-sm">
                            <th className="p-4">Date Needed</th>
                            <th className="p-4">Customer</th>
                            <th className="p-4">Order Details</th>
                            <th className="p-4">Prefs</th>
                            <th className="p-4">Total</th>
                            <th className="p-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-yellow-800/30">
                        {pendingRequests.map(order => (
                            <tr key={order.id} className="hover:bg-yellow-900/10">
                                <td className="p-4">
                                    <div className="font-bold text-white">{new Date(order.cookDay).toLocaleDateString()}</div>
                                    <div className="text-xs text-yellow-400">{order.pickupTime}</div>
                                </td>
                                <td className="p-4 font-bold">{order.customerName}</td>
                                <td className="p-4 text-sm text-gray-300 max-w-xs">
                                     {order.items.map(i => `${i.quantity}x ${i.item.name}`).join(', ')}
                                </td>
                                <td className="p-4 text-xs">
                                    <div className="flex gap-1 items-center">
                                        {order.fulfillmentMethod === 'DELIVERY' ? <Truck size={12} className="text-blue-400"/> : <ShoppingBag size={12}/>}
                                        {order.fulfillmentMethod}
                                    </div>
                                    <div className="flex gap-1 items-center mt-1">
                                        {order.temperature === 'HOT' ? <Flame size={12} className="text-orange-500"/> : <Snowflake size={12} className="text-blue-400"/>}
                                        {order.temperature}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className="font-bold text-white">${order.total}</span>
                                    {order.depositAmount && <div className="text-[10px] text-green-300">Paid: ${order.depositAmount}</div>}
                                </td>
                                <td className="p-4">
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleApprove(order)}
                                            className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded text-sm font-bold flex items-center gap-1"
                                            title="Accept & Move to Pending"
                                        >
                                            <CheckCircle size={14}/> Accept
                                        </button>
                                        <button 
                                            onClick={() => handleEditClick(order)}
                                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded text-sm font-bold flex items-center gap-1"
                                            title="Edit Order"
                                        >
                                            <Edit2 size={14}/>
                                        </button>
                                        <button 
                                            onClick={() => handleDecline(order)}
                                            className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded text-sm font-bold flex items-center gap-1"
                                            title="Decline"
                                        >
                                            <XCircle size={14}/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* ACTIVE ORDERS SECTION */}
      <div>
        <h3 className="text-xl font-bold border-b border-gray-700 pb-2 mb-4">Active Orders & Payment</h3>
        
        <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-gray-900/50 text-gray-400 border-b border-gray-700">
                <th className="p-3">Order ID</th>
                <th className="p-3">Date/Time</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Details</th>
                <th className="p-3">Total</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
                {activeOrders.length === 0 ? (
                <tr><td colSpan={7} className="p-4 text-center text-gray-500">No active orders found.</td></tr>
                ) : (
                activeOrders.map(order => (
                    <tr key={order.id} className="hover:bg-white/5">
                    <td className="p-3 text-sm font-mono text-gray-400">#{order.id.slice(-6)}</td>
                    <td className="p-3 text-sm">
                        <div className="font-bold">{new Date(order.cookDay).toLocaleDateString()}</div>
                        <div className="text-gray-500">{order.pickupTime}</div>
                        <div className="flex gap-1 mt-1 text-[10px] text-gray-400">
                            {order.temperature === 'HOT' ? <Flame size={10} className="text-orange-500"/> : <Snowflake size={10}/>}
                            {order.temperature}
                        </div>
                    </td>
                    <td className="p-3">
                        {order.customerName}
                        <div className="text-xs text-gray-500">{order.customerPhone}</div>
                        {order.fulfillmentMethod === 'DELIVERY' && (
                            <div className="text-[10px] text-blue-300 mt-1 flex gap-1">
                                <Truck size={10}/> {order.deliveryAddress}
                            </div>
                        )}
                    </td>
                    <td className="p-3 text-sm text-gray-300 max-w-xs">
                        <div className="truncate">{order.items.map(i => `${i.quantity}x ${i.item.name}`).join(', ')}</div>
                        {order.items.some(i => i.packSelections) && (
                            <div className="text-[10px] text-gray-500 italic mt-1">Contains Pack Selections</div>
                        )}
                    </td>
                    <td className="p-3">
                        <div className="font-bold text-bbq-gold">${order.total}</div>
                        {order.depositAmount && (
                            <div className="text-[10px] text-green-400">
                                Paid: ${order.depositAmount}
                                <br/>
                                Due: ${order.total - order.depositAmount}
                            </div>
                        )}
                    </td>
                    <td className={`p-3 font-bold ${getStatusColor(order.status)}`}>{order.status}</td>
                    <td className="p-3 flex gap-2">
                        {/* Edit Button is always available */}
                        <button 
                            onClick={() => handleEditClick(order)}
                            className="p-2 bg-gray-700 rounded hover:bg-gray-600 text-white"
                            title="Edit"
                        >
                            <Edit2 size={16} />
                        </button>

                        {/* WORKFLOW BUTTONS */}
                        
                        {/* 1. Pending -> Send Invoice (Wait for Payment) */}
                        {order.status === 'Pending' && (
                           <button 
                                onClick={() => { setEditingOrder(order); handleOpenInvoiceModal(); }}
                                className="p-2 bg-green-600 rounded hover:bg-green-500 text-white flex items-center gap-1 text-xs font-bold"
                                title="Send Invoice"
                           >
                                <DollarSign size={16} /> Invoice
                           </button>
                        )}

                        {/* 2. Awaiting Payment -> Mark Paid */}
                        {order.status === 'Awaiting Payment' && (
                           <button 
                                onClick={() => handleMarkPaid(order.id)}
                                className="p-2 bg-blue-600 rounded hover:bg-blue-500 text-white flex items-center gap-1 text-xs font-bold"
                                title="Mark Paid"
                           >
                                <CreditCard size={16} /> Paid?
                           </button>
                        )}

                        {/* 3. Paid/Confirmed -> Start Cooking */}
                        {(order.status === 'Paid' || order.status === 'Confirmed') && (
                           <button onClick={() => handleStartCooking(order)} className="p-2 bg-orange-600 rounded hover:bg-orange-500 text-white" title="Start Cooking & Notify">
                            <Clock size={16} />
                           </button>
                        )}
                        
                        {/* 4. Cooking -> Ready (Triggers SMS) or Shipped */}
                        {order.status === 'Cooking' && (
                            <>
                                <button onClick={() => handleMarkReady(order)} className="p-2 bg-green-600 rounded hover:bg-green-500" title="Mark Ready & Notify">
                                    <MessageCircle size={16} />
                                </button>
                                {order.fulfillmentMethod === 'DELIVERY' && (
                                    <button onClick={() => handleEditClick(order)} className="p-2 bg-purple-600 rounded hover:bg-purple-500" title="Add Tracking & Ship">
                                        <Package size={16} />
                                    </button>
                                )}
                            </>
                        )}
                        
                        {/* 5. Ready -> Collected (sends thank-you email) */}
                        {(order.status === 'Ready' || order.status === 'Shipped') && (
                        <button onClick={() => handleMarkCollected(order)} className="p-2 bg-blue-600 rounded hover:bg-blue-500" title="Mark Collected & Send Thank You">
                            <CheckCircle size={16} />
                        </button>
                        )}
                    </td>
                    </tr>
                ))
                )}
            </tbody>
            </table>
        </div>
      </div>
      
      {/* REJECTED HISTORY (Collapsed view could be better, but listing here for now) */}
      {rejectedOrders.length > 0 && (
          <div className="opacity-50">
             <h4 className="text-sm font-bold text-gray-500 mb-2 mt-8">Rejected / Cancelled History</h4>
             <div className="text-xs text-gray-500">
                 {rejectedOrders.map(o => (
                     <div key={o.id} className="border-b border-gray-800 py-1 flex gap-4">
                         <span>{new Date(o.cookDay).toLocaleDateString()}</span>
                         <span>{o.customerName}</span>
                         <span>${o.total}</span>
                         <span className="text-red-500">{o.status}</span>
                     </div>
                 ))}
             </div>
          </div>
      )}
    </div>
  );
};

export default OrderManager;
