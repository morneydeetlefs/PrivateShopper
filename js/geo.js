// =============================================================================
// geo.js — Reusable Map Modal + Geo Utilities
// Neighbourhood Delivery Platform
// =============================================================================
// DEPENDENCIES (add to any HTML page that uses this module):
//   <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
//   <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
//   <script src="geo.js"></script>
//
// USAGE:
//   // Pick a location (returns { lat, lon, display_address } or null if cancelled)
//   const loc = await openMapModal({ title: 'Set Delivery Address' });
//
//   // Pick with a starting position
//   const loc = await openMapModal({
//     title: 'Edit Store Location',
//     lat: -29.8587, lon: 31.0218
//   });
//
//   // Read-only view (no dragging, just shows the pin)
//   await openMapModal({
//     title: 'Your Delivery Location',
//     lat: -29.8587, lon: 31.0218,
//     readonly: true
//   });
//
//   // Show a route (array of waypoints, readonly automatically)
//   await openMapModal({
//     title: 'Delivery Route',
//     route: [
//       { lat: -29.85, lon: 31.02, label: 'Base' },
//       { lat: -29.87, lon: 31.05, label: 'SPAR' },
//       { lat: -29.90, lon: 31.03, label: 'Customer' },
//     ]
//   });
// =============================================================================

(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Default fallback coordinates (Durban CBD) — overridden by config or GPS
  // ---------------------------------------------------------------------------
  const DEFAULT_LAT = -29.8587;
  const DEFAULT_LON = 31.0218;
  const DEFAULT_ZOOM = 14;

  // ---------------------------------------------------------------------------
  // Inject CSS once
  // ---------------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById('geo-modal-styles')) return;
    const style = document.createElement('style');
    style.id = 'geo-modal-styles';
    style.textContent = `
      /* ── Backdrop ── */
      #geo-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9000;
        background: rgba(10, 8, 5, 0.82);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        opacity: 0;
        transition: opacity 0.22s ease;
      }
      #geo-modal-backdrop.geo-visible {
        opacity: 1;
      }

      /* ── Modal shell ── */
      #geo-modal {
        width: 100%;
        max-width: 640px;
        max-height: 90dvh;
        display: flex;
        flex-direction: column;
        background: #13110d;
        border: 1px solid #c9a84c44;
        border-radius: 4px;
        overflow: hidden;
        box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px #c9a84c22;
        transform: translateY(18px) scale(0.98);
        transition: transform 0.26s cubic-bezier(0.16, 1, 0.3, 1);
      }
      #geo-modal-backdrop.geo-visible #geo-modal {
        transform: translateY(0) scale(1);
      }

      /* ── Header ── */
      #geo-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        border-bottom: 1px solid #c9a84c33;
        flex-shrink: 0;
        background: #0f0d0a;
      }
      #geo-modal-title {
        font-family: 'Cinzel', 'Palatino Linotype', serif;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #c9a84c;
        margin: 0;
      }
      #geo-modal-close {
        background: none;
        border: none;
        color: #888;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 3px;
        transition: color 0.15s, background 0.15s;
      }
      #geo-modal-close:hover {
        color: #c9a84c;
        background: #c9a84c18;
      }

      /* ── Search bar ── */
      #geo-search-wrap {
        padding: 12px 14px;
        border-bottom: 1px solid #c9a84c22;
        flex-shrink: 0;
        background: #11100c;
        position: relative;
      }
      #geo-search-input {
        width: 100%;
        box-sizing: border-box;
        background: #1a1710;
        border: 1px solid #c9a84c44;
        border-radius: 3px;
        color: #e8dfc8;
        font-family: 'Raleway', sans-serif;
        font-size: 13px;
        padding: 9px 38px 9px 12px;
        outline: none;
        transition: border-color 0.18s;
      }
      #geo-search-input:focus {
        border-color: #c9a84c99;
      }
      #geo-search-input::placeholder {
        color: #556;
      }
      #geo-search-spinner {
        position: absolute;
        right: 26px;
        top: 50%;
        transform: translateY(-50%);
        width: 14px;
        height: 14px;
        border: 2px solid #c9a84c33;
        border-top-color: #c9a84c;
        border-radius: 50%;
        animation: geo-spin 0.7s linear infinite;
        display: none;
      }
      #geo-search-spinner.geo-spinning {
        display: block;
      }
      @keyframes geo-spin {
        to { transform: translateY(-50%) rotate(360deg); }
      }
      #geo-search-results {
        position: absolute;
        left: 14px;
        right: 14px;
        top: calc(100% - 12px);
        z-index: 9999;
        background: #1a1710;
        border: 1px solid #c9a84c44;
        border-top: none;
        border-radius: 0 0 3px 3px;
        max-height: 180px;
        overflow-y: auto;
        display: none;
      }
      #geo-search-results.geo-open {
        display: block;
      }
      .geo-result-item {
        padding: 9px 12px;
        font-family: 'Raleway', sans-serif;
        font-size: 12px;
        color: #c8bfa8;
        cursor: pointer;
        border-bottom: 1px solid #c9a84c18;
        transition: background 0.12s;
        line-height: 1.4;
      }
      .geo-result-item:last-child { border-bottom: none; }
      .geo-result-item:hover { background: #c9a84c18; color: #e8dfc8; }

      /* ── Map ── */
      #geo-map {
        flex: 1;
        min-height: 320px;
      }

      /* ── Footer ── */
      #geo-modal-footer {
        padding: 12px 16px;
        border-top: 1px solid #c9a84c33;
        background: #0f0d0a;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      #geo-address-display {
        flex: 1;
        font-family: 'Raleway', sans-serif;
        font-size: 11px;
        color: #8a7f6a;
        line-height: 1.4;
        min-width: 0;
      }
      #geo-address-display span {
        color: #c8bfa8;
        display: block;
      }
      #geo-confirm-btn {
        flex-shrink: 0;
        background: #c9a84c;
        color: #0f0d0a;
        border: none;
        border-radius: 3px;
        font-family: 'Raleway', sans-serif;
        font-weight: 700;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 10px 20px;
        cursor: pointer;
        transition: background 0.15s, transform 0.1s;
      }
      #geo-confirm-btn:hover {
        background: #e0bc5c;
        transform: translateY(-1px);
      }
      #geo-confirm-btn:active {
        transform: translateY(0);
      }
      #geo-confirm-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        transform: none;
      }

      /* ── GPS button ── */
      #geo-gps-btn {
        flex-shrink: 0;
        background: none;
        border: 1px solid #c9a84c44;
        border-radius: 3px;
        color: #c9a84c;
        font-size: 18px;
        width: 38px;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
        title: 'Use my location';
      }
      #geo-gps-btn:hover {
        background: #c9a84c18;
        border-color: #c9a84c88;
      }

      /* ── Readonly hint ── */
      #geo-readonly-hint {
        font-family: 'Raleway', sans-serif;
        font-size: 11px;
        color: #c9a84c99;
        letter-spacing: 0.05em;
      }

      /* ── Leaflet overrides ── */
      #geo-map .leaflet-container {
        background: #1a1a1a;
        font-family: 'Raleway', sans-serif;
      }
      #geo-map .leaflet-tile {
        filter: brightness(0.85) saturate(0.7) hue-rotate(5deg);
      }
      #geo-map .leaflet-control-zoom a {
        background: #1a1710;
        color: #c9a84c;
        border-color: #c9a84c44;
      }
      #geo-map .leaflet-control-zoom a:hover {
        background: #c9a84c18;
      }
      #geo-map .leaflet-popup-content-wrapper {
        background: #1a1710;
        color: #e8dfc8;
        border: 1px solid #c9a84c44;
        border-radius: 3px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        font-family: 'Raleway', sans-serif;
        font-size: 12px;
      }
      #geo-map .leaflet-popup-tip {
        background: #1a1710;
      }

      /* ── Route legend ── */
      #geo-route-legend {
        padding: 10px 16px;
        background: #11100c;
        border-bottom: 1px solid #c9a84c22;
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
        flex-shrink: 0;
      }
      .geo-legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: 'Raleway', sans-serif;
        font-size: 11px;
        color: #8a7f6a;
      }
      .geo-legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------------------
  // Inject modal HTML once
  // ---------------------------------------------------------------------------
  function injectHTML() {
    if (document.getElementById('geo-modal-backdrop')) return;
    const div = document.createElement('div');
    div.innerHTML = `
      <div id="geo-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="geo-modal-title">
        <div id="geo-modal">
          <div id="geo-modal-header">
            <h2 id="geo-modal-title">Select Location</h2>
            <button id="geo-modal-close" aria-label="Close map">&times;</button>
          </div>
          <div id="geo-search-wrap" style="display:none">
            <input id="geo-search-input" type="text" placeholder="Search for an address or place…" autocomplete="off"/>
            <div id="geo-search-spinner"></div>
            <div id="geo-search-results"></div>
          </div>
          <div id="geo-route-legend" style="display:none"></div>
          <div id="geo-map"></div>
          <div id="geo-modal-footer">
            <button id="geo-gps-btn" aria-label="Use my GPS location" title="Use my location">⊕</button>
            <div id="geo-address-display">
              <span id="geo-address-text">Drag the pin to your location</span>
            </div>
            <span id="geo-readonly-hint" style="display:none">View only</span>
            <button id="geo-confirm-btn">Confirm</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div.firstElementChild);
  }

  // ---------------------------------------------------------------------------
  // Module state
  // ---------------------------------------------------------------------------
  let _map = null;
  let _marker = null;
  let _routeLayer = null;
  let _searchTimer = null;
  let _resolveModal = null;
  let _currentLat = DEFAULT_LAT;
  let _currentLon = DEFAULT_LON;
  let _reverseTimer = null;

  // ---------------------------------------------------------------------------
  // Initialise Leaflet map (first open or reuse)
  // ---------------------------------------------------------------------------
  function initMap(lat, lon, readonly) {
    if (!_map) {
      _map = L.map('geo-map', {
        zoomControl: true,
        attributionControl: true
      }).setView([lat, lon], DEFAULT_ZOOM);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://openstreetmap.org/copyright" style="color:#c9a84c">OpenStreetMap</a>'
      }).addTo(_map);
    } else {
      _map.setView([lat, lon], DEFAULT_ZOOM);
    }

    // Remove old marker
    if (_marker) { _map.removeLayer(_marker); _marker = null; }
    if (_routeLayer) { _map.removeLayer(_routeLayer); _routeLayer = null; }

    if (!readonly) {
      _marker = L.marker([lat, lon], { draggable: true, autoPan: true }).addTo(_map);
      _marker.on('dragend', () => {
        const pos = _marker.getLatLng();
        _currentLat = pos.lat;
        _currentLon = pos.lng;
        scheduleReverseGeocode(pos.lat, pos.lng);
      });

      // Click map to move marker
      _map.on('click', (e) => {
        _marker.setLatLng(e.latlng);
        _currentLat = e.latlng.lat;
        _currentLon = e.latlng.lng;
        scheduleReverseGeocode(e.latlng.lat, e.latlng.lng);
      });
    }

    // Force Leaflet to recalc size after modal animation
    setTimeout(() => { if (_map) _map.invalidateSize(); }, 80);
  }

  // ---------------------------------------------------------------------------
  // Route mode
  // ---------------------------------------------------------------------------
  function renderRoute(waypoints) {
    if (!_map) return;
    if (_routeLayer) { _map.removeLayer(_routeLayer); }
    if (_marker) { _map.removeLayer(_marker); _marker = null; }

    const colours = ['#c9a84c', '#4caf8a', '#4c8ac9', '#c94c4c', '#9c4cc9', '#c97c4c'];
    const latlngs = waypoints.map(w => [w.lat, w.lon]);

    // Draw polyline
    _routeLayer = L.layerGroup().addTo(_map);
    L.polyline(latlngs, { color: '#c9a84c', weight: 2.5, opacity: 0.7, dashArray: '6 5' })
      .addTo(_routeLayer);

    // Draw markers
    waypoints.forEach((wp, i) => {
      const colour = colours[i % colours.length];
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:28px;height:28px;border-radius:50%;
          background:${colour};
          border:3px solid #0f0d0a;
          box-shadow:0 2px 8px rgba(0,0,0,0.6);
          display:flex;align-items:center;justify-content:center;
          font-family:monospace;font-size:11px;font-weight:bold;color:#0f0d0a;
        ">${i + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      L.marker([wp.lat, wp.lon], { icon })
        .addTo(_routeLayer)
        .bindPopup(`<strong>${esc(wp.label || 'Stop ' + (i+1))}</strong>`);
    });

    // Fit bounds
    _map.fitBounds(latlngs, { padding: [30, 30] });

    // Build legend
    const legend = document.getElementById('geo-route-legend');
    legend.style.display = 'flex';
    legend.innerHTML = waypoints.map((wp, i) => `
      <div class="geo-legend-item">
        <div class="geo-legend-dot" style="background:${colours[i % colours.length]}"></div>
        <span>${esc(wp.label || 'Stop ' + (i+1))}</span>
      </div>
    `).join('');
  }

  // ---------------------------------------------------------------------------
  // Nominatim — forward geocode (search)
  // ---------------------------------------------------------------------------
  function nominatimSearch(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
    return fetch(url, { headers: { 'Accept-Language': 'en' } }).then(r => r.json());
  }

  // ---------------------------------------------------------------------------
  // Nominatim — reverse geocode (lat/lon → address)
  // ---------------------------------------------------------------------------
  function nominatimReverse(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
    return fetch(url, { headers: { 'Accept-Language': 'en' } }).then(r => r.json());
  }

  function scheduleReverseGeocode(lat, lon) {
    clearTimeout(_reverseTimer);
    setAddressText('Locating address…');
    _reverseTimer = setTimeout(async () => {
      try {
        const data = await nominatimReverse(lat, lon);
        setAddressText(data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      } catch {
        setAddressText(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      }
    }, 600);
  }

  function setAddressText(text) {
    const el = document.getElementById('geo-address-text');
    if (el) el.textContent = text;
  }

  // ---------------------------------------------------------------------------
  // Search UI
  // ---------------------------------------------------------------------------
  function bindSearchUI() {
    const input   = document.getElementById('geo-search-input');
    const results = document.getElementById('geo-search-results');
    const spinner = document.getElementById('geo-search-spinner');

    input.addEventListener('input', () => {
      clearTimeout(_searchTimer);
      const q = input.value.trim();
      if (q.length < 3) { results.classList.remove('geo-open'); return; }
      spinner.classList.add('geo-spinning');
      _searchTimer = setTimeout(async () => {
        try {
          const items = await nominatimSearch(q);
          spinner.classList.remove('geo-spinning');
          if (!items.length) { results.classList.remove('geo-open'); return; }
          results.innerHTML = items.map((item, i) =>
            `<div class="geo-result-item" data-idx="${i}">${esc(item.display_name)}</div>`
          ).join('');
          results._items = items;
          results.classList.add('geo-open');
        } catch {
          spinner.classList.remove('geo-spinning');
        }
      }, 450);
    });

    results.addEventListener('click', (e) => {
      const el = e.target.closest('.geo-result-item');
      if (!el) return;
      const item = results._items[Number(el.dataset.idx)];
      if (!item) return;
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      _currentLat = lat;
      _currentLon = lon;
      _map.setView([lat, lon], 16);
      if (_marker) _marker.setLatLng([lat, lon]);
      setAddressText(item.display_name);
      results.classList.remove('geo-open');
      input.value = '';
    });

    // Close results on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#geo-search-wrap')) {
        results.classList.remove('geo-open');
      }
    });
  }

  // ---------------------------------------------------------------------------
  // GPS button
  // ---------------------------------------------------------------------------
  function bindGPSBtn(readonly) {
    const btn = document.getElementById('geo-gps-btn');
    if (readonly) { btn.style.display = 'none'; return; }
    btn.style.display = 'flex';
    btn.onclick = () => {
      if (!navigator.geolocation) {
        setAddressText('GPS not available on this device');
        return;
      }
      setAddressText('Getting your location…');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          _currentLat = lat;
          _currentLon = lon;
          _map.setView([lat, lon], 16);
          if (_marker) _marker.setLatLng([lat, lon]);
          scheduleReverseGeocode(lat, lon);
        },
        () => { setAddressText('Could not get GPS location'); }
      );
    };
  }

  // ---------------------------------------------------------------------------
  // Open / Close modal
  // ---------------------------------------------------------------------------
  function openModal() {
    const backdrop = document.getElementById('geo-modal-backdrop');
    backdrop.style.display = 'flex';
    requestAnimationFrame(() => backdrop.classList.add('geo-visible'));
  }

  function closeModal() {
    const backdrop = document.getElementById('geo-modal-backdrop');
    backdrop.classList.remove('geo-visible');
    setTimeout(() => { backdrop.style.display = 'none'; }, 250);
    // Clear search state
    const results = document.getElementById('geo-search-results');
    if (results) results.classList.remove('geo-open');
    const legend = document.getElementById('geo-route-legend');
    if (legend) legend.style.display = 'none';
  }

  // ---------------------------------------------------------------------------
  // Public API — openMapModal(options) → Promise<{lat, lon, display_address}|null>
  // ---------------------------------------------------------------------------
  function openMapModal(options) {
    options = options || {};
    const readonly = options.readonly || (options.route && options.route.length > 0) || false;
    const isRoute  = !!(options.route && options.route.length);

    injectStyles();
    injectHTML();

    return new Promise((resolve) => {
      _resolveModal = resolve;

      // Set title
      document.getElementById('geo-modal-title').textContent = options.title || 'Select Location';

      // Search bar visibility
      const searchWrap = document.getElementById('geo-search-wrap');
      searchWrap.style.display = readonly ? 'none' : 'block';

      // Confirm / readonly hint
      const confirmBtn    = document.getElementById('geo-confirm-btn');
      const readonlyHint  = document.getElementById('geo-readonly-hint');
      const gpsBtn        = document.getElementById('geo-gps-btn');

      if (readonly) {
        confirmBtn.style.display   = 'none';
        readonlyHint.style.display = 'inline';
        gpsBtn.style.display       = 'none';
      } else {
        confirmBtn.style.display   = 'inline-flex';
        readonlyHint.style.display = 'none';
      }

      // Determine starting lat/lon
      let startLat = options.lat || DEFAULT_LAT;
      let startLon = options.lon || DEFAULT_LON;

      // Route mode
      if (isRoute) {
        startLat = options.route[0].lat;
        startLon = options.route[0].lon;
      }

      _currentLat = startLat;
      _currentLon = startLon;

      openModal();
      initMap(startLat, startLon, readonly);

      if (isRoute) {
        renderRoute(options.route);
        setAddressText('Route overview');
      } else if (readonly) {
        // Show a non-draggable marker
        L.marker([startLat, startLon]).addTo(_map)
          .bindPopup(options.title || 'Location').openPopup();
        scheduleReverseGeocode(startLat, startLon);
      } else {
        scheduleReverseGeocode(startLat, startLon);
      }

      // Bind search (safe to call multiple times — uses event delegation)
      if (!readonly) {
        bindSearchUI();
        bindGPSBtn(false);
      }

      // Confirm button
      confirmBtn.onclick = async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Saving…';
        let display_address = document.getElementById('geo-address-text').textContent;
        // Final reverse geocode if address is still a coordinate string
        if (!display_address || display_address.startsWith('Drag') || display_address.startsWith('Getting')) {
          try {
            const data = await nominatimReverse(_currentLat, _currentLon);
            display_address = data.display_name || `${_currentLat.toFixed(5)}, ${_currentLon.toFixed(5)}`;
          } catch {
            display_address = `${_currentLat.toFixed(5)}, ${_currentLon.toFixed(5)}`;
          }
        }
        closeModal();
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm';
        resolve({ lat: _currentLat, lon: _currentLon, display_address });
      };

      // Close button & backdrop click
      document.getElementById('geo-modal-close').onclick = () => {
        closeModal();
        resolve(null);
      };
      document.getElementById('geo-modal-backdrop').onclick = (e) => {
        if (e.target === document.getElementById('geo-modal-backdrop')) {
          closeModal();
          resolve(null);
        }
      };

      // ESC key
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          closeModal();
          resolve(null);
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    });
  }

  // ---------------------------------------------------------------------------
  // Utility — Haversine distance (km) — also available to other modules
  // ---------------------------------------------------------------------------
  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ---------------------------------------------------------------------------
  // Utility — Calculate delivery fee (mirrors Code.gs logic for UI preview)
  // ---------------------------------------------------------------------------
  function calcDeliveryFee(stores, clientLat, clientLon, settings) {
    const baseLat    = Number(settings.base_latitude)        || DEFAULT_LAT;
    const baseLon    = Number(settings.base_longitude)       || DEFAULT_LON;
    const fuelPrice  = Number(settings.fuel_price)           || 22;
    const kpl        = Number(settings.vehicle_km_per_litre) || 12;
    const factor     = Number(settings.delivery_factor)      || 1.8;
    const minFee     = Number(settings.minimum_delivery_fee) || 35;

    // Sort stores furthest first
    const sorted = stores.slice().sort((a, b) =>
      haversineKm(baseLat, baseLon, b.lat, b.lon) -
      haversineKm(baseLat, baseLon, a.lat, a.lon)
    );

    const waypoints = [
      { lat: baseLat, lon: baseLon },
      ...sorted.map(s => ({ lat: s.lat, lon: s.lon })),
      { lat: clientLat, lon: clientLon },
      { lat: baseLat, lon: baseLon }
    ];

    let totalKm = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      totalKm += haversineKm(waypoints[i].lat, waypoints[i].lon,
                             waypoints[i+1].lat, waypoints[i+1].lon);
    }

    const rawFee = (totalKm / kpl) * fuelPrice * factor;
    return Math.ceil(Math.max(rawFee, minFee) / 5) * 5;
  }

  // ---------------------------------------------------------------------------
  // Utility — XSS escape for innerHTML
  // ---------------------------------------------------------------------------
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------------------------------------------------------------------------
  // Exports
  // ---------------------------------------------------------------------------
  global.openMapModal   = openMapModal;
  global.haversineKm    = haversineKm;
  global.calcDeliveryFee = calcDeliveryFee;

})(window);
