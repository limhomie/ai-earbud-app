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

  // Track user action
  if (typeof trackAction === 'function') trackAction('scenarioSwitchCount');

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

  // Translation - now editable for user correction
  const transEl = document.getElementById('translationContent');
  if (isEnglish) {
    transEl.innerHTML = `
      <div class="translation-row">
        <div class="translation-cell">
          <div class="lang-label">English (Original)</div>
          <p class="translation-text" contenteditable="false" data-original="${scenario.text}">${scenario.text}</p>
        </div>
        <div class="translation-cell">
          <div class="lang-label">
            中文 (翻译)
            <button class="edit-translation-btn" onclick="toggleEditTranslation(this)" title="点击编辑/锁定">✏️ 编辑</button>
            <button class="reset-translation-btn" onclick="resetTranslation(this)" style="display:none;" title="恢复原文">🔄 恢复</button>
          </div>
          <p class="translation-text editable" contenteditable="false" data-original="${scenario.translation}">${scenario.translation}</p>
          <div class="edit-hint" style="display:none;">✏️ 点击文本可直接修改翻译内容</div>
        </div>
      </div>
    `;
  } else {
    transEl.innerHTML = `
      <div class="translation-row">
        <div class="translation-cell">
          <div class="lang-label">中文 (原文)</div>
          <p class="translation-text" contenteditable="false" data-original="${scenario.text}">${scenario.text}</p>
        </div>
        <div class="translation-cell">
          <div class="lang-label">
            English (Translation)
            <button class="edit-translation-btn" onclick="toggleEditTranslation(this)" title="点击编辑/锁定">✏️ 编辑</button>
            <button class="reset-translation-btn" onclick="resetTranslation(this)" style="display:none;" title="恢复原文">🔄 恢复</button>
          </div>
          <p class="translation-text editable" contenteditable="false" data-original="Today we discussed Q1 product planning, focusing on the functional design of the new generation AI earbuds. Voice assistant response time needs to be optimized to within 200ms. Noise cancellation algorithms for meeting scenarios need upgrades, especially in multi-person dialogue environments. Translation function needs to support real-time mutual translation in at least 12 languages. Smart summary function needs to automatically identify key information and generate structured meeting minutes.">Today we discussed Q1 product planning, focusing on the functional design of the new generation AI earbuds. Voice assistant response time needs to be optimized to within 200ms. Noise cancellation algorithms for meeting scenarios need upgrades, especially in multi-person dialogue environments. Translation function needs to support real-time mutual translation in at least 12 languages. Smart summary function needs to automatically identify key information and generate structured meeting minutes.</p>
          <div class="edit-hint" style="display:none;">✏️ 点击文本可直接修改翻译内容</div>
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

// ========== 翻译编辑功能 ==========

/**
 * 切换翻译文本的编辑状态
 */
function toggleEditTranslation(btnEl) {
  const translationCell = btnEl.closest('.translation-cell');
  const textEl = translationCell.querySelector('.translation-text.editable');
  const hintEl = translationCell.querySelector('.edit-hint');
  const resetBtn = translationCell.querySelector('.reset-translation-btn');
  const isEditing = textEl.getAttribute('contenteditable') === 'true';

  if (isEditing) {
    // Lock: disable editing
    textEl.setAttribute('contenteditable', 'false');
    textEl.classList.remove('editing');
    btnEl.innerHTML = '✏️ 编辑';
    if (hintEl) hintEl.style.display = 'none';
    if (resetBtn) resetBtn.style.display = 'none';
    showToast('🔒 已锁定翻译内容', 'info');
  } else {
    // Enable editing
    textEl.setAttribute('contenteditable', 'true');
    textEl.classList.add('editing');
    textEl.focus();
    btnEl.innerHTML = '🔒 锁定';
    if (hintEl) hintEl.style.display = 'block';
    if (resetBtn) resetBtn.style.display = 'inline-block';
    showToast('✏️ 已解锁，可直接修改翻译', 'info');

    // Track user action
    if (typeof trackAction === 'function') trackAction('translationEditCount');
  }
}

/**
 * 恢复翻译文本为原始内容
 */
function resetTranslation(btnEl) {
  const translationCell = btnEl.closest('.translation-cell');
  const textEl = translationCell.querySelector('.translation-text.editable');
  const original = textEl.getAttribute('data-original');
  if (original) {
    textEl.textContent = original;
    showToast('🔄 已恢复为原始翻译', 'success');
  }
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

  // Use edited translation text from DOM if available
  const translationEl = document.querySelector('#translationContent .translation-text.editable');
  const translatedText = translationEl ? translationEl.textContent : scenario.translation;

  const content = `转写内容：\n${scenario.text}\n\n翻译（用户编辑）：\n${translatedText}\n\n摘要：\n${scenario.summary.join('\n')}`;
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
