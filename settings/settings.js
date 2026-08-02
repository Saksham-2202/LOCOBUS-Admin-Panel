// settings.js

// 1. Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// 2. Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCRtx7Oyda48Hz0eu-BiNrGYiK3_36Vl-c",
  authDomain: "locobus-e4274.firebaseapp.com",
  databaseURL: "https://locobus-e4274-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "locobus-e4274",
  storageBucket: "locobus-e4274.firebasestorage.app",
  messagingSenderId: "296482389648",
  appId: "1:296482389648:web:1827bd92dc55c8a857e215"
};

// 3. Initialize
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
  console.log("Settings page loaded");

  // --- Session Check ---
  // const session = sessionStorage.getItem('adminProfile');
  // if (!session) {
  //   console.error("No admin session found.");
  //   window.location.href = "../login/login.html"; 
  //   return;
  // }
  
  const adminProfile = JSON.parse(session);
  console.log("Current Admin ID:", adminProfile.adminId);
  // Important: Ensure your login logic saves 'docId' (the generic key like Zlrh3...) 
  // into sessionStorage. If undefined, we can't find the doc.
  
  // --- UI Elements ---
  const updatePasswordBtn = document.getElementById('updatePasswordBtn');
  const pwdMsg = document.getElementById('pwdMsg');
  const currentPassEl = document.getElementById('currentPassword');
  const newPassEl = document.getElementById('newPassword');
  const confirmPassEl = document.getElementById('confirmPassword');

  // Other Settings Elements
  const twofaToggle = document.getElementById('twofaToggle');
  const twofaStatus = document.getElementById('twofaStatus');
  const maxSpeed = document.getElementById('maxSpeed');
  const delayTol = document.getElementById('delayTol');
  const geofenceTol = document.getElementById('geofenceTol');
  const gpsFreq = document.getElementById('gpsFreq');
  const dataRetention = document.getElementById('dataRetention');
  const minAppVersion = document.getElementById('minAppVersion');
  const saveSystemBtn = document.getElementById('saveSystemBtn');

  // --- Load Demo State for Non-Password Settings ---
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem('settings_demo') || '{}');
      if (s.maxSpeed) maxSpeed.value = s.maxSpeed;
      if (s.delayTol) delayTol.value = s.delayTol;
      if (s.geofenceTol) geofenceTol.value = s.geofenceTol;
      if (s.gpsFreq) gpsFreq.value = s.gpsFreq;
      if (s.dataRetention) dataRetention.value = s.dataRetention;
      if (s.minAppVersion) minAppVersion.value = s.minAppVersion;
      if (s.twofaEnabled !== undefined) {
        twofaToggle.checked = s.twofaEnabled;
        twofaStatus.textContent = s.twofaEnabled ? 'Enabled' : 'Disabled';
        twofaStatus.className = s.twofaEnabled ? 'pill-sent' : 'pill-scheduled';
      }
    } catch (err) { console.warn('load state err', err); }
  }
  loadState();

  // --- PASSWORD UPDATE LOGIC ---
  updatePasswordBtn.addEventListener('click', async () => {
    console.log("Update button clicked");
    
    const currentPwd = currentPassEl.value;
    const newPwd = newPassEl.value;
    const confirmPwd = confirmPassEl.value;

    // Reset Message
    pwdMsg.textContent = '';
    
    // Validation
    if (!currentPwd || !newPwd || !confirmPwd) {
      pwdMsg.textContent = 'Please fill all password fields.';
      pwdMsg.style.color = '#ef4444';
      return;
    }

    if (newPwd !== confirmPwd) {
      pwdMsg.textContent = 'New passwords do not match.';
      pwdMsg.style.color = '#ef4444';
      return;
    }

    // Check for Doc ID
    if (!adminProfile.docId) {
      pwdMsg.textContent = 'Error: Missing Document ID. Please logout and login again.';
      pwdMsg.style.color = '#ef4444';
      return;
    }

    // UI Loading
    updatePasswordBtn.disabled = true;
    updatePasswordBtn.textContent = 'Verifying...';

    try {
      // 1. Get the admin document from Firestore
      const adminRef = doc(db, 'admins', adminProfile.docId);
      const docSnap = await getDoc(adminRef);

      if (!docSnap.exists()) {
        throw new Error("Admin document does not exist in Firestore.");
      }

      const adminData = docSnap.data();
      console.log("Firestore Data fetched");

      // 2. Check current password
      // Note: Comparing plain text as per your screenshot
      if (String(adminData.password) !== String(currentPwd)) {
        pwdMsg.textContent = 'Current password is incorrect.';
        pwdMsg.style.color = '#ef4444';
        updatePasswordBtn.disabled = false;
        updatePasswordBtn.textContent = 'Update Password';
        return;
      }

      // 3. Update password
      updatePasswordBtn.textContent = 'Saving...';
      await updateDoc(adminRef, {
        password: newPwd
      });

      // 4. Success
      console.log("Password updated successfully");
      pwdMsg.textContent = 'Password updated successfully!';
      pwdMsg.style.color = '#16a34a';

      // Clear fields
      currentPassEl.value = '';
      newPassEl.value = '';
      confirmPassEl.value = '';

      // Update session storage if needed (optional)
      adminProfile.password = newPwd; // Not strictly necessary unless you use it elsewhere
      
    } catch (error) {
      console.error("Update failed:", error);
      pwdMsg.textContent = 'Update failed: ' + error.message;
      pwdMsg.style.color = '#ef4444';
    } finally {
      updatePasswordBtn.disabled = false;
      updatePasswordBtn.textContent = 'Update Password';
    }
  });

  // --- Other Demo Logic (Preserved) ---
  twofaToggle.addEventListener('change', () => {
    const enabled = twofaToggle.checked;
    twofaStatus.textContent = enabled ? 'Enabled' : 'Disabled';
    twofaStatus.className = enabled ? 'pill-sent' : 'pill-scheduled';
    saveDemoState();
  });

  saveSystemBtn.addEventListener('click', () => {
    saveDemoState();
    saveSystemBtn.textContent = 'Saved ✓';
    saveSystemBtn.disabled = true;
    setTimeout(() => {
      saveSystemBtn.textContent = 'Save System Configuration';
      saveSystemBtn.disabled = false;
    }, 1200);
  });

  function saveDemoState() {
    const s = {
      maxSpeed: maxSpeed.value,
      delayTol: delayTol.value,
      geofenceTol: geofenceTol.value,
      gpsFreq: gpsFreq.value,
      dataRetention: dataRetention.value,
      minAppVersion: minAppVersion.value,
      twofaEnabled: twofaToggle.checked
    };
    localStorage.setItem('settings_demo', JSON.stringify(s));
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
      path: '../index/Bus_carga_trackMile.json'  // <-- put your real path here
    });
  }
});
