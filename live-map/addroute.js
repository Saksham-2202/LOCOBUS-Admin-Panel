src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"
    src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"
    
    src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"

        // Firebase Configuration
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

        let parsedData = [];

        // Download Template Function
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
            
            addLog('Template downloaded successfully!', 'success');
        }

        // Handle File Selection
        function handleFileSelect(event) {
            const file = event.target.files[0];
            if (!file) return;

            addLog(`Reading file: ${file.name}`, 'info');

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                    if (jsonData.length === 0) {
                        addLog('Error: File is empty or invalid format', 'error');
                        return;
                    }

                    parsedData = jsonData;
                    displayPreview(jsonData);
                    addLog(`✅ Successfully parsed ${jsonData.length} routes`, 'success');
                } catch (error) {
                    addLog(`Error parsing file: ${error.message}`, 'error');
                }
            };
            reader.readAsArrayBuffer(file);
        }

        // Display Preview
        function displayPreview(data) {
            const previewTable = document.getElementById('previewTable');
            const previewBody = document.getElementById('previewBody');
            const actionButtons = document.getElementById('actionButtons');

            previewBody.innerHTML = '';
            
            data.slice(0, 5).forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.route_number || 'N/A'}</td>
                    <td>${row.from || 'N/A'}</td>
                    <td>${row.to || 'N/A'}</td>
                    <td>${row.distance_km || 'N/A'}</td>
                    <td>${row.fare || 'N/A'}</td>
                `;
                previewBody.appendChild(tr);
            });

            if (data.length > 5) {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="5" style="text-align: center; color: #666; font-style: italic;">... and ${data.length - 5} more routes</td>`;
                previewBody.appendChild(tr);
            }

            previewTable.style.display = 'table';
            actionButtons.style.display = 'flex';
        }

        // Geocode Location using OpenRouteService
        async function geocodeLocation(locationName) {
            const apiKey = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImMzMzllNDZlMGQ2ZjQ4ZDk5N2I1NTVmZjNhOTk0NWM1IiwiaCI6Im11cm11cjY0In0='; // You need to get this from openrouteservice.org
            
            try {
                // Add "Punjab, India" for better accuracy
                const query = `${locationName}, Punjab, India`;
                const url = `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(query)}&size=1`;
                
                const response = await fetch(url);
                if (!response.ok) throw new Error('Geocoding failed');
                
                const data = await response.json();
                
                if (data.features && data.features.length > 0) {
                    const coords = data.features[0].geometry.coordinates;
                    return {
                        latitude: coords[1],
                        longitude: coords[0],
                        success: true
                    };
                }
                
                return { success: false, error: 'Location not found' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }

        // Process and Upload Routes
        async function processAndUpload() {
            const progressSection = document.getElementById('progressSection');
            const progressBar = document.getElementById('progressBar');
            const actionButtons = document.getElementById('actionButtons');
            
            progressSection.style.display = 'block';
            actionButtons.style.display = 'none';
            
            addLog('🚀 Starting route processing...', 'info');

            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < parsedData.length; i++) {
                const route = parsedData[i];
                const progress = Math.round(((i + 1) / parsedData.length) * 100);
                progressBar.style.width = progress + '%';
                progressBar.textContent = progress + '%';

                addLog(`Processing Route ${i + 1}/${parsedData.length}: ${route.from} → ${route.to}`, 'info');

                try {
                    // Geocode start location
                    addLog(`  Geocoding: ${route.from}...`, 'info');
                    const startGeo = await geocodeLocation(route.from);
                    
                    if (!startGeo.success) {
                        throw new Error(`Failed to geocode start location: ${route.from}`);
                    }

                    // Geocode end location
                    addLog(`  Geocoding: ${route.to}...`, 'info');
                    const endGeo = await geocodeLocation(route.to);
                    
                    if (!endGeo.success) {
                        throw new Error(`Failed to geocode end location: ${route.to}`);
                    }

                    // Prepare route data
                    const routeData = {
                        route_number: route.route_number || `Route-${i + 1}`,
                        from: route.from,
                        to: route.to,
                        start_lat: startGeo.latitude,
                        start_lng: startGeo.longitude,
                        end_lat: endGeo.latitude,
                        end_lng: endGeo.longitude,
                        distance_km: parseFloat(route.distance_km) || 0,
                        fare: parseFloat(route.fare) || 0,
                        status: 'active',
                        created_at: firebase.firestore.FieldValue.serverTimestamp(),
                        uploaded_by: 'admin',
                        upload_method: 'bulk_import'
                    };

                    // Save to Firestore
                    await db.collection('bus_routes').add(routeData);

                    addLog(`  ✅ Route saved successfully!`, 'success');
                    successCount++;

                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error) {
                    addLog(`  ❌ Error: ${error.message}`, 'error');
                    errorCount++;
                }
            }

            addLog(`\n🎉 Upload Complete!`, 'success');
            addLog(`✅ Successfully uploaded: ${successCount} routes`, 'success');
            if (errorCount > 0) {
                addLog(`❌ Failed: ${errorCount} routes`, 'error');
            }

            progressBar.style.background = 'linear-gradient(90deg, #4caf50, #66bb6a)';
        }

        // Add Log Entry
        function addLog(message, type = 'info') {
            const statusLog = document.getElementById('statusLog');
            const logItem = document.createElement('div');
            logItem.className = `status-item ${type}`;
            
            const icon = type === 'success' ? '✅' : 
                        type === 'error' ? '❌' : 
                        type === 'warning' ? '⚠️' : 'ℹ️';
            
            logItem.innerHTML = `<span>${icon}</span><span>${message}</span>`;
            statusLog.appendChild(logItem);
            statusLog.scrollTop = statusLog.scrollHeight;
        }

        // Reset Upload
        function resetUpload() {
            document.getElementById('fileInput').value = '';
            document.getElementById('previewTable').style.display = 'none';
            document.getElementById('actionButtons').style.display = 'none';
            document.getElementById('progressSection').style.display = 'none';
            document.getElementById('statusLog').innerHTML = '';
            parsedData = [];
        }
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
