// broadCasts.js - Fixed version without ES6 modules
// Make sure to add Firebase SDK scripts to your HTML first

// ⚠️ IMPORTANT: Add these scripts to your HTML <head> section:
/*
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
*/

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCRtx7Oyda48Hz0eu-BiNrGYiK3_36Vl-c",
  authDomain: "locobus-e4274.firebaseapp.com",
  projectId: "locobus-e4274",
  storageBucket: "locobus-e4274.firebasestorage.app",
  messagingSenderId: "296482389648",
  appId: "1:296482389648:web:1827bd92dc55c8a857e215"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Cloudinary Configuration
const CLOUDINARY_CLOUD_NAME = "deex0vaix"; 
const CLOUDINARY_UPLOAD_PRESET = "ml_default";

document.addEventListener('DOMContentLoaded', () => {
  console.log('Broadcast script loaded');
  
  const uploadModal = document.getElementById('uploadModal');
  const uploadBtn = document.getElementById('uploadBtn');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const chooseImgBtn = document.getElementById('chooseImgBtn');
  const bannerImageInput = document.getElementById('bannerImageInput');
  const previewImg = document.getElementById('previewImg');
  const bannersGrid = document.getElementById('bannersGrid');
  const saveBtn = document.getElementById('saveBannerBtn');

  let isEditing = false;
  let editingDocId = null;

  // Load advertisements from Firestore
  function loadAdvertisements() {
    console.log('Loading advertisements...');
    
    db.collection('advertisements')
      .orderBy('order', 'asc')
      .onSnapshot((snapshot) => {
        bannersGrid.innerHTML = '';
        
        if (snapshot.empty) {
          bannersGrid.innerHTML = `
            <div style="min-width: 260px; text-align:center; padding:40px; color:#999;">
              No advertisements yet. Click "Upload New Banner" to add one.
            </div>
          `;
          // Show upload button when no ads
          if (uploadBtn) uploadBtn.style.display = 'block';
          return;
        }

        // Hide upload button when ads exist
        

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const card = createBannerCard({
            id: docSnap.id,
            ...data
          });
          bannersGrid.appendChild(card);
        });
        
        console.log(`Loaded ${snapshot.size} advertisements`);
      }, (error) => {
        console.error('Error loading ads:', error);
        bannersGrid.innerHTML = `
          <div style="min-width: 260px; text-align:center; padding:40px; color:#ef4444;">
            Error loading advertisements. Check console for details.
          </div>
        `;
      });
  }

  // Create banner card element
  function createBannerCard({ id, imageUrl, title, description, link = '', createdAt, active = true, order = 0 }) {
    const card = document.createElement('article');
    card.className = 'banner-card';
    if (!active) card.classList.add('inactive');
    card.dataset.id = id;

    let date = 'N/A';
    if (createdAt && createdAt.toDate) {
      date = createdAt.toDate().toISOString().slice(0, 10);
    }
    
    const badgeHtml = !active ? '<span class="badge inactive-badge">Inactive</span>' : '';
    const toggleBtn = active 
      ? '<button class="link-btn disable">Disable</button>'
      : '<button class="link-btn enable">Enable</button>';

    card.innerHTML = `
      <div class="banner-media">
        <img src="${imageUrl}" alt="${title}">
        ${badgeHtml}
      </div>
      <div class="banner-body">
        <h3 class="title">${title}</h3>
        <p class="desc">${description || ''}</p>
        ${link ? `<a class="link" href="${link}" target="_blank">${link}</a>` : ''}
        <div class="meta">Order: ${order} • Created: ${date}</div>
      </div>
      <div class="banner-actions">
        <button class="link-btn edit">Edit</button>
        ${toggleBtn}
        <button class="link-btn del">Delete</button>
      </div>
    `;

    attachCardHandlers(card);
    return card;
  }

  // Attach event handlers to card
  function attachCardHandlers(card) {
    const editBtn = card.querySelector('.edit');
    const delBtn = card.querySelector('.del');
    const actionsDiv = card.querySelector('.banner-actions');

    if (editBtn) {
      editBtn.addEventListener('click', () => openEditModal(card));
    }
    
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (confirm('Delete this banner permanently?')) {
          try {
            await db.collection('advertisements').doc(card.dataset.id).delete();
            console.log('Banner deleted successfully');
          } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete banner: ' + error.message);
          }
        }
      });
    }

    actionsDiv.addEventListener('click', async (e) => {
      if (e.target.classList.contains('disable') || e.target.classList.contains('enable')) {
        const newActiveState = e.target.classList.contains('enable');
        
        try {
          await db.collection('advertisements').doc(card.dataset.id).update({
            active: newActiveState
          });
          console.log('Banner status updated');
        } catch (error) {
          console.error('Toggle error:', error);
          alert('Failed to update status: ' + error.message);
        }
      }
    });
  }

  // Upload image to Cloudinary
  async function uploadToCloudinary(file) {
    console.log('Uploading to Cloudinary...', file.name);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Cloudinary error:', errorData);
        throw new Error('Upload failed: ' + (errorData.error?.message || 'Unknown error'));
      }

      const data = await response.json();
      console.log('Upload successful:', data.secure_url);
      return data.secure_url;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw error;
    }
  }

  // Open modal functions
  function openUploadModal() {
    console.log('Opening upload modal');
    isEditing = false;
    editingDocId = null;
    document.getElementById('bannerTitle').value = '';
    document.getElementById('bannerDesc').value = '';
    document.getElementById('bannerURL').value = '';
    bannerImageInput.value = '';
    previewImg.src = '';
    previewImg.style.display = 'none';
    uploadModal.style.display = 'flex';
  }

  function openEditModal(card) {
    console.log('Opening edit modal for:', card.dataset.id);
    isEditing = true;
    editingDocId = card.dataset.id;

    const title = card.querySelector('.title')?.innerText || '';
    const desc = card.querySelector('.desc')?.innerText || '';
    const link = card.querySelector('.link')?.getAttribute('href') || '';
    const imgSrc = card.querySelector('.banner-media img')?.src || '';

    document.getElementById('bannerTitle').value = title;
    document.getElementById('bannerDesc').value = desc;
    document.getElementById('bannerURL').value = link;
    
    if (imgSrc) {
      previewImg.src = imgSrc;
      previewImg.style.display = 'block';
    }

    bannerImageInput.value = '';
    uploadModal.style.display = 'flex';
  }

  function closeModal() {
    uploadModal.style.display = 'none';
  }

  // Event listeners
  if (uploadBtn) {
    uploadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Upload button clicked');
      openUploadModal();
    });
  }
  
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal);
  }
  
  if (chooseImgBtn) {
    chooseImgBtn.addEventListener('click', () => bannerImageInput.click());
  }

  if (bannerImageInput) {
    bannerImageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      console.log('Image selected:', file.name);
      const imgURL = URL.createObjectURL(file);
      previewImg.src = imgURL;
      previewImg.style.display = 'block';
    });
  }

  // Save banner
  if (saveBtn) {
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const title = document.getElementById('bannerTitle').value.trim();
      const desc = document.getElementById('bannerDesc').value.trim();
      const url = document.getElementById('bannerURL').value.trim();
      const file = bannerImageInput.files[0];

      console.log('Save clicked:', { title, desc, url, hasFile: !!file });

      if (!title) {
        alert('Please enter a title.');
        return;
      }

      if (!isEditing && !file) {
        alert('Please choose an image.');
        return;
      }

      saveBtn.textContent = 'Uploading...';
      saveBtn.disabled = true;

      try {
        let imageUrl = previewImg.src;

        // Upload new image if selected
        if (file) {
          imageUrl = await uploadToCloudinary(file);
        }

        if (isEditing && editingDocId) {
          // Update existing ad
          const updateData = {
            title,
            description: desc,
            link: url || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          };

          if (file) {
            updateData.imageUrl = imageUrl;
          }

          await db.collection('advertisements').doc(editingDocId).update(updateData);
          console.log('Advertisement updated');
          alert('Advertisement updated successfully!');
        } else {
          // Create new ad
          const currentAds = await db.collection('advertisements').get();
          const newOrder = currentAds.size;

          await db.collection('advertisements').add({
            imageUrl,
            title,
            description: desc,
            link: url || null,
            active: true,
            order: newOrder,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          console.log('New advertisement created');
          alert('Advertisement created successfully!');
        }

        closeModal();
      } catch (error) {
        console.error('Save error:', error);
        alert('Failed to save banner: ' + error.message);
      } finally {
        saveBtn.textContent = 'Save Banner';
        saveBtn.disabled = false;
      }
    });
  }

  // Initialize
  loadAdvertisements();
  console.log('Broadcast system initialized');
});