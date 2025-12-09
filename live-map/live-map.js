// live-map.js - Routes & Live Bus Tracking (Redesigned with Top Bar)
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
const map = L.map('map').setView([30.9009, 75.8573], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

// State Management
const routes = new Map();
const liveBuses = new Map();
let selectedRoute = null;
let processedRouteIds = new Set();
let allRoutes = []; // Store all routes for search/filter
let filteredRoutes = []; // Currently filtered routes
let currentPage = 0;
const CARDS_PER_PAGE = 3;

// DOM Elements
const routeCardsContainer = document.getElementById('routeCardsContainer');
const routeSearch = document.getElementById('routeSearch');
const navPrev = document.getElementById('navPrev');
const navNext = document.getElementById('navNext');
const paginationText = document.getElementById('paginationText');

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

// ============ ROUTE RENDERING ============

function startRouteListener() {
  try {
    const routesRef = collection(db, 'bus_routes');
    
    console.log('🔍 Starting route listener...');
    
    onSnapshot(routesRef, async (snapshot) => {
      console.log(`📍 Routes snapshot received: ${snapshot.docs.length} routes`);
      
      if (snapshot.docs.length === 0) {
        routeCardsContainer.innerHTML = '<div class="route-card-loading">No routes found</div>';
        return;
      }
      
      for (const docSnap of snapshot.docs) {
        const routeId = docSnap.id;
        const routeData = docSnap.data();

        if (processedRouteIds.has(routeId)) continue;

        // Check polyline data
        if (routeData.polyline_lats && routeData.polyline_lngs) {
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
          continue;
        }

        // Otherwise check stops subcollection
        try {
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

          stops.sort((a, b) => (a.order || 0) - (b.order || 0));

          if (stops.length > 0) {
            renderRoute(routeId, routeData, stops);
            processedRouteIds.add(routeId);
          }
        } catch (error) {
          console.error(`Error getting stops for route ${routeId}:`, error);
        }
      }
      
      updateRouteDisplay();
      fitAllRoutesToMap();
    }, (error) => {
      console.error('Error listening to routes:', error);
    });
  } catch (error) {
    console.error('Error starting route listener:', error);
  }
}

function renderRoute(routeId, routeData, stops) {
  if (!stops || stops.length === 0) return;

  const coords = stops.map(s => [s.lat, s.lng]);

  const polyline = L.polyline(coords, {
    color: '#93c5fd',
    weight: 4,
    opacity: 0.7
  }).addTo(map);

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

  polyline.on('click', () => highlightRoute(routeId));

  routes.set(routeId, {
    polyline,
    stops: stopMarkers,
    data: routeData,
    buses: [],
    rawStops: stops
  });

  allRoutes.push({ id: routeId, data: routeData, stops });
  filteredRoutes = [...allRoutes];
}

function highlightRoute(routeId) {
  routes.forEach((route, id) => {
    const isSelected = id === routeId;
    route.polyline.setStyle({
      color: isSelected ? '#2563eb' : '#93c5fd',
      weight: isSelected ? 6 : 4,
      opacity: isSelected ? 1 : 0.7
    });
  });

  selectedRoute = routeId;

  const route = routes.get(routeId);
  if (!route) return;

  const coords = route.rawStops.map(s => [s.lat, s.lng]);
  map.fitBounds(L.latLngBounds(coords).pad(0.1));

  updateRouteDisplay();
}

function fitAllRoutesToMap() {
  const allCoords = [];
  
  routes.forEach(route => {
    route.rawStops.forEach(s => allCoords.push([s.lat, s.lng]));
  });

  if (allCoords.length > 0) {
    map.fitBounds(L.latLngBounds(allCoords).pad(0.1));
  }
}

// ============ TOP BAR DISPLAY FUNCTIONS ============

function updateRouteDisplay() {
  const startIdx = currentPage * CARDS_PER_PAGE;
  const endIdx = startIdx + CARDS_PER_PAGE;
  const pageRoutes = filteredRoutes.slice(startIdx, endIdx);

  if (filteredRoutes.length === 0) {
    routeCardsContainer.innerHTML = '<div class="route-card-loading">No routes match your search</div>';
    updatePaginationControls();
    return;
  }

  routeCardsContainer.innerHTML = pageRoutes.map(({ id, data }) => {
    const route = routes.get(id);
    const busCount = route ? route.buses.length : 0;
    const isActive = id === selectedRoute;
    
    return `
      <div class="route-card ${isActive ? 'active' : ''}" data-route-id="${id}">
        <div class="route-card-header">
          <div class="route-indicator"></div>
          <div class="route-number">Route ${escapeHtml(data.route_number || 'N/A')}</div>
        </div>
        <div class="route-card-body">
          <div class="route-path">
            <span>${escapeHtml(data.from || 'Unknown')}</span>
            <span class="route-arrow">→</span>
            <span>${escapeHtml(data.to || 'Unknown')}</span>
          </div>
          <div class="route-meta">
            <span>${data.distance_km ? data.distance_km.toFixed(1) + ' km' : 'N/A'}</span>
            <span class="bus-count">${busCount} ${busCount === 1 ? 'bus' : 'buses'}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers
  document.querySelectorAll('.route-card').forEach(card => {
    card.addEventListener('click', () => {
      const routeId = card.getAttribute('data-route-id');
      highlightRoute(routeId);
    });
  });

  updatePaginationControls();
}

function updatePaginationControls() {
  const totalPages = Math.ceil(filteredRoutes.length / CARDS_PER_PAGE);
  
  navPrev.disabled = currentPage === 0;
  navNext.disabled = currentPage >= totalPages - 1 || filteredRoutes.length === 0;
  
  const startIdx = currentPage * CARDS_PER_PAGE + 1;
  const endIdx = Math.min((currentPage + 1) * CARDS_PER_PAGE, filteredRoutes.length);
  
  if (filteredRoutes.length === 0) {
    paginationText.textContent = 'No routes found';
  } else {
    paginationText.textContent = `Showing ${startIdx}-${endIdx} of ${filteredRoutes.length} routes`;
  }
}

// ============ SEARCH & PAGINATION ============

routeSearch.addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase().trim();
  
  if (!searchTerm) {
    filteredRoutes = [...allRoutes];
  } else {
    filteredRoutes = allRoutes.filter(({ data }) => {
      const from = (data.from || '').toLowerCase();
      const to = (data.to || '').toLowerCase();
      const routeNum = (data.route_number || '').toLowerCase();
      
      return from.includes(searchTerm) || 
             to.includes(searchTerm) || 
             routeNum.includes(searchTerm);
    });
  }
  
  currentPage = 0;
  updateRouteDisplay();
});

navPrev.addEventListener('click', () => {
  if (currentPage > 0) {
    currentPage--;
    updateRouteDisplay();
    routeCardsContainer.scrollLeft = 0;
  }
});

navNext.addEventListener('click', () => {
  const totalPages = Math.ceil(filteredRoutes.length / CARDS_PER_PAGE);
  if (currentPage < totalPages - 1) {
    currentPage++;
    updateRouteDisplay();
    routeCardsContainer.scrollLeft = 0;
  }
});

// ============ LIVE BUS TRACKING ============

function startLiveBusListener() {
  const busesRef = collection(db, 'buses');

  onSnapshot(busesRef, (snapshot) => {
    snapshot.forEach(docSnap => {
      const busId = docSnap.id;
      const busData = docSnap.data();

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
      } else if (busData.routeInfo?.stops && busData.routeInfo.stops.length > 0) {
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
        }
      }
    });

    updateBusCountsOnRoutes();
  });
}

function updateBusPosition(busId, data) {
  if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return;

  const existing = liveBuses.get(busId);

  if (!existing) {
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
    const oldData = existing.data;
    existing.data = { ...oldData, ...data };

    if (oldData.status !== data.status) {
      existing.marker.setIcon(createBusIcon(data));
    }

    animateMarker(existing.marker, [oldData.lat, oldData.lng], [data.lat, data.lng]);

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
    const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    marker.setLatLng([
      from[0] + (to[0] - from[0]) * e,
      from[1] + (to[1] - from[1]) * e
    ]);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function updateBusCountsOnRoutes() {
  routes.forEach((route) => {
    route.buses = [];
  });

  liveBuses.forEach((bus) => {
    const routeId = bus.data.routeId;
    if (routeId && routes.has(routeId)) {
      routes.get(routeId).buses.push(bus.data.busId);
    }
  });

  updateRouteDisplay();
}

// ============ INITIALIZE ============

async function init() {
  console.log('🚀 Initializing Live Map...');
  startRouteListener();
  startLiveBusListener();
}

document.addEventListener('DOMContentLoaded', init);

// Lottie bus logo
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