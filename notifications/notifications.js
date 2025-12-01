/* notifications.js - Firebase Integration */

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Firebase Configuration (Same as your fleet.js)
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

document.addEventListener('DOMContentLoaded', () => {
  const title = document.getElementById('ntTitle');
  const message = document.getElementById('ntMessage');
  const charCount = document.getElementById('charCount');
  const schedule = document.getElementById('ntSchedule');

  const sendNow = document.getElementById('sendNow');
  const scheduleBtn = document.getElementById('scheduleBtn');
  const recentList = document.getElementById('recentList');

  // ---------------- CHAR COUNTER ----------------
  function updateCount() {
    const len = (message.value || '').length;
    charCount.textContent = `${len}/500`;
    charCount.style.color = len > 500 ? "red" : "";
  }
  message.addEventListener('input', updateCount);

  // ---------------- FETCH NOTIFICATIONS (REALTIME) ----------------
  function subscribeToNotifications() {
    const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
      recentList.innerHTML = '';
      
      if (snapshot.empty) {
        recentList.innerHTML = `<div style="padding:20px; text-align:center; color:#999;">No recent notifications</div>`;
        return;
      }

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const dateObj = data.createdAt ? data.createdAt.toDate() : new Date();
        const dateStr = dateObj.toLocaleString();
        
        // Render item
        const item = document.createElement('div');
        item.className = 'recent-item';
        
        // Metadata for modal
        item.dataset.message = data.message || '';
        item.dataset.title = data.title || '';
        item.dataset.date = dateStr;
        item.dataset.status = data.status || 'sent';

        item.innerHTML = `
          <div>
            <div class="r-title">${data.title}</div>
            <div class="r-meta">All Conductors • ${dateStr}</div>
          </div>
          <div class="r-badges">
            <span class="pill ${data.status === 'sent' ? 'sent' : 'scheduled'}">
              ${data.status === 'sent' ? 'Sent' : 'Scheduled'}
            </span>
            <a class="view-detail" href="#">View Details</a>
          </div>
        `;

        // view details click → open modal
        item.querySelector(".view-detail").addEventListener("click", (e) => {
          e.preventDefault();
          openNotifDetails(item);
        });

        recentList.appendChild(item);
      });
    });
  }

  // ---------------- VALIDATION ----------------
  function validate() {
    if (!title.value.trim()) { alert('Enter title'); return false; }
    if (!message.value.trim()) { alert('Enter message content'); return false; }
    if (message.value.length > 500) { alert('Message too long'); return false; }
    return true;
  }

  // ---------------- SEND TO FIREBASE ----------------
  async function saveNotification(status, scheduledFor = null) {
    if (!validate()) return;

    try {
      const btn = status === 'sent' ? sendNow : scheduleBtn;
      const originalText = btn.textContent;
      btn.textContent = 'Sending...';
      btn.disabled = true;

      // Add to Firestore "notifications" collection
      await addDoc(collection(db, "notifications"), {
        title: title.value.trim(),
        message: message.value.trim(),
        target: "all_conductors", // Automatically targeting all conductors
        status: status, // 'sent' or 'scheduled'
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        createdAt: serverTimestamp()
      });

      // Clear form
      title.value = "";
      message.value = "";
      schedule.value = "";
      updateCount();
      
      btn.textContent = originalText;
      btn.disabled = false;
      alert(status === 'sent' ? 'Notification Sent!' : 'Notification Scheduled!');

    } catch (error) {
      console.error("Error adding notification: ", error);
      alert("Error sending notification. Check console.");
    }
  }

  // Event Listeners
  sendNow.addEventListener('click', () => saveNotification('sent'));
  
  scheduleBtn.addEventListener('click', () => {
    if (!schedule.value) {
      alert("Please select a date and time to schedule.");
      return;
    }
    saveNotification('scheduled', schedule.value);
  });

  // Start Listener
  subscribeToNotifications();


  // ============================================================
  // MODAL LOGIC
  // ============================================================
  const notifOverlay = document.getElementById("notifModalOverlay");
  const notifClose = document.getElementById("notifClose");

  const nmTitle = document.getElementById("nmTitle");
  const nmMessage = document.getElementById("nmMessage");
  const nmAudience = document.getElementById("nmAudience");
  const nmStatus = document.getElementById("nmStatus");
  const nmDate = document.getElementById("nmDate");

  function openNotifDetails(item) {
    nmTitle.textContent = item.dataset.title;
    nmMessage.textContent = item.dataset.message;
    nmAudience.textContent = "All Conductors"; // Hardcoded logic
    nmDate.textContent = item.dataset.date;
    
    const status = item.dataset.status;
    nmStatus.innerHTML = status === "sent"
        ? '<span class="pill-sent">Sent</span>'
        : '<span class="pill-scheduled">Scheduled</span>';

    notifOverlay.style.display = "flex";
  }

  function closeModal() {
    notifOverlay.style.display = "none";
  }

  notifClose.addEventListener("click", closeModal);
  notifOverlay.addEventListener("click", (e) => {
    if (e.target === notifOverlay) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
});