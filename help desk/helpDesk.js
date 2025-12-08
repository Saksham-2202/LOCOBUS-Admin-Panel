// helpDesk.js - Complaints & Stop Requests Management System

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

// ==================== COMPLAINTS SECTION ====================

// Pagination State for Complaints
const ITEMS_PER_PAGE = 5;
let currentPage = 1;
let filteredComplaints = [];

// State
let allComplaints = [];
let currentComplaintId = null;

// DOM Elements - Complaints
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

// Pagination Elements - Complaints
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageInfoEl = document.getElementById('pageInfo');
const totalComplaintsEl = document.getElementById('totalComplaints');

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
    applyFiltersAndRender();
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

// Filter Matching - Complaints
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

// Apply Filters and Reset to Page 1
function applyFiltersAndRender() {
  filteredComplaints = allComplaints.filter(matchesFilters);
  currentPage = 1;
  renderComplaints();
  updatePaginationControls();
}

// Update Pagination Controls - Complaints
function updatePaginationControls() {
  const totalItems = filteredComplaints.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  
  totalComplaintsEl.textContent = totalItems;
  
  const start = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const end = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
  
  if (totalItems === 0) {
    pageInfoEl.textContent = '0-0';
  } else {
    pageInfoEl.textContent = `${start}-${end}`;
  }
  
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage >= totalPages || totalItems === 0;
}

// Render Complaints Table (Current Page)
function renderComplaints() {
  countEl.textContent = filteredComplaints.length;

  if (filteredComplaints.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#999;">No complaints found</td></tr>';
    return;
  }

  const busComplaintStats = calculateActiveComplaintsByBus();

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const pageComplaints = filteredComplaints.slice(startIndex, endIndex);

  tbody.innerHTML = pageComplaints.map(c => {
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

// Pagination Button Handlers - Complaints
prevBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderComplaints();
    updatePaginationControls();
  }
});

nextBtn.addEventListener('click', () => {
  const totalPages = Math.ceil(filteredComplaints.length / ITEMS_PER_PAGE);
  if (currentPage < totalPages) {
    currentPage++;
    renderComplaints();
    updatePaginationControls();
  }
});

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

// Filter Event Listeners - Complaints
[searchInput, statusFilter, priorityFilter, categoryFilter].forEach(el => {
  el.addEventListener('input', applyFiltersAndRender);
  el.addEventListener('change', applyFiltersAndRender);
});

// ==================== STOP REQUESTS SECTION ====================

// Pagination State for Stop Requests
let stopCurrentPage = 1;
let filteredStopRequests = [];

// State
let allStopRequests = [];
let currentStopRequestId = null;

// DOM Elements - Stop Requests
const stopRequestsBody = document.getElementById('stopRequestsBody');
const stopRequestCountEl = document.getElementById('stopRequestCount');
const stopSearchInput = document.getElementById('stopSearchInput');
const stopStatusFilter = document.getElementById('stopStatusFilter');
const stopDetailPanel = document.getElementById('stopDetailPanel');
const closeStopPanel = document.getElementById('closeStopPanel');

// Pagination Elements - Stop Requests
const stopPrevBtn = document.getElementById('stopPrevBtn');
const stopNextBtn = document.getElementById('stopNextBtn');
const stopPageInfoEl = document.getElementById('stopPageInfo');
const totalStopRequestsEl = document.getElementById('totalStopRequests');

// Initialize Stop Requests Listener
function initStopRequestsListener() {
  const stopRequestsQuery = query(
    collection(db, 'stopRequests'),
    orderBy('createdAt', 'desc')
  );

  onSnapshot(stopRequestsQuery, (snapshot) => {
    allStopRequests = [];
    snapshot.forEach((doc) => {
      allStopRequests.push({ id: doc.id, ...doc.data() });
    });
    applyStopFiltersAndRender();
  }, (error) => {
    console.error('Error listening to stop requests:', error);
    stopRequestsBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#f87171;">Error loading stop requests</td></tr>';
  });
}

// Filter Matching - Stop Requests
function matchesStopFilters(request) {
  const search = stopSearchInput.value.toLowerCase().trim();
  const status = stopStatusFilter.value;

  if (search) {
    const searchText = `${request.stopName || ''} ${request.betweenStops || ''} ${request.submittedBy || ''}`.toLowerCase();
    if (!searchText.includes(search)) return false;
  }

  if (status !== 'all' && request.status !== status) return false;

  return true;
}

// Apply Filters and Reset to Page 1 - Stop Requests
function applyStopFiltersAndRender() {
  filteredStopRequests = allStopRequests.filter(matchesStopFilters);
  stopCurrentPage = 1;
  renderStopRequests();
  updateStopPaginationControls();
}

// Update Pagination Controls - Stop Requests
function updateStopPaginationControls() {
  const totalItems = filteredStopRequests.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  
  totalStopRequestsEl.textContent = totalItems;
  
  const start = (stopCurrentPage - 1) * ITEMS_PER_PAGE + 1;
  const end = Math.min(stopCurrentPage * ITEMS_PER_PAGE, totalItems);
  
  if (totalItems === 0) {
    stopPageInfoEl.textContent = '0-0';
  } else {
    stopPageInfoEl.textContent = `${start}-${end}`;
  }
  
  stopPrevBtn.disabled = stopCurrentPage === 1;
  stopNextBtn.disabled = stopCurrentPage >= totalPages || totalItems === 0;
}

// Render Stop Requests Table
function renderStopRequests() {
  stopRequestCountEl.textContent = filteredStopRequests.length;

  if (filteredStopRequests.length === 0) {
    stopRequestsBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#999;"><div style="font-size:48px;margin-bottom:12px;">📍</div>No stop requests found</td></tr>';
    return;
  }

  const startIndex = (stopCurrentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const pageRequests = filteredStopRequests.slice(startIndex, endIndex);

  stopRequestsBody.innerHTML = pageRequests.map(r => {
    const date = r.createdAt 
      ? new Date(r.createdAt.toDate()).toLocaleString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : '-';
    
    const shortId = r.id.substr(0, 8).toUpperCase();
    const submitter = r.isAnonymous ? 'Anonymous' : (r.userEmail || 'User');
    const betweenStops = r.betweenStops || '-';

    return `
      <tr data-id="${r.id}">
        <td><span style="font-family:monospace;font-size:12px;">#${shortId}</span></td>
        <td><strong>${r.stopName || 'Unnamed Stop'}</strong></td>
        <td>${betweenStops}</td>
        <td>${submitter}</td>
        <td>${date}</td>
        <td><span class="status status-${r.status || 'pending'}">${r.status || 'pending'}</span></td>
        <td class="action-col">
          <button class="view-btn" onclick="window.openStopRequestDetail('${r.id}')" title="View Details">👁</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Pagination Button Handlers - Stop Requests
stopPrevBtn.addEventListener('click', () => {
  if (stopCurrentPage > 1) {
    stopCurrentPage--;
    renderStopRequests();
    updateStopPaginationControls();
  }
});

stopNextBtn.addEventListener('click', () => {
  const totalPages = Math.ceil(filteredStopRequests.length / ITEMS_PER_PAGE);
  if (stopCurrentPage < totalPages) {
    stopCurrentPage++;
    renderStopRequests();
    updateStopPaginationControls();
  }
});

// Open Stop Request Detail Panel
window.openStopRequestDetail = (id) => {
  const request = allStopRequests.find(r => r.id === id);
  if (!request) return;

  currentStopRequestId = id;
  
  const shortId = id.substr(0, 8).toUpperCase();
  document.getElementById('stopDetailId').textContent = `Stop Request #${shortId}`;
  document.getElementById('stopDetailName').textContent = request.stopName || 'Unnamed Stop';
  document.getElementById('stopDetailBetween').textContent = request.betweenStops || 'Not specified';
  
  const submitter = request.isAnonymous 
    ? 'Anonymous User' 
    : (request.userEmail || 'User');
  document.getElementById('stopDetailSubmitter').textContent = submitter;
  
  const date = request.createdAt 
    ? new Date(request.createdAt.toDate()).toLocaleString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Not specified';
  document.getElementById('stopDetailDate').textContent = date;
  
  const coords = request.location 
    ? `${request.location.latitude.toFixed(6)}, ${request.location.longitude.toFixed(6)}`
    : 'Not available';
  document.getElementById('stopDetailCoords').textContent = coords;
  
  document.getElementById('stopAdminNotesInput').value = request.adminNotes || '';

  const statusBadge = document.getElementById('stopDetailStatus');
  const currentStatus = request.status || 'pending';
  statusBadge.className = `status status-${currentStatus}`;
  statusBadge.textContent = currentStatus;

  document.getElementById('stopStatusSelect').value = currentStatus;

  stopDetailPanel.classList.add('show');
};

// Close Stop Detail Panel
closeStopPanel.addEventListener('click', () => {
  stopDetailPanel.classList.remove('show');
});

// Update Stop Request Status
document.getElementById('stopUpdateBtn').addEventListener('click', async () => {
  if (!currentStopRequestId) return;
  
  const newStatus = document.getElementById('stopStatusSelect').value;
  const adminNotes = document.getElementById('stopAdminNotesInput').value.trim();

  try {
    const updateData = {
      status: newStatus,
      adminNotes: adminNotes,
      updatedAt: Timestamp.now()
    };

    if (newStatus === 'approved') {
      updateData.approvedAt = Timestamp.now();
    } else if (newStatus === 'rejected') {
      updateData.rejectedAt = Timestamp.now();
    }

    await updateDoc(doc(db, 'stopRequests', currentStopRequestId), updateData);
    alert('✅ Stop request updated successfully');
  } catch (err) {
    console.error('Error updating stop request:', err);
    alert('❌ Error updating stop request: ' + err.message);
  }
});

// Approve Stop Request
document.getElementById('approveBtn').addEventListener('click', async () => {
  if (!currentStopRequestId) return;

  const adminNotes = document.getElementById('stopAdminNotesInput').value.trim();

  if (!confirm('Approve this stop request?')) return;

  try {
    await updateDoc(doc(db, 'stopRequests', currentStopRequestId), {
      status: 'approved',
      adminNotes: adminNotes,
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    stopDetailPanel.classList.remove('show');
    alert('✅ Stop request approved');
  } catch (err) {
    console.error('Error approving stop request:', err);
    alert('❌ Error: ' + err.message);
  }
});

// Reject Stop Request
document.getElementById('rejectBtn').addEventListener('click', async () => {
  if (!currentStopRequestId) return;

  const adminNotes = document.getElementById('stopAdminNotesInput').value.trim();

  if (!confirm('Reject this stop request?')) return;

  try {
    await updateDoc(doc(db, 'stopRequests', currentStopRequestId), {
      status: 'rejected',
      adminNotes: adminNotes,
      rejectedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    stopDetailPanel.classList.remove('show');
    alert('✅ Stop request rejected');
  } catch (err) {
    console.error('Error rejecting stop request:', err);
    alert('❌ Error: ' + err.message);
  }
});

// Filter Event Listeners - Stop Requests
[stopSearchInput, stopStatusFilter].forEach(el => {
  el.addEventListener('input', applyStopFiltersAndRender);
  el.addEventListener('change', applyStopFiltersAndRender);
});

// ==================== GLOBAL EVENT LISTENERS ====================

// ESC Key to Close Panels
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (detailPanel.classList.contains('show')) {
      detailPanel.classList.remove('show');
    }
    if (stopDetailPanel.classList.contains('show')) {
      stopDetailPanel.classList.remove('show');
    }
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const admin = checkAuth();
  if (!admin) return;
  
  initComplaintsListener();
  initStopRequestsListener();
});
// Lottie bus logo animation
document.addEventListener('DOMContentLoaded', () => {
  const logoContainer = document.getElementById('busLogoAnim');
  if (logoContainer && window.lottie) {
    window.lottie.loadAnimation({
      container: logoContainer,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: '../index/Bus_carga_trackMile.json'  // <-- put your real path here
    });
  }
});
