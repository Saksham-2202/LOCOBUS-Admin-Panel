// Dashboard JS

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
  getFirestore, collection, onSnapshot, query, where, doc, setDoc, deleteDoc, addDoc, serverTimestamp, getDoc, orderBy
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
const pendingApprovalsCountEl = document.getElementById('pendingApprovalsCount');

// Reliability Elements
const reliabilityBox = document.getElementById('reliabilityBox');
const avgReliabilityEl = document.getElementById('avgReliability');
const reliabilityModalOverlay = document.getElementById('reliabilityModalOverlay');
const reliabilityCloseBtn = document.getElementById('reliabilityClose');
const reliabilityListContainer = document.getElementById('reliabilityListContainer');

// NEW: Crowd Elements
const crowdBox = document.getElementById('crowdBox');
const avgComfortEl = document.getElementById('avgComfort');
const crowdModalOverlay = document.getElementById('crowdModalOverlay');
const crowdCloseBtn = document.getElementById('crowdClose');
const crowdListContainer = document.getElementById('crowdListContainer');

// State
let allComplaints = [];
let fleetReliabilityData = [];
let fleetCrowdData = [];

// Auth & Logout
function checkAuth() {
  const adminProfile = sessionStorage.getItem('adminProfile');
  if (!adminProfile) { window.location.href = "../login/login.html"; return null; }
  try {
    const profile = JSON.parse(adminProfile);
    if (adminNameEl && profile.adminId) adminNameEl.textContent = profile.adminId.toUpperCase();
    return profile;
  } catch (err) { window.location.href = "../login/login.html"; return null; }
}
if (logoutBtn) {
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault(); sessionStorage.removeItem('adminProfile'); window.location.href = "../login/login.html";
  });
}

// --- BUS STATUS, RELIABILITY & CROWD LISTENER ---
function startBusStatusListener() {
  const busesRef = collection(db, 'buses');
  
  onSnapshot(busesRef, (snapshot) => {
    let totalBuses = 0, activeBuses = 0;
    
    // Time Stats Variables
    let sumReliability = 0, countWithTimeVotes = 0;
    
    // Crowd Stats Variables
    let sumComfort = 0, countWithCrowdVotes = 0;

    fleetReliabilityData = [];
    fleetCrowdData = [];
    
    snapshot.forEach((docSnap) => {
      const busData = docSnap.data();
      const busId = docSnap.id;
      const busNumber = busData.busNumber || busId;
      
      // 1. Fleet Counts
      totalBuses++;
      if (busData.liveStatus && busData.liveStatus.status === 'active') activeBuses++;

      const stats = busData.stats || {};

      // 2. Reliability Data (Time)
      const timePct = stats.reliabilityPercentage || 0;
      const timeVotes = stats.totalVotes || 0;
      fleetReliabilityData.push({ busNumber, percentage: timePct, votes: timeVotes });

      if (timeVotes > 0) {
        sumReliability += timePct;
        countWithTimeVotes++;
      }

      // 3. Crowd Data (Comfort)
      // comfortPercentage = % of people who said "No" (it is NOT crowded)
      const comfortPct = stats.comfortPercentage || 0;
      const crowdVotes = stats.totalCrowdVotes || 0;
      fleetCrowdData.push({ busNumber, percentage: comfortPct, votes: crowdVotes });

      if (crowdVotes > 0) {
        sumComfort += comfortPct;
        countWithCrowdVotes++;
      }
    });
    
    // Update Fleet UI
    if (activeBusCountEl) activeBusCountEl.textContent = activeBuses;
    if (totalBusCountEl) totalBusCountEl.textContent = totalBuses;
    if (fleetUpdateIndicator) {
        fleetUpdateIndicator.classList.add('flash');
        setTimeout(() => fleetUpdateIndicator.classList.remove('flash'), 1000);
    }

    // Update Reliability UI
    let globalAvgTime = countWithTimeVotes > 0 ? Math.round(sumReliability / countWithTimeVotes) : 0;
    if (avgReliabilityEl) {
        avgReliabilityEl.textContent = globalAvgTime;
        avgReliabilityEl.style.color = globalAvgTime >= 80 ? '#10b981' : (globalAvgTime >= 50 ? '#f59e0b' : '#ef4444');
    }

    // Update Crowd/Comfort UI
    let globalAvgComfort = countWithCrowdVotes > 0 ? Math.round(sumComfort / countWithCrowdVotes) : 0;
    if (avgComfortEl) {
        avgComfortEl.textContent = globalAvgComfort;
        // High comfort (not crowded) is green
        avgComfortEl.style.color = globalAvgComfort >= 80 ? '#10b981' : (globalAvgComfort >= 50 ? '#f59e0b' : '#ef4444');
    }
  });
}

// --- RELIABILITY MODAL ---
if (reliabilityBox) reliabilityBox.addEventListener('click', openReliabilityModal);
if (reliabilityCloseBtn) reliabilityCloseBtn.addEventListener('click', () => reliabilityModalOverlay.style.display = 'none');
window.addEventListener('click', (e) => { if (e.target === reliabilityModalOverlay) reliabilityModalOverlay.style.display = 'none'; });

function openReliabilityModal() {
    if (!reliabilityListContainer) return;
    fleetReliabilityData.sort((a, b) => b.percentage - a.percentage);
    reliabilityListContainer.innerHTML = '';

    if (fleetReliabilityData.length === 0) {
        reliabilityListContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">No bus data available.</div>';
    } else {
        fleetReliabilityData.forEach(bus => {
            const pct = Math.round(bus.percentage);
            let colorStr = pct >= 80 ? '#10b981' : (pct >= 50 ? '#f59e0b' : '#ef4444');
            if (bus.votes === 0) colorStr = '#9ca3af';
            const percentageText = bus.votes === 0 ? 'No Data' : `${pct}%`;

            reliabilityListContainer.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 10px; border-bottom: 1px solid #f3f4f6;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="background:#e0e7ff; color:#3730a3; padding:6px 12px; border-radius:6px; font-weight:700; font-size:14px;">${bus.busNumber}</span>
                        <span style="font-size:12px; color:#6b7280;">(${bus.votes} votes)</span>
                    </div>
                    <div style="font-weight:700; color:${colorStr}; font-size:16px;">${percentageText}</div>
                </div>`;
        });
    }
    reliabilityModalOverlay.style.display = 'flex';
}

// --- CROWD MODAL ---
if (crowdBox) crowdBox.addEventListener('click', openCrowdModal);
if (crowdCloseBtn) crowdCloseBtn.addEventListener('click', () => crowdModalOverlay.style.display = 'none');
window.addEventListener('click', (e) => { if (e.target === crowdModalOverlay) crowdModalOverlay.style.display = 'none'; });

function openCrowdModal() {
    if (!crowdListContainer) return;
    fleetCrowdData.sort((a, b) => b.percentage - a.percentage); // High % = Comfortable (Empty)
    crowdListContainer.innerHTML = '';

    if (fleetCrowdData.length === 0) {
        crowdListContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">No bus data available.</div>';
    } else {
        fleetCrowdData.forEach(bus => {
            const pct = Math.round(bus.percentage);
            // 100% = Empty (Green), 0% = Full (Red)
            let colorStr = pct >= 80 ? '#10b981' : (pct >= 50 ? '#f59e0b' : '#ef4444');
            if (bus.votes === 0) colorStr = '#9ca3af';
            const percentageText = bus.votes === 0 ? 'No Data' : `${pct}%`;

            crowdListContainer.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 10px; border-bottom: 1px solid #f3f4f6;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="background:#e0e7ff; color:#3730a3; padding:6px 12px; border-radius:6px; font-weight:700; font-size:14px;">${bus.busNumber}</span>
                        <span style="font-size:12px; color:#6b7280;">(${bus.votes} votes)</span>
                    </div>
                    <div style="font-weight:700; color:${colorStr}; font-size:16px;">${percentageText}</div>
                </div>`;
        });
    }
    crowdModalOverlay.style.display = 'flex';
}

// --- OTHER LISTENERS ---
function startComplaintsListener() {
  onSnapshot(query(collection(db, 'complaints'), orderBy('createdAt', 'desc')), (snapshot) => {
    allComplaints = [];
    snapshot.forEach((doc) => allComplaints.push({ id: doc.id, ...doc.data() }));
    if (complaintsCountEl) complaintsCountEl.textContent = allComplaints.filter(c => c.status !== 'solved').length;
    updateCriticalAlerts();
  });
}

function updateCriticalAlerts() {
  const panel = document.getElementById('criticalAlertsList');
  if (!panel) return;
  
  const busStats = {};
  allComplaints.filter(c => c.status !== 'solved').forEach(c => busStats[c.busNumber] = (busStats[c.busNumber] || 0) + 1);
  const high = Object.entries(busStats).filter(([_, c]) => c >= 5).sort((a, b) => b[1] - a[1]);

  if (high.length === 0) {
    panel.innerHTML = `<div class="list empty" style="height:120px; background:#f0fdf4; color:#10b981; font-size:14px; display:flex; align-items:center; justify-content:center;">✅ No Critical Alerts</div>`;
    return;
  }
  
  panel.innerHTML = high.map(([busNum, count]) => {
      return `<div class="item critical-alert-item" style="background:#fef2f2; border-left:4px solid #ef4444; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between;">
          <div>
             <p style="font-weight:bold; color:#991b1b; margin:0;">Bus ${busNum}</p>
             <span style="background:#ef4444; color:white; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700;">${count} ALERTS</span>
          </div>
          <button onclick="window.location.href='../help desk/helpDesk.html?bus=${encodeURIComponent(busNum)}'" style="background:#ef4444; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">View</button>
        </div>
      </div>`;
  }).join('');
}

function loadPendingApprovals() {
  if (!pendingListEl) return;
  onSnapshot(collection(db, 'pending_approvals'), (snapshot) => {
    pendingListEl.innerHTML = '';
    if (pendingApprovalsCountEl) pendingApprovalsCountEl.textContent = snapshot.size;
    
    if (snapshot.empty) { pendingListEl.innerHTML = '<div class="list empty" style="justify-content:center; color:#9ca3af;">No pending approvals</div>'; return; }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      pendingListEl.innerHTML += `
        <div class="item" id="item-${docSnap.id}">
          <div style="display:flex; justify-content:space-between;">
            <div><strong>${data.type}</strong>: ${data.route_data.from} ➝ ${data.route_data.to}</div>
            <div style="display:flex; gap:5px;">
               <button onclick="window.handleReject('${docSnap.id}')" style="background:#ef4444; color:white; border:none; padding:5px; border-radius:4px;">Reject</button>
               <button onclick="window.handleApprove('${docSnap.id}')" style="background:#10b981; color:white; border:none; padding:5px; border-radius:4px;">Approve</button>
            </div>
          </div>
        </div>`;
    });
  });
}

window.handleApprove = async (docId) => {
  try {
    const pendingRef = doc(db, 'pending_approvals', docId);
    const snap = await getDoc(pendingRef);
    if (!snap.exists()) return;
    const { route_data, stops_data, target_route_id } = snap.data();
    
    const liveRef = target_route_id ? doc(db, 'bus_routes', target_route_id) : doc(collection(db, 'bus_routes'));
    await setDoc(liveRef, { ...route_data, updated_at: serverTimestamp() });
    
    const stopsRef = collection(liveRef, 'stops');
    await Promise.all(stops_data.map(stop => addDoc(stopsRef, { ...stop, timestamp: serverTimestamp() })));
    await deleteDoc(pendingRef);
    alert("Approved!");
  } catch (e) { alert("Error: " + e.message); }
};

window.handleReject = async (docId) => {
    if(confirm("Reject?")) await deleteDoc(doc(db, 'pending_approvals', docId));
};

function initRecentNotificationsWidget() {
  const recentList = document.getElementById('recentList');
  if(!recentList) return;
  const tabs = document.querySelectorAll('.filter-tab');
  
  function render(items) {
      recentList.innerHTML = items.length ? items.slice(0,10).map(n => `
        <div class="recent-item">
            <div><div class="r-title">${n.title}</div><div class="r-meta">${n.targetType} • ${n.createdAt?.toDate().toLocaleString()}</div></div>
            <span class="pill ${n.status === 'Sent' ? 'sent' : 'scheduled'}">${n.status}</span>
        </div>`).join('') : '<div style="padding:20px; text-align:center; color:#999;">No notifications</div>';
  }

  function sub(filter) {
      const q = query(collection(db, filter === 'conductors' ? 'notifications' : 'user_notifications'), orderBy('createdAt', 'desc'));
      onSnapshot(q, snap => render(snap.docs.map(d => ({...d.data(), targetType: filter}))));
  }
  
  tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active')); t.classList.add('active');
      sub(t.dataset.filter);
  }));
  sub('all'); // Default simple load
}

document.addEventListener('DOMContentLoaded', () => {
  if(checkAuth()) {
      startBusStatusListener();
      startComplaintsListener();
      // startActiveBannersListener(); // Removed
      loadPendingApprovals();
      initRecentNotificationsWidget();
  }
});