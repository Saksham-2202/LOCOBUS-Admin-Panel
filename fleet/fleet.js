/* fleet.js - Firebase Integration */

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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

// Global storage for bus data
let busesData = [];

// Filter state
let currentStatusFilter = "all"; // "all" | "active" | "inactive"

// Pagination for fleet table
const ROWS_PER_PAGE = 8;
let currentPage = 1;

/* helper setText */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// Load all buses from Firestore
async function loadBusesFromFirebase() {
  try {
    const busesSnapshot = await getDocs(collection(db, "buses"));
    busesData = [];

    busesSnapshot.forEach((docSnap) => {
      const rawData = docSnap.data();

      const routeInfo = rawData.routeInfo || {};
      const liveStatus = rawData.liveStatus || {};

      busesData.push({
        id: docSnap.id, // Document ID
        busId: docSnap.id,

        name: rawData.name || "Not Set",
        phone: rawData.phone || "—",
        email: rawData.loginEmail || "—",

        // Live Status Map
        status: liveStatus.status || "inactive",

        // Route Info Map
        routeFrom: routeInfo.from || "?",
        routeTo: routeInfo.to || "?",
        stops: routeInfo.stops || [],
        templateId: routeInfo.templateId || "",

        isRouteAssigned: !!(routeInfo.from && routeInfo.to)
      });
    });

    console.log("Loaded buses from Firebase:", busesData);

    currentPage = 1; // reset to first page
    renderBusTable();

  } catch (error) {
    console.error("Error loading buses:", error);
    const rowsContainer = document.getElementById("fleet-rows");
    const footer = document.querySelector(".table-footer");
    if (rowsContainer) {
      rowsContainer.innerHTML = `
        <div class="row" style="color:red; padding:20px;">
          Error loading data. Check console.
        </div>`;
    }
    if (footer) {
      footer.innerHTML = `Rows per page ${ROWS_PER_PAGE} &nbsp;&nbsp; (Auto-loaded from Firebase)`;
    }
  }
}

/**
 * Apply status filter + sort active buses to top + paginate + render table.
 */
function renderBusTable() {
  const rowsContainer = document.getElementById("fleet-rows");
  const footer = document.querySelector(".table-footer");
  if (!rowsContainer) return;

  // If truly no buses loaded from Firebase
  if (busesData.length === 0) {
    rowsContainer.innerHTML = `
      <div class="row" style="justify-content: center; padding: 40px; color: #666;">
        No buses found in database.
      </div>
    `;
    if (footer) {
      footer.innerHTML = `Rows per page ${ROWS_PER_PAGE} &nbsp;&nbsp; (Auto-loaded from Firebase)`;
    }
    return;
  }

  // 1️⃣ Filter
  let filtered = busesData.slice();

  if (currentStatusFilter === "active") {
    filtered = filtered.filter((b) => b.status === "active");
  } else if (currentStatusFilter === "inactive") {
    filtered = filtered.filter((b) => b.status !== "active");
  }

  // 2️⃣ Sort: active buses first
  filtered.sort((a, b) => {
    const A = a.status === "active" ? 1 : 0;
    const B = b.status === "active" ? 1 : 0;
    return B - A; // active (1) before inactive (0)
  });

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ROWS_PER_PAGE));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const pageItems = filtered.slice(startIndex, startIndex + ROWS_PER_PAGE);

  // 3️⃣ Render rows
  if (totalItems === 0) {
    rowsContainer.innerHTML = `
      <div class="row" style="justify-content: center; padding: 40px; color: #666;">
        No buses match this filter.
      </div>
    `;
  } else {
    rowsContainer.innerHTML = pageItems
      .map(
        (bus) => `
        <div class="row" data-bus-id="${bus.id}">
          <div class="col col-number" style="font-weight:bold;">${bus.busId}</div>
          <div class="col col-routes">${bus.isRouteAssigned ? "1 Active" : "None"}</div>
          <div class="col col-conductor">${bus.name}</div>
          <div class="col col-hours" style="color:${
            bus.status === "active" ? "#10b981" : "#ef4444"
          }">
            ${bus.status.toUpperCase()}
          </div>
          <div class="col col-actions">
            <button class="btn-view" data-bus="${bus.busId}">View</button>
          </div>
        </div>
      `
      )
      .join("");
  }

  // 4️⃣ Footer pager
  if (footer) {
    footer.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; color:#6b7280;">
        <span>Rows per page ${ROWS_PER_PAGE} &nbsp;&nbsp; (Auto-loaded from Firebase)</span>
        <div style="display:flex; align-items:center; gap:10px;">
          <span>Showing page ${currentPage} of ${totalPages}</span>
          <div style="display:flex; gap:8px;">
            <button id="fleetPrevPage"
                    ${currentPage === 1 ? "disabled" : ""}
                    style="padding:6px 10px; border-radius:6px; border:1px solid #d1d5db; background:#fff; cursor:pointer; font-size:12px;">
              Previous
            </button>
            <button id="fleetNextPage"
                    ${currentPage === totalPages ? "disabled" : ""}
                    style="padding:6px 10px; border-radius:6px; border:1px solid #2563eb; background:#2563eb; color:#fff; cursor:pointer; font-size:12px;">
              Next
            </button>
          </div>
        </div>
      </div>
    `;

    const prevBtn = document.getElementById("fleetPrevPage");
    const nextBtn = document.getElementById("fleetNextPage");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
          currentPage--;
          renderBusTable();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (currentPage < totalPages) {
          currentPage++;
          renderBusTable();
        }
      });
    }
  }
}

// MAIN DOMContentLoaded for table + hover + search + filter
document.addEventListener("DOMContentLoaded", async () => {
  const rowsContainer = document.getElementById("fleet-rows");
  const hover = document.getElementById("busHoverCard");
  const hoverClose = document.getElementById("hoverClose");
  const search = document.querySelector(".search");
  const statusFilter = document.getElementById("statusFilter");

  // 1️⃣ Load buses from Firebase on page load
  await loadBusesFromFirebase();

  // 2️⃣ Status filter dropdown
  if (statusFilter) {
    statusFilter.addEventListener("change", (e) => {
      currentStatusFilter = e.target.value; // all / active / inactive
      currentPage = 1;                      // reset to first page when filter changes
      renderBusTable();
    });
  }

  // 3️⃣ Search filter (client-side on rendered rows)
  if (search) {
    search.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      const rows = rowsContainer.querySelectorAll(".row");
      rows.forEach((row) => {
        const busId =
          row.querySelector(".col-number")?.textContent || "";
        const conductor =
          row.querySelector(".col-conductor")?.textContent || "";
        const searchText = `${busId} ${conductor}`.toLowerCase();
        row.style.display = searchText.includes(q) ? "" : "none";
      });
    });
  }

  /* ---- position hover card near anchor ---- */
  function positionCard(anchorEl) {
    const card = hover;
    const pad = 12;
    const rect = anchorEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = rect.right + 12;
    if (left + card.offsetWidth + pad > vw) {
      left = rect.left - card.offsetWidth - 12;
      if (left < 8) left = Math.max(8, (vw - card.offsetWidth) / 2);
    }

    let top = rect.top;
    if (top + card.offsetHeight + pad > vh) {
      top = Math.max(8, vh - card.offsetHeight - 12);
    }

    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  }

  /* ---- show card with data from row ---- */
  rowsContainer.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".btn-view");
    if (!btn) return;

    const busId = btn.dataset.bus || "—";

    // Find the bus data
    const busData = busesData.find((b) => b.busId === busId);
    if (!busData) {
      console.error("Bus data not found for:", busId);
      return;
    }

    setText("hcBusNumber", `Bus Details: ${busId}`);
    setText("hcBusNo", busId);
    setText("hcStatus", busData.status.toUpperCase());
    setText("hcConductor", `Staff: ${busData.name}`);
    setText("hcConName", busData.name);
    setText("hcConPhone", busData.phone);

    if (busData.isRouteAssigned) {
      setText("r1Title", `${busData.routeFrom} ➝ ${busData.routeTo}`);
    } else {
      setText("r1Title", "No Route Assigned");
    }

    const stopsList = document.getElementById("r1Stops");
    if (stopsList) {
      stopsList.innerHTML = "";
      if (busData.stops && busData.stops.length > 0) {
        busData.stops.forEach((stop) => {
          const li = document.createElement("li");
          const stopName =
            typeof stop === "object" && stop.name ? stop.name : stop;
          li.textContent = stopName;
          stopsList.appendChild(li);
        });
      } else {
        const li = document.createElement("li");
        li.textContent = "No stops defined";
        li.style.color = "#999";
        stopsList.appendChild(li);
      }
    }

    const rightCol = hover.querySelector(".hc-right");
    const existingDetails = hover.querySelector(".extra-details");
    if (existingDetails) existingDetails.remove();

    const detailsDiv = document.createElement("div");
    detailsDiv.className = "extra-details staff-mini";
    detailsDiv.style.marginTop = "10px";
    detailsDiv.innerHTML = `
      <div style="font-size: 13px; margin-bottom: 4px;"><strong>Login Email:</strong></div>
      <div style="font-size: 12px; color: #555; margin-bottom: 8px;">${busData.email}</div>
      
      <div style="font-size: 13px; margin-bottom: 4px;"><strong>Template ID:</strong></div>
      <div style="font-size: 12px; color: #555; word-break: break-all;">${busData.templateId || "None"}</div>
    `;
    rightCol.appendChild(detailsDiv);

    hover.classList.remove("hide");
    hover.classList.add("show");
    hover.style.display = "block";

    setTimeout(() => positionCard(btn), 6);
  });

  /* ---- close behaviors ---- */
  hoverClose.addEventListener("click", () => {
    hover.classList.remove("show");
    hover.classList.add("hide");
    setTimeout(() => {
      hover.style.display = "none";
    }, 150);
  });

  document.addEventListener("click", (e) => {
    if (!hover.classList.contains("show")) return;
    if (e.target.closest("#busHoverCard")) return;
    if (e.target.closest(".btn-view")) return;
    hover.classList.remove("show");
    hover.classList.add("hide");
    setTimeout(() => {
      hover.style.display = "none";
    }, 150);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && hover.classList.contains("show")) {
      hover.classList.remove("show");
      hover.classList.add("hide");
      setTimeout(() => {
        hover.style.display = "none";
      }, 150);
    }
  });

  window.addEventListener("resize", () => {
    if (hover.classList.contains("show")) {
      hover.style.display = "block";
    }
  });
});

// Lottie bus logo animation
document.addEventListener("DOMContentLoaded", () => {
  const logoContainer = document.getElementById("busLogoAnim");
  if (logoContainer && window.lottie) {
    window.lottie.loadAnimation({
      container: logoContainer,
      renderer: "svg",
      loop: true,
      autoplay: true,
      path: "../index/Bus_carga_trackMile.json" // your real path
    });
  }
});
