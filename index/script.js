// Dashboard JS - Real-time Bus Tracking & Approval System

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
  getFirestore,
  collection,
  onSnapshot,
  query,
  where,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  getDoc,
  orderBy // <-- added for notifications
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

// ---------------- BUS STATUS LISTENER ----------------

function startBusStatusListener() {
  const busesRef = collection(db, 'buses');
  
  onSnapshot(busesRef, (snapshot) => {
    let totalBuses = 0;
    let activeBuses = 0;
    
    snapshot.forEach((docSnap) => {
      const busData = docSnap.data();
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
  if (activeBusCountEl) activeBusCountEl.textContent = active;
  if (totalBusCountEl) totalBusCountEl.textContent = total;
}

function flashUpdateIndicator() {
  if (fleetUpdateIndicator) {
    fleetUpdateIndicator.classList.add('flash');
    setTimeout(() => {
      fleetUpdateIndicator.classList.remove('flash');
    }, 1000);
  }
}

// ---------------- PENDING APPROVALS ----------------

function loadPendingApprovals() {
  if (!pendingListEl) return;
  
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
  if (btn) {
    btn.textContent = "Processing...";
    btn.disabled = true;
  }

  try {
    const pendingRef = doc(db, 'pending_approvals', docId);
    const docSnap = await getDoc(pendingRef);

    if (!docSnap.exists()) {
      alert("Request no longer exists.");
      return;
    }

    const pendingData = docSnap.data();
    const routeData = pendingData.route_data;
    const stopsData = pendingData.stops_data;

    let liveRouteRef;
    if (pendingData.target_route_id) {
       liveRouteRef = doc(db, 'bus_routes', pendingData.target_route_id);
    } else {
       liveRouteRef = doc(collection(db, 'bus_routes'));
    }

    await setDoc(liveRouteRef, {
      ...routeData,
      updated_at: serverTimestamp(),
      approved_by: "Admin"
    });

    const stopsCollectionRef = collection(liveRouteRef, 'stops');
    
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

    await deleteDoc(pendingRef);

    alert("Route Approved & Live!");

  } catch (error) {
    console.error("Approval Error:", error);
    alert("Error approving route: " + error.message);
    if (btn) {
      btn.textContent = "Approve";
      btn.disabled = false;
    }
  }
};

window.handleReject = async (docId) => {
  if (!confirm("Are you sure you want to reject this update?")) return;

  try {
    const pendingRef = doc(db, 'pending_approvals', docId);
    await deleteDoc(pendingRef);
  } catch (error) {
    console.error("Reject Error:", error);
    alert("Error rejecting.");
  }
};

// ---------------- RECENT NOTIFICATIONS (READ-ONLY WIDGET) ----------------

function initRecentNotificationsWidget() {
  const recentList = document.getElementById('recentList');
  if (!recentList) return; // Dashboard might not have this section

  const filterTabs = document.querySelectorAll('.filter-tab');
  let currentFilter = 'all';

  // we keep latest snapshots for "all" view
  let conductorNotifs = [];
  let userNotifs = [];

  // unsubscribe functions so we don't stack multiple listeners
  let unsubConductors = null;
  let unsubUsers = null;
  let unsubSingle = null;

  function clearListeners() {
    if (unsubConductors) { unsubConductors(); unsubConductors = null; }
    if (unsubUsers) { unsubUsers(); unsubUsers = null; }
    if (unsubSingle) { unsubSingle(); unsubSingle = null; }
  }

  function renderNotificationItems(items) {
    recentList.innerHTML = "";

    if (!items || items.length === 0) {
      recentList.innerHTML = `
        <div style="padding:20px; text-align:center; color:#999;">
          No recent notifications
        </div>`;
      return;
    }

    items.forEach((n) => {
      const dateObj = n.createdAt ? n.createdAt.toDate() : new Date();
      const dateStr = dateObj.toLocaleString();
      const targetLabel = n.targetType === 'conductors' ? 'Conductors' : 'Users';
      const status = n.status === 'scheduled' ? 'Scheduled' : 'Sent';

      const itemEl = document.createElement('div');
      itemEl.className = 'recent-item';

      itemEl.innerHTML = `
        <div>
          <div class="r-title">${n.title || '(No title)'}</div>
          <div class="r-meta">${targetLabel} • ${dateStr}</div>
        </div>
        <div class="r-badges">
          <span class="pill ${n.targetType}">${targetLabel}</span>
          <span class="pill ${status === 'Sent' ? 'sent' : 'scheduled'}">${status}</span>
        </div>
      `;

      recentList.appendChild(itemEl);
    });
  }

  function renderCombined() {
    const combined = [...conductorNotifs, ...userNotifs];

    combined.sort((a, b) => {
      const tA = a.createdAt ? a.createdAt.toMillis() : 0;
      const tB = b.createdAt ? b.createdAt.toMillis() : 0;
      return tB - tA;
    });

    // you can limit to top 10 if you want:
    renderNotificationItems(combined.slice(0, 10));
  }

  function subscribeToNotifications() {
    clearListeners();

    if (currentFilter === 'all') {
      const qConductors = query(
        collection(db, 'notifications'),
        orderBy('createdAt', 'desc')
      );
      const qUsers = query(
        collection(db, 'user_notifications'),
        orderBy('createdAt', 'desc')
      );

      unsubConductors = onSnapshot(qConductors, (snapshot) => {
        conductorNotifs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          targetType: 'conductors'
        }));
        renderCombined();
      });

      unsubUsers = onSnapshot(qUsers, (snapshot) => {
        userNotifs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          targetType: 'users'
        }));
        renderCombined();
      });

      return;
    }

    const collectionName =
      currentFilter === 'conductors' ? 'notifications' : 'user_notifications';

    const qCol = query(
      collection(db, collectionName),
      orderBy('createdAt', 'desc')
    );

    unsubSingle = onSnapshot(qCol, (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        targetType: currentFilter
      }));

      renderNotificationItems(items.slice(0, 10));
    });
  }

  // filter tab click behaviour
  if (filterTabs && filterTabs.length > 0) {
    filterTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        filterTabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter || 'all';
        subscribeToNotifications();
      });
    });
  }

  // initial message
  recentList.innerHTML = `
    <div style="padding:20px; text-align:center; color:#999;">
      Loading notifications...
    </div>`;

  // start listeners
  subscribeToNotifications();
}

// ---------------- TOURISM SECTION ----------------
// (keep your existing initTourismSection implementation here.
// If you removed tourism from dashboard, you can leave a no-op stub.)

function initTourismSection() {
  // If you already have a full tourism implementation, DELETE this stub.
  // This stub just avoids errors if the function is called but no tourism UI exists.
}

// ---------------- INIT DASHBOARD ----------------

function initDashboard() {
  const admin = checkAuth();
  if (!admin) return;
  
  startBusStatusListener();
  loadPendingApprovals();
  initRecentNotificationsWidget(); // <-- NEW: recent notifications from Firestore
  initTourismSection();            // static tourism section (or stub)
}

// Start
document.addEventListener('DOMContentLoaded', initDashboard);
