// createbus.js - Bulk Bus Management System with Persistence

import { initializeApp, getApp, deleteApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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

// Initialize Main Firebase App (For Admin)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global Variables
let busRows = [];
let rowCounter = 0;
let currentPasswordRowId = null;
let adminProfile = null;

// DOM Elements
const busTableBody = document.getElementById('busTableBody');
const addRowBtn = document.getElementById('addRowBtn');
const saveAllBtn = document.getElementById('saveAllBtn');
const emptyState = document.getElementById('emptyState');
const adminPasswordModal = document.getElementById('adminPasswordModal');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const successModal = document.getElementById('successModal');
const totalCount = document.getElementById('totalCount');
const pendingCount = document.getElementById('pendingCount');
const adminNameEl = document.getElementById('adminName');
const modalError = document.getElementById('modalError');

// Check Admin Authentication
function checkAuth() {
  const profile = sessionStorage.getItem('adminProfile');
  if (!profile) {
    window.location.href = "../login/login.html";
    return null;
  }
  
  try {
    adminProfile = JSON.parse(profile);
    if (adminNameEl && adminProfile.uid) {
      // Just display a generic Admin label or fetch name if available
      adminNameEl.textContent = "ADMIN"; 
    }
    return adminProfile;
  } catch (err) {
    console.error('Error parsing admin profile:', err);
    window.location.href = "../login/login.html";
    return null;
  }
}

// Generate random 8-character password
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Load existing buses from Firestore
async function loadExistingBuses() {
  try {
    const busesSnapshot = await getDocs(collection(db, 'buses'));
    
    busesSnapshot.forEach((docSnap) => {
      const busData = docSnap.data();
      rowCounter++;
      
      const row = {
        id: rowCounter,
        busId: busData.busId || docSnap.id,
        password: '********', // Display placeholder
        actualPassword: busData.busPassword || '********', // Store actual password from Firestore
        isPasswordVisible: false,
        isSaved: true, // Mark as already saved
        createdAt: busData.createdAt,
        conductorUid: busData.conductorUid
      };
      
      busRows.push(row);
    });
    
    // Sort by creation date (newest first)
    busRows.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });
    
    renderTable();
    updateStats();
    
  } catch (error) {
    console.error('Error loading buses:', error);
  }
}

// Add new row
function addRow() {
  rowCounter++;
  const row = {
    id: rowCounter,
    busId: '',
    password: generatePassword(),
    isPasswordVisible: false,
    isSaved: false
  };
  
  busRows.push(row);
  renderTable();
  updateStats();
}

// Remove row
function removeRow(id) {
  busRows = busRows.filter(row => row.id !== id);
  renderTable();
  updateStats();
}

// Edit bus ID
function editBusId(id, value) {
  const row = busRows.find(r => r.id === id);
  if (row) {
    row.busId = value.trim().toUpperCase();
    updateStats();
  }
}

// Edit password
function editPassword(id, value) {
  const row = busRows.find(r => r.id === id);
  if (row) {
    row.password = value;
  }
}

// Generate new password for a row
function generateNewPassword(id) {
  const row = busRows.find(r => r.id === id);
  if (row) {
    row.password = generatePassword();
    renderTable();
  }
}

// Show password with admin verification
function showPassword(id) {
  currentPasswordRowId = id;
  adminPasswordModal.style.display = 'flex';
  adminPasswordInput.value = '';
  modalError.textContent = '';
  adminPasswordInput.focus();
}

// Close admin modal
window.closeAdminModal = function() {
  adminPasswordModal.style.display = 'none';
  currentPasswordRowId = null;
};

// --- UPDATED: Verify admin password (Matches login.js logic) ---
window.verifyAdminPassword = async function() {
  const enteredPassword = adminPasswordInput.value;
  
  if (!enteredPassword) {
    modalError.textContent = 'Please enter admin password';
    return;
  }

  const user = auth.currentUser;
  
  if (!user || !user.email) {
    modalError.textContent = 'Session lost. Please refresh.';
    return;
  }
  
  modalError.style.color = 'orange';
  modalError.textContent = 'Verifying...';

  try {
    // 1. Re-authenticate using Firebase Auth (Secure check)
    await signInWithEmailAndPassword(auth, user.email, enteredPassword);
    
    // 2. Double check Admin Role (Extra security)
    const adminDoc = await getDoc(doc(db, 'admins', user.uid));
    
    if (!adminDoc.exists()) {
       modalError.style.color = 'red';
       modalError.textContent = 'Admin account verification failed.';
       return;
    }
    
    // 3. Success - Show the bus password
    const row = busRows.find(r => r.id === currentPasswordRowId);
    if (row) {
      row.isPasswordVisible = true;
      renderTable();
    }
    
    closeAdminModal();
    
  } catch (error) {
    console.error('Error verifying admin password:', error);
    modalError.style.color = 'red';
    
    if (error.code === 'auth/wrong-password') {
        modalError.textContent = 'Incorrect admin password';
    } else {
        modalError.textContent = 'Verification failed. Try again.';
    }
  }
};

// Hide password
function hidePassword(id) {
  const row = busRows.find(r => r.id === id);
  if (row) {
    row.isPasswordVisible = false;
    renderTable();
  }
}

// Render table
function renderTable() {
  if (busRows.length === 0) {
    busTableBody.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }
  
  emptyState.style.display = 'none';
  
  busTableBody.innerHTML = busRows.map((row, index) => `
    <tr class="${row.isSaved ? 'saved-row' : ''}">
      <td>${index + 1}</td>
      <td>
        <input 
          type="text" 
          class="table-input ${!row.busId ? 'error' : ''}" 
          placeholder="e.g., PB088" 
          value="${row.busId}"
          onInput="editBusId(${row.id}, this.value)"
          ${row.isSaved ? 'disabled' : ''}
        />
      </td>
      <td>
        <div class="password-cell">
          <input 
            type="${row.isPasswordVisible ? 'text' : 'password'}" 
            class="table-input password-input" 
            value="${row.isPasswordVisible ? (row.actualPassword || row.password) : row.password}"
            onInput="editPassword(${row.id}, this.value)"
            ${row.isSaved ? 'disabled' : ''}
          />
          ${row.isSaved ? '' : `
            <div class="password-actions">
              <button class="icon-btn" onclick="generateNewPassword(${row.id})" title="Generate New">
                🔄
              </button>
            </div>
          `}
        </div>
      </td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${row.isPasswordVisible ? `
            <button class="icon-btn" onclick="hidePassword(${row.id})" title="Hide Password">
              👁️ Hide
            </button>
          ` : `
            <button class="icon-btn" onclick="showPassword(${row.id})" title="Show Password">
              👁️‍🗨️ Show
            </button>
          `}
          ${row.isSaved ? `
            <span class="status-badge saved">✓ Saved</span>
          ` : `
            <button class="btn-danger-sm" onclick="removeRow(${row.id})">
              🗑️ Remove
            </button>
          `}
        </div>
      </td>
      <td>
        ${row.isSaved ? 
          '<span class="status-dot success"></span>' : 
          '<span class="status-dot pending"></span>'
        }
      </td>
    </tr>
  `).join('');
  
  // Re-attach functions to window for onclick
  window.editBusId = editBusId;
  window.editPassword = editPassword;
  window.generateNewPassword = generateNewPassword;
  window.showPassword = showPassword;
  window.hidePassword = hidePassword;
  window.removeRow = removeRow;
}

// Update stats
function updateStats() {
  totalCount.textContent = busRows.length;
  const pending = busRows.filter(r => !r.isSaved).length;
  pendingCount.textContent = pending;
}

// --- UPDATED: Save all buses (Uses Secondary App to prevent Admin Logout) ---
async function saveAll() {
  const unsavedRows = busRows.filter(r => !r.isSaved);
  
  if (unsavedRows.length === 0) {
    alert('No new buses to save!');
    return;
  }
  
  const invalidRows = unsavedRows.filter(r => !r.busId || r.busId.length < 2);
  if (invalidRows.length > 0) {
    alert('Please fill in all Bus IDs before saving!');
    return;
  }
  
  saveAllBtn.disabled = true;
  saveAllBtn.innerHTML = '⏳ Saving...';
  
  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  
  // Initialize Secondary App for creating users without logging out admin
  let secondaryApp;
  let secondaryAuth;
  
  try {
      secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
      secondaryAuth = getAuth(secondaryApp);
  } catch (err) {
      // If app already exists, retrieve it
      secondaryApp = getApp("SecondaryApp");
      secondaryAuth = getAuth(secondaryApp);
  }

  for (const row of unsavedRows) {
    try {
      const busId = row.busId;
      const password = row.password;
      
      const busRef = doc(db, 'buses', busId);
      const busSnap = await getDoc(busRef);
      
      if (busSnap.exists()) {
        errors.push(`${busId}: Already exists`);
        errorCount++;
        continue;
      }
      
      const email = `${busId.toLowerCase()}@locobus.com`;
      
      // Create User on Secondary Auth (Keeps main Admin logged in)
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const conductorUid = userCredential.user.uid;
      
      // Create Firestore document (Using main db is fine)
      await setDoc(busRef, {
        busId: busId,
        loginEmail: email,
        conductorUid: conductorUid,
        busPassword: password,
        isProfileComplete: false,
        createdAt: new Date().toISOString(),
        createdBy: adminProfile.uid || 'Admin'
      });
      
      row.isSaved = true;
      row.actualPassword = password;
      row.password = '********';
      row.isPasswordVisible = false;
      successCount++;
      
    } catch (error) {
      console.error(`Error creating bus ${row.busId}:`, error);
      errors.push(`${row.busId}: ${error.message}`);
      errorCount++;
    }
  }
  
  // Clean up secondary app
  if (secondaryAuth) {
      await secondaryAuth.signOut();
  }
  // Note: We don't deleteApp immediately to avoid async issues, but we signed out.

  let message = `✅ Successfully created ${successCount} bus(es)`;
  if (errorCount > 0) {
    message += `\n❌ Failed: ${errorCount} bus(es)\n\n${errors.join('\n')}`;
  }
  
  document.getElementById('successMessage').textContent = message;
  successModal.style.display = 'flex';
  
  renderTable();
  updateStats();
  
  saveAllBtn.disabled = false;
  saveAllBtn.innerHTML = '💾 Save All';
}

// Close success modal
window.closeSuccessModal = function() {
  successModal.style.display = 'none';
};

// Event Listeners
addRowBtn.addEventListener('click', addRow);
saveAllBtn.addEventListener('click', saveAll);

// Allow Enter key in admin password modal
adminPasswordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    verifyAdminPassword();
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  if (checkAuth()) {
    await loadExistingBuses();
  }
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
      path: '../index/Bus_carga_trackMile.json' 
    });
  }
});