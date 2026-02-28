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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Mock Data mode (if config is placeholder)
const isMock = firebaseConfig.apiKey.startsWith("PLACEHOLDER");
let mockInterval = null;

// UI Elements
const appDiv = document.getElementById('app');

function renderAuthView(isLogin = true) {
    appDiv.innerHTML = `
        <div class="glass-panel auth-container">
            <h2>${isLogin ? 'Login' : 'Sign Up'}</h2>
            <input type="email" id="email" placeholder="Email" value="demo@example.com">
            <input type="password" id="password" placeholder="Password" value="password123">
            <button class="btn" id="submitBtn">${isLogin ? 'Login' : 'Sign Up'}</button>
            <button class="btn btn-toggle" id="toggleBtn">Switch to ${isLogin ? 'Sign Up' : 'Login'}</button>
            <p id="authError" style="color: var(--danger); margin-top: 10px;"></p>
        </div>
    `;

    document.getElementById('submitBtn').addEventListener('click', async () => {
        if (isMock) {
            // Mock authentication success
            initDashboardMock();
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

    document.getElementById('toggleBtn').addEventListener('click', () => {
        renderAuthView(!isLogin);
    });
};

const thresholds = {
    heartRate: { min: 60, max: 100 },
    temperature: { min: 36.0, max: 37.8 },
    spO2: { min: 95, max: 100 },
    waterLevel: { min: 10, max: 100 } // percentage
};

let currentSensorData = {
    heartRate: 75,
    temperature: 36.6,
    spO2: 98,
    waterLevel: 50
};

let robotMoving = false;

function evaluateStatus(value, min, max) {
    if (value < min || value > max) return 'danger';
    return 'normal';
};

function triggerRobotAlert() {
    if (!robotMoving) {
        robotMoving = true;
        updateRobotStatusUI();
        if (!isMock) {
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
        { id: 'hr', name: 'Heart Rate', value: currentSensorData.heartRate, unit: 'BPM', status: evaluateStatus(currentSensorData.heartRate, thresholds.heartRate.min, thresholds.heartRate.max) },
        { id: 'temp', name: 'Body Temp', value: currentSensorData.temperature.toFixed(1), unit: '°C', status: evaluateStatus(currentSensorData.temperature, thresholds.temperature.min, thresholds.temperature.max) },
        { id: 'spo2', name: 'Blood Oxygen', value: currentSensorData.spO2, unit: '%', status: evaluateStatus(currentSensorData.spO2, thresholds.spO2.min, thresholds.spO2.max) },
        { id: 'water', name: 'Water Level', value: currentSensorData.waterLevel, unit: '%', status: evaluateStatus(currentSensorData.waterLevel, thresholds.waterLevel.min, thresholds.waterLevel.max) }
    ];

    let hasDanger = false;

    grid.innerHTML = cards.map(c => {
        if (c.status === 'danger') hasDanger = true;
        return `
        <div class="glass-panel sensor-card">
            <h3>${c.name}</h3>
            <div class="sensor-value">${c.value} <span class="sensor-unit">${c.unit}</span></div>
            <div class="sensor-status status-${c.status}">${getStatusText(c.status)}</div>
        </div>
    `}).join('');

    if (hasDanger && !robotMoving) {
        triggerRobotAlert();
    }
};


function initDashboardMock() {
    renderDashboard();
    robotMoving = false;

    // Simulate incoming data
    mockInterval = setInterval(() => {
        // Random walk
        currentSensorData.heartRate += Math.floor(Math.random() * 5) - 2;
        currentSensorData.temperature += (Math.random() * 0.4) - 0.2;

        // Randomly simulate an emergency sometimes
        if (Math.random() > 0.95 && currentSensorData.heartRate < thresholds.heartRate.max) {
            currentSensorData.heartRate = 120; // spike HR
        }

        updateDashboardUI();
    }, 2000);
};

// Auth state listener
if (!isMock) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            renderDashboard();
            robotMoving = false;

            // Listen to data
            const sensorsRef = ref(db, 'sensors');
            onValue(sensorsRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    currentSensorData = { ...currentSensorData, ...data };
                    updateDashboardUI();
                }
            });

            // Listen to robot status
            const robotRef = ref(db, 'car/status');
            onValue(robotRef, (snapshot) => {
                const status = snapshot.val();
                if (status === 'MOVING_TO_USER') {
                    robotMoving = true;
                    updateRobotStatusUI();
                } else if (status === 'IDLE') {
                    robotMoving = false;
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
