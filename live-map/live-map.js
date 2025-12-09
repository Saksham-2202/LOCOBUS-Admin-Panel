// live-map.js - Routes & Live Bus Tracking
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
  getFirestore,
  collection,
  onSnapshot,
  getDocs,
  query
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCRtx7Oyda48Hz0eu-BiNrGYiK3_36Vl-c",
  authDomain: "locobus-e4274.firebaseapp.com",
  databaseURL: "https://locobus-e4274-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "locobus-e4274",
  storageBucket: "locobus-e4274.firebasestorage.app",
  messagingSenderId: "296482389648",
  appId: "1:296482389648:web:1827bd92dc55c8a857e215"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Check Leaflet
if (typeof L === 'undefined') {
  document.body.innerHTML = '<div style="padding:20px;">Leaflet failed to load. Check your internet.</div>';
  throw new Error('Leaflet missing');
}

// Initialize Map
const map = L.map('map').setView([30.9009, 75.8573], 12); // Ludhiana center

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

// State Management
const routes = new Map(); // routeId -> { polyline, stops, data, buses }
const liveBuses = new Map(); // busId -> { marker, data }
let selectedRoute = null;
let processedRouteIds = new Set(); // Track processed routes

// ============ UTILITY FUNCTIONS ============

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function createBusIcon(data) {
  const s = (data.status || '').toLowerCase();
  const cls = s === 'idle' ? 'marker-idle' :
              s === 'delayed' ? 'marker-delayed' :
              'marker-running';
  return L.divIcon({
    html: `<div class="bus-marker ${cls}">${escapeHtml(data.busId || "BUS")}</div>`,
    className: '',
    iconSize: [48, 28],
    iconAnchor: [24, 14]
  });
}

function createStopIcon() {
  return L.divIcon({
    html: '<div style="width:12px;height:12px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

// ============ ROUTE RENDERING ============

function startRouteListener() {
  try {
    const routesRef = collection(db, 'bus_routes');
    
    console.log('🔍 Starting route listener...');
    
    // Listen to route changes in real-time
    onSnapshot(routesRef, async (snapshot) => {
      console.log(`📍 Routes snapshot received: ${snapshot.docs.length} total routes in database`);
      
      if (snapshot.docs.length === 0) {
        console.warn('⚠️ No routes found in bus_routes collection');
        return;
      }
      
      let newRoutesCount = 0;
      let processedCount = 0;
      
      for (const docSnap of snapshot.docs) {
        const routeId = docSnap.id;
        const routeData = docSnap.data();

        console.log(`\n--- Processing Route ${routeId} ---`);
        console.log('Route Data:', routeData);

        // Skip if already processed
        if (processedRouteIds.has(routeId)) {
          console.log(`✓ Route ${routeId} already processed, skipping`);
          processedCount++;
          continue;
        }

        // Check if route has polyline data (from bulk upload)
        if (routeData.polyline_lats && routeData.polyline_lngs) {
          console.log(`✅ Route ${routeId} has polyline data (${routeData.polyline_lats.length} points)`);
          const lats = routeData.polyline_lats;
          const lngs = routeData.polyline_lngs;
          
          const stops = [];
          for (let i = 0; i < Math.min(lats.length, lngs.length); i++) {
            stops.push({
              lat: lats[i],
              lng: lngs[i],
              name: i === 0 ? routeData.from : (i === lats.length - 1 ? routeData.to : `Stop ${i}`),
              order: i
            });
          }
          
          renderRoute(routeId, routeData, stops);
          processedRouteIds.add(routeId);
          newRoutesCount++;
          console.log(`✅ Route rendered from polyline: ${routeData.from} → ${routeData.to}`);
          continue;
        }

        // Otherwise, try to get stops subcollection
        try {
          console.log(`🔍 Checking stops subcollection for route ${routeId}...`);
          const stopsRef = collection(db, 'bus_routes', routeId, 'stops');
          const stopsSnapshot = await getDocs(stopsRef);
          
          console.log(`Found ${stopsSnapshot.docs.length} stops in subcollection`);
          
          const stops = [];
          stopsSnapshot.forEach(stopDoc => {
            const stopData = stopDoc.data();
            console.log('Stop data:', stopData);
            if (stopData.lat && stopData.lng) {
              stops.push({
                id: stopDoc.id,
                ...stopData
              });
            }
          });

          // Sort stops by order
          stops.sort((a, b) => (a.order || 0) - (b.order || 0));

          if (stops.length > 0) {
            renderRoute(routeId, routeData, stops);
            processedRouteIds.add(routeId);
            newRoutesCount++;
            console.log(`✅ Route rendered from stops subcollection: ${routeData.from} → ${routeData.to}`);
          } else {
            console.warn(`⚠️ Route ${routeId} has no valid stops (found ${stopsSnapshot.docs.length} stop docs but 0 with lat/lng)`);
          }
        } catch (error) {
          console.error(`❌ Error getting stops for route ${routeId}:`, error);
        }
      }
      
      console.log(`\n📊 SUMMARY:`);
      console.log(`- Total routes in DB: ${snapshot.docs.length}`);
      console.log(`- Already processed: ${processedCount}`);
      console.log(`- Newly rendered: ${newRoutesCount}`);
      console.log(`- Total on map: ${routes.size}`);
      console.log(`- Sidebar items: ${document.querySelectorAll('.bus-card').length}`);
      
      // Fit map to show all routes
      if (newRoutesCount > 0) {
        fitAllRoutesToMap();
      }
    }, (error) => {
      console.error('❌ Error listening to routes:', error);
      alert('Failed to load routes: ' + error.message);
    });
  } catch (error) {
    console.error('❌ Error starting route listener:', error);
  }
}

function renderRoute(routeId, routeData, stops) {
  if (!stops || stops.length === 0) {
    console.warn(`❌ Cannot render route ${routeId}: no stops`);
    return;
  }

  console.log(`🎨 Rendering route ${routeId} with ${stops.length} stops`);

  // Create polyline coordinates
  const coords = stops.map(s => [s.lat, s.lng]);

  // Draw route polyline (light blue)
  const polyline = L.polyline(coords, {
    color: '#93c5fd',
    weight: 4,
    opacity: 0.7
  }).addTo(map);

  // Add stops as markers (only show first and last for cleaner map)
  const stopMarkers = [];
  
  // First stop (green)
  if (stops[0]) {
    const firstMarker = L.marker([stops[0].lat, stops[0].lng], {
      icon: L.divIcon({
        html: '<div style="width:16px;height:16px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    }).addTo(map);
    
    firstMarker.bindPopup(`
      <div style="font-weight:600;">Start: ${escapeHtml(stops[0].name || routeData.from)}</div>
      <div style="font-size:12px;color:#666;">Route: ${escapeHtml(routeData.route_number || 'N/A')}</div>
    `);
    
    stopMarkers.push(firstMarker);
  }
  
  // Last stop (red)
  if (stops.length > 1) {
    const lastStop = stops[stops.length - 1];
    const lastMarker = L.marker([lastStop.lat, lastStop.lng], {
      icon: L.divIcon({
        html: '<div style="width:16px;height:16px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    }).addTo(map);
    
    lastMarker.bindPopup(`
      <div style="font-weight:600;">End: ${escapeHtml(lastStop.name || routeData.to)}</div>
      <div style="font-size:12px;color:#666;">Route: ${escapeHtml(routeData.route_number || 'N/A')}</div>
    `);
    
    stopMarkers.push(lastMarker);
  }

  // Click on route to highlight
  polyline.on('click', () => highlightRoute(routeId));

  // Store route data
  routes.set(routeId, {
    polyline,
    stops: stopMarkers,
    data: routeData,
    buses: [], // Will store bus IDs on this route
    rawStops: stops
  });

  // Add to sidebar list
  addRouteToList(routeId, routeData);
  
  console.log(`✅ Route ${routeId} successfully added to map and sidebar`);
}

function highlightRoute(routeId) {
  // Reset all routes to light blue
  routes.forEach((route) => {
    route.polyline.setStyle({
      color: '#93c5fd',
      weight: 4,
      opacity: 0.7
    });
  });

  // Highlight selected route
  const route = routes.get(routeId);
  if (!route) return;

  route.polyline.setStyle({
    color: '#2563eb',
    weight: 6,
    opacity: 1
  });

  selectedRoute = routeId;

  // Zoom to route
  const coords = route.rawStops.map(s => [s.lat, s.lng]);
  map.fitBounds(L.latLngBounds(coords).pad(0.1));

  console.log(`🎯 Selected route: ${routeId}`);
}

function addRouteToList(routeId, routeData) {
  const listEl = document.getElementById('list');
  if (!listEl) {
    console.error('❌ Could not find #list element in DOM');
    return;
  }

  // Check if already exists
  const existingEl = document.getElementById('route-' + routeId);
  if (existingEl) {
    console.log(`Route ${routeId} already in sidebar, skipping`);
    return;
  }

  const el = document.createElement('div');
  el.id = 'route-' + routeId;
  el.className = 'bus-card';
  el.style.cursor = 'pointer';
  
  el.innerHTML = `
    <div style="width:10px;height:10px;background:#93c5fd;border-radius:50%"></div>
    <div class="bus-info">
      <div>${escapeHtml(routeData.from || 'Unknown')} → ${escapeHtml(routeData.to || 'Unknown')}</div>
      <div class="bus-sub">${routeData.distance_km ? routeData.distance_km.toFixed(1) + ' km' : 'N/A'} • Route ${escapeHtml(routeData.route_number || 'N/A')}</div>
    </div>
    <div style="font-weight:700;font-size:12px;color:#666;" id="bus-count-${routeId}">0 buses</div>
  `;

  el.onclick = () => highlightRoute(routeId);
  listEl.appendChild(el);
  
  console.log(`✅ Route ${routeId} added to sidebar (#${listEl.children.length})`);
}

function fitAllRoutesToMap() {
  const allCoords = [];
  
  routes.forEach(route => {
    route.rawStops.forEach(s => allCoords.push([s.lat, s.lng]));
  });

  if (allCoords.length > 0) {
    map.fitBounds(L.latLngBounds(allCoords).pad(0.1));
    console.log(`✅ Fitted ${routes.size} routes to map`);
  }
}

// ============ LIVE BUS TRACKING ============

function startLiveBusListener() {
  const busesRef = collection(db, 'buses');

  onSnapshot(busesRef, (snapshot) => {
    let activeBusCount = 0;
    
    snapshot.forEach(docSnap => {
      const busId = docSnap.id;
      const busData = docSnap.data();

      // Check if bus has live location OR use routeInfo stops as fallback
      if (busData.liveStatus?.location) {
        const loc = busData.liveStatus.location;
        updateBusPosition(busId, {
          busId,
          lat: loc.lat,
          lng: loc.lng,
          status: busData.liveStatus.status || 'running',
          speed: loc.speed || 0,
          routeId: busData.routeInfo?.templateId || null,
          route: `${busData.routeInfo?.from || 'N/A'} → ${busData.routeInfo?.to || 'N/A'}`,
          timestamp: loc.timestamp
        });
        activeBusCount++;
      } else if (busData.routeInfo?.stops && busData.routeInfo.stops.length > 0) {
        // Fallback: Use first stop location if no live data
        const firstStop = busData.routeInfo.stops[0];
        if (firstStop.location) {
          const geoPoint = firstStop.location;
          updateBusPosition(busId, {
            busId,
            lat: geoPoint._lat || geoPoint.latitude,
            lng: geoPoint._long || geoPoint.longitude,
            status: 'idle',
            speed: 0,
            routeId: busData.routeInfo?.templateId || null,
            route: `${busData.routeInfo?.from || 'N/A'} → ${busData.routeInfo?.to || 'N/A'}`,
            timestamp: busData.createdAt
          });
          activeBusCount++;
        }
      }
    });

    console.log(`🚌 Active buses on map: ${activeBusCount}`);
    updateBusCountsOnRoutes();
  }, (error) => {
    console.error('Error listening to buses:', error);
  });
}

function updateBusPosition(busId, data) {
  if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return;

  const existing = liveBuses.get(busId);

  if (!existing) {
    // Create new bus marker
    const marker = L.marker([data.lat, data.lng], {
      icon: createBusIcon(data)
    }).addTo(map);

    marker.bindPopup(`
      <div style="font-weight:600;">Bus ${escapeHtml(data.busId)}</div>
      <div style="font-size:12px;">Route: ${escapeHtml(data.route)}</div>
      <div style="font-size:12px;">Speed: ${Math.round(data.speed)} km/h</div>
      <div style="font-size:12px;">Status: ${escapeHtml(data.status)}</div>
    `);

    liveBuses.set(busId, { marker, data });
  } else {
    // Update existing marker
    const oldData = existing.data;
    existing.data = { ...oldData, ...data };

    // Update icon if status changed
    if (oldData.status !== data.status) {
      existing.marker.setIcon(createBusIcon(data));
    }

    // Animate position change
    animateMarker(existing.marker, [oldData.lat, oldData.lng], [data.lat, data.lng]);

    // Update popup
    existing.marker.setPopupContent(`
      <div style="font-weight:600;">Bus ${escapeHtml(data.busId)}</div>
      <div style="font-size:12px;">Route: ${escapeHtml(data.route)}</div>
      <div style="font-size:12px;">Speed: ${Math.round(data.speed)} km/h</div>
      <div style="font-size:12px;">Status: ${escapeHtml(data.status)}</div>
    `);
  }
}

function animateMarker(marker, from, to, duration = 1000) {
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in-out
    marker.setLatLng([
      from[0] + (to[0] - from[0]) * e,
      from[1] + (to[1] - from[1]) * e
    ]);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function updateBusCountsOnRoutes() {
  // Reset all counts
  routes.forEach((route, routeId) => {
    route.buses = [];
    const countEl = document.getElementById('bus-count-' + routeId);
    if (countEl) countEl.textContent = '0 buses';
  });

  // Count buses per route
  liveBuses.forEach((bus) => {
    const routeId = bus.data.routeId;
    if (routeId && routes.has(routeId)) {
      routes.get(routeId).buses.push(bus.data.busId);
    }
  });

  // Update UI
  routes.forEach((route, routeId) => {
    const countEl = document.getElementById('bus-count-' + routeId);
    if (countEl) {
      const count = route.buses.length;
      countEl.textContent = `${count} ${count === 1 ? 'bus' : 'buses'}`;
    }
  });
}

// ============ CONTROLS ============

document.getElementById('fitAll')?.addEventListener('click', () => {
  fitAllRoutesToMap();
});

// Simulate button - adds test buses for debugging
let simInterval = null;

document.getElementById('simulate')?.addEventListener('click', function() {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
    this.textContent = 'Simulate';
    this.style.background = '#2563eb';
    console.log('Simulation stopped');
    return;
  }

  this.textContent = 'Stop Sim';
  this.style.background = '#ef4444';

  // Add 3 test buses on random routes
  const routeIds = Array.from(routes.keys());
  if (routeIds.length === 0) {
    alert('No routes available for simulation');
    return;
  }

  const testBuses = [
    { id: 'SIM-001', routeIdx: 0, speed: 35 },
    { id: 'SIM-002', routeIdx: Math.min(1, routeIds.length - 1), speed: 28 },
    { id: 'SIM-003', routeIdx: Math.min(2, routeIds.length - 1), speed: 0 }
  ];

  testBuses.forEach(bus => {
    const routeId = routeIds[bus.routeIdx];
    const route = routes.get(routeId);
    if (route && route.rawStops.length > 0) {
      const firstStop = route.rawStops[0];
      updateBusPosition(bus.id, {
        busId: bus.id,
        lat: firstStop.lat,
        lng: firstStop.lng,
        status: bus.speed > 0 ? 'running' : 'idle',
        speed: bus.speed,
        routeId: routeId,
        route: `${route.data.from} → ${route.data.to}`,
        timestamp: Date.now()
      });
    }
  });

  // Move buses randomly
  simInterval = setInterval(() => {
    testBuses.forEach(bus => {
      const existing = liveBuses.get(bus.id);
      if (!existing) return;

      const jitter = (Math.random() - 0.5) * 0.002;
      const newLat = existing.data.lat + (Math.random() * 0.002 - 0.001) + jitter;
      const newLng = existing.data.lng + (Math.random() * 0.002 - 0.001) + jitter;
      const newSpeed = Math.max(0, bus.speed + (Math.random() * 6 - 3));

      updateBusPosition(bus.id, {
        ...existing.data,
        lat: newLat,
        lng: newLng,
        speed: newSpeed,
        status: newSpeed < 1 ? 'idle' : 'running',
        timestamp: Date.now()
      });
    });
  }, 1500);

  console.log('Simulation started with 3 test buses');
});

// ============ INITIALIZE ============

async function init() {
  console.log('🚀 Initializing Live Map...');
  console.log('📍 Checking DOM elements...');
  console.log('- #map element:', document.getElementById('map') ? '✓ Found' : '❌ Missing');
  console.log('- #list element:', document.getElementById('list') ? '✓ Found' : '❌ Missing');
  
  // Start listening to routes (real-time)
  startRouteListener();
  
  // Start listening to live buses
  startLiveBusListener();
  
  console.log('✅ Live Map initialized - listening for route updates');
}

// Start on page load
document.addEventListener('DOMContentLoaded', init);

// Lottie bus logo animation
document.addEventListener('DOMContentLoaded', () => {
  const logoContainer = document.getElementById('busLogoAnim');
  if (logoContainer && window.lottie) {
    window.lottie.loadAnimation({
      container: logoContainer,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: '../index/Bus_carga_trackMile.json'
    });
  }
});


