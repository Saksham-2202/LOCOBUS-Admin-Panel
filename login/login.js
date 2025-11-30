// login.js - Firestore Admin Verification (No Firebase Auth)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
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

  // Get DOM elements
  const adminIdEl = document.getElementById('adminId');
  const passEl = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const errMsg = document.getElementById('errMsg');

  // Helper functions for error messages
  function showError(msg) {
    errMsg.textContent = msg;
    errMsg.style.color = '#ef4444';
  }

  function showSuccess(msg) {
    errMsg.textContent = msg;
    errMsg.style.color = '#10b981';
  }

  function clearError() {
    errMsg.textContent = '';
  }

  // Check if already logged in
  const loggedInAdmin = sessionStorage.getItem('adminProfile');
  if (loggedInAdmin) {
    window.location.href = "../index/index.html";
  }

  // Login button click handler
  loginBtn.addEventListener('click', async () => {
    await handleLogin();
  });

  // Allow Enter key to submit
  passEl.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      await handleLogin();
    }
  });

  adminIdEl.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      await handleLogin();
    }
  });

  // Main login function
  async function handleLogin() {
    clearError();
    const adminId = adminIdEl.value.trim();
    const password = passEl.value;

    // Validation
    if (!adminId || !password) {
      showError('Please enter Admin ID and Password.');
      return;
    }

    // Disable button during login
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';

    try {
      // Query Firestore for matching adminId
      const adminsRef = collection(db, 'admins');
      const q = query(adminsRef, where('adminId', '==', adminId));
      const querySnapshot = await getDocs(q);

      // Check if admin exists
      if (querySnapshot.empty) {
        showError('Invalid Admin ID or Password.');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign in';
        return;
      }

      // Get the first matching document
      let adminFound = false;
      let adminData = null;
      let docId = null;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Compare password (plain text for now)
        if (data.password === password) {
          adminFound = true;
          adminData = data;
          docId = doc.id;
        }
      });

      if (!adminFound) {
        showError('Invalid Admin ID or Password.');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign in';
        return;
      }

      // Login successful
      showSuccess('Login successful! Redirecting...');

      // Store admin info in session
      sessionStorage.setItem('adminProfile', JSON.stringify({
        docId: docId,
        adminId: adminData.adminId,
        loginTime: new Date().toISOString()
      }));

      // Redirect to dashboard after short delay
      setTimeout(() => {
        window.location.href = "../index/index.html";
      }, 1000);

    } catch (err) {
      console.error('Login error:', err);
      showError('Login failed. Please try again.');
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign in';
    }
  }
});