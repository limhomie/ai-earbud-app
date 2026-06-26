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

  // Enhanced insights with user behavior analysis
  var avgResponseTime = 0;
  var avgAccuracy = 0;
  var avgAITime = 0;
  data.forEach(function(d) {
    avgResponseTime += d.responseTime;
    avgAccuracy += d.accuracy;
    avgAITime += d.aiTime;
  });
  avgResponseTime = Math.round(avgResponseTime / data.length);
  avgAccuracy = Math.round(avgAccuracy / data.length);
  avgAITime = Math.round(avgAITime / data.length);

  // Analyze preferred scenario
  var meetingCount = 0;
  var learningCount = 0;
  var convHistory = state.conversationHistory || [];
  convHistory.forEach(function(c) {
    if (c.scenario === 'meeting') meetingCount++;
    else if (c.scenario === 'learning') learningCount++;
  });
  var preferredScenario = meetingCount > learningCount ? '会议场景' : meetingCount < learningCount ? '学习场景' : '两者均衡';

  // Generate personalized suggestions
  var suggestions = [];
  if (avgAccuracy < 85) {
    suggestions.push('识别准确率偏低，建议在安静环境下使用');
  }
  if (avgAITime > 3000) {
    suggestions.push('AI处理耗时较长，可尝试标准模式以提升速度');
  }
  if (convHistory.length > 3) {
    suggestions.push('您已使用多轮对话功能，建议尝试自动整理会议纪要');
  }
  if (suggestions.length === 0) {
    suggestions.push('当前使用状态良好，继续保持');
  }

  var totalActionCount = (actions.recordingCount || 0) + (actions.aiProcessCount || 0) + (actions.scenarioSwitchCount || 0) + (actions.translationEditCount || 0);

  const insights = document.getElementById('insightsContainer');
  insights.innerHTML = `
    <div class="insight-card">
      <h5>📊 使用行为报告</h5>
      <p>平均响应时间 <strong>${avgResponseTime}ms</strong> · 平均准确率 <strong>${avgAccuracy}%</strong> · 平均AI耗时 <strong>${avgAITime}ms</strong></p>
      <p>累计使用 <strong>${totalActionCount}</strong> 次操作，完成 <strong>${convHistory.length}</strong> 轮对话</p>
    </div>
    <div class="insight-card">
      <h5>🎯 使用偏好分析</h5>
      <p>常用场景：<strong>${preferredScenario}</strong></p>
      <p>录音 ${actions.recordingCount || 0} 次 · AI处理 ${actions.aiProcessCount || 0} 次 · 场景切换 ${actions.scenarioSwitchCount || 0} 次</p>
    </div>
    <div class="insight-card">
      <h5>💡 个性化建议</h5>
      <p>${suggestions.map(function(s) { return '• ' + s; }).join('<br>')}</p>
    </div>
    <div class="insight-card">
      <h5>🔒 数据安全</h5>
      <p>所有数据存储于本地浏览器 · 关闭页面后自动清除 · 未经您的许可不会上传任何数据</p>
    </div>
  `;
}
