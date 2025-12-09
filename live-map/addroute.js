// ===========================
// Firebase Initialization
// ===========================
const firebaseConfig = {
    apiKey: "AIzaSyCRtx7Oyda48Hz0eu-BiNrGYiK3_36Vl-c",
    authDomain: "locobus-e4274.firebaseapp.com",
    projectId: "locobus-e4274",
    storageBucket: "locobus-e4274.firebasestorage.app",
    messagingSenderId: "296482389648",
    appId: "1:296482389648:web:1827bd92dc55c8a857e215"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Main variables
let parsedData = [];
const ORS_GEO_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImMzMzllNDZlMGQ2ZjQ4ZDk5N2I1NTVmZjNhOTk0NWM1IiwiaCI6Im11cm11cjY0In0=";
const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImMzMzllNDZlMGQ2ZjQ4ZDk5N2I1NTVmZjNhOTk0NWM1IiwiaCI6Im11cm11cjY0In0="; // <<<<< IMPORTANT


// ===========================
// DOWNLOAD TEMPLATE
// ===========================
function downloadTemplate() {
    const template = [
        ['route_number', 'from', 'to', 'distance_km', 'fare', 'stops'],
        ['101', 'Garhshankar Bus Stand', 'Hoshiarpur', '35', '50', 'Stop1,Stop2,Stop3'],
        ['102', 'Jalandhar City', 'Ludhiana', '75', '80', 'Stop4,Stop5,Stop6'],
        ['103', 'Chandigarh ISBT', 'Mohali', '15', '25', 'Stop7,Stop8']
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Routes Template");
    XLSX.writeFile(wb, "bus_routes_template.xlsx");
    addLog("Template downloaded!", "success");
}


// ===========================
// FILE SELECT HANDLER
// ===========================
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById("previewSection").style.display = "block";
    document.getElementById("progressSection").style.display = "none";

    addLog(`Reading file: ${file.name}`, "info");

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(firstSheet);

            if (json.length === 0) {
                addLog("Invalid or empty file!", "error");
                return;
            }

            parsedData = json;
            displayPreview(json);
            addLog(`Parsed ${json.length} routes`, "success");

        } catch (err) {
            addLog("Error reading file: " + err.message, "error");
        }
    };

    reader.readAsArrayBuffer(file);
}


// ===========================
// DISPLAY PREVIEW (FIRST 5 ROWS)
// ===========================
function displayPreview(data) {
    const tbody = document.getElementById("previewBody");
    const previewSection = document.getElementById("previewSection");
    const actions = document.getElementById("actionButtons");

    tbody.innerHTML = "";

    data.slice(0, 5).forEach(row => {
        tbody.innerHTML += `
            <tr>
                <td>${row.route_number}</td>
                <td>${row.from}</td>
                <td>${row.to}</td>
                <td>${row.distance_km}</td>
                <td>${row.fare}</td>
            </tr>
        `;
    });

    if (data.length > 5) {
        tbody.innerHTML += `
            <tr>
                <td colspan="5" style="text-align:center;color:#666;">
                    ...and ${data.length - 5} more routes
                </td>
            </tr>
        `;
    }

    previewSection.style.display = "block";
    actions.style.display = "flex";
}


// ===========================
// GEOCODING FUNCTION
// ===========================
async function geocodeLocation(name) {
    const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_GEO_API_KEY}&text=${encodeURIComponent(name + ", Punjab, India")}&size=1`;

    try {
        const res = await fetch(url);
        const json = await res.json();

        if (!json.features || json.features.length === 0) {
            return { success: false };
        }

        const [lng, lat] = json.features[0].geometry.coordinates;

        return { success: true, lat, lng };

    } catch (err) {
        return { success: false };
    }
}


// ===========================
// DIRECTIONS → POLYLINE
// ===========================
async function getRoutePolyline(startLat, startLng, endLat, endLng) {
    const url = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": ORS_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                coordinates: [
                    [startLng, startLat],
                    [endLng, endLat]
                ]
            })
        });

        const data = await response.json();

        if (!data.features) return { success: false };

        const coords = data.features[0].geometry.coordinates;

        return {
            success: true,
            lats: coords.map(c => c[1]),
            lngs: coords.map(c => c[0])
        };

    } catch (err) {
        return { success: false };
    }
}


// ===========================
// DUPLICATE ROUTE CHECK
// ===========================
async function checkDuplicateRoute(from, to) {
    const snap = await db.collection("bus_routes")
        .where("from", "==", from)
        .where("to", "==", to)
        .limit(1)
        .get();

    return !snap.empty;
}


// ===========================
// MAIN PROCESS & UPLOAD
// ===========================
async function processAndUpload() {
    const preview = document.getElementById("previewSection");
    const progressSection = document.getElementById("progressSection");
    const progressBar = document.getElementById("progressBar");
    const actions = document.getElementById("actionButtons");

    preview.style.display = "none";
    actions.style.display = "none";
    progressSection.style.display = "block";
    document.getElementById("statusLog").innerHTML = "";

    addLog("🚀 Starting upload...", "info");

    let success = 0, errors = 0, skipped = 0;

    for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];

        const pct = Math.round(((i + 1) / parsedData.length) * 100);
        progressBar.style.width = pct + "%";
        progressBar.querySelector("span").innerText = pct + "%";

        addLog(`Route ${i + 1}: ${row.from} → ${row.to}`, "info");

        try {
            // DUPLICATE CHECK
            if (await checkDuplicateRoute(row.from, row.to)) {
                addLog("⚠️ Duplicate found, skipping.", "warning");
                skipped++;
                continue;
            }

            // GEOCODE START
            const start = await geocodeLocation(row.from);
            if (!start.success) throw new Error("Start location failed");

            // GEOCODE END
            const end = await geocodeLocation(row.to);
            if (!end.success) throw new Error("End location failed");

            // GET POLYLINE
            addLog("  ↪ Fetching polyline...", "info");

            const poly = await getRoutePolyline(start.lat, start.lng, end.lat, end.lng);

            let lats, lngs;

            if (poly.success) {
                lats = poly.lats;
                lngs = poly.lngs;
                addLog(`  🛣 Polyline OK (${lats.length} points)`, "success");
            } else {
                addLog("  ⚠ Polyline failed, using straight line", "warning");
                lats = [start.lat, end.lat];
                lngs = [start.lng, end.lng];
            }

            // FINAL DATA
            const routeDoc = {
                route_number: row.route_number ?? `Route-${i + 1}`,
                from: row.from,
                to: row.to,
                start_lat: start.lat,
                start_lng: start.lng,
                end_lat: end.lat,
                end_lng: end.lng,
                polyline_lats: lats,
                polyline_lngs: lngs,
                distance_km: Number(row.distance_km || 0),
                fare: Number(row.fare || 0),
                status: "active",
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                uploaded_by: "admin",
                upload_method: "bulk_import"
            };

            await db.collection("bus_routes").add(routeDoc);

            addLog("  ✅ Saved!", "success");
            success++;

        } catch (err) {
            addLog("  ❌ Error: " + err.message, "error");
            errors++;
        }
    }

    addLog(`🎉 Upload Completed`, "success");
    addLog(`✔ Success: ${success}`, "success");
    addLog(`⚠ Skipped: ${skipped}`, "warning");
    addLog(`❌ Errors: ${errors}`, "error");

    progressBar.style.background = "#4caf50";
}


// ===========================
// LOGGING HELPER
// ===========================
function addLog(msg, type = "info") {
    const log = document.getElementById("statusLog");
    const div = document.createElement("div");
    div.className = `status-item ${type}`;
    div.innerHTML = `
        <span>${type === "success" ? "✅" :
                type === "error" ? "❌" :
                type === "warning" ? "⚠️" : "ℹ️"}</span>
        <span>${msg}</span>
    `;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}


// ===========================
// RESET UPLOADER
// ===========================
function resetUpload() {
    document.getElementById("fileInput").value = "";
    document.getElementById("previewSection").style.display = "none";
    document.getElementById("actionButtons").style.display = "none";
    document.getElementById("progressSection").style.display = "none";
    document.getElementById("previewBody").innerHTML = "";
    document.getElementById("statusLog").innerHTML = "";
    parsedData = [];
}


// ===========================
// LOTTIE ANIMATION
// ===========================
document.addEventListener("DOMContentLoaded", () => {
    const logo = document.getElementById("busLogoAnim");
    if (logo && window.lottie) {
        window.lottie.loadAnimation({
            container: logo,
            renderer: "svg",
            loop: true,
            autoplay: true,
            path: "../index/Bus_carga_trackMile.json"
        });
    }

    document.getElementById("previewSection").style.display = "none";
    document.getElementById("progressSection").style.display = "none";
});
