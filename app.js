// app.js
// LOCAL SERVER CONFIGURATION
const API_URL = "http://127.0.0.1:5000/api";

const isMock = false; // We use the real local server now

let mockInterval = null;

// UI Elements
const appDiv = document.getElementById('app');

function renderAuthView(isLogin = true) {
    appDiv.innerHTML = `
        <div class="glass-panel auth-container">
            <h2>${isLogin ? 'Login' : 'Sign Up'}</h2>
            <input type="email" id="email" placeholder="Email" value="demo@example.com">
            <input type="password" id="password" placeholder="Password" value="password123">
            <button class="btn" id="submitBtn">${isMock ? 'Demo Login' : (isLogin ? 'Login' : 'Sign Up')}</button>
            ${!isMock ? `<button class="btn btn-toggle" id="toggleBtn">Switch to ${isLogin ? 'Sign Up' : 'Login'}</button>` : ''}
            <p id="authError" style="color: var(--danger); margin-top: 10px;"></p>
            ${isMock ? '<p style="color: var(--warning); font-size: 0.8rem; margin-top: 20px;">[Firebase not configured. Proceeding in UI Demo Mode.]</p>' : ''}
        </div>
    `;

    document.getElementById('submitBtn').addEventListener('click', async () => {
        if (isMock) {
            // Bypass Auth, directly enter dashboard
            renderDashboard();
            return;
        }

        const errorEl = document.getElementById('authError');
        errorEl.innerText = "Auth disabled. Bypassing straight to Local Server UI.";
        renderDashboard();
    });

    const toggleBtn = document.getElementById('toggleBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            renderAuthView(!isLogin);
        });
    }
};

const thresholds = {
    heartRate: { min: 60, max: 100 },
    temperature: { min: 36.0, max: 37.8 },
    spO2: { min: 95, max: 100 },
    waterLevel: { min: 10, max: 100 } // percentage
};

// ⚠️ KEY FIX: Start with null values — display '--' until real data arrives.
// This prevents stale/hardcoded values from appearing before sensors connect.
let currentSensorData = {
    heartRate: null,
    temperature: null,
    spO2: null,
    waterLevel: null,
    ambientTemp: null,
    ambientHumidity: null
};

// dataReceived blocks auto-dispatch until we have a real data packet
let dataReceived = false;

let robotMoving = false;

// Returns 'danger', 'normal', or 'loading' (null = not yet received)
function evaluateStatus(value, min, max) {
    if (value === null || value === undefined) return 'loading';
    if (value < min || value > max) return 'danger';
    return 'normal';
};

// Format display value — '--' when null
function formatValue(value, decimals = 0) {
    if (value === null || value === undefined) return '--';
    return decimals > 0 ? Number(value).toFixed(decimals) : Math.round(value);
};

async function triggerRobotAlert() {
    if (!robotMoving) {
        robotMoving = true;
        updateRobotStatusUI();

        try {
            await fetch(`${API_URL}/car/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'CALL' })
            });
        } catch (e) {
            console.error("Failed to send call command", e);
        }
    }
};

function updateRobotStatusUI() {
    const btn = document.getElementById('callRobotBtn');
    if (btn) {
        if (robotMoving) {
            btn.innerText = "Robot Car is on the way...";
            btn.classList.add('btn-called');
            btn.disabled = true;
        } else {
            btn.innerText = "🚨 CALL ROBOT CAR 🚨";
            btn.classList.remove('btn-called');
            btn.disabled = false;
        }
    }
};

function renderDashboard() {
    appDiv.innerHTML = `
        <div class="dashboard-container">
            <div class="glass-panel header">
                <h2>Health & Assistive Robotics Dashboard</h2>
            </div>
            
            <div class="cards-grid" id="sensorsGrid">
                <!-- Cards injected here -->
            </div>

            <div class="glass-panel call-robot-section">
                <button class="btn btn-call" id="callRobotBtn">🚨 CALL ROBOT CAR 🚨</button>
                <div id="apiErrorMsg" style="color:var(--danger); margin-top:10px; font-size: 0.9em; display:none;">Server Disconnected. Retrying...</div>
            </div>
        </div>
    `;



    document.getElementById('callRobotBtn').addEventListener('click', () => {
        triggerRobotAlert();
    });

    updateDashboardUI();
};

function getStatusText(status) {
    if (status === 'normal') return 'Normal';
    if (status === 'danger') return 'CRITICAL ALERT';
    return 'Warning';
}

function updateDashboardUI() {
    const grid = document.getElementById('sensorsGrid');
    if (!grid) return;

    const cards = [
        { id: 'hr', name: 'Heart Rate', value: formatValue(currentSensorData.heartRate), unit: 'BPM', status: evaluateStatus(currentSensorData.heartRate, THRESHOLDS.heartRate.min, THRESHOLDS.heartRate.max) },
        { id: 'temp', name: 'Body Temp', value: formatValue(currentSensorData.temperature, 1), unit: '°C', status: evaluateStatus(currentSensorData.temperature, THRESHOLDS.temperature.min, THRESHOLDS.temperature.max) },
        { id: 'spo2', name: 'Blood Oxygen', value: formatValue(currentSensorData.spO2), unit: '%', status: evaluateStatus(currentSensorData.spO2, THRESHOLDS.spO2.min, THRESHOLDS.spO2.max) },
        { id: 'water', name: 'Water Level', value: formatValue(currentSensorData.waterLevel), unit: '%', status: evaluateStatus(currentSensorData.waterLevel, THRESHOLDS.waterLevel.min, THRESHOLDS.waterLevel.max) },
        { id: 'ambTemp', name: 'Room Temp', value: formatValue(currentSensorData.ambientTemp, 1), unit: '°C', status: evaluateStatus(currentSensorData.ambientTemp, THRESHOLDS.ambientTemp.min, THRESHOLDS.ambientTemp.max) },
        { id: 'ambHum', name: 'Room Humidity', value: formatValue(currentSensorData.ambientHumidity), unit: '%', status: evaluateStatus(currentSensorData.ambientHumidity, THRESHOLDS.ambientHumidity.min, THRESHOLDS.ambientHumidity.max) }
    ];

    let hasDanger = false;

    grid.innerHTML = cards.map(c => {
        const isLoading = c.status === 'loading';
        if (c.status === 'danger') hasDanger = true;
        const statusClass = isLoading ? 'status-loading' : `status-${c.status}`;
        const statusText = isLoading ? 'Connecting...' : getStatusText(c.status);
        return `
        <div class="glass-panel sensor-card">
            <h3>${c.name}</h3>
            <div class="sensor-value ${isLoading ? 'value-loading' : ''}">${c.value} <span class="sensor-unit">${isLoading ? '' : c.unit}</span></div>
            <div class="sensor-status ${statusClass}">${statusText}</div>
        </div>
    `}).join('');

    // ⚠️ KEY FIX: Only trigger robot if data has actually been received
    if (hasDanger && !robotMoving && dataReceived) {
        triggerRobotAlert();
    }
};

// ==========================================
// DATA POLLING FROM LOCAL PYTHON SERVER
// ==========================================
async function fetchServerData() {
    try {
        const response = await fetch(`${API_URL}/data`);
        const dbState = await response.json();

        document.getElementById('apiErrorMsg').style.display = 'none';

        if (dbState.sensors.heartRate !== null || dbState.sensors.temperature !== null || dbState.sensors.ambientTemp !== null) {
            currentSensorData = { ...currentSensorData, ...dbState.sensors };
            dataReceived = true;
        }

        if (dbState.car.status === 'ARRIVED' || dbState.car.status === 'IDLE') {
            robotMoving = false;
            if (dbState.car.command === 'IDLE') {
                updateRobotStatusUI();
            }
        } else if (dbState.car.status === 'MOVING_TO_USER') {
            robotMoving = true;
            updateRobotStatusUI();
        }

        updateDashboardUI();
    } catch (error) {
        document.getElementById('apiErrorMsg').style.display = 'block';
        console.error("Local Server Polling failed", error);
    }
}

// Skip Login Screen since auth is disabled
renderDashboard();
// Poll every 1 second
setInterval(fetchServerData, 1000);
