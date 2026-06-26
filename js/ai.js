/**
 * M4 AI Processing Module
 *
 * This module handles all AI-related processing for the Soundcore AI Earbud App,
 * including mode selection, AI processing pipeline (speech-to-text, translation,
 * summary generation), and result generation for different scenarios.
 */

// ========== AI State ==========
// These properties are managed within the global `state` object:
//   state.mode            - Current processing mode ('standard' | 'precision')
//   state.processed       - Whether AI processing has been completed
//   state.scenarios       - Scenario data (meeting, learning) with text, translation, summary
//   state.aiApiMode       - 'simulated' | 'real' (controlled via UI)
//   state.aiApiKey        - API key for real AI services (optional)

// AI Processing mode
state.aiApiMode = state.aiApiMode || 'simulated';
state.aiApiKey = state.aiApiKey || '';

// ========== AI Mode Selection ==========
function selectAiProcessingMode(mode) {
  state.aiApiMode = mode;
  document.querySelectorAll('.ai-processing-mode-option').forEach(el => el.classList.remove('active'));
  document.getElementById(mode === 'simulated' ? 'aiModeSimulated' : 'aiModeReal').classList.add('active');
  document.querySelector('input[name="aiProcessingMode"][value="' + mode + '"]').checked = true;
  // Show/hide API key input
  if (typeof showApiKeyArea === 'function') {
    showApiKeyArea(mode === 'real');
  }
}

// ========== Mode Selection ==========
function selectMode(el, mode) {
  document.querySelectorAll('.mode-option').forEach(m => m.classList.remove('selected'));
  el.classList.add('selected');
  state.mode = mode;
}

// ========== Real AI API Calls ==========

/**
 * Call real speech-to-text API (e.g., OpenAI Whisper)
 * @param {Blob} audioBlob - Audio data to transcribe
 * @param {string} language - Target language code
 * @returns {Promise<string>} Transcribed text
 */
async function callRealSTT(audioBlob, language) {
  if (!state.aiApiKey) {
    throw new Error('未配置 API Key，请在 AI 处理页面设置 Whisper API Key');
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', 'whisper-1');
  formData.append('language', language || 'zh');
  formData.append('response_format', 'text');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + state.aiApiKey
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error('STT API 请求失败: ' + response.status);
  }

  return await response.text();
}

/**
 * Call real translation API (e.g., OpenAI Chat Completions)
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code
 * @returns {Promise<string>} Translated text
 */
async function callRealTranslation(text, targetLang) {
  if (!state.aiApiKey) {
    throw new Error('未配置 API Key');
  }

  const langNames = { en: 'English', zh: '中文', ja: '日本語', ko: '한국어', fr: 'Français', de: 'Deutsch' };
  const targetName = langNames[targetLang] || targetLang;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + state.aiApiKey
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a professional translator. Translate the following text to ' + targetName + '. Only return the translation, nothing else.' },
        { role: 'user', content: text }
      ],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw new Error('翻译 API 请求失败: ' + response.status);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

/**
 * Call real summary API
 * @param {string} text - Text to summarize
 * @param {string} language - Language of the text
 * @returns {Promise<string[]>} Summary points
 */
async function callRealSummary(text, language) {
  if (!state.aiApiKey) {
    throw new Error('未配置 API Key');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + state.apiKey
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Extract 3-5 key points from the following text. Return as a JSON array of strings, nothing else.' },
        { role: 'user', content: text }
      ],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw new Error('摘要 API 请求失败: ' + response.status);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  try {
    return JSON.parse(content);
  } catch (e) {
    return [content];
  }
}

/**
 * Main pipeline using real AI APIs
 * Falls back to simulated mode on error
 */
async function startAIProcessWithRealAPI() {
  const steps = ['step-stt', 'step-translate', 'step-summary'];
  const labels = ['语音转写', '实时翻译', '摘要生成'];
  const progressBar = document.getElementById('aiProgressBar');
  const progressText = document.getElementById('aiProgressText');

  // Reset states
  steps.forEach(function(id) {
    var step = document.getElementById(id);
    step.classList.remove('active', 'done', 'flash');
  });
  progressBar.style.width = '0%';
  progressText.textContent = '0%';

  var confidenceDisplay = document.getElementById('confidenceDisplay');
  if (confidenceDisplay) confidenceDisplay.style.display = 'none';

  var stepConfidences = [];

  try {
    // Step 1: STT
    var transcriptText = '';
    if (state._recordedAudioBlob) {
      var sttStart = Date.now();
      transcriptText = await callRealSTT(state._recordedAudioBlob, 'zh');
      var sttDuration = Date.now() - sttStart;
      stepConfidences.push(Math.min(98, 85 + Math.random() * 10));
    } else {
      // No recorded audio, use scenario text
      transcriptText = state.scenarios[state.currentScenario].text;
      stepConfidences.push(88 + Math.random() * 8);
    }

    // Step 2: Translation
    var translatedText = '';
    var targetLang = state.targetLanguage || 'en';
    var translationStart = Date.now();
    translatedText = await callRealTranslation(transcriptText, targetLang);
    var translationDuration = Date.now() - translationStart;
    stepConfidences.push(Math.min(98, 85 + Math.random() * 10));

    // Step 3: Summary
    var summaryPoints = [];
    var summaryStart = Date.now();
    summaryPoints = await callRealSummary(transcriptText, 'zh');
    var summaryDuration = Date.now() - summaryStart;
    stepConfidences.push(Math.min(98, 85 + Math.random() * 10));

    // Update UI
    updateResultsDisplay(transcriptText, translatedText, summaryPoints, targetLang);

    var overallConfidence = generateConfidence(state.mode, stepConfidences);
    displayConfidence(overallConfidence);

    state.processed = true;
    showToast('✅ AI处理完成！', 'success');
    switchTab('results');

    state.performanceData.push({
      responseTime: Math.round(800 + Math.random() * 400),
      accuracy: Math.round(overallConfidence),
      aiTime: Math.round((sttDuration || 1000) + (translationDuration || 1000) + (summaryDuration || 1000)),
      timestamp: Date.now()
    });

    updateReport();

  } catch (error) {
    console.warn('Real AI API failed, falling back to simulated mode:', error.message);
    showToast('⚠️ API 调用失败，使用模拟模式: ' + error.message, 'warning');
    startAIProcess();
  }
}

/**
 * Update results display with real data
 */
function updateResultsDisplay(transcriptText, translatedText, summaryPoints, targetLang) {
  var transcriptEl = document.getElementById('transcriptText');
  var transEl = document.getElementById('translationContent');
  var summaryEl = document.getElementById('summaryContent');
  var targetLangName = state.languageOptions && state.languageOptions[targetLang] ? state.languageOptions[targetLang] : targetLang;

  // Transcript with word highlighting
  var isEnglish = state.currentScenario === 'learning';
  if (isEnglish) {
    var words = transcriptText.split(' ');
    var html = '';
    words.forEach(function(word) {
      var confidence = Math.random();
      var level = confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low';
      html += '<span class="word ' + level + '">' + word + '</span> ';
    });
    transcriptEl.innerHTML = html;
  } else {
    transcriptEl.innerHTML = '<p style="font-size: 14px; line-height: 1.7;">' + transcriptText + '</p>';
  }

  // Translation
  transEl.innerHTML =
    '<div class="translation-row">' +
      '<div class="translation-cell">' +
        '<div class="lang-label">' + (isEnglish ? 'English (Original)' : '中文 (原文)') + '</div>' +
        '<p class="translation-text" contenteditable="false" data-original="' + transcriptText + '">' + transcriptText + '</p>' +
      '</div>' +
      '<div class="translation-cell">' +
        '<div class="lang-label">' +
          targetLangName +
          ' <button class="edit-translation-btn" onclick="toggleEditTranslation(this)">✏️ 编辑</button>' +
          '<button class="reset-translation-btn" onclick="resetTranslation(this)" style="display:none;">🔄 恢复</button>' +
        '</div>' +
        '<p class="translation-text editable" contenteditable="false" data-original="' + translatedText + '">' + translatedText + '</p>' +
        '<div class="edit-hint" style="display:none;">✏️ 点击文本可直接修改翻译内容</div>' +
      '</div>' +
    '</div>';

  // Summary
  summaryEl.innerHTML =
    '<div class="summary-card">' +
      '<h4>智能摘要</h4>' +
      '<ul class="summary-points">' +
        summaryPoints.map(function(s) { return '<li><span>' + s + '</span></li>'; }).join('') +
      '</ul>' +
    '</div>';

  document.getElementById('actionBar').style.display = 'flex';
}

// ========== AI Processing Pipeline ==========
async function startAIProcess() {
  // Route to real API if configured
  if (state.aiApiMode === 'real' && state.aiApiKey) {
    await startAIProcessWithRealAPI();
    return;
  }

  const btn = document.getElementById('aiProcessBtn');
  btn.disabled = true;

  // Track user action
  if (typeof trackAction === 'function') trackAction('aiProcessCount');

  // Reset all steps to idle state
  const steps = ['step-stt', 'step-translate', 'step-summary'];
  const labels = ['语音转写', '实时翻译', '摘要生成'];
  const progressBar = document.getElementById('aiProgressBar');
  const progressText = document.getElementById('aiProgressText');

  // Reset previous states
  steps.forEach(function(id) {
    var step = document.getElementById(id);
    step.classList.remove('active', 'done', 'flash');
  });
  progressBar.style.width = '0%';
  progressText.textContent = '0%';

  // Hide confidence display for new run
  var confidenceDisplay = document.getElementById('confidenceDisplay');
  if (confidenceDisplay) confidenceDisplay.style.display = 'none';

  const duration = state.mode === 'precision' ? 4000 : 2500;
  const stepDuration = duration / steps.length;

  // Track per-step confidence values
  var stepConfidences = [];

  for (let i = 0; i < steps.length; i++) {
    const step = document.getElementById(steps[i]);

    // Add blink effect when switching to this step (skip for first step)
    if (i > 0) {
      step.classList.add('blink');
      await new Promise(resolve => setTimeout(resolve, 300));
      step.classList.remove('blink');
    }

    // Activate step
    step.classList.add('active');
    document.getElementById('processingOverlay').classList.add('show');
    document.getElementById('processingText').textContent = `正在${labels[i]}...`;
    document.getElementById('processingSub').textContent = `步骤 ${i + 1} / ${steps.length}`;

    // Smooth progress animation during step execution
    const startProgress = (i / steps.length) * 100;
    const endProgress = ((i + 1) / steps.length) * 100;
    const animationStart = Date.now();

    await new Promise(resolve => {
      const animateProgress = function() {
        const elapsed = Date.now() - animationStart;
        const stepProgress = Math.min(elapsed / stepDuration, 1);
        const currentProgress = startProgress + (endProgress - startProgress) * stepProgress;
        progressBar.style.width = Math.round(currentProgress) + '%';
        progressText.textContent = Math.round(currentProgress) + '%';

        if (stepProgress < 1) {
          requestAnimationFrame(animateProgress);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(animateProgress);
    });

    // Generate per-step confidence value
    var stepConfidence = generateStepConfidence(state.mode);
    stepConfidences.push(stepConfidence);

    // Flash transition effect
    step.classList.remove('active');
    step.classList.add('flash');
    await new Promise(resolve => setTimeout(resolve, 400));
    step.classList.remove('flash');
    step.classList.add('done');

    // Ensure final progress for this step
    const finalProgress = Math.round(((i + 1) / steps.length) * 100);
    progressBar.style.width = finalProgress + '%';
    progressText.textContent = finalProgress + '%';
  }

  document.getElementById('processingOverlay').classList.remove('show');

  // Generate results
  generateResults();
  state.processed = true;

  // Calculate and display overall confidence
  var overallConfidence = generateConfidence(state.mode, stepConfidences);
  displayConfidence(overallConfidence);

  // Enable results tab
  showToast('✅ AI处理完成！', 'success');

  // Switch to results
  switchTab('results');

  // Record performance data
  state.performanceData.push({
    responseTime: Math.round(800 + Math.random() * 400),
    accuracy: Math.round(overallConfidence),
    aiTime: Math.round(duration),
    timestamp: Date.now()
  });

  // Update report
  updateReport();
}

// ========== Generate Per-Step Confidence ==========
function generateStepConfidence(mode) {
  // Precision mode yields slightly higher confidence
  var baseMin = mode === 'precision' ? 88 : 82;
  var baseMax = mode === 'precision' ? 98 : 95;
  return Math.round((baseMin + Math.random() * (baseMax - baseMin)) * 10) / 10;
}

// ========== Generate Overall Confidence ==========
function generateConfidence(mode, stepConfidences) {
  // Calculate weighted average of step confidences
  var avg = stepConfidences.reduce(function(a, b) { return a + b; }, 0) / stepConfidences.length;

  // Add a small mode-based boost for precision
  if (mode === 'precision') {
    avg = Math.min(avg + 1.5, 98);
  }

  return Math.round(avg * 10) / 10;
}

// ========== Display Confidence ==========
function displayConfidence(confidence) {
  var confidenceDisplay = document.getElementById('confidenceDisplay');
  var confidenceValue = document.getElementById('confidenceValue');
  var confidenceBarFill = document.getElementById('confidenceBarFill');

  if (!confidenceDisplay || !confidenceValue || !confidenceBarFill) return;

  // Determine confidence level
  var level = 'low';
  if (confidence > 80) level = 'high';
  else if (confidence >= 50) level = 'medium';

  // Show the display
  confidenceDisplay.style.display = 'block';

  // Update value text
  confidenceValue.textContent = confidence + '%';
  confidenceValue.className = 'confidence-value ' + level;

  // Animate bar fill with delay for visual effect
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      confidenceBarFill.style.width = confidence + '%';
      confidenceBarFill.className = 'confidence-bar-fill ' + level;
    });
  });
}

// ========== Result Generation ==========
function generateResults() {
  const scenario = state.scenarios[state.currentScenario];
  const isEnglish = state.currentScenario === 'learning';
  const targetLang = state.targetLanguage || 'en';

  // Get translated text based on target language
  var translatedText;
  if (scenario.translations && scenario.translations[targetLang]) {
    translatedText = scenario.translations[targetLang];
  } else {
    translatedText = scenario.translation;
  }

  // Get target language display name
  var targetLangName = state.languageOptions && state.languageOptions[targetLang] ? state.languageOptions[targetLang] : targetLang;

  // Transcript
  const transcriptEl = document.getElementById('transcriptText');
  if (isEnglish) {
    const words = scenario.text.split(' ');
    let html = '';
    words.forEach(word => {
      const confidence = Math.random();
      const level = confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low';
      html += `<span class="word ${level}">${word}</span> `;
    });
    transcriptEl.innerHTML = html;
  } else {
    const chars = scenario.text.split('');
    let html = '';
    let currentWord = '';
    chars.forEach(char => {
      if (char === ' ' || char === '，' || char === '。') {
        if (currentWord) {
          const confidence = Math.random();
          const level = confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low';
          html += `<span class="word ${level}">${currentWord}</span>`;
          currentWord = '';
        }
        html += char;
      } else {
        currentWord += char;
      }
    });
    if (currentWord) {
      html += `<span class="word high">${currentWord}</span>`;
    }
    transcriptEl.innerHTML = html;
  }

  // Translation
  const transEl = document.getElementById('translationContent');
  if (isEnglish) {
    transEl.innerHTML = `
      <div class="translation-row">
        <div class="translation-cell">
          <div class="lang-label">English (Original)</div>
          <p style="font-size: 14px; line-height: 1.7;">${scenario.text}</p>
        </div>
        <div class="translation-cell">
          <div class="lang-label">${targetLangName} (Translation)</div>
          <p style="font-size: 14px; line-height: 1.7;">${translatedText}</p>
        </div>
      </div>
    `;
  } else {
    transEl.innerHTML = `
      <div class="translation-row">
        <div class="translation-cell">
          <div class="lang-label">中文 (原文)</div>
          <p style="font-size: 14px; line-height: 1.7;">${scenario.text}</p>
        </div>
        <div class="translation-cell">
          <div class="lang-label">${targetLangName} (Translation)</div>
          <p style="font-size: 14px; line-height: 1.7;">${translatedText}</p>
        </div>
      </div>
    `;
  }

  // Summary
  const summaryEl = document.getElementById('summaryContent');
  summaryEl.innerHTML = `
    <div class="summary-card">
      <h4>📝 智能摘要</h4>
      <ul class="summary-points">
        ${scenario.summary.map(s => `<li><span>${s}</span></li>`).join('')}
      </ul>
    </div>
  `;

  // Show action bar
  document.getElementById('actionBar').style.display = 'flex';
}
