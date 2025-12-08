// Dashboard JS - Real-time Bus Tracking, Reliability & Approval System

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
const pendingApprovalsCountEl = document.getElementById('pendingApprovalsCount'); // Might be null if HTML replaced, handled safely below
const activeBannersCountEl = document.getElementById('activeBannersCount');

// NEW: Reliability Elements
const reliabilityBox = document.getElementById('reliabilityBox');
const avgReliabilityEl = document.getElementById('avgReliability');
const reliabilityModalOverlay = document.getElementById('reliabilityModalOverlay');
const reliabilityCloseBtn = document.getElementById('reliabilityClose');
const reliabilityListContainer = document.getElementById('reliabilityListContainer');

// State Variables
let allComplaints = [];
let fleetReliabilityData = []; // Stores individual bus stats

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

// ---------------- BUS STATUS & RELIABILITY LISTENER ----------------

function startBusStatusListener() {
  const busesRef = collection(db, 'buses');
  
  onSnapshot(busesRef, (snapshot) => {
    let totalBuses = 0;
    let activeBuses = 0;
    
    // Reliability Calculation Variables
    let sumReliability = 0;
    let countWithVotes = 0;
    fleetReliabilityData = []; // Reset list on every update
    
    snapshot.forEach((docSnap) => {
      const busData = docSnap.data();
      const busId = docSnap.id;
      
      // 1. Active Fleet Count
      totalBuses++;
      if (busData.liveStatus && busData.liveStatus.status === 'active') {
        activeBuses++;
      }

      // 2. Reliability Data Extraction
      const stats = busData.stats || {};
      const percentage = stats.reliabilityPercentage || 0;
      const totalVotes = stats.totalVotes || 0;
      const busNumber = busData.busNumber || busId;

      // Store for Modal
      fleetReliabilityData.push({
        busNumber: busNumber,
        percentage: percentage,
        votes: totalVotes
      });

      // Aggregate for Average (Only count buses that have data)
      if (totalVotes > 0) {
        sumReliability += percentage;
        countWithVotes++;
      }
    });
    
    // Update Active/Total Display
    updateFleetDisplay(activeBuses, totalBuses);
    flashUpdateIndicator();

    // Update Average Reliability Display
    let globalAvg = 0;
    if (countWithVotes > 0) {
        globalAvg = Math.round(sumReliability / countWithVotes);
    }
    
    if (avgReliabilityEl) {
        avgReliabilityEl.textContent = globalAvg;
        
        // Dynamic color for the average
        if(globalAvg >= 80) avgReliabilityEl.style.color = '#10b981'; // Green
        else if(globalAvg >= 50) avgReliabilityEl.style.color = '#f59e0b'; // Orange
        else avgReliabilityEl.style.color = '#ef4444'; // Red
    }

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

// ---------------- RELIABILITY MODAL LOGIC ----------------

// Event Listeners for Modal
if (reliabilityBox) {
    reliabilityBox.addEventListener('click', () => {
        openReliabilityModal();
    });
}

if (reliabilityCloseBtn) {
    reliabilityCloseBtn.addEventListener('click', () => {
        reliabilityModalOverlay.style.display = 'none';
    });
}

// Close when clicking outside modal
window.addEventListener('click', (e) => {
    if (e.target === reliabilityModalOverlay) {
        reliabilityModalOverlay.style.display = 'none';
    }
});

function openReliabilityModal() {
    if (!reliabilityListContainer) return;

    // Sort: Highest reliability first
    fleetReliabilityData.sort((a, b) => b.percentage - a.percentage);

    reliabilityListContainer.innerHTML = '';

    if (fleetReliabilityData.length === 0) {
        reliabilityListContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">No bus data available.</div>';
    } else {
        fleetReliabilityData.forEach(bus => {
            // Logic for coloring
            const pct = Math.round(bus.percentage);
            let colorStr = '#ef4444'; // Red default
            if (pct >= 80) colorStr = '#10b981'; // Green
            else if (pct >= 50) colorStr = '#f59e0b'; // Orange
            
            // Grey out if no votes yet
            if (bus.votes === 0) colorStr = '#9ca3af';

            const percentageText = bus.votes === 0 ? 'No Data' : `${pct}%`;

            const itemHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 10px; border-bottom: 1px solid #f3f4f6;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="background:#e0e7ff; color:#3730a3; padding:6px 12px; border-radius:6px; font-weight:700; font-size:14px;">
                            ${bus.busNumber}
                        </span>
                        <span style="font-size:12px; color:#6b7280;">(${bus.votes} votes)</span>
                    </div>
                    <div style="font-weight:700; color:${colorStr}; font-size:16px;">
                        ${percentageText}
                    </div>
                </div>
            `;
            reliabilityListContainer.innerHTML += itemHTML;
        });
    }

    reliabilityModalOverlay.style.display = 'flex';
}

// ---------------- ACTIVE BANNERS LISTENER ----------------

function startActiveBannersListener() {
  if (!activeBannersCountEl) return;

  // Query only active banners
  const activeBannersQuery = query(
    collection(db, 'advertisements'),
    where('active', '==', true)
  );

  onSnapshot(activeBannersQuery, (snapshot) => {
    const activeCount = snapshot.size;
    activeBannersCountEl.textContent = activeCount;
  }, (error) => {
    console.error('Error listening to active banners:', error);
    if (activeBannersCountEl) {
      activeBannersCountEl.textContent = 'Err';
    }
  });
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
  const criticalAlertsPanel = document.getElementById('criticalAlertsList');
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
      <div class="item critical-alert-item" 
           style="background:#fef2f2; border-left:4px solid #ef4444; margin-bottom:10px;">
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

// ---------------- PENDING APPROVALS (Bottom List Panel) ----------------

function loadPendingApprovals() {
  if (!pendingListEl) return;
  
  const pendingRef = collection(db, 'pending_approvals');

  onSnapshot(pendingRef, (snapshot) => {
    pendingListEl.innerHTML = '';

    // If you still have the count element somewhere else (or if it wasn't replaced in HTML)
    if (pendingApprovalsCountEl) {
      pendingApprovalsCountEl.textContent = snapshot.size;
    }

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
  
  startBusStatusListener(); // Handless Fleet Count & Reliability
  startComplaintsListener();
  startActiveBannersListener();
  loadPendingApprovals(); // Handles the Bottom Panel List
  initRecentNotificationsWidget();
}

// Start
document.addEventListener('DOMContentLoaded', initDashboard);