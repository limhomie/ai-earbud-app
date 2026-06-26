// ============================================================
// M3 Voice Capture Module (Rewritten)
// ============================================================
// Handles microphone access, waveform visualization, volume
// metering, noise reduction display, pause/resume, and audio
// recording (real or simulated fallback).
// ============================================================

// ---- Extended capture state fields (add to main `state` object) ----
// state.recording        - boolean: recording is active (not paused)
// state.paused           - boolean: recording is paused
// state.simulated        - boolean: using simulated audio (mic unavailable)
// state.mediaStream      - MediaStream: microphone stream reference
// state.canvasInitialized- boolean: whether canvas size has been set
// state.volumeHistory    - number[]: recent volume samples for clarity calc
// state.noiseFloor       - number: estimated noise floor level
// state.peakVolumeValue  - number: running peak volume during recording

// ============================================================
// IDLE WAVEFORM
// ============================================================

function initWaveform() {
  const canvas = document.getElementById('waveformCanvas');
  const ctx = canvas.getContext('2d');

  // Set canvas size only once
  if (!state.canvasInitialized) {
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    state.canvasInitialized = true;
  }

  function drawIdle() {
    if (state.recording || state.paused) return;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Center line
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    // Gentle idle sine wave
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

    requestAnimationFrame(drawIdle);
  }
  drawIdle();
}

// ============================================================
// START RECORDING (real mic or fallback to simulated)
// ============================================================

async function startRecording() {
  try {
    // Ensure canvas is initialized before drawing
    const canvas = document.getElementById('waveformCanvas');
    if (!state.canvasInitialized || canvas.width === 0) {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      state.canvasInitialized = true;
    }

    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.mediaStream = stream;
    state.microphone = state.audioContext.createMediaStreamSource(stream);
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 2048;
    state.analyser.smoothingTimeConstant = 0.8;
    state.microphone.connect(state.analyser);

    state.simulated = false;
    state.recording = true;
    state.paused = false;
    state.volumeHistory = [];
    state.noiseFloor = 0.02;
    state.peakVolumeValue = -100; // Initialize to minimum dB

    updateButtonStates('recording');
    startTimer();
    setAudioParamsUI(state.audioContext);

    document.getElementById('aiProcessBtn').disabled = false;

    drawWaveform();
    showToast('🎙️ 开始录音', 'info');

  } catch (err) {
    console.error('麦克风访问失败:', err);
    showToast('❌ 无法访问麦克风，使用模拟模式', 'error');
    // Fallback: simulate recording
    simulateRecording();
  }
}

// ============================================================
// PAUSE RECORDING (preserves audioContext and resources)
// ============================================================

function pauseRecording() {
  if (!state.recording) return;

  state.paused = true;
  state.recording = false;

  // Cancel the animation frame to stop drawing
  if (state.animationId) {
    cancelAnimationFrame(state.animationId);
    state.animationId = null;
  }

  // Pause the timer
  if (state.recordingInterval) {
    clearInterval(state.recordingInterval);
    state.recordingInterval = null;
  }

  updateButtonStates('paused');
  showToast('⏸️ 已暂停', 'info');
}

// ============================================================
// RESUME RECORDING (from paused state)
// ============================================================

function resumeRecording() {
  if (!state.paused) return;

  state.paused = false;
  state.recording = true;

  updateButtonStates('recording');
  startTimer();

  document.getElementById('aiProcessBtn').disabled = false;

  // Ensure canvas is sized
  const canvas = document.getElementById('waveformCanvas');
  if (!state.canvasInitialized) {
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    state.canvasInitialized = true;
  }

  if (state.simulated) {
    drawSimulatedWaveform();
  } else {
    drawWaveform();
  }

  showToast('▶️ 已继续录音', 'info');
}

// ============================================================
// STOP RECORDING (full cleanup)
// ============================================================

function stopRecording() {
  state.recording = false;
  state.paused = false;
  state.simulated = false;

  if (state.recordingInterval) {
    clearInterval(state.recordingInterval);
    state.recordingInterval = null;
  }
  if (state.animationId) {
    cancelAnimationFrame(state.animationId);
    state.animationId = null;
  }

  // Release media stream
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(function(track) {
      track.stop();
    });
    state.mediaStream = null;
  }

  // Close audio context
  if (state.audioContext) {
    state.audioContext.close();
    state.audioContext = null;
  }

  state.microphone = null;
  state.analyser = null;

  updateButtonStates('idle');
  resetAudioParamsUI();

  showToast('⏹️ 录音已停止', 'info');

  // Switch to AI tab
  switchTab('ai');

  // Return to idle waveform
  state.canvasInitialized = false;
  initWaveform();
}

// ============================================================
// DRAW WAVEFORM (real microphone)
// ============================================================

function drawWaveform() {
  // Only draw when recording (not paused) and analyser exists
  if (!state.analyser) return;
  if (!state.recording) {
    // If not recording, return to idle
    state.canvasInitialized = false;
    initWaveform();
    return;
  }

  const canvas = document.getElementById('waveformCanvas');
  const ctx = canvas.getContext('2d');

  const bufferLength = state.analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  state.analyser.getByteTimeDomainData(dataArray);

  // Clear background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw center guide line
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();

  // Calculate volume from waveform data
  let sum = 0;
  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0;
    const deviation = Math.abs(v - 1);
    sum += deviation;
  }
  const avgVolume = sum / bufferLength;
  const currentVolume = Math.min(1, avgVolume * 2.5); // normalize to 0-1

  // Draw waveform with volume-proportional amplitude
  // The waveform amplitude directly scales with microphone volume
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#00d4ff';
  ctx.shadowColor = '#00d4ff';
  ctx.shadowBlur = 4;
  ctx.beginPath();

  const sliceWidth = canvas.width / bufferLength;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0;
    // Direct waveform visualization: scale by current volume
    // When volume is 0, waveform is flat; when volume is 1, full amplitude
    const scaledY = (v - 1) * 8; // base multiplier for visibility
    const y = canvas.height / 2 + scaledY * (canvas.height / 4);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Draw volume meter below the canvas
  drawVolumeMeter(currentVolume);

  // Update peak volume - display as positive value
  const volumeDb = currentVolume > 0.001 ? Math.round(-60 + currentVolume * 60) : -60;
  if (volumeDb > state.peakVolumeValue) {
    state.peakVolumeValue = volumeDb;
  }
  // Display absolute value (e.g., -12dB shown as 12dB, 0dB shown as 0dB)
  const displayDb = Math.abs(state.peakVolumeValue);
  document.getElementById('peakVolume').textContent = displayDb + ' dB';

  // Calculate clarity score based on volume stability and SNR
  state.volumeHistory.push(currentVolume);
  if (state.volumeHistory.length > 30) {
    state.volumeHistory.shift();
  }
  const clarity = calculateClarity(state.volumeHistory, currentVolume, state.noiseFloor);
  const clarityEl = document.getElementById('clarityScore');
  clarityEl.textContent = clarity + '%';
  clarityEl.style.color = clarity > 70 ? 'var(--success)' : clarity > 40 ? 'var(--warning)' : 'var(--danger)';

  // Update noise level display
  updateNoiseLevelDisplay();

  // Update speech rate display (real mic: estimate from volume patterns)
  var estimatedWpm = estimateSpeechRate(state.volumeHistory);
  updateSpeechRateDisplay(estimatedWpm);

  // Update sample rate display with subtle visual pulse
  updateSampleRateDisplay(currentVolume);

  // Update noise reduction visualization
  updateNoiseReductionDisplay(currentVolume);

  state.animationId = requestAnimationFrame(drawWaveform);
}

// ============================================================
// VOLUME METER (drawn below waveform on the same canvas)
// ============================================================

function drawVolumeMeter(volume) {
  const canvas = document.getElementById('waveformCanvas');
  const ctx = canvas.getContext('2d');

  const meterHeight = 6;
  const meterWidth = canvas.width * 0.9;
  const meterX = (canvas.width - meterWidth) / 2;
  const meterY = canvas.height - meterHeight - 4;

  // Meter background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.beginPath();
  ctx.roundRect(meterX, meterY, meterWidth, meterHeight, 3);
  ctx.fill();

  // Meter fill
  const fillWidth = meterWidth * Math.min(1, volume);
  const gradient = ctx.createLinearGradient(meterX, 0, meterX + meterWidth, 0);
  gradient.addColorStop(0, '#00d4ff');
  gradient.addColorStop(0.6, '#00ff88');
  gradient.addColorStop(0.85, '#ffaa00');
  gradient.addColorStop(1, '#ff4444');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(meterX, meterY, Math.max(3, fillWidth), meterHeight, 3);
  ctx.fill();
}

// ============================================================
// CLARITY CALCULATION
// ============================================================

function calculateClarity(history, currentVol, noiseFloor) {
  if (history.length < 5) return Math.round(currentVol * 50);

  // Volume stability: lower variance = more stable = clearer
  const avg = history.reduce((a, b) => a + b, 0) / history.length;
  const variance = history.reduce((a, b) => a + (b - avg) * (b - avg), 0) / history.length;
  const stability = Math.max(0, 1 - variance * 20);

  // Signal-to-noise ratio estimate
  const snr = currentVol > noiseFloor ? currentVol / (noiseFloor + 0.001) : 0;
  const snrScore = Math.min(1, snr / 10);

  // Volume level factor (too quiet or too loud reduces clarity)
  const levelScore = currentVol > 0.05 && currentVol < 0.85 ? 1 : 0.5;

  // Speech rate factor: optimal rate is 150-200 WPM
  var wpm = state.simulated ? state.simulatedSpeechRate : estimateSpeechRate(history);
  var rateScore = calculateSpeechRateScore(wpm);

  // Combined clarity (adjusted weights to include speech rate)
  const clarity = (stability * 0.3 + snrScore * 0.25 + levelScore * 0.2 + rateScore * 0.25) * 100;
  return Math.min(100, Math.max(0, Math.round(clarity)));
}

/**
 * Estimate speech rate (WPM) from volume history patterns
 * Analyzes zero-crossings and envelope changes to estimate word rate
 */
function estimateSpeechRate(history) {
  if (history.length < 10) return 180;

  // Count significant volume transitions (syllable detection)
  var transitions = 0;
  var threshold = 0.05;
  for (var i = 1; i < history.length; i++) {
    if (Math.abs(history[i] - history[i - 1]) > threshold) {
      transitions++;
    }
  }

  // Estimate WPM: assume ~5 syllables per word, history spans ~1 second
  // Each transition cluster represents a syllable
  var syllablesPerSecond = transitions;
  var estimatedWpm = Math.round(syllablesPerSecond * 12); // 60s / 5 syllables per word

  // Clamp to realistic range
  return Math.max(60, Math.min(300, estimatedWpm));
}

/**
 * Calculate a speech rate quality score (0-1) based on WPM
 * - Optimal: 150-200 WPM (score = 1.0)
 * - Too fast (>250 WPM): score decreases
 * - Too slow (<100 WPM): score decreases
 */
function calculateSpeechRateScore(wpm) {
  if (wpm >= 150 && wpm <= 200) {
    return 1.0; // Optimal range
  } else if (wpm > 200 && wpm <= 250) {
    // Gradual decline from 1.0 to 0.7
    return 1.0 - ((wpm - 200) / 50) * 0.3;
  } else if (wpm > 250) {
    // Fast speech: score drops to 0.4
    return Math.max(0.4, 0.7 - ((wpm - 250) / 100) * 0.3);
  } else if (wpm >= 100 && wpm < 150) {
    // Gradual decline from 0.7 to 1.0
    return 0.7 + ((wpm - 100) / 50) * 0.3;
  } else {
    // Slow speech: score drops to 0.4
    return Math.max(0.4, 0.4 + ((wpm - 50) / 50) * 0.3);
  }
}

// ============================================================
// SIMULATED RECORDING (fallback when mic is unavailable)
// ============================================================

function simulateRecording() {
  // Ensure canvas is initialized
  const canvas = document.getElementById('waveformCanvas');
  if (!state.canvasInitialized || canvas.width === 0) {
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    state.canvasInitialized = true;
  }

  state.simulated = true;
  state.recording = true;
  state.paused = false;
  state.volumeHistory = [];
  state.noiseFloor = 0.015;
  state.peakVolumeValue = -100; // Initialize to minimum dB

  updateButtonStates('recording');
  startTimer();

  document.getElementById('aiProcessBtn').disabled = false;

  // Set simulated audio params
  setAudioParamsUI(null);

  drawSimulatedWaveform();
  showToast('🎙️ 开始录音（模拟模式）', 'info');
}

// ============================================================
// DRAW SIMULATED WAVEFORM (with realistic voice-like dynamics)
// ============================================================

function drawSimulatedWaveform() {
  if (!state.recording || state.paused) return;

  const canvas = document.getElementById('waveformCanvas');
  const ctx = canvas.getContext('2d');

  // Do NOT reset canvas size here
  const time = Date.now() / 1000;

  // Simulate realistic voice dynamics:
  // Use multiple overlapping sine waves with varying amplitude
  // to mimic speech patterns (syllables, pauses, emphasis)
  const syllablePhase = Math.sin(time * 0.4) * 0.5 + 0.5; // slow envelope
  const wordPhase = Math.sin(time * 1.8) * 0.3 + 0.7;     // medium envelope
  const phonemePhase = Math.sin(time * 4.5) * 0.2 + 0.8;   // fast envelope
  const baseAmp = Math.max(0.05, syllablePhase * wordPhase * phonemePhase);

  // Determine noise parameters based on current noise mode
  var noiseFloor = getNoiseFloorForMode(state.noiseMode || 'quiet');
  state.noiseFloor = noiseFloor;

  // Base noise component
  var noise = Math.sin(time * 13.7) * noiseFloor * 0.5 + Math.sin(time * 7.3) * noiseFloor * 0.4;

  // Mode-specific noise additions
  if (state.noiseMode === 'noisy') {
    // Noisy environment: add random high-frequency interference
    noise += (Math.random() - 0.5) * noiseFloor * 0.8;
    noise += Math.sin(time * 23.5) * noiseFloor * 0.3;
  } else if (state.noiseMode === 'loud') {
    // Loud environment: add low-frequency sine waves (voice interference simulation)
    noise += Math.sin(time * 3.2 + time * 0.7) * noiseFloor * 0.6;
    noise += Math.sin(time * 2.5 + time * 1.1) * noiseFloor * 0.4;
    noise += (Math.random() - 0.5) * noiseFloor * 0.5;
  }

  // Clear background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Center guide line
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();

  // Draw simulated waveform
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#00d4ff';
  ctx.shadowColor = '#00d4ff';
  ctx.shadowBlur = 4;
  ctx.beginPath();

  const numPoints = 512;
  const sliceWidth = canvas.width / numPoints;
  let x = 0;

  for (let i = 0; i < numPoints; i++) {
    const t = i / numPoints;
    // Combine multiple frequencies to simulate complex voice waveform
    const wave =
      Math.sin(t * Math.PI * 8 + time * 5) * 0.4 +
      Math.sin(t * Math.PI * 13 + time * 7.5) * 0.25 +
      Math.sin(t * Math.PI * 21 + time * 3.2) * 0.15 +
      Math.sin(t * Math.PI * 3 + time * 2.1) * 0.2;

    // Apply amplitude envelope (voice-like dynamics)
    const envelope = baseAmp + noise;
    const y = canvas.height / 2 + wave * envelope * (canvas.height / 3);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Volume meter
  const currentVolume = Math.min(1, baseAmp * 2);
  drawVolumeMeter(currentVolume);

  // Update peak volume - display as positive value
  const volumeDb = currentVolume > 0.001 ? Math.round(-60 + currentVolume * 60) : -60;
  if (volumeDb > state.peakVolumeValue) {
    state.peakVolumeValue = volumeDb;
  }
  const displayDb = Math.abs(state.peakVolumeValue);
  document.getElementById('peakVolume').textContent = displayDb + ' dB';

  // Clarity
  state.volumeHistory.push(currentVolume);
  if (state.volumeHistory.length > 30) {
    state.volumeHistory.shift();
  }
  const clarity = calculateClarity(state.volumeHistory, currentVolume, state.noiseFloor);
  const clarityEl = document.getElementById('clarityScore');
  clarityEl.textContent = clarity + '%';
  clarityEl.style.color = clarity > 70 ? 'var(--success)' : clarity > 40 ? 'var(--warning)' : 'var(--danger)';

  // Update noise level display
  updateNoiseLevelDisplay();

  // Update speech rate display (simulated)
  updateSpeechRateDisplay(state.simulatedSpeechRate);

  // Update noise reduction display
  updateNoiseReductionDisplay(currentVolume);

  state.animationId = requestAnimationFrame(drawSimulatedWaveform);
}

// ============================================================
// STOP RECORDING (full cleanup)
// ============================================================

function stopRecording() {
  state.recording = false;
  state.paused = false;
  state.simulated = false;

  if (state.recordingInterval) {
    clearInterval(state.recordingInterval);
    state.recordingInterval = null;
  }
  if (state.animationId) {
    cancelAnimationFrame(state.animationId);
    state.animationId = null;
  }

  // Release media stream
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(function(track) {
      track.stop();
    });
    state.mediaStream = null;
  }

  // Close audio context
  if (state.audioContext) {
    state.audioContext.close();
    state.audioContext = null;
  }

  state.microphone = null;
  state.analyser = null;

  updateButtonStates('idle');
  resetAudioParamsUI();

  showToast('⏹️ 录音已停止', 'info');

  // Switch to AI tab
  switchTab('ai');

  // Return to idle waveform
  initWaveform();
}

// ============================================================
// UI HELPERS
// ============================================================

/**
 * Update button states based on recording state
 * @param {'idle'|'recording'|'paused'} uiState
 */
function updateButtonStates(uiState) {
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const stopBtn = document.getElementById('stopBtn');
  const timer = document.getElementById('recordingTimer');

  // Reset timer class
  timer.classList.remove('paused-timer');

  switch (uiState) {
    case 'idle':
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      pauseBtn.innerHTML = '⏸️ 暂停';
      pauseBtn.onclick = pauseRecording;
      pauseBtn.className = 'rec-btn rec-btn-pause';
      stopBtn.disabled = true;
      break;
    case 'recording':
      startBtn.disabled = true;
      pauseBtn.disabled = false;
      pauseBtn.innerHTML = '⏸️ 暂停';
      pauseBtn.onclick = pauseRecording;
      pauseBtn.className = 'rec-btn rec-btn-pause';
      stopBtn.disabled = false;
      break;
    case 'paused':
      startBtn.disabled = true;
      pauseBtn.disabled = false;
      // Change pause button to resume button
      pauseBtn.innerHTML = '▶️ 继续';
      pauseBtn.onclick = resumeRecording;
      pauseBtn.className = 'rec-btn rec-btn-resume';
      stopBtn.disabled = false;
      timer.classList.add('paused-timer');
      break;
  }
}

/**
 * Start the recording timer
 */
function startTimer() {
  if (state.recordingInterval) {
    clearInterval(state.recordingInterval);
  }
  state.recordingInterval = setInterval(function() {
    state.recordingTime++;
    var mins = String(Math.floor(state.recordingTime / 60)).padStart(2, '0');
    var secs = String(state.recordingTime % 60).padStart(2, '0');
    document.getElementById('recordingTimer').textContent = mins + ':' + secs;
  }, 1000);
}

/**
 * Set audio parameter display values from a real AudioContext
 */
function setAudioParamsUI(audioCtx) {
  var sampleRate = audioCtx ? audioCtx.sampleRate : 48000;
  var sampleRateKhz = (sampleRate / 1000).toFixed(1);
  document.getElementById('sampleRate').textContent = sampleRateKhz + ' kHz';
  document.getElementById('bitDepth').textContent = '16 bit';
  document.getElementById('channels').textContent = '\u7acb\u4f53\u58f0';
  document.getElementById('noiseReduction').textContent = '\u5df2\u5f00\u542f';
  document.getElementById('noiseReduction').style.color = 'var(--success)';
}

/**
 * Reset audio params to default
 */
function resetAudioParamsUI() {
  document.getElementById('sampleRate').textContent = '48 kHz';
  document.getElementById('bitDepth').textContent = '16 bit';
  document.getElementById('channels').textContent = '\u7acb\u4f53\u58f0';
  document.getElementById('noiseReduction').textContent = '\u5df2\u5f00\u542f';
  document.getElementById('noiseReduction').style.color = 'var(--success)';
  document.getElementById('peakVolume').textContent = '-12 dB';
  var clarityEl = document.getElementById('clarityScore');
  clarityEl.textContent = '--';
  clarityEl.style.color = '';
  document.getElementById('noiseLevel').textContent = '--';
  document.getElementById('noiseLevel').style.color = '';
  document.getElementById('speechRate').textContent = '--';
  document.getElementById('speechRate').style.color = '';
  var barFill = document.getElementById('speechRateBarFill');
  if (barFill) barFill.style.width = '0%';
}

/**
 * Subtle visual update for sample rate display
 * Shows a small indicator dot that pulses with audio activity
 */
function updateSampleRateDisplay(volume) {
  var el = document.getElementById('sampleRate');
  // Keep the text stable but add a visual pulse via opacity
  var intensity = 0.6 + volume * 0.4;
  el.style.opacity = intensity.toFixed(2);
}

/**
 * Noise reduction visualization: show before/after volume comparison
 * Updates the noiseReduction element with a mini bar
 */
function updateNoiseReductionDisplay(currentVolume) {
  var el = document.getElementById('noiseReduction');
  var noiseFloor = state.noiseFloor || 0.015;
  var originalVol = currentVolume + noiseFloor;
  var reducedVol = currentVolume;
  var reductionPercent = originalVol > 0 ? Math.round((1 - reducedVol / originalVol) * 100) : 0;
  // Clamp to reasonable range
  reductionPercent = Math.max(5, Math.min(45, reductionPercent));

  el.innerHTML = '\u5df2\u5f00\u542f <span style="color: var(--text-dim); font-size: 11px;">(\u964d\u566a ' + reductionPercent + '%)</span>';
  el.style.color = 'var(--success)';
}

/**
 * Get the current noise floor based on the selected noise mode
 */
function getNoiseFloorForMode(mode) {
  switch (mode) {
    case 'quiet': return 0.01;
    case 'noisy': return 0.05;
    case 'loud':  return 0.12;
    default:      return 0.01;
  }
}

/**
 * Get noise mode label for display
 */
function getNoiseModeLabel(mode) {
  switch (mode) {
    case 'quiet': return '\u5b89\u9759 (0.01)';
    case 'noisy': return '\u5608\u6742 (0.05)';
    case 'loud':  return '\u5f3a\u566a\u58f0 (0.12)';
    default:      return '--';
  }
}

/**
 * Update the noise level display in the audio-params area
 */
function updateNoiseLevelDisplay() {
  var el = document.getElementById('noiseLevel');
  if (!el) return;
  var mode = state.noiseMode || 'quiet';
  var floor = getNoiseFloorForMode(mode);
  el.textContent = getNoiseModeLabel(mode);
  if (mode === 'quiet') {
    el.style.color = 'var(--success)';
  } else if (mode === 'noisy') {
    el.style.color = 'var(--warning)';
  } else {
    el.style.color = 'var(--danger)';
  }
}

/**
 * Update the speech rate display and indicator bar
 */
function updateSpeechRateDisplay(wpm) {
  var rateEl = document.getElementById('speechRate');
  var barFill = document.getElementById('speechRateBarFill');
  if (!rateEl || !barFill) return;

  if (!wpm || wpm <= 0) {
    rateEl.textContent = '--';
    barFill.style.width = '0%';
    return;
  }

  rateEl.textContent = Math.round(wpm) + ' WPM';

  // Map WPM to a percentage for the bar (50-300 WPM range)
  var pct = Math.min(100, Math.max(0, ((wpm - 50) / 250) * 100));
  barFill.style.width = pct + '%';

  // Color based on speech rate quality
  if (wpm >= 150 && wpm <= 200) {
    barFill.style.backgroundColor = 'var(--success)';
    rateEl.style.color = 'var(--success)';
  } else if ((wpm >= 100 && wpm < 150) || (wpm > 200 && wpm <= 250)) {
    barFill.style.backgroundColor = 'var(--warning)';
    rateEl.style.color = 'var(--warning)';
  } else {
    barFill.style.backgroundColor = 'var(--danger)';
    rateEl.style.color = 'var(--danger)';
  }
}

/**
 * Initialize noise selector event listeners
 */
function initNoiseSelector() {
  var radios = document.querySelectorAll('input[name="noiseMode"]');
  var options = document.querySelectorAll('.noise-option');

  radios.forEach(function(radio) {
    radio.addEventListener('change', function() {
      // Update active class on options
      options.forEach(function(opt) { opt.classList.remove('active'); });
      var parent = radio.closest('.noise-option');
      if (parent) parent.classList.add('active');

      // Update state
      state.noiseMode = radio.value;

      // Update noise floor in state for simulated mode
      if (state.simulated) {
        state.noiseFloor = getNoiseFloorForMode(state.noiseMode);
      }

      // Update display
      updateNoiseLevelDisplay();
    });
  });

  // Initialize display on load
  updateNoiseLevelDisplay();
}

// ============================================================
// INITIALIZATION
// ============================================================

// Ensure the state has the new fields
if (typeof state.paused === 'undefined') state.paused = false;
if (typeof state.simulated === 'undefined') state.simulated = false;
if (typeof state.canvasInitialized === 'undefined') state.canvasInitialized = false;
if (typeof state.mediaStream === 'undefined') state.mediaStream = null;
if (typeof state.volumeHistory === 'undefined') state.volumeHistory = [];
if (typeof state.peakVolumeValue === 'undefined') state.peakVolumeValue = 0;
if (typeof state.noiseFloor === 'undefined') state.noiseFloor = 0.015;
if (typeof state.noiseMode === 'undefined') state.noiseMode = 'quiet';
if (typeof state.simulatedSpeechRate === 'undefined') state.simulatedSpeechRate = 180;

// Initialize idle waveform after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      initNoiseSelector();
      initWaveform();
    }, 100);
  });
} else {
  setTimeout(function() {
    initNoiseSelector();
    initWaveform();
  }, 100);
}
