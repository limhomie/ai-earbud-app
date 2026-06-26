/**
 * M5 - 结果展示模块 (Results Module)
 *
 * 负责处理 AI 耳机语音助手的结果展示功能，包括：
 * - 场景切换（会议场景 / 学习场景）
 * - 结果标签页切换（转写文本 / 翻译对照 / 智能摘要）
 * - 结果内容生成与渲染
 * - 文本复制、导出、分享操作
 */

// ========== 当前场景状态 ==========
// 注意：此变量需与 index.html 中的 state 对象配合使用
// state.currentScenario = 'meeting';

// ========== 场景切换 ==========
function switchScenario(scenarioName) {
  state.currentScenario = scenarioName;
  document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  // Regenerate results with new scenario
  if (state.processed) {
    generateResults();
  }
}

// ========== 结果标签页切换 ==========
function switchResultTab(tabName) {
  document.querySelectorAll('.result-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.result-content').forEach(c => c.classList.remove('active'));
  // Use event.currentTarget instead of global event
  const tabs = document.querySelectorAll('.result-tab');
  tabs.forEach(t => {
    if (t.textContent.includes(tabName === 'transcript' ? '转写' : tabName === 'translation' ? '翻译' : '摘要')) {
      t.classList.add('active');
    }
  });
  document.getElementById('result-' + tabName).classList.add('active');
}

// ========== 结果内容生成 ==========
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
      if (char === ' ' || char === '\uFF0C' || char === '\u3002') {
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
      <h4>智能摘要</h4>
      <ul class="summary-points">
        ${scenario.summary.map(s => `<li><span>${s}</span></li>`).join('')}
      </ul>
    </div>
  `;

  // Show action bar
  document.getElementById('actionBar').style.display = 'flex';
}

// ========== 操作按钮 ==========

// 复制文本到剪贴板
function copyText() {
  const text = document.getElementById('transcriptText').innerText;
  navigator.clipboard.writeText(text).then(() => showToast(' 已复制到剪贴板', 'success'));
}

// 导出结果为文本文件
function exportText() {
  const scenario = state.scenarios[state.currentScenario];
  const content = `转写内容：\n${scenario.text}\n\n翻译：\n${scenario.translation}\n\n摘要：\n${scenario.summary.join('\n')}`;
  const blob = new Blob([content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ai-earbud-result.txt';
  a.click();
  showToast(' 已导出文件', 'success');
}

// 分享结果（演示功能）
function shareText() {
  showToast(' 分享链接已生成（演示功能）', 'info');
}
