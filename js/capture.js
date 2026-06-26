// ============================================================
// M3 Voice Capture Module
// ============================================================
// Handles microphone access, waveform visualization, and
// audio recording (real or simulated fallback) for the
// Soundcore AI Earbud application.
// ============================================================

// ---- Capture-related state fields (add to main `state` object) ----
// recording: boolean - whether recording is active
// recordingTime: number - elapsed recording time in seconds
// recordingInterval: null|number - setInterval handle for the timer
// audioContext: null|AudioContext - Web Audio API context
// analyser: null|AnalyserNode - audio analyser node
// microphone: null|MediaStreamAudioSourceNode - microphone source
// animationId: null|number - requestAnimationFrame handle

// ========== Audio Capture ==========

async function initWaveform() {
  const canvas = document.getElementById('waveformCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * 2;
  canvas.height = canvas.offsetHeight * 2;

  function drawIdle() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const time = Date.now() / 1000;
    for (let x = 0; x < canvas.width; x++) {
      const y = canvas.height / 2 + Math.sin(x * 0.02 + time * 2) * 5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    if (!state.recording) {
      requestAnimationFrame(drawIdle);
    }
  }
  drawIdle();
}

async function toggleRecording() {
  if (state.recording) {
    stopRecording();
  } else {
    startRecording();
  }
}

async function startRecording() {
  try {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.microphone = state.audioContext.createMediaStreamSource(stream);
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 2048;
    state.microphone.connect(state.analyser);

    state.recording = true;
    const btn = document.getElementById('micBtn');
    btn.classList.add('recording');
    btn.innerHTML = '\u23F9\uFE0F';

    // Start timer
    state.recordingTime = 0;
    state.recordingInterval = setInterval(() => {
      state.recordingTime++;
      const mins = String(Math.floor(state.recordingTime / 60)).padStart(2, '0');
      const secs = String(state.recordingTime % 60).padStart(2, '0');
      document.getElementById('recordingTimer').textContent = `${mins}:${secs}`;
    }, 1000);

    // Enable AI process button
    document.getElementById('aiProcessBtn').disabled = false;

    drawWaveform();
    showToast('\uD83C\uDF99\uFE0F 开始录音', 'info');

  } catch (err) {
    console.error('麦克风访问失败:', err);
    showToast('\u274C 无法访问麦克风，请检查权限', 'error');
    // Fallback: simulate recording
    simulateRecording();
  }
}

function drawWaveform() {
  if (!state.recording || !state.analyser) return;

  const canvas = document.getElementById('waveformCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * 2;
  canvas.height = canvas.offsetHeight * 2;

  const bufferLength = state.analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  state.analyser.getByteTimeDomainData(dataArray);

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#00d4ff';
  ctx.beginPath();

  const sliceWidth = canvas.width / bufferLength;
  let x = 0;

  let sum = 0;
  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0;
    sum += Math.abs(v - 1);
    const y = v * canvas.height / 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.stroke();

  // Update audio params
  const volume = Math.round(sum / bufferLength * 100);
  const peakDb = Math.max(-60, -60 + volume);
  document.getElementById('peakVolume').textContent = peakDb.toFixed(0) + ' dB';

  // Clarity score based on volume consistency
  const clarity = Math.min(100, Math.round(60 + volume * 0.4));
  const clarityEl = document.getElementById('clarityScore');
  clarityEl.textContent = clarity + '%';
  clarityEl.style.color = clarity > 70 ? 'var(--success)' : clarity > 40 ? 'var(--warning)' : 'var(--danger)';

  state.animationId = requestAnimationFrame(drawWaveform);
}

function simulateRecording() {
  state.recording = true;
  const btn = document.getElementById('micBtn');
  btn.classList.add('recording');
  btn.innerHTML = '\u23F9\uFE0F';

  state.recordingTime = 0;
  state.recordingInterval = setInterval(() => {
    state.recordingTime++;
    const mins = String(Math.floor(state.recordingTime / 60)).padStart(2, '0');
    const secs = String(state.recordingTime % 60).padStart(2, '0');
    document.getElementById('recordingTimer').textContent = `${mins}:${secs}`;
  }, 1000);

  document.getElementById('aiProcessBtn').disabled = false;

  // Simulated waveform
  const canvas = document.getElementById('waveformCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * 2;
  canvas.height = canvas.offsetHeight * 2;

  function drawSimulated() {
    if (!state.recording) return;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const time = Date.now() / 1000;
    for (let x = 0; x < canvas.width; x++) {
      const amp = 15 + Math.sin(time * 0.5) * 10;
      const y = canvas.height / 2 + Math.sin(x * 0.015 + time * 3) * amp * Math.sin(time * 0.7);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Simulated params
    const volume = Math.round(30 + Math.sin(time) * 20 + 40);
    document.getElementById('peakVolume').textContent = (-60 + volume).toFixed(0) + ' dB';
    const clarity = Math.min(100, Math.round(65 + Math.sin(time * 0.3) * 15));
    const clarityEl = document.getElementById('clarityScore');
    clarityEl.textContent = clarity + '%';
    clarityEl.style.color = clarity > 70 ? 'var(--success)' : 'var(--warning)';

    requestAnimationFrame(drawSimulated);
  }
  drawSimulated();

  showToast('\uD83C\uDF99\uFE0F 开始录音（模拟模式）', 'info');
}

function stopRecording() {
  state.recording = false;

  if (state.recordingInterval) {
    clearInterval(state.recordingInterval);
    state.recordingInterval = null;
  }
  if (state.animationId) {
    cancelAnimationFrame(state.animationId);
  }
  if (state.audioContext) {
    state.audioContext.close();
    state.audioContext = null;
  }

  const btn = document.getElementById('micBtn');
  btn.classList.remove('recording');
  btn.innerHTML = '\uD83C\uDF99\uFE0F';

  showToast('\u23F9\uFE0F 录音已停止', 'info');

  // Switch to AI tab
  switchTab('ai');
}
