/* notifications.js - Full Code with Delete Functionality */

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, where, deleteDoc, doc, Timestamp, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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

document.addEventListener('DOMContentLoaded', () => {
  const title = document.getElementById('ntTitle');
  const message = document.getElementById('ntMessage');
  const charCount = document.getElementById('charCount');
  const schedule = document.getElementById('ntSchedule');
  const targetInfo = document.getElementById('targetInfo');
  const targetText = document.getElementById('targetText');

  const sendNow = document.getElementById('sendNow');
  const scheduleBtn = document.getElementById('scheduleBtn');
  const recentList = document.getElementById('recentList');

  const targetRadios = document.querySelectorAll('input[name="target"]');
  const filterTabs = document.querySelectorAll('.filter-tab');

  let currentFilter = 'all';

  // ---------------- TARGET SELECTION ----------------
  targetRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const target = e.target.value;
      if (target === 'conductors') {
        targetText.textContent = 'All Active Conductors';
        targetInfo.classList.remove('users');
      } else {
        targetText.textContent = 'All App Users';
        targetInfo.classList.add('users');
      }
    });
  });

  // ---------------- FILTER TABS ----------------
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      subscribeToNotifications();
    });
  });

  // ---------------- CHAR COUNTER ----------------
  function updateCount() {
    const len = (message.value || '').length;
    charCount.textContent = `${len}/500`;
    charCount.style.color = len > 500 ? "red" : "";
  }
  message.addEventListener('input', updateCount);

  // ---------------- GET SELECTED TARGET ----------------
  function getSelectedTarget() {
    const selected = document.querySelector('input[name="target"]:checked');
    return selected ? selected.value : 'conductors';
  }

  // ---------------- FETCH NOTIFICATIONS (REALTIME WITH FILTER) ----------------
  function subscribeToNotifications() {
    let q;
    
    if (currentFilter === 'all') {
      // Fetch from both collections
      fetchBothCollections();
      return;
    }
    
    // Fetch from specific collection
    const collectionName = currentFilter === 'conductors' ? 'notifications' : 'user_notifications';
    q = query(collection(db, collectionName), orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
      displayNotifications(snapshot, currentFilter);
    });
  }

  function fetchBothCollections() {
    const notifications = [];

    const qConductors = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
    const qUsers = query(collection(db, "user_notifications"), orderBy("createdAt", "desc"));

    onSnapshot(qConductors, (snapshot) => {
      const conductorNotifs = [];
      snapshot.forEach((docSnap) => {
        conductorNotifs.push({
          id: docSnap.id,
          data: docSnap.data(),
          target: 'conductors'
        });
      });
      
      // Merge and sort
      const allNotifs = [...conductorNotifs];
      
      // Get user notifications too
      onSnapshot(qUsers, (userSnapshot) => {
        // We clear this array to avoid duplicating user notifications on conductor updates
        // In a real app, merging streams is cleaner with RxJS, but here we rebuild the list
        // Note: This logic is simplified; iterating both snapshots ensures fresh data.
        
        const userNotifs = [];
        userSnapshot.forEach((docSnap) => {
          userNotifs.push({
            id: docSnap.id,
            data: docSnap.data(),
            target: 'users'
          });
        });

        // Combine
        const combined = [...conductorNotifs, ...userNotifs];
        
        // Sort by createdAt
        combined.sort((a, b) => {
          const timeA = a.data.createdAt ? a.data.createdAt.toMillis() : 0;
          const timeB = b.data.createdAt ? b.data.createdAt.toMillis() : 0;
          return timeB - timeA;
        });
        
        displayCombinedNotifications(combined);
      });
    });
  }

  // ---------------- DISPLAY & RENDER LOGIC ----------------

  function displayCombinedNotifications(notifs) {
    recentList.innerHTML = '';
    
    if (notifs.length === 0) {
      recentList.innerHTML = `<div style="padding:20px; text-align:center; color:#999;">No recent notifications</div>`;
      return;
    }

    notifs.forEach((item) => {
      // Determine collection based on target
      const collectionName = item.target === 'conductors' ? 'notifications' : 'user_notifications';
      renderNotificationItem(item.id, item.data, item.target, collectionName);
    });
  }

  function displayNotifications(snapshot, targetType) {
    recentList.innerHTML = '';
    
    if (snapshot.empty) {
      recentList.innerHTML = `<div style="padding:20px; text-align:center; color:#999;">No recent notifications</div>`;
      return;
    }

    // Determine collection based on current filter
    const collectionName = targetType === 'conductors' ? 'notifications' : 'user_notifications';

    snapshot.forEach((docSnap) => {
      renderNotificationItem(docSnap.id, docSnap.data(), targetType, collectionName);
    });
  }

  // Helper function to render HTML for a single item (Avoids code duplication)
  function renderNotificationItem(docId, data, targetType, collectionName) {
    const dateObj = data.createdAt ? data.createdAt.toDate() : new Date();
    const expiryObj = data.expiresAt ? data.expiresAt.toDate() : null;
    const dateStr = dateObj.toLocaleString();
    const expiryStr = expiryObj ? expiryObj.toLocaleString() : 'N/A';
    
    const targetLabel = targetType === 'conductors' ? 'Conductors' : 'Users';
    
    const itemEl = document.createElement('div');
    itemEl.className = 'recent-item';
    
    // Metadata for modal
    itemEl.dataset.title = data.title || '';
    itemEl.dataset.message = data.message || '';
    itemEl.dataset.date = dateStr;
    itemEl.dataset.expiry = expiryStr;
    itemEl.dataset.status = data.status || 'sent';
    itemEl.dataset.target = targetLabel;

    itemEl.innerHTML = `
      <div>
        <div class="r-title">${data.title}</div>
        <div class="r-meta">${targetLabel} • ${dateStr}</div>
      </div>
      <div class="r-badges">
        <span class="pill ${targetType}">${targetLabel}</span>
        <span class="pill ${data.status === 'sent' ? 'sent' : 'scheduled'}">
          ${data.status === 'sent' ? 'Sent' : 'Scheduled'}
        </span>
        <div class="action-row">
          <a class="view-detail" href="#">View Details</a>
          <button class="btn-delete" title="Delete Permanently">🗑️</button>
        </div>
      </div>
    `;

    // View Details Listener
    itemEl.querySelector(".view-detail").addEventListener("click", (e) => {
      e.preventDefault();
      openNotifDetails(itemEl);
    });

    // DELETE BUTTON LISTENER
    itemEl.querySelector(".btn-delete").addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent bubbling to card click if added later
      deleteNotification(docId, collectionName);
    });

    recentList.appendChild(itemEl);
  }

  // ---------------- DELETE LOGIC ----------------
  
  async function deleteNotification(docId, collectionName) {
    const confirmDelete = confirm("Are you sure you want to PERMANENTLY delete this notification? This will remove it from all devices.");
    
    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, collectionName, docId));
        // The onSnapshot listener will automatically refresh the UI
        alert("Notification deleted successfully.");
      } catch (error) {
        console.error("Error deleting document: ", error);
        alert("Error deleting notification: " + error.message);
      }
    }
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

      const target = getSelectedTarget();
      const collectionName = target === 'conductors' ? 'notifications' : 'user_notifications';
      
      // Calculate expiry time (24 hours from now)
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Add to appropriate Firestore collection
      await addDoc(collection(db, collectionName), {
        title: title.value.trim(),
        message: message.value.trim(),
        target: target === 'conductors' ? "all_conductors" : "all_users",
        status: status,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt)
      });

      // Clear form
      title.value = "";
      message.value = "";
      schedule.value = "";
      updateCount();
      
      btn.textContent = originalText;
      btn.disabled = false;
      
      const targetLabel = target === 'conductors' ? 'Conductors' : 'Users';
      alert(`Notification ${status === 'sent' ? 'Sent' : 'Scheduled'} to ${targetLabel}!`);

    } catch (error) {
      console.error("Error adding notification: ", error);
      alert("Error sending notification. Check console.");
      sendNow.textContent = "Send Notification Now";
      scheduleBtn.textContent = "Schedule Notification";
      sendNow.disabled = false;
      scheduleBtn.disabled = false;
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

  // ---------------- AUTO-DELETE OLD NOTIFICATIONS ----------------
  function setupAutoDelete() {
    // Check every 5 minutes for expired notifications
    setInterval(async () => {
      const now = new Date();
      
      // Check conductor notifications
      const qConductors = query(
        collection(db, "notifications"),
        where("expiresAt", "<=", Timestamp.fromDate(now))
      );
      
      const snapshotConductors = await getDocs(qConductors);
      snapshotConductors.forEach(async (docSnap) => {
        await deleteDoc(doc(db, "notifications", docSnap.id));
        console.log(`Deleted expired conductor notification: ${docSnap.id}`);
      });
      
      // Check user notifications
      const qUsers = query(
        collection(db, "user_notifications"),
        where("expiresAt", "<=", Timestamp.fromDate(now))
      );
      
      const snapshotUsers = await getDocs(qUsers);
      snapshotUsers.forEach(async (docSnap) => {
        await deleteDoc(doc(db, "user_notifications", docSnap.id));
        console.log(`Deleted expired user notification: ${docSnap.id}`);
      });
      
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Note: For production, you should use Firebase Cloud Functions for auto-deletion
  // This client-side approach is a fallback
  setupAutoDelete();

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
  const nmExpiry = document.getElementById("nmExpiry");

  function openNotifDetails(item) {
    nmTitle.textContent = item.dataset.title;
    nmMessage.textContent = item.dataset.message;
    nmAudience.textContent = item.dataset.target;
    nmDate.textContent = item.dataset.date;
    nmExpiry.textContent = item.dataset.expiry;
    
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