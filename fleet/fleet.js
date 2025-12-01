/* fleet.js - Firebase Integration */

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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

// Global storage for bus data
let busesData = [];

/* helper setText */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// Load all buses from Firestore
async function loadBusesFromFirebase() {
  try {
    const busesSnapshot = await getDocs(collection(db, 'buses'));
    busesData = [];
    
    busesSnapshot.forEach((docSnap) => {
      const rawData = docSnap.data();
      
      // Parse routeInfo map
      const routeInfo = rawData.routeInfo || {};
      const liveStatus = rawData.liveStatus || {};
      
      // Construct bus object matching your specific DB structure
      busesData.push({
        id: docSnap.id, // This is the Document ID (e.g., PB01F4456)
        busId: docSnap.id, 
        
        // Fields from your screenshot
        name: rawData.name || 'Not Set',
        phone: rawData.phone || '—',
        email: rawData.loginEmail || '—',
        
        // Live Status Map
        status: liveStatus.status || 'inactive',
        
        // Route Info Map
        routeFrom: routeInfo.from || '?',
        routeTo: routeInfo.to || '?',
        stops: routeInfo.stops || [], // This is an array of objects
        templateId: routeInfo.templateId || '',
        
        // Computed fields for UI
        isRouteAssigned: (routeInfo.from && routeInfo.to) ? true : false
      });
    });
    
    console.log('Loaded buses from Firebase:', busesData);
    renderBusTable();
    
  } catch (error) {
    console.error('Error loading buses:', error);
    const rowsContainer = document.getElementById('fleet-rows');
    if(rowsContainer) rowsContainer.innerHTML = `<div class="row" style="color:red; padding:20px;">Error loading data. Check console.</div>`;
  }
}

// Render bus table
function renderBusTable() {
  const rowsContainer = document.getElementById('fleet-rows');
  if (!rowsContainer) return;
  
  if (busesData.length === 0) {
    rowsContainer.innerHTML = `
      <div class="row" style="justify-content: center; padding: 40px; color: #666;">
        No buses found in database.
      </div>
    `;
    return;
  }
  
  rowsContainer.innerHTML = busesData.map(bus => `
    <div class="row" data-bus-id="${bus.id}">
      <div class="col col-number" style="font-weight:bold;">${bus.busId}</div>
      <div class="col col-routes">${bus.isRouteAssigned ? '1 Active' : 'None'}</div>
      <div class="col col-conductor">${bus.name}</div>
      <div class="col col-hours">${bus.status.toUpperCase()}</div>
      <div class="col col-actions">
        <button class="btn-view" data-bus="${bus.busId}">View</button>
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  const rowsContainer = document.getElementById('fleet-rows');
  const hover = document.getElementById('busHoverCard');
  const hoverClose = document.getElementById('hoverClose');
  const search = document.querySelector('.search');

  // Load buses from Firebase on page load
  await loadBusesFromFirebase();

  /* ---- search filter (simple text filter) ---- */
  if (search) {
    search.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      const rows = rowsContainer.querySelectorAll('.row');
      rows.forEach(row => {
        const busId = row.querySelector('.col-number')?.textContent || '';
        const conductor = row.querySelector('.col-conductor')?.textContent || '';
        const searchText = `${busId} ${conductor}`.toLowerCase();
        row.style.display = searchText.includes(q) ? '' : 'none';
      });
    });
  }

  /* ---- position hover card near anchor (smart) ---- */
  function positionCard(anchorEl) {
    const card = hover;
    const pad = 12;
    const rect = anchorEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // preferred to the right of the button
    let left = rect.right + 12;
    if (left + card.offsetWidth + pad > vw) {
      // not enough space at right -> position on left
      left = rect.left - card.offsetWidth - 12;
      if (left < 8) left = Math.max(8, (vw - card.offsetWidth) / 2);
    }

    let top = rect.top;
    if (top + card.offsetHeight + pad > vh) {
      top = Math.max(8, vh - card.offsetHeight - 12);
    }

    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  }

  /* ---- show card with data from row ---- */
  rowsContainer.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.btn-view');
    if (!btn) return;

    const busId = btn.dataset.bus || '—';
    
    // Find the bus data from our loaded data
    const busData = busesData.find(b => b.busId === busId);
    
    if (!busData) {
      console.error('Bus data not found for:', busId);
      return;
    }

    // populate basic fields
    setText('hcBusNumber', `Bus Details: ${busId}`);
    setText('hcBusNo', busId);
    setText('hcStatus', busData.status.toUpperCase());
    setText('hcConductor', `Staff: ${busData.name}`);
    setText('hcConName', busData.name);
    setText('hcConPhone', busData.phone);
    
    // Route display
    if(busData.isRouteAssigned) {
        setText('r1Title', `${busData.routeFrom} ➝ ${busData.routeTo}`);
    } else {
        setText('r1Title', 'No Route Assigned');
    }

    // Populate Stops List
    const stopsList = document.getElementById('r1Stops');
    if (stopsList) {
        stopsList.innerHTML = '';
        if (busData.stops && busData.stops.length > 0) {
            busData.stops.forEach(stop => {
                const li = document.createElement('li');
                // Check if stop is an object (from DB screenshot) or string
                const stopName = (typeof stop === 'object' && stop.name) ? stop.name : stop;
                li.textContent = stopName;
                stopsList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'No stops defined';
            li.style.color = '#999';
            stopsList.appendChild(li);
        }
    }

    // Show additional details (Email, Template ID)
    const hoverBody = hover.querySelector('.hover-body');
    const rightCol = hover.querySelector('.hc-right');
    const existingDetails = hover.querySelector('.extra-details');
    if (existingDetails) existingDetails.remove();
    
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'extra-details staff-mini'; // reusing staff-mini class for styling
    detailsDiv.style.marginTop = '10px';
    detailsDiv.innerHTML = `
      <div style="font-size: 13px; margin-bottom: 4px;"><strong>Login Email:</strong></div>
      <div style="font-size: 12px; color: #555; margin-bottom: 8px;">${busData.email}</div>
      
      <div style="font-size: 13px; margin-bottom: 4px;"><strong>Template ID:</strong></div>
      <div style="font-size: 12px; color: #555; word-break: break-all;">${busData.templateId || 'None'}</div>
    `;
    
    // Append to right column
    rightCol.appendChild(detailsDiv);

    // show and position hover card
    hover.classList.remove('hide');
    hover.classList.add('show');
    hover.style.display = 'block';
    
    // small timeout so we have card dimensions
    setTimeout(() => positionCard(btn), 6);
  });

  /* ---- close behaviors ---- */
  hoverClose.addEventListener('click', () => {
    hover.classList.remove('show');
    hover.classList.add('hide');
    setTimeout(() => { hover.style.display = 'none'; }, 150);
  });

  document.addEventListener('click', (e) => {
    if (!hover.classList.contains('show')) return;
    if (e.target.closest('#busHoverCard')) return; // clicked inside card
    if (e.target.closest('.btn-view')) return; // clicked a different view button
    hover.classList.remove('show');
    hover.classList.add('hide');
    setTimeout(() => { hover.style.display = 'none'; }, 150);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && hover.classList.contains('show')) {
      hover.classList.remove('show');
      hover.classList.add('hide');
      setTimeout(() => { hover.style.display = 'none'; }, 150);
    }
  });

  // maintain visibility after resize (reposition)
  window.addEventListener('resize', () => {
    if (hover.classList.contains('show')) {
      hover.style.display = 'block';
    }
  });
});