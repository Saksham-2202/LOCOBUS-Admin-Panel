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
  orderBy
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
const complaintsCountEl = document.getElementById('complaintsCount');

// State for complaints tracking
let allComplaints = [];

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

// ---------------- COMPLAINTS TRACKING ----------------

function calculateActiveComplaintsByBus() {
  const busStats = {};
  
  // Only count complaints that are NOT solved
  allComplaints.forEach(complaint => {
    if (complaint.status !== 'solved') {
      const bus = complaint.busNumber;
      busStats[bus] = (busStats[bus] || 0) + 1;
    }
  });
  
  return busStats;
}

function startComplaintsListener() {
  const complaintsQuery = query(
    collection(db, 'complaints'),
    orderBy('createdAt', 'desc')
  );

  onSnapshot(complaintsQuery, (snapshot) => {
    allComplaints = [];
    
    snapshot.forEach((doc) => {
      allComplaints.push({ id: doc.id, ...doc.data() });
    });
    
    // Update complaint count
    const unresolvedCount = allComplaints.filter(c => c.status !== 'solved').length;
    if (complaintsCountEl) {
      complaintsCountEl.textContent = unresolvedCount;
    }
    
    // Update critical alerts
    updateCriticalAlerts();
  }, (error) => {
    console.error('Error listening to complaints:', error);
  });
}

function updateCriticalAlerts() {
  const criticalAlertsPanel = document.querySelector('.panel-row .panel:nth-child(2) .list');
  
  if (!criticalAlertsPanel) return;
  
  const busComplaintStats = calculateActiveComplaintsByBus();
  
  const highComplaintBuses = Object.entries(busComplaintStats)
    .filter(([_, count]) => count >= 5)
    .sort((a, b) => b[1] - a[1]);

  if (highComplaintBuses.length === 0) {
    criticalAlertsPanel.innerHTML = `
      <div class="list empty" style="height:120px; background:#f0fdf4; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#10b981; font-size:14px;">
        ✅ No Critical Alerts
      </div>
    `;
    return;
  }

  criticalAlertsPanel.innerHTML = highComplaintBuses.map(([busNumber, count]) => {
    const busComplaints = allComplaints.filter(c => 
      c.busNumber === busNumber && c.status !== 'solved'
    );
    
    const latestComplaint = busComplaints[0];
    const route = latestComplaint 
      ? `${latestComplaint.from || '-'} → ${latestComplaint.to || '-'}` 
      : 'Route unavailable';
    
    const categories = [...new Set(busComplaints.map(c => c.issueCategory))];
    const categoryText = categories.slice(0, 2).join(', ') + 
      (categories.length > 2 ? `, +${categories.length - 2} more` : '');

    return `
      <div class="item critical-alert-item" style="background:#fef2f2; border-left:4px solid #ef4444; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:start;">
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <span style="font-size:20px;">⚠️</span>
              <p style="font-weight:bold; margin:0; font-size:15px; color:#991b1b;">
                Bus ${busNumber}
              </p>
              <span style="background:#ef4444; color:white; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:700;">
                ${count} ACTIVE COMPLAINTS
              </span>
            </div>
            <small style="color:#7f1d1d; font-size:12px; display:block; margin-bottom:4px;">
              Route: ${route}
            </small>
            <small style="color:#991b1b; font-size:11px; font-weight:600;">
              Issues: ${categoryText}
            </small>
          </div>
          <button 
            onclick="window.location.href='../help desk/helpDesk.html?bus=${encodeURIComponent(busNumber)}'" 
            style="background:#ef4444; padding:8px 14px; font-size:12px; border:none; color:white; border-radius:6px; cursor:pointer; white-space:nowrap; font-weight:600;">
            View Details →
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ---------------- PENDING APPROVALS ----------------

function loadPendingApprovals() {
  if (!pendingListEl) return;
  
  const pendingRef = collection(db, 'pending_approvals');

  onSnapshot(pendingRef, (snapshot) => {
    pendingListEl.innerHTML = '';

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

// Expose Approve/Reject to Window scope
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

// ---------------- RECENT NOTIFICATIONS ----------------

function initRecentNotificationsWidget() {
  const recentList = document.getElementById('recentList');
  if (!recentList) return;

  const filterTabs = document.querySelectorAll('.filter-tab');
  let currentFilter = 'all';

  let conductorNotifs = [];
  let userNotifs = [];

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

  recentList.innerHTML = `
    <div style="padding:20px; text-align:center; color:#999;">
      Loading notifications...
    </div>`;

  subscribeToNotifications();
}

// ---------------- INIT DASHBOARD ----------------

function initDashboard() {
  const admin = checkAuth();
  if (!admin) return;
  
  startBusStatusListener();
  startComplaintsListener(); // Added: Listen to complaints
  loadPendingApprovals();
  initRecentNotificationsWidget();
}

// Start
document.addEventListener('DOMContentLoaded', initDashboard);