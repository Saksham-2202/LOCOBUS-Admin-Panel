// complaints.js - Complaints Management System

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy,
  Timestamp
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

// State
let allComplaints = [];
let currentComplaintId = null;

// DOM Elements
const tbody = document.getElementById('complaintsBody');
const countEl = document.getElementById('complaintCount');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const priorityFilter = document.getElementById('priorityFilter');
const categoryFilter = document.getElementById('categoryFilter');
const detailPanel = document.getElementById('detailPanel');
const closePanel = document.getElementById('closePanel');
const alertBanner = document.getElementById('alertBanner');
const alertList = document.getElementById('alertList');

// Check Authentication
function checkAuth() {
  const adminProfile = sessionStorage.getItem('adminProfile');
  if (!adminProfile) {
    window.location.href = "../login/login.html";
    return null;
  }
  
  try {
    const profile = JSON.parse(adminProfile);
    const adminProfileEl = document.getElementById('adminProfile');
    if (adminProfileEl && profile.adminId) {
      const nameSpan = adminProfileEl.querySelector('span') || adminProfileEl;
      nameSpan.textContent = profile.adminId.toUpperCase();
    }
    return profile;
  } catch (err) {
    console.error('Error parsing admin profile:', err);
    window.location.href = "../login/login.html";
    return null;
  }
}

// Calculate active (unsolved) complaints per bus
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

// Initialize Complaints Listener
function initComplaintsListener() {
  const complaintsQuery = query(
    collection(db, 'complaints'),
    orderBy('createdAt', 'desc')
  );

  onSnapshot(complaintsQuery, (snapshot) => {
    allComplaints = [];
    snapshot.forEach((doc) => {
      allComplaints.push({ id: doc.id, ...doc.data() });
    });
    renderComplaints();
    updateAlertBanner();
  }, (error) => {
    console.error('Error listening to complaints:', error);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#f87171;">Error loading complaints</td></tr>';
  });
}

// Update Alert Banner for High Complaint Buses
function updateAlertBanner() {
  const busComplaintStats = calculateActiveComplaintsByBus();
  
  const highComplaintBuses = Object.entries(busComplaintStats)
    .filter(([_, count]) => count >= 5)
    .sort((a, b) => b[1] - a[1]);

  if (highComplaintBuses.length > 0) {
    alertBanner.classList.add('show');
    alertList.innerHTML = highComplaintBuses
      .map(([bus, count]) => `
        <li>
          <span class="alert-bus-number">${bus}</span>
          <span class="alert-count">${count} active complaints</span>
        </li>
      `)
      .join('');
  } else {
    alertBanner.classList.remove('show');
  }
}

// Filter Matching
function matchesFilters(complaint) {
  const search = searchInput.value.toLowerCase().trim();
  const status = statusFilter.value;
  const priority = priorityFilter.value;
  const category = categoryFilter.value;

  if (search) {
    const searchText = `${complaint.busNumber} ${complaint.issueCategory} ${complaint.description}`.toLowerCase();
    if (!searchText.includes(search)) return false;
  }

  if (status !== 'all' && complaint.status !== status) return false;
  if (priority !== 'all' && complaint.priority !== priority) return false;
  if (category !== 'all' && complaint.issueCategory !== category) return false;

  return true;
}

// Render Complaints Table
function renderComplaints() {
  const filtered = allComplaints.filter(matchesFilters);
  countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#999;">No complaints found</td></tr>';
    return;
  }

  // Calculate active complaints per bus for warning indicator
  const busComplaintStats = calculateActiveComplaintsByBus();

  tbody.innerHTML = filtered.map(c => {
    const date = c.createdAt 
      ? new Date(c.createdAt.toDate()).toLocaleString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : '-';
    
    const route = `${c.from || '-'} → ${c.to || '-'}`;
    
    // Check if this bus has 5+ ACTIVE (unsolved) complaints
    const isHighComplaint = busComplaintStats[c.busNumber] >= 5;
    const shortId = c.id.substr(0, 8).toUpperCase();

    return `
      <tr class="complaint-row ${isHighComplaint ? 'high-complaint-bus' : ''}" data-id="${c.id}">
        <td><span style="font-family:monospace;font-size:12px;">#${shortId}</span></td>
        <td>${date}</td>
        <td>
          <div class="bus-badge">
            ${isHighComplaint ? '<span class="warning-icon">⚠️</span>' : ''}
            <strong>${c.busNumber}</strong>
          </div>
        </td>
        <td>${route}</td>
        <td>${c.issueCategory}</td>
        <td><span class="priority priority-${c.priority}">${c.priority}</span></td>
        <td><span class="status status-${c.status}">${c.status}</span></td>
        <td class="action-col">
          <button class="view-btn" onclick="window.openComplaintDetail('${c.id}')" title="View Details">👁</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Open Complaint Detail Panel
window.openComplaintDetail = (id) => {
  const complaint = allComplaints.find(c => c.id === id);
  if (!complaint) return;

  currentComplaintId = id;
  
  const shortId = id.substr(0, 8).toUpperCase();
  document.getElementById('detailId').textContent = `Complaint #${shortId}`;
  document.getElementById('detailBusNumber').textContent = complaint.busNumber;
  document.getElementById('detailRoute').textContent = `${complaint.from || '-'} → ${complaint.to || '-'}`;
  document.getElementById('detailCategory').textContent = complaint.issueCategory;
  
  const incidentDate = complaint.incidentAt 
    ? new Date(complaint.incidentAt.toDate()).toLocaleString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Not specified';
  document.getElementById('detailDate').textContent = incidentDate;
  
  const reporter = complaint.isAnonymous 
    ? 'Anonymous User' 
    : (complaint.userEmail || 'User');
  document.getElementById('detailReporter').textContent = reporter;
  
  document.getElementById('detailDescription').textContent = complaint.description || 'No description provided';
  document.getElementById('adminNotesInput').value = complaint.adminNotes || '';

  const statusBadge = document.getElementById('detailStatus');
  statusBadge.className = `status status-${complaint.status}`;
  statusBadge.textContent = complaint.status;

  const priorityBadge = document.getElementById('detailPriority');
  priorityBadge.className = `priority priority-${complaint.priority}`;
  priorityBadge.textContent = complaint.priority;

  document.getElementById('statusSelect').value = complaint.status;

  detailPanel.classList.add('show');
};

// Close Detail Panel
closePanel.addEventListener('click', () => {
  detailPanel.classList.remove('show');
});

// Update Complaint Status
document.getElementById('updateBtn').addEventListener('click', async () => {
  if (!currentComplaintId) return;
  
  const newStatus = document.getElementById('statusSelect').value;
  const adminNotes = document.getElementById('adminNotesInput').value.trim();

  try {
    const updateData = {
      status: newStatus,
      adminNotes: adminNotes,
      updatedAt: Timestamp.now()
    };

    // If marking as solved, add resolved flag and timestamp
    if (newStatus === 'solved') {
      updateData.resolved = true;
      updateData.resolvedAt = Timestamp.now();
    }

    await updateDoc(doc(db, 'complaints', currentComplaintId), updateData);
    alert('✅ Complaint updated successfully');
  } catch (err) {
    console.error('Error updating complaint:', err);
    alert('❌ Error updating complaint: ' + err.message);
  }
});

// Mark Complaint as Solved
document.getElementById('solveBtn').addEventListener('click', async () => {
  if (!currentComplaintId) return;

  const adminNotes = document.getElementById('adminNotesInput').value.trim();

  if (!confirm('Mark this complaint as solved?')) return;

  try {
    await updateDoc(doc(db, 'complaints', currentComplaintId), {
      status: 'solved',
      resolved: true,
      adminNotes: adminNotes,
      resolvedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    detailPanel.classList.remove('show');
    alert('✅ Complaint marked as solved');
  } catch (err) {
    console.error('Error marking as solved:', err);
    alert('❌ Error: ' + err.message);
  }
});

// Filter Event Listeners
[searchInput, statusFilter, priorityFilter, categoryFilter].forEach(el => {
  el.addEventListener('input', renderComplaints);
  el.addEventListener('change', renderComplaints);
});

// ESC Key to Close Panel
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && detailPanel.classList.contains('show')) {
    detailPanel.classList.remove('show');
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const admin = checkAuth();
  if (!admin) return;
  
  initComplaintsListener();
});