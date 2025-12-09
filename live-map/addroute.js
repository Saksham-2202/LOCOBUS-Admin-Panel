// ===========================
// Firebase Config
// ===========================
const firebaseConfig = {
    apiKey: "AIzaSyCRtx7Oyda48Hz0eu-BiNrGYiK3_36Vl-c",
    authDomain: "locobus-e4274.firebaseapp.com",
    projectId: "locobus-e4274",
    storageBucket: "locobus-e4274.firebasestorage.app",
    messagingSenderId: "296482389648",
    appId: "1:296482389648:web:1827bd92dc55c8a857e215"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(); 
const db = firebase.firestore();

let parsedData = [];
const ORS_GEO_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImMzMzllNDZlMGQ2ZjQ4ZDk5N2I1NTVmZjNhOTk0NWM1IiwiaCI6Im11cm11cjY0In0=";
const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImMzMzllNDZlMGQ2ZjQ4ZDk5N2I1NTVmZjNhOTk0NWM1IiwiaCI6Im11cm11cjY0In0="; 

// ===========================
// 1. TEMPLATE DOWNLOAD
// ===========================
function downloadTemplate() {
    const template = [
        ['route_number', 'from', 'to', 'distance_km', 'fare', 'stops'],
        ['101', 'Garhshankar', 'Hoshiarpur', '35', '50', 'Stop1,Stop2'],
        ['104', 'Jalandhar', 'Kapurthala', '', '30', '']
    ];
    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Routes");
    XLSX.writeFile(wb, "LocoBus_Route_Template.xlsx");
}

// ===========================
// 2. CLOUD SYNC
// ===========================
async function syncFromCloud() {
    const url = document.getElementById("cloudLinkInput").value.trim();
    if (!url) {
        alert("Please paste a Direct Download Link first!");
        return;
    }

    const btn = document.querySelector(".sync-card button");
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ Downloading...";
    btn.disabled = true;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to download. Check link.");
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);

        if (json.length === 0) throw new Error("File is empty");

        const taggedData = json.map(item => ({...item, _source: 'Cloud Sync'}));
        parsedData = [...parsedData, ...taggedData]; 
        
        displayPreview();
        alert("Synced successfully! Scroll down to confirm upload.");

    } catch (err) {
        console.error(err);
        alert("Sync Failed: " + err.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ===========================
// 3. MANUAL UPLOAD
// ===========================
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);

            if (json.length === 0) return alert("Empty File");

            const taggedData = json.map(item => ({...item, _source: 'Excel Upload'}));
            parsedData = [...parsedData, ...taggedData];
            displayPreview();
        } catch (err) {
            alert("Error parsing file");
        }
    };
    reader.readAsArrayBuffer(file);
}

// ===========================
// 4. MANUAL FORM ENTRY
// ===========================
async function calculateManualDistance() {
    const fromVal = document.getElementById("manualFrom").value.trim();
    const toVal = document.getElementById("manualTo").value.trim();
    const distInput = document.getElementById("manualDistance");

    if (fromVal && toVal) {
        distInput.placeholder = "Calculating...";
        try {
            const start = await geocodeLocation(fromVal);
            const end = await geocodeLocation(toVal);
            if (!start.success || !end.success) throw new Error("Location not found");

            const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_API_KEY}&start=${start.lng},${start.lat}&end=${end.lng},${end.lat}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.features?.length > 0) {
                const km = (data.features[0].properties.segments[0].distance / 1000).toFixed(1);
                distInput.value = km;
            } else {
                distInput.value = ""; distInput.placeholder = "Not found";
            }
        } catch (err) {
            distInput.value = ""; distInput.placeholder = "Manual entry needed";
        }
    }
}

function addManualToQueue() {
    const routeNo = document.getElementById("manualRouteNo").value.trim();
    const from = document.getElementById("manualFrom").value.trim();
    const to = document.getElementById("manualTo").value.trim();
    const fare = document.getElementById("manualFare").value.trim();
    const distance = document.getElementById("manualDistance").value.trim();
    const stops = document.getElementById("manualStops").value.trim();

    if (!routeNo || !from || !to || !fare) {
        alert("Please fill in Route No, From, To, and Fare.");
        return;
    }

    parsedData.push({
        route_number: routeNo,
        from: from,
        to: to,
        distance_km: distance || 0,
        fare: fare,
        stops: stops, // Optional, can be empty
        _source: 'Manual Form'
    });
    
    displayPreview();
    
    // Clear inputs
    document.getElementById("manualRouteNo").value = "";
    document.getElementById("manualFrom").value = "";
    document.getElementById("manualTo").value = "";
    document.getElementById("manualFare").value = "";
    document.getElementById("manualDistance").value = "";
    document.getElementById("manualStops").value = "";
}

// ===========================
// PREVIEW
// ===========================
function displayPreview() {
    const tbody = document.getElementById("previewBody");
    const section = document.getElementById("previewSection");
    const actions = document.getElementById("actionButtons"); // Select the button wrapper
    
    tbody.innerHTML = "";
    parsedData.slice(0, 10).forEach(row => {
        let cls = 'badge-excel';
        if(row._source === 'Manual Form') cls = 'badge-manual';
        if(row._source === 'Cloud Sync') cls = 'badge-cloud'; 

        const dist = (row.distance_km && row.distance_km != 0) ? row.distance_km : '<span style="color:orange">Auto</span>';
        const stopsDisplay = row.stops ? row.stops : '<span style="color:#ccc">None</span>';
        
        tbody.innerHTML += `
            <tr>
                <td>${row.route_number || '-'}</td>
                <td>${row.from}</td>
                <td>${row.to}</td>
                <td>${dist}</td>
                <td>${row.fare}</td>
                <td>${stopsDisplay}</td>
                <td><span class="badge-source ${cls}">${row._source}</span></td>
            </tr>`;
    });
    
    if(parsedData.length > 0) {
        section.style.display = "block";
        actions.style.display = "flex"; // FORCE SHOW BUTTONS
        
        // Auto-scroll to the buttons so the user sees them
        actions.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ===========================
// API HELPERS
// ===========================
async function geocodeLocation(name) {
    const cleanName = String(name).replace(/Bus Stand|ISBT|City|Cantt/gi, "").trim();
    const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_GEO_API_KEY}&text=${encodeURIComponent(cleanName + ", Punjab, India")}&size=1`;
    try {
        const res = await fetch(url);
        const json = await res.json();
        return json.features?.length > 0 ? { success: true, lat: json.features[0].geometry.coordinates[1], lng: json.features[0].geometry.coordinates[0] } : { success: false };
    } catch (e) { return { success: false }; }
}

async function getRoutePolyline(start, end) {
    const url = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";
    try {
        const response = await fetch(url, {
            method: "POST", headers: { "Authorization": ORS_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ coordinates: [[start.lng, start.lat], [end.lng, end.lat]] })
        });
        const data = await response.json();
        if (data.features) {
            const props = data.features[0].properties.segments[0];
            return { 
                success: true, 
                distance: (props.distance / 1000).toFixed(1),
                lats: data.features[0].geometry.coordinates.map(c=>c[1]), 
                lngs: data.features[0].geometry.coordinates.map(c=>c[0]) 
            };
        }
    } catch (e) { return { success: false }; }
}

// ===========================
// PROCESS & UPLOAD (ALL SOURCES)
// ===========================
async function processAndUpload() {
    const user = auth.currentUser;
    if (!user) return alert("Please Login First");

    document.getElementById("previewSection").style.display = "none";
    document.getElementById("progressSection").style.display = "block";
    
    addLog("🚀 Starting Processing...", "info");
    let updated = 0, created = 0, errors = 0;

    for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        const pct = Math.round(((i + 1) / parsedData.length) * 100);
        document.getElementById("progressBar").style.width = pct + "%";
        document.getElementById("progressBar").querySelector("span").innerText = pct + "%";

        try {
            let docId = null;
            let oldData = null;
            
            // Check Exists
            if(row.route_number) {
                const snap = await db.collection("bus_routes").where("route_number", "==", String(row.route_number)).limit(1).get();
                if(!snap.empty) { docId = snap.docs[0].id; oldData = snap.docs[0].data(); }
            }
            if(!docId) {
                const snap = await db.collection("bus_routes").where("from", "==", row.from).where("to", "==", row.to).limit(1).get();
                if(!snap.empty) { docId = snap.docs[0].id; oldData = snap.docs[0].data(); }
            }

            let data = {
                route_number: String(row.route_number || `RT-${Date.now()}`),
                from: row.from,
                to: row.to,
                fare: Number(row.fare || 0),
                stops: row.stops ? String(row.stops).split(',').filter(s=>s.trim()!=='') : [],
                last_updated: firebase.firestore.FieldValue.serverTimestamp(),
                upload_method: row._source
            };

            // Smart Update Logic
            let doMap = true;
            if(docId && oldData.from === row.from && oldData.to === row.to && oldData.polyline_lats) {
                doMap = false;
                addLog(`Updating details: ${row.route_number}`, "info");
            }

            if(doMap) {
                const start = await geocodeLocation(row.from);
                const end = await geocodeLocation(row.to);
                if(!start.success || !end.success) throw new Error("Location not found");

                const poly = await getRoutePolyline(start, end);
                
                data.start_lat = start.lat; data.start_lng = start.lng;
                data.end_lat = end.lat; data.end_lng = end.lng;
                data.polyline_lats = poly.success ? poly.lats : [start.lat, end.lat];
                data.polyline_lngs = poly.success ? poly.lngs : [start.lng, end.lng];
                
                if(row.distance_km && row.distance_km > 0) data.distance_km = Number(row.distance_km);
                else data.distance_km = poly.success ? Number(poly.distance) : 0;
                
                data.status = "active";
                data.created_by = user.uid;
            } else {
                if(row.distance_km > 0) data.distance_km = Number(row.distance_km);
            }

            if(docId) { await db.collection("bus_routes").doc(docId).update(data); updated++; }
            else { 
                data.created_at = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection("bus_routes").add(data); 
                created++; 
            }

        } catch (e) {
            errors++;
            addLog(`Failed ${row.route_number}: ${e.message}`, "error");
        }
    }
    
    addLog(`Done! Updated: ${updated}, Created: ${created}, Errors: ${errors}`, "success");
    document.getElementById("progressBar").style.background = "#4caf50";
}

function addLog(msg, type) {
    const log = document.getElementById("statusLog");
    const div = document.createElement("div");
    div.className = `status-item ${type}`;
    div.innerHTML = `<span>${type=='success'?'✅':type=='error'?'❌':'ℹ️'}</span> ${msg}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

function resetUpload() {
    parsedData = [];
    document.getElementById("fileInput").value = "";
    document.getElementById("previewSection").style.display = "none";
    document.getElementById("progressSection").style.display = "none";
    document.getElementById("statusLog").innerHTML = "";
    displayPreview();
}

document.addEventListener("DOMContentLoaded", () => {
    const logo = document.getElementById("busLogoAnim");
    if(logo && window.lottie) window.lottie.loadAnimation({ container: logo, renderer: "svg", loop: true, autoplay: true, path: "../index/Bus_carga_trackMile.json" });
});