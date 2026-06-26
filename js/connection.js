// ========== M1 设备连接模块 ==========
// 本文件包含 M1 设备连接相关的所有功能：
// 设备扫描、配对、连接、自动重连、连接稳定性监控

// ========== M1 模块状态 ==========
// 以下状态变量属于设备连接模块，保留在全局 state 对象中
// state.devices          - 可连接的设备列表
// state.connected        - 连接状态标志
// state.connecting       - 正在连接标志
// state._pendingReconnectDevice - 待重连设备（内部使用）
// state._currentDevice   - 当前已连接设备（内部使用）
// window._pendingDevice  - 待配对设备（内部使用）

// ========== 设备扫描 ==========
function startScan() {
  const btn = document.getElementById('scanBtn');
  const scanAnim = document.getElementById('scanAnimation');
  const scanStatus = document.getElementById('scanStatus');

  btn.disabled = true;
  btn.innerHTML = '⏳ 扫描中...';
  scanAnim.style.display = 'block';
  scanStatus.textContent = '正在搜索附近蓝牙设备...';

  // Simulate device discovery
  const deviceList = document.getElementById('deviceList');
  deviceList.innerHTML = '';

  state.devices.forEach((device, index) => {
    setTimeout(() => {
      const signalBars = generateSignalBars(device.signal);
      const item = document.createElement('li');
      item.className = 'device-item';
      item.innerHTML = `
        <div class="device-info">
          <div class="device-icon">🎧</div>
          <div>
            <div class="device-name">${device.name}</div>
            <div class="device-meta">${device.type.toUpperCase()} · 电量 ${device.battery}% · ${device.firmware}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="signal-bars">${signalBars}</div>
          <button class="btn btn-primary btn-sm" onclick="connectDevice(${index})">连接</button>
        </div>
      `;
      deviceList.appendChild(item);
      scanStatus.textContent = `已发现 ${index + 1} 台设备`;
    }, (index + 1) * 800);
  });

  setTimeout(() => {
    scanAnim.style.display = 'none';
    btn.innerHTML = '🔄 重新扫描';
    btn.disabled = false;
    scanStatus.textContent = '扫描完成，选择设备进行连接';
  }, state.devices.length * 800 + 500);
}

// ========== 信号条生成 ==========
function generateSignalBars(signal) {
  const levels = signal > -50 ? 4 : signal > -60 ? 3 : signal > -70 ? 2 : 1;
  let html = '';
  for (let i = 0; i < 4; i++) {
    html += `<div class="signal-bar ${i < levels ? 'active' : ''}" style="height: ${6 + i * 4}px;"></div>`;
  }
  return html;
}

// ========== 设备连接（配对弹窗） ==========
function connectDevice(index) {
  const device = state.devices[index];
  const modal = document.getElementById('pairingModal');
  const code = Math.floor(100000 + Math.random() * 900000);
  document.getElementById('pairingCode').textContent = code;
  modal.classList.add('show');

  window._pendingDevice = device;
}

// ========== 取消配对 ==========
function cancelPairing() {
  document.getElementById('pairingModal').classList.remove('show');
}

// ========== 确认配对 ==========
function confirmPairing() {
  document.getElementById('pairingModal').classList.remove('show');
  const device = window._pendingDevice;

  // Show feedback area
  document.getElementById('connectionFeedback').style.display = 'block';
  const log = document.getElementById('connectionLog');
  log.innerHTML = '';

  // Start simulated connection process with possible failure
  simulateConnectionFlow(device);
}

// ========== 连接日志 ==========
function addLog(message, type = 'info') {
  const log = document.getElementById('connectionLog');
  const color = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : type === 'warning' ? 'var(--warning)' : 'var(--text-secondary)';
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
  const time = new Date().toLocaleTimeString();
  log.innerHTML += `<div style="color: ${color};">[${time}] ${icon} ${message}</div>`;
  log.scrollTop = log.scrollHeight;
}

// ========== 模拟连接流程（含失败/重连逻辑） ==========
function simulateConnectionFlow(device) {
  const reconnectArea = document.getElementById('reconnectArea');
  reconnectArea.style.display = 'none';

  // Step 1: Pairing
  addLog(`正在与 ${device.name} 配对...`);

  setTimeout(() => {
    addLog('配对码验证通过', 'success');

    // Step 2: Connection attempt (30% chance of failure for demo)
    setTimeout(() => {
      addLog('正在建立蓝牙连接...');

      setTimeout(() => {
        // Simulate connection failure scenario
        const failChance = Math.random();

        if (failChance < 0.3) {
          // Connection FAILED
          addLog('连接失败: 蓝牙握手超时 (ErrorCode: 0x08)', 'error');
          showToast('❌ 连接失败，请重试', 'error');

          // Update header status
          document.getElementById('headerStatusDot').className = 'status-dot';
          document.getElementById('headerStatusText').textContent = '连接失败';

          // Show reconnect area
          reconnectArea.style.display = 'block';
          document.getElementById('reconnectHint').textContent = '连接不稳定，建议检查设备后重试';
          document.getElementById('reconnectBtn').textContent = '🔄 一键重连';
          document.getElementById('reconnectBtn').disabled = false;
          state._pendingReconnectDevice = device;

        } else if (failChance < 0.45) {
          // Connection unstable - auto reconnect scenario
          addLog('连接成功，但信号不稳定', 'warning');
          addLog('检测到连接中断，正在自动重连...', 'warning');

          document.getElementById('headerStatusDot').className = 'status-dot connecting';
          document.getElementById('headerStatusText').textContent = '重连中...';

          // Auto reconnect after delay
          setTimeout(() => {
            addLog('自动重连成功！', 'success');
            finalizeConnection(device);
          }, 2000);

        } else {
          // Connection SUCCESS
          finalizeConnection(device);
        }
      }, 1500);
    }, 800);
  }, 1000);
}

// ========== 自动重连 ==========
function autoReconnect() {
  const device = state._pendingReconnectDevice || window._pendingDevice;
  if (!device) return;

  const btn = document.getElementById('reconnectBtn');
  btn.disabled = true;
  btn.textContent = '⏳ 重连中...';

  addLog('正在重新连接...');
  document.getElementById('headerStatusDot').className = 'status-dot connecting';
  document.getElementById('headerStatusText').textContent = '重连中...';

  // Simulate reconnect (always succeeds after retry)
  setTimeout(() => {
    addLog('重新发现设备: ' + device.name);
  }, 1000);

  setTimeout(() => {
    addLog('配对码验证通过', 'success');
  }, 2000);

  setTimeout(() => {
    addLog('蓝牙连接建立成功', 'success');
    finalizeConnection(device);
  }, 3000);
}

// ========== 完成连接 ==========
function finalizeConnection(device) {
  state.connected = true;
  state.connecting = false;

  // Update header status
  document.getElementById('headerStatusDot').className = 'status-dot connected';
  document.getElementById('headerStatusText').textContent = device.name;

  addLog(`${device.name} 已就绪`, 'success');
  showToast(`✅ ${device.name} 连接成功！`, 'success');

  // Enable all tabs
  ['monitor', 'capture', 'ai', 'results', 'report'].forEach(enableTab);

  // Initialize monitor
  initMonitor(device);

  // Store current device for reconnect
  state._currentDevice = device;

  // Switch to monitor tab after short delay
  setTimeout(() => switchTab('monitor'), 1500);

  // Start waveform
  initWaveform();

  // Start connection stability monitor
  startConnectionMonitor(device);
}

// ========== 连接稳定性监控 ==========
function startConnectionMonitor(device) {
  // Randomly trigger a disconnect/reconnect event for demo (after 15-30s)
  const delay = 15000 + Math.random() * 15000;
  setTimeout(() => {
    if (!state.connected) return;

    // Simulate brief disconnect
    addLog('⚠️ 连接中断，正在自动重连...', 'warning');
    document.getElementById('headerStatusDot').className = 'status-dot connecting';
    document.getElementById('headerStatusText').textContent = '重连中...';

    // Auto reconnect
    setTimeout(() => {
      addLog('自动重连成功', 'success');
      document.getElementById('headerStatusDot').className = 'status-dot connected';
      document.getElementById('headerStatusText').textContent = device.name;
      showToast('🔄 设备已自动重连', 'info');

      // Schedule next monitor cycle
      startConnectionMonitor(device);
    }, 3000);
  }, delay);
}
