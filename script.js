// --- FORCE HIDE ON LOAD ---
document.addEventListener("DOMContentLoaded", function() {
    // Ensure the panel spec button is hidden when page loads
    document.getElementById('fixed-left-container').style.display = 'none';
});

let selectedAlgorithm = 'pno'; // Default
// --- 1. THREE.JS ENGINE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); 

const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 2000);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; 
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
renderer.toneMapping = THREE.ACESFilmicToneMapping; 
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// --- A. THE FLOOR ---
const floorGeo = new THREE.PlaneGeometry(600, 600);
const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0x111111, roughness: 0.7, metalness: 0.1 
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const gridHelper = new THREE.GridHelper(600, 300, 0x333333, 0x111111);
scene.add(gridHelper);

// --- B. PV PANEL ASSETS ---
function createPanelTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a00cc'; 
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#000033'; ctx.lineWidth = 6; ctx.beginPath();
    const cols = 6; const stepX = 512 / cols;
    for (let i = 1; i < cols; i++) { ctx.moveTo(i * stepX, 0); ctx.lineTo(i * stepX, 512); }
    const rows = 10; const stepY = 512 / rows;
    for (let i = 1; i < rows; i++) { ctx.moveTo(0, i * stepY); ctx.lineTo(512, i * stepY); }
    ctx.stroke();
    ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < cols; i++) {
        const cellX = i * stepX;
        ctx.moveTo(cellX + (stepX * 0.25), 0); ctx.lineTo(cellX + (stepX * 0.25), 512);
        ctx.moveTo(cellX + (stepX * 0.50), 0); ctx.lineTo(cellX + (stepX * 0.50), 512);
        ctx.moveTo(cellX + (stepX * 0.75), 0); ctx.lineTo(cellX + (stepX * 0.75), 512);
    }
    ctx.stroke();
    return new THREE.CanvasTexture(canvas);
}

const panelTexture = createPanelTexture();
panelTexture.anisotropy = renderer.capabilities.getMaxAnisotropy(); 

const panelGeo = new THREE.BoxGeometry(4, 0.1, 2.5); 
const panelMat = new THREE.MeshPhysicalMaterial({
    map: panelTexture, color: 0xffffff, emissive: 0x000066, emissiveIntensity: 0.4,      
    metalness: 0.2, roughness: 0.6, clearcoat: 1.0, reflectivity: 1.0            
});

const standGeo = new THREE.CylinderGeometry(0.1, 0.1, 1);
const standMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

const solarArray = new THREE.Group();
scene.add(solarArray);

function buildSolarGrid(rows, cols) {
    while(solarArray.children.length > 0){ 
        solarArray.remove(solarArray.children[0]); 
    }
    const gapX = 0.2; 
    const gapZ = 0.5; 
    const pWidth = 4;
    const pDepth = 2.5;

    const totalWidth = (cols * pWidth) + ((cols - 1) * gapX);
    const totalDepth = (rows * pDepth) + ((rows - 1) * gapZ);
    
    const startX = -(totalWidth / 2) + (pWidth/2);
    const startZ = -(totalDepth / 2) + (pDepth/2);

    for(let c = 0; c < cols; c++) {
        for(let r = 0; r < rows; r++) {
            const posX = startX + (c * (pWidth + gapX)); 
            const posZ = startZ + (r * (pDepth + gapZ)); 

            const pMesh = new THREE.Mesh(panelGeo, panelMat);
            pMesh.position.set(posX, 1, posZ);
            pMesh.castShadow = true;
            pMesh.receiveShadow = true;
            solarArray.add(pMesh);

            const sMesh = new THREE.Mesh(standGeo, standMat);
            sMesh.position.set(posX, 0.5, posZ);
            sMesh.castShadow = true;
            sMesh.receiveShadow = true;
            solarArray.add(sMesh);
        }
    }
}

// --- C. SUN SYSTEM ---
const sunContainer = new THREE.Group();
scene.add(sunContainer);

// 1. Physics Light (Distant)
const sunLight = new THREE.PointLight(0xffaa00, 3, 0); 
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 4096; 
sunLight.shadow.mapSize.height = 4096;
sunLight.shadow.bias = -0.0001;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 1000;
sunContainer.add(sunLight);

// 2. Visual Sphere (Distant)
const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(15, 64, 64), 
    new THREE.MeshBasicMaterial({ color: 0xffffff })
);
sunContainer.add(sunMesh);

// 3. UI Marker (Local Orbiting Dot)
const uiSunGeo = new THREE.SphereGeometry(0.1, 16, 16);
const uiSunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const uiSunMarker = new THREE.Mesh(uiSunGeo, uiSunMat);
scene.add(uiSunMarker);

// 4. Glow Sprite (Attached to Marker)
const glowCanvas = document.createElement('canvas');
glowCanvas.width = 64; glowCanvas.height = 64;
const gCtx = glowCanvas.getContext('2d');
const gradient = gCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); 
gradient.addColorStop(0.2, 'rgba(255, 230, 100, 1)');
gradient.addColorStop(0.5, 'rgba(255, 150, 0, 0.5)');
gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
gCtx.fillStyle = gradient;
gCtx.fillRect(0, 0, 64, 64);

const uiSunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowCanvas),
    color: 0xffaa00,
    blending: THREE.AdditiveBlending,
    depthTest: false
}));
uiSunGlow.scale.set(10, 10, 1);
uiSunMarker.add(uiSunGlow);

// 5. Orbit Line
const orbitLineGeo = new THREE.BufferGeometry();
const orbitLineMat = new THREE.LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.3 });
const orbitLine = new THREE.Line(orbitLineGeo, orbitLineMat);
scene.add(orbitLine);

const ambientLight = new THREE.AmbientLight(0x404040, 0.2); 
scene.add(ambientLight);

// --- GLOBAL APP STATE ---
window.appMode = 'manual';
let appState = {
    active: false, 
    panelSpecs: null, 
    configRows: 2, 
    configCols: 2,
    orbitX: 50,
    orbitY: 30,
    currentVoltage: 0, 
    currentPower: 0, 
    lastPower: 0, 
    voltageStep: 0.5, 
    direction: 1      
};

const inputs = { G: 0, T: 25 };

/// --- D. LOGIC: SUN MOVEMENT (UPDATED FOR BETTER VISIBILITY) ---
function updateSunAndEnvironment(sliderValue) { 
    // 1. VISUAL ADJUSTMENT
    // We map 0-100 slider to 0-180 degrees (Sunrise to Sunset)
    // Old logic started at -10 degrees, which buried the sun.
    // New logic starts at 0 degrees so it's visible immediately.
    
    // Normalize slider (0 to 100) -> (0 to 1)
    const fraction = sliderValue / 100;
    
    // Calculate Angle: 0 radians (Sunrise) to PI radians (Sunset)
    // We add a tiny offset (0.1) so 0 isn't perfectly flat, keeping it visible
    const angle = (fraction * Math.PI); 

    // Calculate Height Factor (Sine Wave)
    // sin(0) = 0, sin(PI/2) = 1 (Noon), sin(PI) = 0
    let heightFactor = Math.sin(angle);
    
    // TWEAK: Boost low values. If height is low but > 0, lift it slightly
    // This makes 200W look higher than it physically is, for better UX
    if (heightFactor > 0 && heightFactor < 0.3) {
        heightFactor = heightFactor + 0.1; // Lift the sun visually
    }

    // Calculate Physics Irradiance (Max 1000 W/m2)
    // We use the raw sine wave for physics accuracy, but boosted for visuals
    const irradiance = Math.max(0, Math.sin(angle) * 1000);

    // A. MAIN SUN (Physics Light)
    // We use the 'lifted' height for position so users can see it
    sunContainer.position.set(
        400 * -Math.cos(angle), // X movement (East to West)
        400 * heightFactor,     // Y movement (Height - using boosted value)
        -50
    );
    sunContainer.lookAt(0,0,0);

    // B. MINI SUN (Visual UI)
    const rX = appState.orbitX; 
    const rY = appState.orbitY;
    
    const uiX = rX * -Math.cos(angle);
    const uiY = rY * heightFactor; // Use boosted height
    uiSunMarker.position.set(uiX, uiY, 0);

    // C. VISIBILITY LOGIC
    // Show scene if irradiance > 1 OR slider is not at absolute 0
    if (sliderValue > 0.5 && sliderValue < 99.5) { 
        sunContainer.visible = true;
        uiSunMarker.visible = true;
        orbitLine.visible = true;

        // Lighting intensity
        sunLight.intensity = 3 * heightFactor; 
        ambientLight.intensity = 0.1 + (heightFactor * 0.2); 
        
        // Color Shift (Reddish at low angles, White at high)
        const sunColor = new THREE.Color().setHSL(0.1 + (heightFactor * 0.08), 1.0, 0.5 + (heightFactor * 0.4));
        uiSunGlow.material.color = sunColor; 
        sunMesh.material.color = sunColor;

    } else {
        // Night Mode
        sunContainer.visible = false;
        uiSunMarker.visible = false;
        orbitLine.visible = false;
        ambientLight.intensity = 0.02; 
    }
    
    return irradiance;
}
function animate() {
    requestAnimationFrame(animate);
    solarArray.rotation.y = Math.sin(Date.now() * 0.00005) * 0.02;
    renderer.render(scene, camera);
}
animate();

// --- UPDATED CHART (Logical Interpretation) ---
let chart;
function initChart() {
    const chartCtx = document.getElementById('liveChart').getContext('2d');
    
    // CRITICAL FIX: Destroy old chart to prevent crash
    if(chart) {
        chart.destroy();
    }
    
    chart = new Chart(chartCtx, {
        type: 'line',
        data: {
            labels: Array(30).fill(''),
            datasets: [
                { 
                    label: 'Power (W)',
                    data: Array(30).fill(0), 
                    borderColor: '#00e676', 
                    backgroundColor: 'rgba(0, 230, 118, 0.1)',
                    borderWidth: 2, 
                    tension: 0.3, 
                    fill: true, 
                    pointRadius: 0,
                    yAxisID: 'y'
                },
                { 
                    label: 'Voltage (V)',
                    data: Array(30).fill(0), 
                    borderColor: '#21CBF3', 
                    backgroundColor: 'rgba(33, 203, 243, 0.05)',
                    borderWidth: 1, 
                    borderDash: [5, 5],
                    tension: 0.3, 
                    fill: false, 
                    pointRadius: 0,
                    yAxisID: 'y1'
                }
            ]
        },
        options: { 
            maintainAspectRatio: false,
            animation: false, // Turn off animation for smoother live updates
            plugins: { 
                legend: { display: true, labels: { color: '#888', font: {size: 9} } } 
            }, 
            scales: { 
                x: { display: false }, 
                y: { 
                    display: true, 
                    position: 'left',
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#00e676', font: {size: 9} }
                },
                y1: { 
                    display: true, 
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#21CBF3', font: {size: 9} }
                }
            }, 
            responsive: true 
        }
    });
}
// Initialize empty chart on load
initChart();

// --- UI FUNCTIONS ---

// 1. OPEN SETUP (Hide Dashboard)
window.openSetup = function() {
    document.getElementById('setup-overlay').style.display = 'flex';
    document.getElementById('ui-layer').style.display = 'none';
    
    // NEW LINE: Hide the side button when configuring
   document.getElementById('fixed-left-container').style.display = 'none';
    document.getElementById('setup-title').innerText = "Update Configuration";
    document.getElementById('btn-init').innerText = "Update Simulation";
};

// 2. START / UPDATE SIMULATION (Show Dashboard)
window.startApp = function() {
    const errorBox = document.getElementById('config-error');
    const rowInput = document.getElementById('setup-rows');
    const colInput = document.getElementById('setup-cols');

    let r = parseInt(rowInput.value);
    let c = parseInt(colInput.value);
    
    // Cap values strictly for performance
    if (r > 20 || c > 20) {
        errorBox.style.display = 'block';
        if (r > 20) r = 20;
        if (c > 20) c = 20;
        rowInput.value = r;
        colInput.value = c;
    } else {
        errorBox.style.display = 'none';
    }
    if (r < 1) r = 1; 
    if (c < 1) c = 1;

    appState.panelSpecs = JSON.parse(document.getElementById('panel-select').value);

    
    // Capture MPPT Algo
    const algoEl = document.getElementById('algo-select');
    appState.algorithm = algoEl ? algoEl.value : 'pno'; 

    // Capture Converter Type
    const convEl = document.getElementById('conv-select');
    appState.converter = convEl ? convEl.value : 'buck';
    appState.configRows = r;
    appState.configCols = c;

    buildSolarGrid(appState.configRows, appState.configCols);

    // --- 1. CALCULATE DIMENSIONS ---
    const pWidth = 4; const pGap = 0.2;
    const totalWidth = (c * pWidth) + ((c - 1) * pGap);
    const totalDepth = (r * 2.5) + ((r - 1) * 0.5);
    
    const maxDim = Math.max(totalWidth, totalDepth);

    // --- 2. DYNAMIC ORBIT & ZOOM ---
    appState.orbitX = Math.max((maxDim / 2) * 1.6, 8); 
    appState.orbitY = Math.max((maxDim / 2) * 1.2, 5); 

    // --- 3. FIX SUN SIZE SCALING ---
    const sunScale = appState.orbitX / 3.5; 
    uiSunGlow.scale.set(sunScale, sunScale, 1);

    // --- 4. DRAW ORBIT LINE ---
    const orbitPoints = [];
    for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI; 
        const ox = appState.orbitX * -Math.cos(a);
        const oy = appState.orbitY * Math.sin(a);
        orbitPoints.push(new THREE.Vector3(ox, oy, 0));
    }
    orbitLine.geometry.setFromPoints(orbitPoints);

    // --- 5. CAMERA AUTO-ZOOM ---
    let camDist = maxDim * 1.5; 
    if(camDist < 12) camDist = 12; 
    const camHeight = camDist * 0.6; 

    camera.position.set(0, camHeight, camDist);
    camera.lookAt(0, 0, 0);

    // --- FINAL SETUP & SCREEN SWITCHING ---
    document.getElementById('setup-overlay').style.display = 'none'; // Hide Setup
    document.getElementById('ui-layer').style.display = 'flex';      // Show Dashboard (CRITICAL FIX)

    document.getElementById('fixed-left-container').style.display = 'flex';
    document.getElementById('panel-name-display').innerText = "MODEL: " + appState.panelSpecs.name.toUpperCase();
    
    // Re-init chart with fresh data
    initChart();

    // Force Environment Update
    const currentSliderVal = parseFloat(document.getElementById('slider-irr').value);
    const irr = updateSunAndEnvironment(currentSliderVal);
    inputs.G = irr; 
    document.getElementById('val-irr').innerText = irr.toFixed(0) + " W/m²";

    appState.active = true;
    if(window.physicsInterval) clearInterval(window.physicsInterval);
    window.physicsInterval = setInterval(physicsLoop, 100); 

    if (typeof logEvent === "function") {
        logEvent("CONFIG UPDATE", `Setup: ${appState.configRows}x${appState.configCols}, Panel: ${appState.panelSpecs.name}, Algo: ${appState.algorithm}`);
    }
};

// --- STRICT VALIDATION & CUSTOM PANEL CREATION ---
window.validateCustomPanel = function() {
    const errorBox = document.getElementById('custom-error');
    errorBox.style.display = 'none';

    // 1. GET RAW VALUES
    const nameStr = document.getElementById('cust-name').value.trim();
    const pmaxStr = document.getElementById('cust-pmax').value;
    const vocStr  = document.getElementById('cust-voc').value;
    const iscStr  = document.getElementById('cust-isc').value;
    const vmpStr  = document.getElementById('cust-vmp').value;
    const cvStr   = document.getElementById('cust-cv').value;
    const ciStr   = document.getElementById('cust-ci').value;

    // 2. ERROR IF ANY FIELD IS EMPTY (Strict Check)
    if (!nameStr) return showError("❌ MISSING: Please enter a Model Name.");
    if (!iscStr)  return showError("❌ MISSING: Short Circuit Current (Isc) is required.");
    if (!pmaxStr) return showError("❌ MISSING: Max Power (Pmax) is required.");
    if (!cvStr)   return showError("❌ MISSING: Temp Coeff Voc is required.");
    if (!vmpStr)  return showError("❌ MISSING: Voltage at Max Power (Vmp) is required.");
    if (!ciStr)   return showError("❌ MISSING: Temp Coeff Isc is required.");
    if (!vocStr)  return showError("❌ MISSING: Open Circuit Voltage (Voc) is required.");

    // 3. PARSE NUMBERS
    const pmax = parseFloat(pmaxStr);
    const voc  = parseFloat(vocStr);
    const isc  = parseFloat(iscStr);
    const vmp  = parseFloat(vmpStr);
    const cV   = parseFloat(cvStr);
    const cI   = parseFloat(ciStr);

    // 4. PHYSICS CONSTRAINTS (Real-world Logic)

    // Rule A: Voltage Check (Voc > Vmp)
    if (voc <= vmp) {
        return showError(`⚠️ PHYSICS ERROR: Voc (${voc}V) must be greater than Vmp (${vmp}V).`);
    }

    // Rule B: Current Check (Isc > Imp)
    // Imp (Current at Max Power) = Pmax / Vmp. Isc must be higher.
    const calculatedImp = pmax / vmp;
    if (isc <= calculatedImp) {
        return showError(`⚠️ PHYSICS ERROR: Isc (${isc}A) is too low. To achieve ${pmax}W at ${vmp}V, you need at least ${calculatedImp.toFixed(2)}A.`);
    }

    // Rule C: Impossible Efficiency (Pmax > Voc * Isc)
    const theoreticalMax = voc * isc;
    if (pmax >= theoreticalMax) {
        return showError(`⚠️ IMPOSSIBLE PHYSICS: Pmax (${pmax}W) cannot exceed Voc × Isc (${theoreticalMax.toFixed(1)}W). This implies >100% efficiency.`);
    }

    // Rule D: Temperature Coefficient Logic
    if (cV > 0) {
        return showError(`⚠️ UNUSUAL PARAMETER: Temp Coeff for Voltage (cV) is usually negative (e.g., -0.25). You entered positive.`);
    }

    // Rule E: Fill Factor Check (Too Low)
    if (pmax < (voc * isc) * 0.5) {
        return showError(`⚠️ INEFFICIENT DESIGN: Your Fill Factor is dangerously low (<50%). Check your Pmax or Voltage values.`);
    }

    // Rule F: Hard Caps (Prevent browser crashing values)
    if (voc > 400 || isc > 50) {
        return showError(`⚠️ VALUE LIMIT: Voltage > 400V or Current > 50A is too high for a single module simulation.`);
    }

    // 5. SUCCESS: Create and Apply
    const customPanel = {
        name: nameStr + " (Custom)",
        pmax: pmax,
        voc: voc,
        isc: isc,
        vmp: vmp,
        cV: cV / 100, // Convert percentage to decimal
        cI: cI / 100
    };

    // Add to main dropdown
    const select = document.getElementById('panel-select');
    const option = document.createElement("option");
    option.text = customPanel.name;
    option.value = JSON.stringify(customPanel);
    select.add(option);
    
    // Auto-select the new panel
    select.selectedIndex = select.options.length - 1;

    // Close Modal and return to Main Setup
    closeCustomModal();
};

// Helper to show error
function showError(msg) {
    const el = document.getElementById('custom-error');
    el.innerText = msg;
    el.style.display = 'block';
}

// --- 1. OPEN CUSTOM WINDOW (AND HIDE UI) ---
window.swapToCustomConfig = function() {
    document.getElementById('setup-overlay').style.display = 'none'; // Hide Main Setup
    document.getElementById('ui-layer').style.display = 'none';      // Hide Graph/Dashboard
    document.getElementById('custom-modal').style.display = 'flex';  // Show Custom (Flex centers it)
};

// --- 2. CLOSE CUSTOM WINDOW (AND RESTORE UI) ---
window.closeCustomModal = function() {
    document.getElementById('custom-modal').style.display = 'none';  // Hide Custom
    // If we are setting up, return to setup overlay
    document.getElementById('setup-overlay').style.display = 'flex'; 
};
// Inside script.js

function physicsLoop() {
    if(!appState.active) return;
    const specs = appState.panelSpecs; 
    const G = inputs.G; 
    const T = inputs.T;

    // --- 1. ENVIRONMENT ---
    const thermalFactorV = 1 + (specs.cV * (T - 25)); 
    let lightFactorV = (G > 0) ? 1 + (0.045 * Math.log(G / 1000)) : 0;
    if (lightFactorV < 0) lightFactorV = 0;

    const panelVoc_Now = specs.voc * thermalFactorV * lightFactorV;
    const panelIsc_Now = specs.isc * (G / 1000);

    const sysVoc = panelVoc_Now * appState.configRows;
    const sysIsc = panelIsc_Now * appState.configCols;

    if(G < 10) { 
        updateDashboard(0, 0, "IDLE (NIGHT)");
        if (typeof updateAnalysis === "function") 
            updateAnalysis(0, T, specs, {v:0,i:0,p:0}, appState.converter, appState.configRows);
        return;
    }

    if(appState.currentVoltage === 0) appState.currentVoltage = sysVoc * 0.7;

    // --- 2. PV CURVE ---
    let I_operating = sysIsc * (1 - Math.pow((appState.currentVoltage / sysVoc), 15)); 
    if(I_operating < 0) I_operating = 0;
    let P_operating = appState.currentVoltage * I_operating;

    // --- 3. MPPT LOGIC ---
    let statusTxt = "";

    // *** FIX: DETECT ANY CHANGE (Sun, Temp, or Algorithm) ***
    
    // 1. Initialize Memory if undefined
    if (appState.lastG === undefined) appState.lastG = G;
    if (appState.lastT === undefined) appState.lastT = T;
    if (appState.lastAlgo === undefined) appState.lastAlgo = appState.algorithm;

    // 2. Measure Changes
    const dG = Math.abs(G - appState.lastG);      // Change in Sun
    const dT = Math.abs(T - appState.lastT);      // Change in Temperature
    const algoChanged = (appState.algorithm !== appState.lastAlgo); // Change in Algorithm

    // 3. Reset Lock if ANYTHING changes significantly
    // (Sun > 1W, Temp > 0.5C, or Algorithm Switched)
    if (dG > 1.0 || dT > 0.5 || algoChanged) {
        appState.isLocked = false;        // <--- This resets the "Pop" capability
        appState.stabilityTimer = Date.now(); 
        appState.anchorVoltage = appState.currentVoltage; 
        appState.voltageHistory = [];     // Wipe P&O history
        
        // Update Memory
        appState.lastG = G;
        appState.lastT = T;
        appState.lastAlgo = appState.algorithm;
    }

    if (appState.algorithm === 'incCond') {
        // --- INCREMENTAL CONDUCTANCE ---
        let stepSize = sysVoc * 0.002;
        const dV = appState.currentVoltage - appState.lastVoltage;
        const dI = I_operating - appState.lastCurrent;
        let isAtPeak = false;

        if (Math.abs(dV) > 0.05) {
            const instantaneous = I_operating / appState.currentVoltage; 
            const incremental = dI / dV; 
            if (Math.abs(incremental + instantaneous) < 0.05) isAtPeak = true;
            else {
                if (incremental > -instantaneous) appState.currentVoltage += stepSize;
                else appState.currentVoltage -= stepSize;
                appState.stabilityTimer = Date.now(); 
            }
        } else {
            isAtPeak = true;
        }

        if (isAtPeak) {
            if ((Date.now() - appState.stabilityTimer) < 3000) {
                appState.currentVoltage += (Math.random() > 0.5 ? 0.05 : -0.05); 
                statusTxt = "INC. COND (VERIFYING)";
                appState.isLocked = false;
            } else {
                statusTxt = "INC. COND (LOCKED)";
                if (!appState.isLocked) { 
                    playSuccessSound(); 
                    appState.isLocked = true; 
                }
            }
        } else {
            statusTxt = "INC. COND (TUNING)";
            appState.isLocked = false;
        }

    } else {
        // --- PERTURB & OBSERVE ---
        let stepSize = sysVoc * 0.012; 
        const dP = P_operating - appState.lastPower;

        if (!appState.voltageHistory) appState.voltageHistory = [];

        if (dP > 0) appState.currentVoltage += (stepSize * appState.direction);
        else {
            appState.direction *= -1;
            appState.currentVoltage += (stepSize * appState.direction);
        }

        appState.voltageHistory.push(appState.currentVoltage);
        
        if (appState.voltageHistory.length > 60) {
            appState.voltageHistory.shift(); 
        }

        if (appState.voltageHistory.length >= 60) {
            let minV = Math.min(...appState.voltageHistory);
            let maxV = Math.max(...appState.voltageHistory);
            let spread = maxV - minV;
            let allowedSpread = sysVoc * 0.05; 

            if (spread < allowedSpread) {
                statusTxt = "P&O (LOCKED/OSC)";
                if (!appState.isLocked) {
                    playSuccessSound();
                    appState.isLocked = true;
                }
            } else {
                statusTxt = (appState.direction > 0) ? "P&O (CLIMBING \u2191)" : "P&O (CLIMBING \u2193)";
            }
        } else {
            statusTxt = "P&O (STARTING)";
        }
    }

    // --- 4. SAFETY ---
    if(appState.currentVoltage > sysVoc) appState.currentVoltage = sysVoc;
    if(appState.currentVoltage < 1) appState.currentVoltage = 1;

    appState.lastPower = P_operating;
    appState.lastVoltage = appState.currentVoltage;
    appState.lastCurrent = I_operating;

    updateDashboard(P_operating, appState.currentVoltage, statusTxt);

    if (typeof updateAnalysis === "function") {
        updateAnalysis(G, T, specs, { v: appState.currentVoltage, i: I_operating, p: P_operating }, appState.converter, appState.configRows); 
    }
}
// Add this in your main script or init() function
document.getElementById('conv-select').addEventListener('change', function(e) {
    const type = e.target.value;
    const label = document.getElementById('pout-label');
    
    if (type === 'buck') label.innerText = "Buck Output Power (Pout)";
    else if (type === 'boost') label.innerText = "Boost Output Power (Pout)";
    else if (type === 'buckboost') label.innerText = "Buck-Boost Output Power (Pout)";
});
function updateDashboard(power, voltage, status) {
    document.getElementById('disp-power').innerText = power.toFixed(2) + " W";
    document.getElementById('disp-voltage').innerText = voltage.toFixed(2) + " V";
    document.getElementById('disp-mppt').innerText = "MPPT: " + status;
    
    // Push Data to Chart
    if(chart) {
        chart.data.datasets[0].data.shift(); 
        chart.data.datasets[0].data.push(power); 
        
        chart.data.datasets[1].data.shift(); 
        chart.data.datasets[1].data.push(voltage);
        
        chart.update('none'); // 'none' for performance
    }
}

// --- 1. GLOBAL STATE TRACKER ---
window.appMode = 'manual'; // Required for the new Real-Time switch

const irrSlider = document.getElementById('slider-irr');
const tempSlider = document.getElementById('slider-temp');

// --- 2. EXISTING VALIDATION (Unchanged) ---
function checkInputLimit() {
    const r = parseInt(document.getElementById('setup-rows').value);
    const c = parseInt(document.getElementById('setup-cols').value);
    const errorBox = document.getElementById('config-error');
    if(r > 20 || c > 20) {
        errorBox.style.display = 'block';
    } else {
        errorBox.style.display = 'none';
    }
}
document.getElementById('setup-rows').addEventListener('input', checkInputLimit);
document.getElementById('setup-cols').addEventListener('input', checkInputLimit);

// --- 3. UNIFIED UPDATE FUNCTION ---
// This wrapper allows both the Slider AND the Real-Time API to update the physics
// --- 3. UNIFIED UPDATE FUNCTION (FIXED) ---
// --- 3. UNIFIED UPDATE FUNCTION (DATA INJECTION FIX) ---
// Note: We now accept apiG and apiT as arguments
window.updateInputs = function(fromAPI = false, apiG = null, apiT = null) {

    // GUARD: If in Real-Time mode, ignore manual mouse movements
    if (window.appMode === 'realtime' && !fromAPI) return;

    // A. VISUALS: Always rely on where the slider is currently sitting
    // (realtime.js has already moved the slider for us)
    const sliderVal = parseFloat(document.getElementById('slider-irr').value);
    const tempVal = parseFloat(document.getElementById('slider-temp').value);

    // Update 3D Sun Position based on slider
    const calculatedVisualIrr = updateSunAndEnvironment(sliderVal);

    // B. PHYSICS & DATA: The Critical Split
    if (fromAPI && apiG !== null && apiT !== null) {
        // === REAL TIME PATH ===
        // We ignore the slider's "value" for physics. 
        // We use the PRECISE numbers passed from the API.
        
        // 1. Update the Physics Engine Variables
        inputs.G = apiG;
        inputs.T = apiT;

        // 2. Update the Dashboard Text
        document.getElementById('val-irr').innerText = apiG.toFixed(0) + " W/m²";
        document.getElementById('val-temp').innerText = apiT.toFixed(1) + " °C";

    } else {
        // === MANUAL PATH ===
        // We use the slider's calculated value for physics.

        inputs.G = calculatedVisualIrr;
        inputs.T = tempVal;
        
        document.getElementById('val-irr').innerText = calculatedVisualIrr.toFixed(0) + " W/m²";
        document.getElementById('val-temp').innerText = tempVal.toFixed(1) + " °C";
    }

   
};

// --- 4. RE-ATTACH LISTENERS ---
// Instead of running the logic directly, we call the function above
irrSlider.addEventListener('input', () => window.updateInputs(false));
tempSlider.addEventListener('input', () => window.updateInputs(false));
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
const algoDropdown = document.getElementById('algo-select');
if (algoDropdown) {
    algoDropdown.addEventListener('change', function(e) {
        // 1. Update State Immediately
        appState.algorithm = e.target.value;
        
        // 2. Log it
        if (typeof logEvent === "function") {
            logEvent("ALGO SWITCH", `Control Strategy switched to: ${e.target.value.toUpperCase()}`);
        }
    });
}
// --- PANEL SPECS POPUP LOGIC ---

// --- HOVER LOGIC ---
// --- HOVER INTERACTION LOGIC ---

window.showPanelInfo = function() {
    const specs = appState.panelSpecs;
    if (!specs) return;

    // 1. Fill Data
    document.getElementById('tp-name').innerText = specs.name;
    document.getElementById('tp-pmax').innerText = specs.pmax + " W";
    document.getElementById('tp-voc').innerText  = specs.voc + " V";
    document.getElementById('tp-isc').innerText  = specs.isc + " A";
    document.getElementById('tp-vmp').innerText  = specs.vmp + " V";
    
    // 2. Format Coeffs
    const cvVal = specs.cV !== undefined ? (specs.cV * 100).toFixed(2) : "0.00";
    const ciVal = specs.cI !== undefined ? (specs.cI * 100).toFixed(2) : "0.00";
    document.getElementById('tp-cv').innerText = cvVal + "%";
    document.getElementById('tp-ci').innerText = ciVal + "%";

    // 3. SHOW THE POPUP
    document.getElementById('spec-tooltip').style.display = 'block';
};

window.hidePanelInfo = function() {
    // HIDE THE POPUP
    document.getElementById('spec-tooltip').style.display = 'none';
};

// --- AUDIO GENERATOR ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSuccessSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Sound Design: A high-pitched "Ding"
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
    oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); // Slide up to A6

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);
    
    // Trigger Visual Toast
    const toast = document.getElementById("mppt-toast");
    toast.className = "show";
    
    // Hide after 3 seconds
    setTimeout(function(){ 
        toast.className = toast.className.replace("show", ""); 
    }, 3000);
}

// ==========================================
//   MANUAL EVENT HOOKS (FOR PDF LOGGING)
// ==========================================
// Ensure this runs AFTER the DOM loads
document.addEventListener('DOMContentLoaded', () => {

    // --- HOOK FOR SLIDERS ---
    const irrSliderEl = document.getElementById('slider-irr');
    const tempSliderEl = document.getElementById('slider-temp');

    if (irrSliderEl) {
        irrSliderEl.addEventListener('change', function() {
            // We do NOT read 'this.value' here because it might be unscaled (e.g. 0-50).
            // Instead, we wait for the simulation to process the change,
            // then we read the EXACT value the simulation is using from the global state.
            
            setTimeout(() => {
                // Read from window.latestSimData.irr (Set by updateAnalysis)
                const realIrr = window.latestSimData ? window.latestSimData.irr : this.value;
                logEvent("MANUAL ADJUSTMENT", `Irradiance slider moved to ${realIrr} W/m²`);
            }, 500); 
        });
    }

    if (tempSliderEl) {
        tempSliderEl.addEventListener('change', function() {
            setTimeout(() => {
                // Read from window.latestSimData (Set by updateAnalysis)
                // If the simulation calculates a different temp, we catch it here.
                // We fallback to this.value only if sim data is missing.
                const val = (window.latestSimData && window.latestSimData.temp) 
                            ? window.latestSimData.temp 
                            : this.value; 
                
                logEvent("MANUAL ADJUSTMENT", `Temperature slider moved to ${val}°C`);
            }, 500);
        });
    }

    // --- HOOK FOR PANEL DROPDOWN ---
    const panelSelect = document.getElementById('panel-select');
    if (panelSelect) {
        panelSelect.addEventListener('change', function() {
            let name = "Unknown Panel";
            try {
                const specs = JSON.parse(this.value);
                name = specs.name || "Custom Panel";
            } catch(e) {
                name = this.options[this.selectedIndex].text;
            }
            
            // Panels reset the sim, so give it a slightly longer delay
            setTimeout(() => {
                logEvent("PANEL CHANGED", `PV Module updated to: ${name}`);
            }, 800);
        });
    }
});