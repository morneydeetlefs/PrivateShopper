// =============================================================================
// wa.js — WhatsApp Message Builders
// Neighbourhood Delivery Platform
// =============================================================================
// Builds wa.me deep links for every notification type in the platform.
// No emoji — uses WhatsApp markdown (*bold*, _italic_, ----) for formatting.
// All functions return a ready-to-open wa.me URL string.
//
// USAGE:
//   const link = WA.otpRegister({ name, phone, otp, appName, expiryMins });
//   window.open(link);   // or set as href
//
// DEPENDENCIES: none — pure JS, no imports required
// INCLUDE:  <script src="wa.js"></script>
// =============================================================================

const WA = (() => {
  'use strict';

  const CURRENCY = 'R ';

  // ---------------------------------------------------------------------------
  // Core builder — cleans phone, encodes message, returns wa.me URL
  // ---------------------------------------------------------------------------
  function build(phone, lines) {
    const clean = String(phone).replace(/\D/g, '');
    const msg   = lines.filter(l => l !== null && l !== undefined).join('\n');
    return 'https://wa.me/' + clean + '?text=' + encodeURIComponent(msg);
  }

  // ---------------------------------------------------------------------------
  // Money formatter
  // ---------------------------------------------------------------------------
  function money(amount) {
    return CURRENCY + Number(amount).toFixed(2);
  }

  // ---------------------------------------------------------------------------
  // Day label helper
  // ---------------------------------------------------------------------------
  function windowLabel(win) {
    if (!win) return '';
    return `${win.day_of_week} ${win.start_time}–${win.end_time}`;
  }

  // ---------------------------------------------------------------------------
  // Divider
  // ---------------------------------------------------------------------------
  const DIV = '----';

  // ===========================================================================
  // 1. OTP — Registration (sent by admin after new signup)
  // ===========================================================================
  // params: { appName, name, phone, otp, expiryMins }
  function otpRegister({ appName, name, phone, otp, expiryMins = 30 }) {
    return build(phone, [
      `*${appName}*`,
      '',
      `Hi ${name}, welcome!`,
      '',
      'Your verification code is:',
      '',
      `*${otp}*`,
      '',
      `_This code expires in ${expiryMins} minutes._`,
      '_Do not share this code with anyone._',
    ]);
  }

  // ===========================================================================
  // 2. OTP — Account Approval (sent by admin when approving a pending user)
  // ===========================================================================
  // params: { appName, name, phone, otp, expiryMins }
  function otpApproval({ appName, name, phone, otp, expiryMins = 30 }) {
    return build(phone, [
      `*${appName}*`,
      '',
      `Hi ${name}, your account has been approved!`,
      '',
      'Enter this code in the app to activate your account:',
      '',
      `*${otp}*`,
      '',
      `_Expires in ${expiryMins} minutes._`,
    ]);
  }

  // ===========================================================================
  // 3. Order Confirmation (sent after customer places order)
  // ===========================================================================
  // params: {
  //   appName, name, phone, order_id,
  //   items: [{ name, size, qty, unit_price }],
  //   subtotal, delivery_fee, total,
  //   payment_method, window: { day_of_week, start_time, end_time }
  // }
  function orderConfirmation({ appName, name, phone, order_id, items, subtotal, delivery_fee, total, payment_method, window: win }) {
    const itemLines = (items || []).map(i => {
      const lineTotal = money(Number(i.unit_price) * Number(i.qty));
      const label = i.size ? `${i.name} (${i.size})` : i.name;
      return `${label} x${i.qty}    ${lineTotal}`;
    });

    return build(phone, [
      `*${appName} — Order Confirmed*`,
      '',
      `Hi ${name}, we have received your order.`,
      '',
      `Order: *${order_id}*`,
      win ? `Delivery: _${windowLabel(win)}_` : null,
      '',
      DIV,
      ...itemLines,
      DIV,
      `Subtotal:       ${money(subtotal)}`,
      `Delivery:       ${money(delivery_fee)}`,
      `*Total due:     ${money(total)}*`,
      `Payment:        ${payment_method}`,
      '',
      '_We will update you as your order progresses._',
    ]);
  }

  // ===========================================================================
  // 4. Order Status Updates (one per lifecycle stage)
  // ===========================================================================
  // params: { appName, name, phone, order_id, status, notes?, total, payment_method }
  function orderStatusUpdate({ appName, name, phone, order_id, status, notes, total, payment_method }) {
    const messages = {
      confirmed:  'Your order has been confirmed and will be picked up soon.',
      picking:    'We are currently shopping for your order.',
      packed:     'Your order is packed and ready for delivery.',
      delivering: 'Your order is on its way to you now!',
      delivered:  'Your order has been delivered. Enjoy!',
      issue:      'There is an issue with your order. We will contact you shortly.',
      cancelled:  'Your order has been cancelled.',
    };

    const statusMsg = messages[status] || `Your order status has been updated to: ${status}`;

    return build(phone, [
      `*${appName}*`,
      '',
      `Hi ${name},`,
      '',
      `Order *${order_id}* update:`,
      '',
      statusMsg,
      notes ? `\n_Note: ${notes}_` : null,
      '',
      status === 'delivering'
        ? `*Amount due: ${money(total)}* (${payment_method})`
        : null,
    ]);
  }

  // ===========================================================================
  // 5. Till Slip + Packed Notification (sent after slip captured, before delivery)
  // ===========================================================================
  // params: {
  //   appName, name, phone, order_id,
  //   items: [{ name, size, qty, unit_price }],
  //   subtotal, delivery_fee, total, payment_method,
  //   window: { day_of_week, start_time, end_time },
  //   till_slip_url
  // }
  function tillSlipNotification({ appName, name, phone, order_id, items, subtotal, delivery_fee, total, payment_method, window: win, till_slip_url }) {
    const itemLines = (items || []).map(i => {
      const lineTotal = money(Number(i.unit_price) * Number(i.qty));
      const label = i.size ? `${i.name} (${i.size})` : i.name;
      return `${label} x${i.qty}    ${lineTotal}`;
    });

    return build(phone, [
      `*${appName} — Your Order is Packed*`,
      '',
      `Hi ${name}, your order is packed and out for delivery soon!`,
      '',
      `Order: *${order_id}*`,
      win ? `Delivery window: _${windowLabel(win)}_` : null,
      '',
      DIV,
      ...itemLines,
      DIV,
      `Subtotal:       ${money(subtotal)}`,
      `Delivery:       ${money(delivery_fee)}`,
      `*Total due:     ${money(total)}*`,
      `Payment:        ${payment_method}`,
      '',
      till_slip_url ? `Till slip: ${till_slip_url}` : null,
      '',
      '_Thank you for your order!_',
    ]);
  }

  // ===========================================================================
  // 6. Picking List — sent to picker per store per delivery window
  // ===========================================================================
  // params: {
  //   appName, pickerPhone, storeName, windowLabel,
  //   orders: [{
  //     order_id, customer_name, total, payment_method,
  //     items: [{ name, size, qty, substitution }]
  //   }]
  // }
  function pickingList({ appName, pickerPhone, storeName, windowLabel: winLabel, orders }) {
    const lines = [
      `*${appName} — Picking List*`,
      `*${storeName}*`,
      `_${winLabel}_`,
      DIV,
    ];

    (orders || []).forEach((order, idx) => {
      lines.push(`*${idx + 1}. ${order.order_id}* — ${order.customer_name}`);
      lines.push(`   Payment: ${order.payment_method} — *${money(order.total)}*`);
      (order.items || []).forEach(item => {
        const label = item.size ? `${item.name} (${item.size})` : item.name;
        const sub   = item.substitution !== 'contact' ? ` [sub: ${item.substitution}]` : '';
        lines.push(`   - ${label} x${item.qty}${sub}`);
      });
      lines.push('');
    });

    lines.push(DIV);
    lines.push(`_Total orders: ${(orders || []).length}_`);

    return build(pickerPhone, lines);
  }

  // ===========================================================================
  // 7. Delivery Run — sent to driver with ordered stop list
  // ===========================================================================
  // params: {
  //   appName, driverPhone,
  //   windowLabel,
  //   storeRoute: [{ name, address }],
  //   clientStops: [{
  //     order_id, user_name, address, phone,
  //     total, payment_method, payment_status
  //   }],
  //   totalKm
  // }
  function deliveryRun({ appName, driverPhone, windowLabel: winLabel, storeRoute, clientStops, totalKm }) {
    const lines = [
      `*${appName} — Delivery Run*`,
      `_${winLabel}_`,
      `_Estimated route: ${Number(totalKm).toFixed(1)} km_`,
      DIV,
      '*SHOPPING STOPS*',
    ];

    (storeRoute || []).forEach((store, i) => {
      lines.push(`${i + 1}. *${store.name}*`);
      lines.push(`   ${store.address}`);
    });

    lines.push('');
    lines.push(DIV);
    lines.push('*DELIVERY STOPS*');

    (clientStops || []).forEach((stop, i) => {
      const collected = stop.payment_status === 'paid' ? ' (PAID)' : '';
      lines.push(`${i + 1}. *${stop.user_name}*${collected}`);
      lines.push(`   ${stop.address}`);
      lines.push(`   Order: ${stop.order_id} — *${money(stop.total)}* ${stop.payment_method}`);
    });

    lines.push('');
    lines.push(DIV);
    lines.push(`_${(clientStops || []).length} deliveries — safe travels!_`);

    return build(driverPhone, lines);
  }

  // ===========================================================================
  // 8. Payment Confirmation (sent by admin after collecting payment)
  // ===========================================================================
  // params: { appName, name, phone, order_id, amount, method }
  function paymentConfirmation({ appName, name, phone, order_id, amount, method }) {
    return build(phone, [
      `*${appName} — Payment Received*`,
      '',
      `Hi ${name},`,
      '',
      `Payment of *${money(amount)}* received for order *${order_id}*.`,
      `Method: ${method}`,
      '',
      '_Thank you for your business!_',
    ]);
  }

  // ===========================================================================
  // 9. General admin contact link (pre-filled item enquiry from customer app)
  // ===========================================================================
  // params: { adminPhone, appName, customerName, itemName, note? }
  function customerEnquiry({ adminPhone, appName, customerName, itemName, note }) {
    return build(adminPhone, [
      `*${appName} — Product Enquiry*`,
      '',
      `Hi, I am ${customerName} and I would like to enquire about:`,
      '',
      `*${itemName}*`,
      note ? `\n${note}` : null,
    ]);
  }

  // ---------------------------------------------------------------------------
  // Expose public API
  // ---------------------------------------------------------------------------
  return {
    otpRegister,
    otpApproval,
    orderConfirmation,
    orderStatusUpdate,
    tillSlipNotification,
    pickingList,
    deliveryRun,
    paymentConfirmation,
    customerEnquiry,
  };

})();
