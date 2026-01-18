// analysis.js

// --- 1. GLOBAL STATE TRACKER (THE FIX) ---
// This stores the calculated physics values immediately so the Logger can find them.
// This prevents the "stuck at 0" or "stuck at initial value" bug.
window.latestSimData = {
    vin: "0.00",
    iin: "0.00",
    pin: "0.00",
    irr: "0",
    vout: "0.00",
    iout: "0.00",
    pout: "0.00",
    duty: "0.00"
};

// Global memory to track what the graph looked like last frame
let lastGraphState = {
    irr: -1,        // Irradiance
    temp: -1,       // Temperature
    duty: -1,       // Duty Cycle (Result of Algorithm)
    type: '',       // Converter Type (Buck/Boost)
    rows: -1,       // Panel Configuration (Row Count)
    panelVoc: -1,   // Panel Spec Proxy (To detect Panel Type change)
    algo: ''        // Algorithm Name
};
let isDashboardOpen = false;
let pvChart = null;
let ivChart = null;
let pwmChart = null; // New PWM Scope

function toggleDashboard() {
    const dashboard = document.getElementById('dashboard-section');
    isDashboardOpen = !isDashboardOpen;
    
    if (isDashboardOpen) {
        dashboard.classList.add('active');
        // Only re-init if something is broken, otherwise just update
        if (!pvChart || !ivChart) {
             setTimeout(initAllCharts, 200);
        }
    } else {
        dashboard.classList.remove('active');
    }
}
// ---// --- MAIN SIMULATION LOOP (FIXED) ---
function updateAnalysis(irradiance, temp, specs, currentVals, converterType, rowCount) {

    // --- 1. ALWAYS RUN PHYSICS CALCULATIONS (Do not block this!) ---
    // We calculate these FIRST so the Logger always has fresh data, 
    // even if the dashboard is closed or hidden.

    // A. Configuration Safeguards
    if(!converterType) converterType = 'buck';
    if(!rowCount) rowCount = 2; 

    const Vin = currentVals.v; 
    const Pin = currentVals.p;
    
    // B. Dynamic Load Scaling
    const scaleFactor = rowCount / 2.0; 
    const BASE_BUCK_V = 50.0;
    const BASE_BOOST_V = 125.0;
    const BASE_BUCKBOOST_V = 75.0;

    let V_target_load = 50.0; 

    if (converterType === 'buck') V_target_load = BASE_BUCK_V * scaleFactor; 
    else if (converterType === 'boost') V_target_load = BASE_BOOST_V * scaleFactor; 
    else if (converterType === 'buckboost') V_target_load = BASE_BUCKBOOST_V * scaleFactor;

    // C. Calculate Duty Cycle (D)
    let D = 0;
    const droop = (1000 - irradiance) * 0.005 * scaleFactor; 
    const V_actual_load = V_target_load - droop;

    if (Vin > 1) { 
        if (converterType === 'buck') {
            if (V_actual_load >= Vin) D = 0.95; 
            else D = V_actual_load / Vin;
        } else if (converterType === 'boost') {
            if (Vin >= V_actual_load) D = 0.05; 
            else D = 1 - (Vin / V_actual_load);
        } else if (converterType === 'buckboost') {
            D = V_actual_load / (Vin + V_actual_load);
        }
    }

    // Hardware Clamping
    if (D > 0.95) D = 0.95; 
    if (D < 0.05) D = 0.05;

    // D. Output Physics
    const efficiency = 0.96; 
    const Pout_potential = Pin * efficiency;
    const Iout = (V_actual_load > 0) ? Pout_potential / V_actual_load : 0;

    // --- 2. CRITICAL: SAVE DATA TO GLOBAL STATE ---
    // This runs EVERY TIME, ensuring the PDF report is never stuck.
    window.latestSimData = {
        vin: Vin.toFixed(1),
        iin: (Vin > 0 ? Pin/Vin : 0).toFixed(2),
        pin: Pin.toFixed(1),
        irr: irradiance.toFixed(0),
        vout: V_actual_load.toFixed(1),
        iout: Iout.toFixed(2),
        pout: Pout_potential.toFixed(1),
        duty: D.toFixed(3)
    };

    // 1. Get current Algorithm (Safely check if global appState exists)
    const currentAlgo = (typeof appState !== 'undefined' && appState.algorithm) ? appState.algorithm : 'unknown';

    // 2. Check for ANY relevant change
    const hasChanged = 
        Math.abs(irradiance - lastGraphState.irr) > 1 ||     // Irradiance
        Math.abs(temp - lastGraphState.temp) > 0.5 ||        // Temperature
        Math.abs(D - lastGraphState.duty) > 0.001 ||         // Duty Cycle (Visual change)
        converterType !== lastGraphState.type ||             // Converter Switch
        rowCount !== lastGraphState.rows ||                  // Panel Config Change
        specs.voc !== lastGraphState.panelVoc ||             // Panel Type Change (Checks Voc as ID)
        currentAlgo !== lastGraphState.algo;                 // Algorithm Switch

    if (hasChanged) {
        // Update the Charts
        updateStaticCurves(specs, irradiance, temp);
        drawPWMWaveform(D);

        // Save the new state
        lastGraphState = {
            irr: irradiance,
            temp: temp,
            duty: D,
            type: converterType,
            rows: rowCount,
            panelVoc: specs.voc, // We use Voc to recognize if the panel model changed
            algo: currentAlgo
        };
        
        console.log("Graphs Updated: Parameter Change Detected");
    }

    // ------------------------------------------------------------------
    // --- 3. STOP HERE IF DASHBOARD IS CLOSED ---
    // We only block the Visual UI updates to save performance.
    // The data above is already saved!
    if (!isDashboardOpen) return;
    // ------------------------------------------------------------------

    // --- 4. UI LABEL UPDATES (Only if open) ---
    // Titles
    const titleEl = document.getElementById('conv-title');
    if (titleEl) {
        if (converterType === 'buck') titleEl.innerText = "BUCK CONVERTER STATE";
        else if (converterType === 'boost') titleEl.innerText = "BOOST CONVERTER STATE";
        else if (converterType === 'buckboost') titleEl.innerText = "BUCK-BOOST STATE";
    }

    const pLabel = document.getElementById('pout-label');
    if (pLabel) {
        if (converterType === 'buck') pLabel.innerText = "Buck Output Power (Pout)";
        else if (converterType === 'boost') pLabel.innerText = "Boost Output Power (Pout)";
        else if (converterType === 'buckboost') pLabel.innerText = "Buck-Boost Output Power";
    }

    const algoLabel = document.getElementById('algo-display');
    if (algoLabel && typeof appState !== 'undefined') {
        algoLabel.innerText = (appState.algorithm === 'incCond') ? "Inc. Cond" : "P&O";
    }

    // Metrics
    document.getElementById('d-vin').innerText = Vin.toFixed(1) + " V";
    document.getElementById('d-iin').innerText = (Vin > 0 ? Pin/Vin : 0).toFixed(2) + " A";
    document.getElementById('d-pin').innerText = Pin.toFixed(1) + " W";
    document.getElementById('d-irr').innerText = irradiance.toFixed(0) + " W/m²";
    document.getElementById('d-duty').innerText = "D = " + D.toFixed(3);
    document.getElementById('d-vout').innerText = V_actual_load.toFixed(1) + " V";
    document.getElementById('d-iout').innerText = Iout.toFixed(2) + " A";
    document.getElementById('d-pout').innerText = Pout_potential.toFixed(1) + " W";
    
    // Status Text
    let status = converterType.toUpperCase();
    if (D >= 0.95 || D <= 0.05) status += " (LIMIT)";
    else status += " (REGULATING)";
    document.getElementById('d-status').innerText = status;

    // --- 5. UPDATE CHARTS ---
   
}

// --- DRAW SQUARE WAVE PWM ---
function drawPWMWaveform(dutyCycle) {
    if (!pwmChart) return;

    const cyclePoints = 40;
    const highPoints = Math.floor(cyclePoints * dutyCycle);
    const lowPoints = cyclePoints - highPoints;
    
    let waveformData = [];
    let labels = [];

    for(let cycle=0; cycle<3; cycle++) {
        for(let i=0; i<highPoints; i++) {
            waveformData.push(1);
            labels.push("");
        }
        for(let i=0; i<lowPoints; i++) {
            waveformData.push(0);
            labels.push("");
        }
    }

    pwmChart.data.labels = labels;
    pwmChart.data.datasets[0].data = waveformData;
    
    const color = dutyCycle > 0.9 ? '#ff4444' : '#00e676';
    pwmChart.data.datasets[0].borderColor = color;
    pwmChart.data.datasets[0].backgroundColor = color;
    
    pwmChart.update('none');
}

function updateStaticCurves(specs, irradiance, temp) {
    if (!pvChart || !ivChart) return;
    const G_ratio = irradiance / 1000;
    if (G_ratio < 0.01) return;

    const Voc_T = specs.voc * (1 + (specs.cV || -0.003) * (temp - 25));
    const Voc_Real = Voc_T * Math.max(0, 1 + 0.045 * Math.log(G_ratio));
    const Isc_Real = specs.isc * G_ratio;

    let labels = [];
    let pData = [];
    let iData = [];
    const points = 20;

    for (let i = 0; i <= points; i++) {
        let v = (Voc_Real / points) * i;
        let curr = Isc_Real * (1 - Math.pow(v / Voc_Real, 15));
        if (curr < 0) curr = 0;
        labels.push(v.toFixed(1));
        iData.push(curr);
        pData.push(curr * v);
    }
    pvChart.data.labels = labels;
    pvChart.data.datasets[0].data = pData;
    pvChart.update('none');
    ivChart.data.labels = labels;
    ivChart.data.datasets[0].data = iData;
    ivChart.update('none');
}
function initAllCharts() {
    // Destroy old charts if they exist
    if (pvChart) pvChart.destroy();
    if (ivChart) ivChart.destroy();
    if (pwmChart) pwmChart.destroy();

    // --- 1. SETTINGS TO FIX PDF RENDERING ---
    const baseOpts = {
        responsive: true,
        maintainAspectRatio: false, // Allows it to fill the 300px height
        
        // CRITICAL: Turn off animations so toDataURL() captures the full line instantly
        animation: false, 
        animations: {
            colors: false,
            x: false,
            y: false
        },
        transitions: {
            active: {
                animation: {
                    duration: 0 // Zero delay
                }
            }
        },
        
        layout: {
            padding: { left: 10, right: 20, top: 10, bottom: 25 }
        },
        elements: { 
            point: { radius: 0 }, // Hides dots for performance
            line: { tension: 0 }  // Draws straight lines (faster)
        },
        plugins: { legend: { display: false } }
    };

    // --- 2. PV CHART ---
    const ctxPV = document.getElementById('pvCurveChart');
    if(ctxPV) {
        pvChart = new Chart(ctxPV, {
            type: 'line',
            data: { labels: [], datasets: [{ data: [], borderColor: '#ffcc00', backgroundColor: 'rgba(255,204,0,0.1)', fill: true, borderWidth: 2 }] },
            options: {
                ...baseOpts,
                scales: {
                    x: { display: true, title: { display: true, text: 'VOLTAGE (V)', color: '#ffffff', font: { size: 11, weight: 'bold' }, padding: { top: 10 } }, grid: { color: '#333' }, ticks: { color: '#aaa' } },
                    y: { display: true, title: { display: true, text: 'POWER (W)', color: '#888' }, grid: { color: '#222' }, ticks: { color: '#666' } }
                }
            }
        });
    }

    // --- 3. IV CHART ---
    const ctxIV = document.getElementById('ivCurveChart');
    if(ctxIV) {
        ivChart = new Chart(ctxIV, {
            type: 'line',
            data: { labels: [], datasets: [{ data: [], borderColor: '#00e676', borderWidth: 2 }] },
            options: {
                ...baseOpts,
                scales: {
                    x: { display: true, title: { display: true, text: 'VOLTAGE (V)', color: '#ffffff', font: { size: 11, weight: 'bold' }, padding: { top: 10 } }, grid: { color: '#333' }, ticks: { color: '#aaa' } },
                    y: { display: true, title: { display: true, text: 'CURRENT (A)', color: '#888' }, grid: { color: '#222' }, ticks: { color: '#666' } }
                }
            }
        });
    }

    // --- 4. PWM SCOPE ---
    const ctxPWM = document.getElementById('pwmScopeChart');
    if(ctxPWM) {
        pwmChart = new Chart(ctxPWM, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Gate', data: [], borderColor: '#00e676', backgroundColor: 'rgba(0, 230, 118, 0.2)', borderWidth: 2, stepped: true, fill: true }] },
            options: {
                ...baseOpts,
                scales: {
                    x: { display: true, title: { display: true, text: 'TIME (ms)', color: '#888', font: { size: 10 } }, grid: { display: false }, ticks: { display: false } },
                    y: { min: -0.1, max: 1.1, grid: { color: '#333' }, ticks: { color: '#fff', font: { weight: 'bold' }, callback: function(value) { if(value === 0) return '0'; if(value === 1) return '1'; return ''; } } }
                }
            }
        });
    }
}

// --- 5. INITIALIZE IMMEDIATELY ---
// Add this at the very bottom of analysis.js
document.addEventListener('DOMContentLoaded', () => {
    // Force chart creation immediately so they exist for the PDF
    initAllCharts();
    console.log("Charts forced initialized for PDF background rendering.");
});
// --- FLIGHT RECORDER LOGIC ---
let isRecording = false;
let sessionLog = []; 
let recordingStartTime = null;

// --- FINAL RECORDING LOGIC ---
window.toggleRecording = function() {
    const btn = document.getElementById("side-rec-btn");
    const txt = document.getElementById("rec-text");
    const icon = document.getElementById("rec-icon");

    if (!btn) return;

    if (!isRecording) {
        // START
        isRecording = true;
        sessionLog = []; 
        recordingStartTime = new Date();
        
        txt.innerText = "Creating Report...";
        icon.innerText = "■";
        btn.classList.add("recording-active");
        btn.title = "Click to Stop Recording & Download PDF"; 
        
        showNotification("📡 Report Analysis Happening...", "#ff4444");

        if(typeof logEvent === "function") {
            logEvent("SESSION START", "Recording started.");
            logEvent("INITIAL STATE", "Baseline metrics captured.");
        }

    } else {
        // STOP
        isRecording = false;
        
        txt.innerText = "Create Report";
        icon.innerText = "●";
        btn.classList.remove("recording-active");
        btn.title = "Start Recording to Generate Analysis";

        if(typeof logEvent === "function") logEvent("SESSION END", "Recording stopped.");

        // Generate PDF
        if(typeof generateSessionReport === "function") {
            generateSessionReport();
            showNotification("✅ PDF Generated & Downloaded", "#00e676");
        }
    }
};

// --- GLOBAL LOGGING FUNCTION (CORRECTED) ---
window.logEvent = function(type, desc) { 
    if (!isRecording) return;

    // 1. Calculate Time
    const timeOffset = Math.floor((new Date() - recordingStartTime) / 1000); 

    // 2. READ FROM GLOBAL STATE (NOT HTML)
    // This ensures we get the calculated physics numbers even if the HTML is slow to update.
    const data = window.latestSimData || { pin: "0", pout: "0", irr: "0" };

    const currentPin = data.pin;
    const currentPout = data.pout;
    const currentIrr = data.irr;

    // 3. CAPTURE GRAPHS
    let imgPV = null;
    let imgIV = null;
    try {
        const cv1 = document.getElementById('pvCurveChart'); 
        const cv2 = document.getElementById('ivCurveChart'); 
        if(cv1 && cv1.width > 0) imgPV = cv1.toDataURL("image/jpeg", 0.8);
        if(cv2 && cv2.width > 0) imgIV = cv2.toDataURL("image/jpeg", 0.8);
    } catch(e) {}

    // 4. SAVE TO ARRAY
    sessionLog.push({
        time: `T+${timeOffset}s`,
        type: type,
        desc: desc,
        metrics: { 
            pin: currentPin + " W", 
            pout: currentPout + " W", 
            irr: currentIrr + " W/m²" 
        },
        raw: { 
            pin: parseFloat(currentPin) || 0, 
            pout: parseFloat(currentPout) || 0 
        },
        graphs: { pv: imgPV, iv: imgIV }
    });

    // 5. BUTTON FLASH FEEDBACK
    const btn = document.getElementById("side-rec-btn");
    if(btn) {
        btn.style.opacity = "0.5";
        setTimeout(() => btn.style.opacity = "1", 150);
    }
}

function logInitialState() {
    const rows = document.getElementById("setup-rows").value;
    const cols = document.getElementById("setup-cols").value;
    logEvent("INIT CONFIG", `System initialized with ${rows}x${cols} Array.`);
}

// --- NOTIFICATION HELPER ---
function showNotification(message, color = "#fff") {
    const toast = document.createElement("div");
    toast.className = "toast-notification";
    toast.innerText = message;
    toast.style.borderColor = color;
    
    if(color === "#00e676") toast.style.boxShadow = "0 0 10px #00e676"; 
    if(color === "#ff4444") toast.style.boxShadow = "0 0 10px #ff4444"; 

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500); 
    }, 3000);
}

// --- ENGINEERING PDF GENERATOR ---
async function generateSessionReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const pageWidth = 210;
    const margin = 15;
    let y = 20;

    function drawHeader(isFirstPage = false) {
        doc.setFillColor(26, 35, 126); 
        doc.rect(0, 0, pageWidth, isFirstPage ? 40 : 15, "F");
        
        doc.setTextColor(255, 255, 255);
        if(isFirstPage) {
            doc.setFontSize(22);
            doc.setFont("helvetica", "bold");
            doc.text("PV SYSTEM ANALYSIS REPORT", margin, 20);
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 32);
            doc.text(`Total Events Logged: ${sessionLog.length}`, margin, 37);
        } else {
            doc.setFontSize(10);
            doc.text("PV Analysis Report (Continuation)", margin, 10);
        }
    }

    function checkSpace(heightNeeded) {
        if (y + heightNeeded > 280) {
            doc.addPage();
            drawHeader(false);
            y = 30;
        }
    }

    drawHeader(true);
    y = 50;

    sessionLog.forEach((entry, i) => {
        checkSpace(65);

        doc.setFillColor(245, 245, 245); 
        doc.setDrawColor(220, 220, 220);
        doc.roundedRect(margin, y, pageWidth - (margin*2), 60, 2, 2, "FD");

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        
        if(entry.type.includes("ALERT")) doc.setTextColor(200, 50, 50);
        else if(entry.type.includes("SUCCESS") || entry.type.includes("LOCKED")) doc.setTextColor(0, 120, 0);
        
        doc.text(`[${entry.time}] ${entry.type}`, margin + 5, y + 8);

        doc.setTextColor(50, 50, 50);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const descText = doc.splitTextToSize(entry.desc, 170);
        doc.text(descText, margin + 5, y + 15);

        doc.setFont("courier", "bold");
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 100);
        doc.text(`INPUT: ${entry.metrics.pin}   |   OUTPUT: ${entry.metrics.pout}   |   IRR: ${entry.metrics.irr}`, margin + 5, y + 23);

        const graphY = y + 26;
        const graphW = 80; 
        const graphH = 30;

        if(entry.graphs && entry.graphs.pv) {
            doc.addImage(entry.graphs.pv, 'JPEG', margin + 5, graphY, graphW, graphH);
            doc.setFontSize(6);
            doc.text("P-V Curve Snapshot", margin + 5, graphY + graphH + 2);
        } else {
            doc.rect(margin + 5, graphY, graphW, graphH); 
            doc.text("No PV Graph", margin + 30, graphY + 15);
        }

        if(entry.graphs && entry.graphs.iv) {
            doc.addImage(entry.graphs.iv, 'JPEG', margin + 90, graphY, graphW, graphH);
            doc.text("I-V Curve Snapshot", margin + 90, graphY + graphH + 2);
        } else {
             doc.rect(margin + 90, graphY, graphW, graphH);
             doc.text("No IV Graph", margin + 115, graphY + 15);
        }

        y += 68; 
    });

    checkSpace(50);
    y += 10;
    
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("4. AUTOMATED CONCLUSION", margin, y);
    y += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    let maxPower = 0;
    let totalEff = 0;
    let count = 0;

    sessionLog.forEach(e => {
        const p = parseFloat(e.metrics.pout) || 0;
        const pin = parseFloat(e.metrics.pin) || 0;
        if(p > maxPower) maxPower = p;
        if(pin > 0) {
            totalEff += (p/pin);
            count++;
        }
    });

    const avgEff = count > 0 ? (totalEff / count * 100).toFixed(2) : 0;
    
    let conclusionText = `During this simulation session, the system reached a Peak Power Output of ${maxPower.toFixed(2)} W. The average system conversion efficiency was observed to be ${avgEff}%. `;

    if(avgEff > 90) conclusionText += "The system is operating at OPTIMAL EFFICIENCY, indicating excellent MPPT tracking performance and low losses.";
    else if(avgEff > 50) conclusionText += "The system shows MODERATE EFFICIENCY. Consider optimizing the MPPT algorithm or reducing temperature losses.";
    else conclusionText += "The system appears to be UNDERPERFORMING (<50%). This may be due to partial shading conditions, mismatch losses, or sub-optimal MPPT tracking during the test.";

    const splitConclusion = doc.splitTextToSize(conclusionText, pageWidth - (margin*2));
    doc.text(splitConclusion, margin, y);

    doc.save(`PV_Engineering_Report_${Date.now()}.pdf`);
}

