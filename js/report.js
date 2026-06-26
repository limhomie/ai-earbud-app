// ============================================================
// M6 - Performance Report Module
// ============================================================
// This module handles the performance data collection and
// report chart rendering for the Soundcore AI earbud app.
// ============================================================

// ========== Performance Data (add to state) ==========
// Append this to the state object in index.html:
//   performanceData: []

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

  // Insights
  const insights = document.getElementById('insightsContainer');
  const lastData = data[data.length - 1];
  insights.innerHTML = `
    <div class="insight-card">
      <h5>💡 体验分析</h5>
      <p>最近一次识别准确率为 <strong>${lastData.accuracy}%</strong>，响应时间 <strong>${lastData.responseTime}ms</strong>。${lastData.accuracy > 90 ? '识别效果优秀，系统运行良好。' : '建议在安静环境下使用，可有效提升识别准确率。'}</p>
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
