// createbus.js - Bulk Bus Management System with Persistence

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
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

// Initialize Firebase
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
    if (adminNameEl && adminProfile.adminId) {
      adminNameEl.textContent = adminProfile.adminId.toUpperCase();
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
      
      console.log('Loading bus:', busData.busId, 'Password:', busData.busPassword); // Debug log
      
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
    
    console.log('Loaded buses:', busRows); // Debug log
    
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

// Verify admin password
window.verifyAdminPassword = async function() {
  const enteredPassword = adminPasswordInput.value;
  
  if (!enteredPassword) {
    modalError.textContent = 'Please enter admin password';
    return;
  }
  
  try {
    // Query admin collection to verify password
    const adminDoc = await getDoc(doc(db, 'admins', adminProfile.docId));
    
    if (!adminDoc.exists()) {
      modalError.textContent = 'Admin account not found';
      return;
    }
    
    const adminData = adminDoc.data();
    if (adminData.password !== enteredPassword) {
      modalError.textContent = 'Incorrect admin password';
      return;
    }
    
    // Password correct - show the bus password
    const row = busRows.find(r => r.id === currentPasswordRowId);
    if (row) {
      row.isPasswordVisible = true;
      // If it's a saved bus with actualPassword, display that
      // If it's a new unsaved bus, display the generated password
      renderTable();
    }
    
    closeAdminModal();
    
  } catch (error) {
    console.error('Error verifying admin password:', error);
    modalError.textContent = 'Verification failed. Please try again.';
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

// Save all buses
async function saveAll() {
  const unsavedRows = busRows.filter(r => !r.isSaved);
  
  if (unsavedRows.length === 0) {
    alert('No new buses to save!');
    return;
  }
  
  // Validate all rows
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
  
  for (const row of unsavedRows) {
    try {
      const busId = row.busId;
      const password = row.password;
      
      // Check if bus already exists
      const busRef = doc(db, 'buses', busId);
      const busSnap = await getDoc(busRef);
      
      if (busSnap.exists()) {
        errors.push(`${busId}: Already exists`);
        errorCount++;
        continue;
      }
      
      // Generate email
      const email = `${busId.toLowerCase()}@locobus.com`;
      
      // Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const conductorUid = userCredential.user.uid;
      
      // Sign out immediately
      await auth.signOut();
      
      // Create Firestore document
      await setDoc(busRef, {
        busId: busId,
        loginEmail: email,
        conductorUid: conductorUid,
        busPassword: password, // Store password in Firestore so we can view it later
        isProfileComplete: false,
        createdAt: new Date().toISOString(),
        createdBy: adminProfile.adminId || 'Admin'
      });
      
      // Mark as saved and store actual password for viewing
      row.isSaved = true;
      row.actualPassword = password; // Keep the actual password for viewing
      row.password = '********'; // Replace display with placeholder
      row.isPasswordVisible = false;
      successCount++;
      
    } catch (error) {
      console.error(`Error creating bus ${row.busId}:`, error);
      errors.push(`${row.busId}: ${error.message}`);
      errorCount++;
    }
  }
  
  // Show results
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
    // Load existing buses first
    await loadExistingBuses();
  }
});