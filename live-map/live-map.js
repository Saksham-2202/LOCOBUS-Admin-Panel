// live-map.js - Routes & Live Bus Tracking
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
  getFirestore,
  collection,
  onSnapshot,
  getDocs
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
    
    // Listen to route changes in real-time
    onSnapshot(routesRef, async (snapshot) => {
      console.log(`Route update detected: ${snapshot.docs.length} routes`);
      
      for (const docSnap of snapshot.docs) {
        const routeId = docSnap.id;
        const routeData = docSnap.data();

        // Skip if already rendered
        if (routes.has(routeId)) {
          continue;
        }

        // Get stops subcollection
        const stopsRef = collection(db, 'bus_routes', routeId, 'stops');
        const stopsSnapshot = await getDocs(stopsRef);
        
        const stops = [];
        stopsSnapshot.forEach(stopDoc => {
          const stopData = stopDoc.data();
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
          console.log(`✅ New route added: ${routeData.from} → ${routeData.to}`);
        }
      }
    }, (error) => {
      console.error('Error listening to routes:', error);
      alert('Failed to load routes: ' + error.message);
    });
  } catch (error) {
    console.error('Error starting route listener:', error);
  }
}

function renderRoute(routeId, routeData, stops) {
  // Create polyline coordinates
  const coords = stops.map(s => [s.lat, s.lng]);

  // Draw route polyline (light blue)
  const polyline = L.polyline(coords, {
    color: '#93c5fd',
    weight: 4,
    opacity: 0.7
  }).addTo(map);

  // Add stops as markers
  const stopMarkers = stops.map(stop => {
    const marker = L.marker([stop.lat, stop.lng], {
      icon: createStopIcon()
    }).addTo(map);

    marker.bindPopup(`
      <div style="font-weight:600;">${escapeHtml(stop.name)}</div>
      <div style="font-size:12px;color:#666;">Order: ${stop.order || 'N/A'}</div>
    `);

    return marker;
  });

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

  console.log(`Selected route: ${routeId}`);
}

function addRouteToList(routeId, routeData) {
  const listEl = document.getElementById('list');
  if (!listEl) return;

  const el = document.createElement('div');
  el.id = 'route-' + routeId;
  el.className = 'bus-card';
  el.style.cursor = 'pointer';
  
  el.innerHTML = `
    <div style="width:10px;height:10px;background:#93c5fd;border-radius:50%"></div>
    <div class="bus-info">
      <div>${escapeHtml(routeData.from || 'Unknown')} → ${escapeHtml(routeData.to || 'Unknown')}</div>
      <div class="bus-sub">${routeData.distance_km ? routeData.distance_km.toFixed(1) + ' km' : 'N/A'}</div>
    </div>
    <div style="font-weight:700;font-size:12px;color:#666;" id="bus-count-${routeId}">0 buses</div>
  `;

  el.onclick = () => highlightRoute(routeId);
  listEl.appendChild(el);
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

    console.log(`Active buses on map: ${activeBusCount}`);
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
  const allCoords = [];
  
  routes.forEach(route => {
    route.rawStops.forEach(s => allCoords.push([s.lat, s.lng]));
  });

  liveBuses.forEach(bus => {
    allCoords.push([bus.data.lat, bus.data.lng]);
  });

  if (allCoords.length === 0) {
    alert('No data to fit');
    return;
  }

  map.fitBounds(L.latLngBounds(allCoords).pad(0.15));
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
  console.log('Initializing Live Map...');
  
  // Start listening to routes (real-time)
  startRouteListener();
  
  // Start listening to live buses
  startLiveBusListener();
  
  console.log('Live Map initialized successfully - listening for updates');
}

// Start on page load
document.addEventListener('DOMContentLoaded', init);