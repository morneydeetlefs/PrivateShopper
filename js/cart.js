// =============================================================================
// cart.js — Hybrid Cart Sync Module
// Neighbourhood Delivery Platform
// =============================================================================
// localStorage is the instant cache. CARTS sheet is source of truth.
// On load  → pull from sheet into localStorage
// On change → write localStorage immediately, debounce sheet sync 800ms
//
// USAGE:
//   await Cart.load(userId, token);       // on app startup after login
//   Cart.add(productId, storeId, qty);    // add or update qty
//   Cart.remove(productId);               // remove one item
//   Cart.clear();                         // empty cart
//   Cart.get();                           // returns current items array
//   Cart.count();                         // total item count (sum of qty)
//   Cart.total(productMap);               // subtotal given { product_id: { price } }
//   Cart.getByStore();                    // items grouped by store_id
//   Cart.onUpdate(fn);                    // register callback on any change
//
// DEPENDENCIES: expects window.API and window.api() helper to exist
//   api() signature: api(action, body) → Promise<responseObject>
// =============================================================================

const Cart = (() => {
  'use strict';

  const STORAGE_KEY  = 'ndp_cart';
  const SYNC_DELAY   = 800; // ms debounce before writing to sheet

  let _userId    = null;
  let _token     = null;
  let _syncTimer = null;
  let _listeners = [];
  let _syncing   = false;

  // ---------------------------------------------------------------------------
  // Internal: read/write localStorage
  // ---------------------------------------------------------------------------
  function _read() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function _write(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  // ---------------------------------------------------------------------------
  // Internal: notify all registered listeners
  // ---------------------------------------------------------------------------
  function _notify() {
    const items = _read();
    _listeners.forEach(fn => { try { fn(items); } catch (e) {} });
  }

  // ---------------------------------------------------------------------------
  // Internal: debounced sheet sync
  // ---------------------------------------------------------------------------
  function _scheduleSync() {
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => _syncToSheet(), SYNC_DELAY);
  }

  async function _syncToSheet() {
    if (!_userId || !_token || _syncing) return;
    _syncing = true;
    try {
      const items = _read();
      await api('syncCart', { token: _token, items });
    } catch (e) {
      console.warn('[Cart] Sheet sync failed:', e.message);
      // Non-fatal — localStorage is still intact
    } finally {
      _syncing = false;
    }
  }

  // ---------------------------------------------------------------------------
  // load — pull from sheet into localStorage (call once after login)
  // ---------------------------------------------------------------------------
  async function load(userId, token) {
    _userId = userId;
    _token  = token;

    try {
      const res = await api('getCart', null, { user_id: userId, token });
      if (res.success && Array.isArray(res.items)) {
        _write(res.items);
        _notify();
        return res.items;
      }
    } catch (e) {
      console.warn('[Cart] Load from sheet failed, using localStorage cache:', e.message);
    }

    // Fall back to whatever is in localStorage already
    return _read();
  }

  // ---------------------------------------------------------------------------
  // add — add item or update qty. qty=0 removes the item.
  // ---------------------------------------------------------------------------
  function add(productId, storeId, qty) {
    const items  = _read();
    const idx    = items.findIndex(i => i.product_id === String(productId));
    const newQty = Number(qty);

    if (newQty <= 0) {
      if (idx !== -1) items.splice(idx, 1);
    } else if (idx !== -1) {
      items[idx].qty      = newQty;
      items[idx].store_id = String(storeId);
    } else {
      items.push({
        product_id: String(productId),
        store_id:   String(storeId),
        qty:        newQty
      });
    }

    _write(items);
    _notify();
    _scheduleSync();
    return items;
  }

  // ---------------------------------------------------------------------------
  // remove — remove a product entirely from cart
  // ---------------------------------------------------------------------------
  function remove(productId) {
    const items = _read().filter(i => i.product_id !== String(productId));
    _write(items);
    _notify();
    _scheduleSync();
    return items;
  }

  // ---------------------------------------------------------------------------
  // clear — empty cart (call after order placed)
  // ---------------------------------------------------------------------------
  function clear() {
    _write([]);
    _notify();
    _scheduleSync();
  }

  // ---------------------------------------------------------------------------
  // get — return current items array
  // ---------------------------------------------------------------------------
  function get() {
    return _read();
  }

  // ---------------------------------------------------------------------------
  // count — total number of items (sum of all qty)
  // ---------------------------------------------------------------------------
  function count() {
    return _read().reduce((sum, i) => sum + Number(i.qty), 0);
  }

  // ---------------------------------------------------------------------------
  // total — calculate subtotal given a productMap { product_id: { price } }
  // ---------------------------------------------------------------------------
  function total(productMap) {
    return _read().reduce((sum, i) => {
      const p = productMap[i.product_id];
      return sum + (p ? Number(p.price) * Number(i.qty) : 0);
    }, 0);
  }

  // ---------------------------------------------------------------------------
  // getByStore — return items grouped by store_id
  // { store_id: [{ product_id, store_id, qty }] }
  // ---------------------------------------------------------------------------
  function getByStore() {
    const groups = {};
    _read().forEach(item => {
      const sid = item.store_id;
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(item);
    });
    return groups;
  }

  // ---------------------------------------------------------------------------
  // getStoreIds — unique store IDs in cart
  // ---------------------------------------------------------------------------
  function getStoreIds() {
    return [...new Set(_read().map(i => i.store_id))];
  }

  // ---------------------------------------------------------------------------
  // onUpdate — register a callback fired on every cart change
  // Returns an unsubscribe function
  // ---------------------------------------------------------------------------
  function onUpdate(fn) {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(f => f !== fn); };
  }

  // ---------------------------------------------------------------------------
  // forceSync — immediate sync (call before page unload / order submission)
  // ---------------------------------------------------------------------------
  async function forceSync() {
    clearTimeout(_syncTimer);
    await _syncToSheet();
  }

  // ---------------------------------------------------------------------------
  // logout — clear session refs and cart
  // ---------------------------------------------------------------------------
  function logout() {
    clearTimeout(_syncTimer);
    _userId = null;
    _token  = null;
    _write([]);
    _notify();
  }

  // ---------------------------------------------------------------------------
  // Expose public API
  // ---------------------------------------------------------------------------
  return {
    load,
    add,
    remove,
    clear,
    get,
    count,
    total,
    getByStore,
    getStoreIds,
    onUpdate,
    forceSync,
    logout,
  };

})();
