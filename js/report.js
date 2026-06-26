// ============================================================
// M6 - Performance Report Module
// ============================================================
// This module handles the performance data collection and
// report chart rendering for the Soundcore AI earbud app.
// ============================================================

// ========== Performance Data (add to state) ==========
// Append this to the state object in index.html:
//   performanceData: []

// ========== User Action Tracking ==========
function trackAction(actionName) {
  if (!state.userActions) {
    state.userActions = {
      recordingCount: 0,
      aiProcessCount: 0,
      scenarioSwitchCount: 0,
      translationEditCount: 0,
      totalClickCount: 0
    };
  }
  if (state.userActions[actionName] !== undefined) {
    state.userActions[actionName]++;
  }
  state.userActions.totalClickCount++;
}

// ========== Performance Report ==========
function updateReport() {
  const data = state.performanceData;
  if (!data.length) return;

  // Response time chart
  const rtChart = document.getElementById('responseTimeChart');
  rtChart.innerHTML = data.map((d, i) => `
    <div class="chart-bar-item">
      <div class="chart-bar-value">${d.responseTime}</div>
      <div class="chart-bar" style="height: ${d.responseTime / 12}%;"></div>
      <div class="chart-bar-label">#${i + 1}</div>
    </div>
  `).join('');

  // Accuracy chart
  const accChart = document.getElementById('accuracyChart');
  accChart.innerHTML = data.map((d, i) => `
    <div class="chart-bar-item">
      <div class="chart-bar-value">${d.accuracy}%</div>
      <div class="chart-bar" style="height: ${d.accuracy}%; background: linear-gradient(to top, #009966, #00e676);"></div>
      <div class="chart-bar-label">#${i + 1}</div>
    </div>
  `).join('');

  // AI time chart
  const aiChart = document.getElementById('aiTimeChart');
  aiChart.innerHTML = data.map((d, i) => `
    <div class="chart-bar-item">
      <div class="chart-bar-value">${d.aiTime}ms</div>
      <div class="chart-bar" style="height: ${d.aiTime / 50}%; background: linear-gradient(to top, #cc6600, #ffab00);"></div>
      <div class="chart-bar-label">#${i + 1}</div>
    </div>
  `).join('');

  // User actions chart
  const actions = state.userActions || {};
  const actionData = [
    { label: '录音', value: actions.recordingCount || 0, color: 'linear-gradient(to top, #0066cc, #0099ff)' },
    { label: 'AI处理', value: actions.aiProcessCount || 0, color: 'linear-gradient(to top, #cc6600, #ffab00)' },
    { label: '场景切换', value: actions.scenarioSwitchCount || 0, color: 'linear-gradient(to top, #6600cc, #aa66ff)' },
    { label: '翻译编辑', value: actions.translationEditCount || 0, color: 'linear-gradient(to top, #009966, #00e676)' },
    { label: '总点击', value: actions.totalClickCount || 0, color: 'linear-gradient(to top, #cc0066, #ff66aa)' }
  ];

  const maxAction = Math.max(1, ...actionData.map(a => a.value));
  const uaChart = document.getElementById('userActionsChart');
  uaChart.innerHTML = actionData.map(a => `
    <div class="chart-bar-item">
      <div class="chart-bar-value">${a.value}</div>
      <div class="chart-bar" style="height: ${Math.max(5, (a.value / maxAction) * 100)}%; background: ${a.color};"></div>
      <div class="chart-bar-label">${a.label}</div>
    </div>
  `).join('');

  // Insights
  const insights = document.getElementById('insightsContainer');
  const lastData = data[data.length - 1];
  const totalActions = (actions.recordingCount || 0) + (actions.aiProcessCount || 0) + (actions.scenarioSwitchCount || 0) + (actions.translationEditCount || 0);
  insights.innerHTML = `
    <div class="insight-card">
      <h5>💡 体验分析</h5>
      <p>最近一次识别准确率为 <strong>${lastData.accuracy}%</strong>，响应时间 <strong>${lastData.responseTime}ms</strong>。${lastData.accuracy > 90 ? '识别效果优秀，系统运行良好。' : '建议在安静环境下使用，可有效提升识别准确率。'}</p>
    </div>
    <div class="insight-card">
      <h5>📊 操作统计</h5>
      <p>累计录音 <strong>${actions.recordingCount || 0}</strong> 次，AI 处理 <strong>${actions.aiProcessCount || 0}</strong> 次，场景切换 <strong>${actions.scenarioSwitchCount || 0}</strong> 次，翻译编辑 <strong>${actions.translationEditCount || 0}</strong> 次。总操作 <strong>${totalActions}</strong> 次。</p>
    </div>
    <div class="insight-card">
      <h5>🎯 优化建议</h5>
      <p>• 建议在低噪环境中使用，识别效果最优<br>
         • 语速控制在 150-180 词/分钟时识别最准确<br>
         • 保持耳机与设备距离在 3 米以内<br>
         • 定期更新固件以获得最佳性能</p>
    </div>
  `;
}
