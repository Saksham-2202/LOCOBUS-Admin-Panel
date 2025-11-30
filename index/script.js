// Dashboard JS - Real-time Bus Tracking with Firebase

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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
  
  // Listen to ALL changes in the buses collection in real-time
  onSnapshot(busesRef, (snapshot) => {
    let totalBuses = 0;
    let activeBuses = 0;
    
    snapshot.forEach((doc) => {
      const busData = doc.data();
      totalBuses++;
      
      // Check if bus is active based on your database structure
      // Your structure: buses/{docId}/liveStatus/status = "active" or "inactive"
      if (busData.liveStatus && busData.liveStatus.status === 'active') {
        activeBuses++;
      }
    });
    
    // Update the UI
    updateFleetDisplay(activeBuses, totalBuses);
    
    // Show update indicator
    flashUpdateIndicator();
    
    console.log(`Fleet Update: ${activeBuses}/${totalBuses} buses active`);
  }, (error) => {
    console.error('Error listening to bus status:', error);
    activeBusCountEl.textContent = 'Error';
    totalBusCountEl.textContent = 'Error';
  });
}

// Update Fleet Display
function updateFleetDisplay(active, total) {
  activeBusCountEl.textContent = active;
  totalBusCountEl.textContent = total;
  
  // Optional: Calculate and update on-time percentage
  if (total > 0) {
    const onTimePercent = Math.round((active / total) * 100);
    // You can update another stat box if needed
  }
}

// Flash the update indicator when data changes
function flashUpdateIndicator() {
  if (fleetUpdateIndicator) {
    fleetUpdateIndicator.classList.add('flash');
    setTimeout(() => {
      fleetUpdateIndicator.classList.remove('flash');
    }, 1000);
  }
}

// Search functionality
if (searchInput) {
  searchInput.addEventListener('input', () => {
    console.log('Searching:', searchInput.value);
    // Implement search logic here if needed
  });
}

// Load pending approvals from Firestore (optional)
function loadPendingApprovals() {
  // You can fetch approval requests from Firestore here
  console.log('Loading pending approvals...');
  
  // Example: Listen to approvals collection
  // const approvalsRef = collection(db, 'approvals');
  // onSnapshot(approvalsRef, (snapshot) => {
  //   // Update approvals list
  // });
}

// Load complaints count (optional)
function loadComplaints() {
  const complaintsRef = collection(db, 'complaints');
  const unresolvedQuery = query(complaintsRef, where('status', '==', 'unresolved'));
  
  onSnapshot(unresolvedQuery, (snapshot) => {
    const complaintsCountEl = document.getElementById('complaintsCount');
    if (complaintsCountEl) {
      complaintsCountEl.textContent = snapshot.size;
    }
  }, (error) => {
    console.error('Error loading complaints:', error);
  });
}

// Load SOS count (optional)
function loadSOS() {
  const sosRef = collection(db, 'sos');
  const activeSOSQuery = query(sosRef, where('status', '==', 'active'));
  
  onSnapshot(activeSOSQuery, (snapshot) => {
    const sosCountEl = document.getElementById('sosCount');
    if (sosCountEl) {
      sosCountEl.textContent = snapshot.size;
    }
  }, (error) => {
    console.error('Error loading SOS:', error);
  });
}

// Initialize Dashboard
function initDashboard() {
  // Check authentication first
  const admin = checkAuth();
  if (!admin) return;
  
  // Start real-time listeners
  console.log('Starting real-time bus status listener...');
  startBusStatusListener();
  
  // Load other data
  loadPendingApprovals();
  
  // Optionally load complaints and SOS if collections exist
  // loadComplaints();
  // loadSOS();
}

// Start the dashboard when page loads
document.addEventListener('DOMContentLoaded', initDashboard);