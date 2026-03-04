// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// TODO: Replace with actual Firebase Realtime Database and Auth config for production
const firebaseConfig = {
    apiKey: "PLACEHOLDER_API_KEY",
    authDomain: "PLACEHOLDER_AUTH_DOMAIN",
    databaseURL: "https://PLACEHOLDER-DATABASE.firebaseio.com",
    projectId: "PLACEHOLDER_PROJECT_ID",
    storageBucket: "PLACEHOLDER_STORAGE_BUCKET",
    messagingSenderId: "PLACEHOLDER_MESSAGING_SENDER_ID",
    appId: "PLACEHOLDER_APP_ID"
};

// Mock mode check MUST come before Firebase init.
// If config is placeholder, skip Firebase entirely to avoid errors.
const isMock = firebaseConfig.apiKey.startsWith("PLACEHOLDER");

let app, auth, db;
if (!isMock) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
}

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

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('authError');

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (error) {
            errorEl.innerText = error.message;
        }
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
    waterLevel: null
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

function triggerRobotAlert() {
    if (!robotMoving) {
        robotMoving = true;
        updateRobotStatusUI();
        if (!isMock) {
            // Write 'CALL' command — robot car firmware reads from 'car/command'
            set(ref(db, 'car/command'), 'CALL');
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
                <button class="btn logout-btn" id="logoutBtn">Logout</button>
            </div>
            
            <div class="cards-grid" id="sensorsGrid">
                <!-- Cards injected here -->
            </div>

            <div class="glass-panel call-robot-section">
                <button class="btn btn-call" id="callRobotBtn">🚨 CALL ROBOT CAR 🚨</button>
            </div>
        </div>
    `;

    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (isMock) {
            if (mockInterval) clearInterval(mockInterval);
            renderAuthView(true);
            return;
        }
        signOut(auth);
    });

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
        { id: 'hr', name: 'Heart Rate', value: formatValue(currentSensorData.heartRate), unit: 'BPM', status: evaluateStatus(currentSensorData.heartRate, thresholds.heartRate.min, thresholds.heartRate.max) },
        { id: 'temp', name: 'Body Temp', value: formatValue(currentSensorData.temperature, 1), unit: '°C', status: evaluateStatus(currentSensorData.temperature, thresholds.temperature.min, thresholds.temperature.max) },
        { id: 'spo2', name: 'Blood Oxygen', value: formatValue(currentSensorData.spO2), unit: '%', status: evaluateStatus(currentSensorData.spO2, thresholds.spO2.min, thresholds.spO2.max) },
        { id: 'water', name: 'Water Level', value: formatValue(currentSensorData.waterLevel), unit: '%', status: evaluateStatus(currentSensorData.waterLevel, thresholds.waterLevel.min, thresholds.waterLevel.max) }
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

// Auth state listener
if (!isMock) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Reset state on login
            robotMoving = false;
            dataReceived = false;
            currentSensorData = { heartRate: null, temperature: null, spO2: null, waterLevel: null };

            renderDashboard();

            // Listen to sensor data (path must match ESP32 firmware)
            const sensorsRef = ref(db, 'sensors');
            onValue(sensorsRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    currentSensorData = { ...currentSensorData, ...data };
                    dataReceived = true; // Unlock robot dispatch
                    updateDashboardUI();
                }
            });

            // Listen to robot car status (firmware writes back to car/status)
            const robotRef = ref(db, 'car/status');
            onValue(robotRef, (snapshot) => {
                const status = snapshot.val();
                if (status === 'ARRIVED' || status === 'IDLE') {
                    robotMoving = false;
                    updateRobotStatusUI();
                } else if (status === 'MOVING_TO_USER') {
                    robotMoving = true;
                    updateRobotStatusUI();
                }
            });

        } else {
            renderAuthView(true);
        }
    });
} else {
    // Start with mock auth view
    renderAuthView(true);
}
