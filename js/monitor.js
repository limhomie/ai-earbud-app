/**
 * M2 Device Monitor Module
 *
 * Responsible for monitoring M2 earbud device status,
 * including real-time value updates, alert checking,
 * alert display, and alert history tracking.
 */

// ============================================================
// Alert History State
// ============================================================
const alertHistory = [];

// ============================================================
// Active Alerts Tracking (for auto-dismiss support)
// ============================================================
let activeAlertKeys = new Set();

// ============================================================
// Initialize Monitor
// ============================================================
function initMonitor(device) {
  updateMonitorValues(device);
  setInterval(() => updateMonitorValues(device), 3000);

  // Initial alert check
  checkAlerts(device);

  // Periodic alert check every 10 seconds
  setInterval(() => checkAlerts(device), 10000);
}

// ============================================================
// Update Monitor Values
// ============================================================
function updateMonitorValues(device) {
  // Simulate slight variations
  const battery = Math.max(0, device.battery + Math.floor(Math.random() * 3 - 1));
  const signal = device.signal + Math.floor(Math.random() * 6 - 3);
  const temp = 36 + Math.floor(Math.random() * 4 - 2);
  const latency = 45 + Math.floor(Math.random() * 10 - 5);

  document.getElementById('batteryValue').textContent = battery + '%';
  document.getElementById('signalValue').textContent = signal + 'dBm';
  document.getElementById('tempValue').textContent = temp + '°C';
  document.getElementById('latencyValue').textContent = latency + 'ms';

  // Color coding
  const batteryEl = document.getElementById('batteryValue');
  batteryEl.className = 'status-value ' + (battery > 50 ? 'status-good' : battery > 20 ? 'status-warn' : 'status-bad');

  const signalEl = document.getElementById('signalValue');
  signalEl.className = 'status-value ' + (signal > -60 ? 'status-good' : signal > -70 ? 'status-warn' : 'status-bad');

  const tempEl = document.getElementById('tempValue');
  tempEl.className = 'status-value ' + (temp < 40 ? 'status-good' : temp < 45 ? 'status-warn' : 'status-bad');
}

// ============================================================
// Check Alerts
// ============================================================
function checkAlerts(device) {
  const currentAlertKeys = new Set();

  // Build a unique key for each alert condition to track active state
  const alertConditions = [];

  if (device.battery < 50) {
    alertConditions.push({ key: 'battery_low', message: '\u26a0\ufe0f 电量偏低，建议及时充电' });
  }
  if (device.signal < -70) {
    alertConditions.push({ key: 'signal_weak', message: '\ud83d\udce1 信号较弱，请靠近设备' });
  } else if (device.signal < -65) {
    alertConditions.push({ key: 'signal_unstable', message: '\ud83d\udce1 连接不稳定，信号较弱' });
  }
  if (device.firmware < 'v2.3.0') {
    alertConditions.push({ key: 'firmware_outdated', message: '\ud83d\udcbb 需更新固件，当前版本过旧' });
  }

  // Register active alert keys
  alertConditions.forEach(c => currentAlertKeys.add(c.key));

  // Show alerts that are newly triggered
  alertConditions.forEach(condition => {
    if (!activeAlertKeys.has(condition.key)) {
      showAlert(condition.message, 'warning');
      activeAlertKeys.add(condition.key);
      // Record to history
      alertHistory.push({
        key: condition.key,
        message: condition.message,
        time: new Date().toLocaleTimeString(),
        resolved: false
      });
    }
  });

  // Auto-dismiss alerts whose condition is no longer met
  activeAlertKeys.forEach(key => {
    if (!currentAlertKeys.has(key)) {
      activeAlertKeys.delete(key);
      // Mark as resolved in history
      const lastEntry = [...alertHistory].reverse().find(e => e.key === key && !e.resolved);
      if (lastEntry) {
        lastEntry.resolved = true;
        lastEntry.resolvedTime = new Date().toLocaleTimeString();
      }
    }
  });

  // Re-render alert container based on current active alerts
  renderActiveAlerts(alertConditions);
}

// ============================================================
// Render Active Alerts
// ============================================================
function renderActiveAlerts(conditions) {
  const container = document.getElementById('alertContainer');
  container.innerHTML = '';

  conditions.forEach(condition => {
    const alert = document.createElement('div');
    alert.className = 'alert-banner show warning';
    alert.innerHTML = '<span>' + condition.message + '</span>';
    container.appendChild(alert);
  });

  // Render alert history section
  renderAlertHistory();
}

// ============================================================
// Show Alert (legacy compatibility - adds to history and renders)
// ============================================================
function showAlert(message, type) {
  const container = document.getElementById('alertContainer');
  const alert = document.createElement('div');
  alert.className = 'alert-banner show ' + type;
  alert.innerHTML = '<span>' + message + '</span>';
  container.appendChild(alert);

  // Record to history
  alertHistory.push({
    key: 'manual_' + Date.now(),
    message: message,
    time: new Date().toLocaleTimeString(),
    resolved: false
  });
}

// ============================================================
// Render Alert History
// ============================================================
function renderAlertHistory() {
  if (alertHistory.length === 0) return;

  const container = document.getElementById('alertContainer');

  // Create or get history section
  let historySection = document.getElementById('alertHistorySection');
  if (!historySection) {
    historySection = document.createElement('div');
    historySection.id = 'alertHistorySection';
    historySection.style.cssText = 'margin-top: 20px;';
    container.parentNode.appendChild(historySection);
  }

  historySection.innerHTML =
    '<div class="card">' +
      '<div class="card-title">\ud83d\udccb 告警历史记录</div>' +
      '<div id="alertHistoryList" style="max-height: 200px; overflow-y: auto; font-size: 13px; line-height: 1.8;">' +
        alertHistory.slice().reverse().map(entry => {
          const statusColor = entry.resolved ? 'var(--success)' : 'var(--danger)';
          const statusIcon = entry.resolved ? '\u2705' : '\u26a0\ufe0f';
          const statusText = entry.resolved
            ? '已恢复 (' + entry.resolvedTime + ')'
            : '活动中';
          return '<div style="color: var(--text-secondary); padding: 6px 0; border-bottom: 1px solid var(--border);">' +
            '<span style="color: ' + statusColor + ';">[' + statusIcon + ' ' + statusText + ']</span> ' +
            '<span style="color: var(--text-dim);">[' + entry.time + ']</span> ' +
            entry.message +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
}
