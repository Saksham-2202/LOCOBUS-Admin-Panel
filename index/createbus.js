// createBus.js - Admin Creates Firebase Auth Account + Firestore Document

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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

// DOM Elements
const form = document.getElementById('createBusForm');
const messageBox = document.getElementById('messageBox');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');
const previewCard = document.getElementById('previewCard');
const adminNameEl = document.getElementById('adminName');

// Check Admin Authentication
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

// Show message
function showMessage(message, type = 'error') {
  messageBox.textContent = message;
  messageBox.className = `message-box ${type}`;
  messageBox.style.display = 'block';
  
  if (type === 'success') {
    setTimeout(() => {
      messageBox.style.display = 'none';
    }, 5000);
  }
}

// Hide message
function hideMessage() {
  messageBox.style.display = 'none';
}

// Loading state
function setLoading(loading) {
  submitBtn.disabled = loading;
  if (loading) {
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
  } else {
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
  }
}

// Form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessage();
  
  // Get form values
  const busId = document.getElementById('busId').value.trim().toUpperCase();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  // Validation
  if (!busId || !password || !confirmPassword) {
    showMessage('Please fill in all required fields.', 'error');
    return;
  }
  
  if (password !== confirmPassword) {
    showMessage('Passwords do not match!', 'error');
    return;
  }
  
  if (password.length < 6) {
    showMessage('Password must be at least 6 characters long.', 'error');
    return;
  }
  
  setLoading(true);
  
  try {
    // Step 1: Check if bus ID already exists
    const busRef = doc(db, 'buses', busId);
    const busSnap = await getDoc(busRef);
    
    if (busSnap.exists()) {
      showMessage(`Bus ID "${busId}" already exists! Please use a different ID.`, 'error');
      setLoading(false);
      return;
    }
    
    // Step 2: Generate email from Bus ID
    const email = `${busId.toLowerCase()}@locobus.com`;
    
    // Step 3: Create Firebase Authentication account
    let conductorUid = null;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      conductorUid = userCredential.user.uid;
      console.log('Firebase Auth account created with UID:', conductorUid);
      
      // Sign out the newly created account immediately (so admin stays logged in)
      await auth.signOut();
    } catch (authError) {
      if (authError.code === 'auth/email-already-in-use') {
        showMessage('This Bus ID is already registered. Please use a different ID.', 'error');
      } else {
        showMessage(`Authentication error: ${authError.message}`, 'error');
      }
      setLoading(false);
      return;
    }
    
    // Step 4: Create Firestore document with conductorUid
    const busData = {
      busId: busId,
      loginEmail: email,
      conductorUid: conductorUid, // ✅ THIS IS THE KEY!
      isProfileComplete: false,
      createdAt: new Date().toISOString(),
      createdBy: adminNameEl.textContent || 'Admin'
    };
    
    await setDoc(busRef, busData);
    console.log('Bus document created with conductorUid');
    
    // Show success message
    showMessage('Bus credentials created successfully!', 'success');
    
    // Display preview card
    document.getElementById('previewBusId').textContent = busId;
    document.getElementById('previewPassword').textContent = password;
    
    // Add generated email to preview
    const emailPreview = document.createElement('div');
    emailPreview.className = 'credential-box';
    emailPreview.innerHTML = `
      <p class="label">Generated Email (for Firebase Auth):</p>
      <p class="value" style="font-size: 14px;">${email}</p>
    `;
    document.querySelector('.preview-content').insertBefore(
      emailPreview, 
      document.querySelector('.preview-content .warning')
    );
    
    // Hide form, show preview
    document.querySelector('.form-card').style.display = 'none';
    previewCard.style.display = 'block';
    
    setLoading(false);
    
  } catch (error) {
    console.error('Error creating bus credentials:', error);
    showMessage(`Error: ${error.message}`, 'error');
    setLoading(false);
  }
});

// Password match validation
document.getElementById('confirmPassword').addEventListener('input', function() {
  const password = document.getElementById('password').value;
  const confirmPassword = this.value;
  
  if (confirmPassword && password !== confirmPassword) {
    this.setCustomValidity('Passwords do not match');
  } else {
    this.setCustomValidity('');
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});