// Dashboard JS - Real-time Bus Tracking & Approval System

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
  getFirestore, collection, onSnapshot, query, where, 
  doc, setDoc, deleteDoc, addDoc, serverTimestamp, getDoc 
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

// DOM Elements
const activeBusCountEl = document.getElementById('activeBusCount');
const totalBusCountEl = document.getElementById('totalBusCount');
const fleetUpdateIndicator = document.getElementById('fleetUpdateIndicator');
const logoutBtn = document.getElementById('logoutBtn');
const adminNameEl = document.getElementById('adminName');
const searchInput = document.querySelector('.search');
const pendingListEl = document.getElementById('pendingList');

// Check if admin is logged in
function checkAuth() {
  const adminProfile = sessionStorage.getItem('adminProfile');
  if (!adminProfile) {
    window.location.href = "../login/login.html";
    return null;
  }
  
  try {
    const profile = JSON.parse(adminProfile);
    if (adminNameEl && profile.adminId) {
      adminNameEl.textContent = profile.adminId.toUpperCase();
    }
    return profile;
  } catch (err) {
    console.error('Error parsing admin profile:', err);
    window.location.href = "../login/login.html";
    return null;
  }
}

// Logout functionality
if (logoutBtn) {
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    sessionStorage.removeItem('adminProfile');
    window.location.href = "../login/login.html";
  });
}

// Real-time Bus Status Listener
function startBusStatusListener() {
  const busesRef = collection(db, 'buses');
  
  onSnapshot(busesRef, (snapshot) => {
    let totalBuses = 0;
    let activeBuses = 0;
    
    snapshot.forEach((doc) => {
      const busData = doc.data();
      totalBuses++;
      if (busData.liveStatus && busData.liveStatus.status === 'active') {
        activeBuses++;
      }
    });
    
    updateFleetDisplay(activeBuses, totalBuses);
    flashUpdateIndicator();
  }, (error) => {
    console.error('Error listening to bus status:', error);
  });
}

function updateFleetDisplay(active, total) {
  if(activeBusCountEl) activeBusCountEl.textContent = active;
  if(totalBusCountEl) totalBusCountEl.textContent = total;
}

function flashUpdateIndicator() {
  if (fleetUpdateIndicator) {
    fleetUpdateIndicator.classList.add('flash');
    setTimeout(() => {
      fleetUpdateIndicator.classList.remove('flash');
    }, 1000);
  }
}

// --- NEW: Pending Approvals Logic ---

function loadPendingApprovals() {
  if(!pendingListEl) return;
  
  const pendingRef = collection(db, 'pending_approvals');

  onSnapshot(pendingRef, (snapshot) => {
    pendingListEl.innerHTML = ''; // Clear existing list

    if (snapshot.empty) {
      pendingListEl.innerHTML = `
        <div class="list empty" style="justify-content:center; color:#9ca3af;">
           No pending approvals
        </div>
      `;
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const docId = docSnap.id;
      const stopsCount = data.stops_data ? data.stops_data.length : 0;
      
      const itemHTML = `
        <div class="item" id="item-${docId}" style="margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:start;">
            <div>
              <p style="font-weight:bold; margin-bottom:4px; font-size:14px;">
                ${data.type}: ${data.route_data.from} ➝ ${data.route_data.to}
              </p>
              <small class="muted" style="color:#6b7280; font-size:12px;">
                By: ${data.conductor_name} • Stops: ${stopsCount}
              </small>
            </div>
            <div style="display:flex; gap:8px;">
               <button 
                 onclick="window.handleReject('${docId}')" 
                 style="background:#ef4444; padding:5px 10px; font-size:12px; border:none; color:white; border-radius:4px; cursor:pointer;">
                 Reject
               </button>
               <button 
                 onclick="window.handleApprove('${docId}')" 
                 style="background:#10b981; padding:5px 10px; font-size:12px; border:none; color:white; border-radius:4px; cursor:pointer;">
                 Approve
               </button>
            </div>
          </div>
        </div>
      `;
      pendingListEl.innerHTML += itemHTML;
    });
  });
}

// Expose Approve/Reject to Window scope so HTML onclick can find them
window.handleApprove = async (docId) => {
  const btn = document.querySelector(`#item-${docId} button:last-child`);
  if(btn) {
    btn.textContent = "Processing...";
    btn.disabled = true;
  }

  try {
    // 1. Get the Pending Document
    const pendingRef = doc(db, 'pending_approvals', docId);
    const docSnap = await getDoc(pendingRef);

    if (!docSnap.exists()) {
      alert("Request no longer exists.");
      return;
    }

    const pendingData = docSnap.data();
    const routeData = pendingData.route_data;
    const stopsData = pendingData.stops_data;

    // 2. Determine ID (Update existing or Create new)
    let liveRouteRef;
    if (pendingData.target_route_id) {
       liveRouteRef = doc(db, 'bus_routes', pendingData.target_route_id);
    } else {
       liveRouteRef = doc(collection(db, 'bus_routes'));
    }

    // 3. Save main route info to Live Collection
    await setDoc(liveRouteRef, {
      ...routeData,
      updated_at: serverTimestamp(),
      approved_by: "Admin"
    });

    // 4. Save Stops (as subcollection)
    // First clear old stops if updating (optional/safety step omitted for brevity)
    const stopsCollectionRef = collection(liveRouteRef, 'stops');
    
    // Add all stops concurrently
    const stopPromises = stopsData.map(stop => {
      return addDoc(stopsCollectionRef, {
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        order: stop.order,
        timestamp: serverTimestamp()
      });
    });
    
    await Promise.all(stopPromises);

    // 5. Delete from Pending
    await deleteDoc(pendingRef);

    alert("Route Approved & Live!");

  } catch (error) {
    console.error("Approval Error:", error);
    alert("Error approving route: " + error.message);
    if(btn) {
      btn.textContent = "Approve";
      btn.disabled = false;
    }
  }
};

window.handleReject = async (docId) => {
  if(!confirm("Are you sure you want to reject this update?")) return;

  try {
    const pendingRef = doc(db, 'pending_approvals', docId);
    await deleteDoc(pendingRef);
  } catch (error) {
    console.error("Reject Error:", error);
    alert("Error rejecting.");
  }
};

// Initialize Dashboard
function initDashboard() {
  const admin = checkAuth();
  if (!admin) return;
  
  startBusStatusListener();
  loadPendingApprovals(); // Start listening for approvals
}

// Start
document.addEventListener('DOMContentLoaded', initDashboard);