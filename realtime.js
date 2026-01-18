let appMode = 'manual';
let mapInstance = null;
let mapMarker = null;
let selectedLat = 0;
let selectedLon = 0;

// --- 1. MODE SWITCHING ---
function setMode(mode) {
    appMode = mode;
    const btnMan = document.getElementById('btnManual');
    const btnRT = document.getElementById('btnRealTime');
    const rtPanel = document.getElementById('realTimePanel');
    const sIrr = document.getElementById('slider-irr');
    const sTemp = document.getElementById('slider-temp');

    if (mode === 'realtime') {
        btnMan.classList.remove('active');
        btnRT.classList.add('active');
        rtPanel.classList.add('open');

        // Visually Lock Sliders (User cannot drag, but code can move them)
        sIrr.disabled = true; sIrr.style.opacity = '0.6'; sIrr.style.cursor = 'not-allowed';
        sTemp.disabled = true; sTemp.style.opacity = '0.6'; sTemp.style.cursor = 'not-allowed';
    } else {
        btnRT.classList.remove('active');
        btnMan.classList.add('active');
        rtPanel.classList.remove('open');

        // Unlock Sliders
        sIrr.disabled = false; sIrr.style.opacity = '1'; sIrr.style.cursor = 'pointer';
        sTemp.disabled = false; sTemp.style.opacity = '1'; sTemp.style.cursor = 'pointer';
    }
}

function toggleCoordInput() {
    const el = document.getElementById('manual-coords-input');
    el.style.display = (el.style.display === 'none') ? 'block' : 'none';
}

// --- 2. OPTION A: LIVE LOCATION ---
function getLocation() {
    const status = document.getElementById('rt-status');
    
    // 1. Show "Waiting" status
    // CHANGE THIS LINE:
    status.innerHTML = "<span style='color:white'>Requesting </span><br><span style='color:white; font-weight:bold;'>Location Access</span>";
    
    if (!navigator.geolocation) {
        status.innerText = "Geolocation not supported by browser.";
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            // Success
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            fetchData(lat, lon);
        },
        (err) => { 
            // Error / Denied
            console.error(err);
            status.innerHTML = "<span style='color:red'>Location Denied.</span><br>Please enable"; 
        }
    );
}

// --- 3. OPTION B: MAP MODAL ---
function openMap() {
    document.getElementById('map-modal').style.display = 'flex';
    if (!mapInstance) {
        mapInstance = L.map('leaflet-map').setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap', maxZoom: 18
        }).addTo(mapInstance);

        mapInstance.on('click', function(e) {
            if (mapMarker) mapInstance.removeLayer(mapMarker);
            mapMarker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(mapInstance);
            selectedLat = e.latlng.lat;
            selectedLon = e.latlng.lng;
            document.getElementById('selected-coords').innerText = `Lat: ${selectedLat.toFixed(2)}, Lon: ${selectedLon.toFixed(2)}`;
        });
    }
    setTimeout(() => { mapInstance.invalidateSize(); }, 100);
}
function closeMap() { document.getElementById('map-modal').style.display = 'none'; }
function confirmLocation() { closeMap(); fetchData(selectedLat, selectedLon); }
function searchLocation() {
    const q = document.getElementById('map-search').value;
    if(!q) return;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`)
    .then(r=>r.json()).then(d=>{
        if(d[0]) {
            const lat = parseFloat(d[0].lat); const lon = parseFloat(d[0].lon);
            mapInstance.setView([lat,lon], 10);
            if (mapMarker) mapInstance.removeLayer(mapMarker);
            mapMarker = L.marker([lat,lon]).addTo(mapInstance);
            selectedLat = lat; selectedLon = lon;
        }
    });
}

// --- 4. OPTION C: MANUAL COORDS ---
function fetchWeatherByCoords() {
    const lat = document.getElementById('inpLat').value;
    const lon = document.getElementById('inpLon').value;
    if(lat && lon) fetchData(lat, lon);
}
// ---// --- 5. FETCH DATA (UPDATED) ---
function fetchData(lat, lon) {
    const status = document.getElementById('rt-status');
    status.innerHTML = "<span style='color:white'>Analysing..</span> <span style='color:white; animation:blink 1s infinite'>●</span>";
    status.style.borderLeftColor = "#e7edefff";

    // CHANGE: Request BOTH 'temperature_2m' AND 'shortwave_radiation'
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,shortwave_radiation&hourly=temperature_2m,shortwave_radiation&forecast_days=1&timezone=auto`;
    
    // Geo Request (Unchanged)
    const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;

    Promise.all([
        fetch(weatherUrl).then(r => r.json()),
        fetch(geoUrl).then(r => r.json().catch(() => ({})))
    ])
    .then(([weatherData, geoData]) => {
        
        if (!weatherData.current) throw new Error("Weather Data Missing");

        const G = weatherData.current.shortwave_radiation; 
        const T = weatherData.current.temperature_2m;
        
        let placeName = "Unknown Location";
        if(geoData && geoData.address) {
            placeName = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.county || "Unknown Location";
        }

        status.innerHTML = `
            <div style="font-weight:bold; color:white; margin-bottom:2px;">${placeName}</div>
            <div style="display:flex; justify-content:space-between; margin-top:4px;">
                <span>☀ ${G} W/m²</span>
                <span>🌡 ${T} °C</span>
            </div>
        `;
        // ADD THIS LINE:
       if(typeof logEvent === "function") {
    // Wait 0.5 seconds for the dashboard numbers to update
    setTimeout(() => {
        logEvent("WEATHER UPDATE", `Location: ${placeName} | Irr: ${G} W/m² | Temp: ${T}°C`);
    }, 500); 
}
        
        status.style.borderLeftColor = "#00e676"; 

        applyRealTimeData(G, T);

        // Pass all hourly data to the chart function
        if(weatherData.hourly) {
            updateChart(weatherData.hourly);
        }
    })
    .catch(err => {
        console.error(err);
        status.innerHTML = "<span style='color:red'>Connection Failed.</span>";
        status.style.borderLeftColor = "red";
    });

    // ... inside fetchData .then() ...



}
// -// --- 6. MOVE SLIDERS & UPDATE SCENE (FIXED) ---
function applyRealTimeData(G, T) {
    // 1. Move Temp Slider
    const sTemp = document.getElementById('slider-temp');
    if (sTemp) sTemp.value = T;

    // 2. Move Irradiance Slider (Visual mapping only)
    const sIrr = document.getElementById('slider-irr');
    if (sIrr) {
        let targetSliderVal = 0;
        if (G > 0) {
            targetSliderVal = (G / 1000) * 50; 
            if (targetSliderVal > 50) targetSliderVal = 50; 
            if (targetSliderVal < 5 && G > 5) targetSliderVal = 5; 
        }
        sIrr.value = targetSliderVal;
    }

    // 3. CRITICAL: Pass the EXACT data to script.js
    // We pass G and T directly as arguments so they can't get lost
    if(typeof window.updateInputs === 'function') {
        window.updateInputs(true, G, T); 
    }
}

// --- NEW CHART LOGIC ---
let myChart = null; // Global variable to store chart instance
// --- NEW CHART LOGIC (DUAL AXIS: POWER + TEMP) ---

function updateChart(hourlyData) {
    const ctx = document.getElementById('tempChart').getContext('2d');
    
    // 1. Time Labels
    const labels = hourlyData.time.map(t => t.slice(11, 16)); 
    
    // 2. Data Arrays
    const powerData = hourlyData.shortwave_radiation;
    const tempData = hourlyData.temperature_2m;

    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Irradiance (W/m²)',
                    data: powerData,
                    borderColor: '#ff9100', // Orange
                    backgroundColor: 'rgba(255, 145, 0, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.4,
                    yAxisID: 'y', // Left Axis
                    fill: true
                },
                {
                    label: 'Temperature (°C)',
                    data: tempData,
                    borderColor: '#21CBF3', // Cyan
                    backgroundColor: 'transparent', // No fill for temp to keep it clean
                    borderWidth: 2,
                    borderDash: [5, 5], // Dashed line to distinguish
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.4,
                    yAxisID: 'y1' // Right Axis
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { 
                    display: true,
                    labels: { color: '#aaa', font: {size: 10}, boxWidth: 10 }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff'
                }
            },
            scales: {
                x: {
                    display: true, 
                    grid: { display: false },
                    ticks: { color: '#666', font: {size: 8}, maxTicksLimit: 6 }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'W/m²', color: '#ff9100', font:{size:9} },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#ff9100', font: {size: 8} }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: '°C', color: '#21CBF3', font:{size:9} },
                    grid: { display: false }, // Hide grid for 2nd axis to avoid clutter
                    ticks: { color: '#21CBF3', font: {size: 8} }
                }
            }
        }
    });
}

function toggleChart() {
    const chartPanel = document.getElementById('chart-wrapper');
    const isVisible = chartPanel.classList.contains('active');
    
    if (isVisible) {
        chartPanel.classList.remove('active');
        setTimeout(() => { chartPanel.style.display = 'none'; }, 300);
    } else {
        chartPanel.style.display = 'block';
        setTimeout(() => { chartPanel.classList.add('active'); }, 10);
    }
}