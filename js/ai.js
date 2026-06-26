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

// ========== Mode Selection ==========
function selectMode(el, mode) {
  document.querySelectorAll('.mode-option').forEach(m => m.classList.remove('selected'));
  el.classList.add('selected');
  state.mode = mode;
}

// ========== AI Processing Pipeline ==========
async function startAIProcess() {
  const btn = document.getElementById('aiProcessBtn');
  btn.disabled = true;

  const steps = ['step-stt', 'step-translate', 'step-summary'];
  const labels = ['语音转写', '实时翻译', '摘要生成'];
  const progressBar = document.getElementById('aiProgressBar');
  const progressText = document.getElementById('aiProgressText');

  const duration = state.mode === 'precision' ? 4000 : 2500;
  const stepDuration = duration / steps.length;

  for (let i = 0; i < steps.length; i++) {
    const step = document.getElementById(steps[i]);
    step.classList.add('active');
    document.getElementById('processingOverlay').classList.add('show');
    document.getElementById('processingText').textContent = `正在${labels[i]}...`;
    document.getElementById('processingSub').textContent = `步骤 ${i + 1} / ${steps.length}`;

    await new Promise(resolve => setTimeout(resolve, stepDuration));

    step.classList.remove('active');
    step.classList.add('done');

    const progress = Math.round(((i + 1) / steps.length) * 100);
    progressBar.style.width = progress + '%';
    progressText.textContent = progress + '%';
  }

  document.getElementById('processingOverlay').classList.remove('show');

  // Generate results
  generateResults();
  state.processed = true;

  // Enable results tab
  showToast('✅ AI处理完成！', 'success');

  // Switch to results
  switchTab('results');

  // Record performance data
  state.performanceData.push({
    responseTime: Math.round(800 + Math.random() * 400),
    accuracy: Math.round(88 + Math.random() * 10),
    aiTime: Math.round(duration),
    timestamp: Date.now()
  });

  // Update report
  updateReport();
}

// ========== Result Generation ==========
function generateResults() {
  const scenario = state.scenarios[state.currentScenario];
  const isEnglish = state.currentScenario === 'learning';

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
          <div class="lang-label">中文 (翻译)</div>
          <p style="font-size: 14px; line-height: 1.7;">${scenario.translation}</p>
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
          <div class="lang-label">English (Translation)</div>
          <p style="font-size: 14px; line-height: 1.7;">Today we discussed Q1 product planning, focusing on the functional design of the new generation AI earbuds. Voice assistant response time needs to be optimized to within 200ms. Noise cancellation algorithms for meeting scenarios need upgrades, especially in multi-person dialogue environments. Translation function needs to support real-time mutual translation in at least 12 languages. Smart summary function needs to automatically identify key information and generate structured meeting minutes.</p>
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
