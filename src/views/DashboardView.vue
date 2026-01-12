<template>
  <div class="dashboard-view">
    <!-- 欢迎区域 -->
    <div class="welcome-section">
      <div class="welcome-content">
        <h1 class="welcome-title">
          <i class="icon-robot"></i>
          机器人可视化平台
        </h1>
        <p class="welcome-subtitle">
          支持 ROS、MQTT、WebSocket 等多种通信协议的统一可视化平台
        </p>

        <!-- 快速操作 -->
        <div class="quick-actions">
          <button
            @click="uiStore.showModal('connection')"
            class="quick-action-btn primary"
          >
            <i class="icon-connection"></i>
            连接机器人
          </button>

          <button
            @click="uiStore.setActiveView('navigation')"
            class="quick-action-btn secondary"
          >
            <i class="icon-navigation"></i>
            开始导航
          </button>

          <button
            @click="uiStore.setActiveView('sensors')"
            class="quick-action-btn secondary"
          >
            <i class="icon-sensor"></i>
            查看传感器
          </button>
        </div>
      </div>

      <!-- 系统状态卡片 -->
      <div class="status-cards">
        <div class="status-card" :class="robotStore.systemStatus">
          <div class="status-icon">
            <i :class="getStatusIcon(robotStore.systemStatus)"></i>
          </div>
          <div class="status-content">
            <div class="status-title">系统状态</div>
            <div class="status-value">{{ getStatusText(robotStore.systemStatus) }}</div>
          </div>
        </div>

        <div class="status-card">
          <div class="status-icon">
            <i class="icon-robot"></i>
          </div>
          <div class="status-content">
            <div class="status-title">连接机器人</div>
            <div class="status-value">{{ robotStore.connectedRobots.length }}</div>
          </div>
        </div>

        <div class="status-card">
          <div class="status-icon">
            <i class="icon-sensor"></i>
          </div>
          <div class="status-content">
            <div class="status-title">活跃传感器</div>
            <div class="status-value">{{ activeSensors }}</div>
          </div>
        </div>

        <div class="status-card">
          <div class="status-icon">
            <i class="icon-task"></i>
          </div>
          <div class="status-content">
            <div class="status-title">活跃任务</div>
            <div class="status-value">{{ robotStore.activeTasks.length }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="dashboard-content">
      <!-- 左侧面板 -->
      <div class="dashboard-sidebar">
        <!-- 快速设置 -->
        <div class="dashboard-card">
          <h3 class="card-title">快速设置</h3>
          <div class="quick-settings">
            <div class="setting-group">
              <label class="setting-label">主题</label>
              <select
                v-model="uiStore.uiState.theme"
                @change="uiStore.setTheme(($event.target as HTMLSelectElement).value as any)"
                class="setting-select"
              >
                <option value="light">浅色</option>
                <option value="dark">深色</option>
                <option value="auto">自动</option>
              </select>
            </div>

            <div class="setting-group">
              <label class="setting-label">布局</label>
              <select
                v-model="uiStore.uiState.layout"
                class="setting-select"
              >
                <option value="default">默认</option>
                <option value="minimal">极简</option>
                <option value="extended">扩展</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 最近活动 -->
        <div class="dashboard-card">
          <h3 class="card-title">最近活动</h3>
          <div class="activity-list">
            <div
              v-for="packet in recentPackets"
              :key="packet.timestamp"
              class="activity-item"
            >
              <div class="activity-icon">
                <i :class="getProtocolIcon(packet.source)"></i>
              </div>
              <div class="activity-content">
                <div class="activity-topic">{{ packet.topic }}</div>
                <div class="activity-type">{{ packet.type }}</div>
              </div>
              <div class="activity-time">{{ formatTime(packet.timestamp) }}</div>
            </div>

            <div v-if="robotStore.dataPackets.length === 0" class="no-activity">
              <i class="icon-inactive"></i>
              <span>暂无活动</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧内容 -->
      <div class="dashboard-main">
        <!-- 地图预览 -->
        <div class="dashboard-card map-preview">
          <h3 class="card-title">
            地图预览
            <button
              @click="uiStore.setActiveView('mapping')"
              class="card-action"
            >
              查看详情 <i class="icon-arrow"></i>
            </button>
          </h3>
          <div class="map-placeholder">
            <div v-if="robotStore.currentMap" class="map-canvas">
              <!-- 这里可以显示地图缩略图 -->
              <div class="map-info">
                <div class="map-size">{{ robotStore.currentMap.info.width }} × {{ robotStore.currentMap.info.height }}</div>
                <div class="map-resolution">{{ (robotStore.currentMap.info.resolution * 100).toFixed(1) }} cm/像素</div>
              </div>
            </div>
            <div v-else class="no-map">
              <i class="icon-map"></i>
              <span>暂无地图数据</span>
              <p>连接机器人后将自动加载地图</p>
            </div>
          </div>
        </div>

        <!-- 性能指标 -->
        <div class="dashboard-card performance-metrics">
          <h3 class="card-title">性能指标</h3>
          <div class="metrics-grid">
            <div class="metric-item">
              <div class="metric-icon">
                <i class="icon-fps"></i>
              </div>
              <div class="metric-content">
                <div class="metric-value">{{ robotStore.performanceMetrics.fps }}</div>
                <div class="metric-label">FPS</div>
              </div>
            </div>

            <div class="metric-item">
              <div class="metric-icon">
                <i class="icon-memory"></i>
              </div>
              <div class="metric-content">
                <div class="metric-value">{{ robotStore.performanceMetrics.memoryUsage }}</div>
                <div class="metric-label">内存 (MB)</div>
              </div>
            </div>

            <div class="metric-item">
              <div class="metric-icon">
                <i class="icon-throughput"></i>
              </div>
              <div class="metric-content">
                <div class="metric-value">{{ robotStore.performanceMetrics.dataThroughput.toFixed(1) }}</div>
                <div class="metric-label">数据吞吐 (KB/s)</div>
              </div>
            </div>

            <div class="metric-item">
              <div class="metric-icon">
                <i class="icon-latency"></i>
              </div>
              <div class="metric-content">
                <div class="metric-value">{{ robotStore.performanceMetrics.latency.toFixed(1) }}</div>
                <div class="metric-label">延迟 (ms)</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 快速导航 -->
        <div class="dashboard-card quick-nav">
          <h3 class="card-title">快速导航</h3>
          <div class="nav-grid">
            <button
              @click="uiStore.setActiveView('navigation')"
              class="nav-item"
            >
              <i class="icon-navigation"></i>
              <span>导航控制</span>
            </button>

            <button
              @click="uiStore.setActiveView('control')"
              class="nav-item"
            >
              <i class="icon-control"></i>
              <span>机器人控制</span>
            </button>

            <button
              @click="uiStore.setActiveView('sensors')"
              class="nav-item"
            >
              <i class="icon-sensor"></i>
              <span>传感器数据</span>
            </button>

            <button
              @click="uiStore.setActiveView('tasks')"
              class="nav-item"
            >
              <i class="icon-task"></i>
              <span>任务管理</span>
            </button>

            <button
              @click="uiStore.setActiveView('data-analysis')"
              class="nav-item"
            >
              <i class="icon-analysis"></i>
              <span>数据分析</span>
            </button>

            <button
              @click="uiStore.setActiveView('logs')"
              class="nav-item"
            >
              <i class="icon-log"></i>
              <span>系统日志</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUIStore } from '../stores/ui'
import { useRobotStore } from '../stores/robot'

// Store
const uiStore = useUIStore()
const robotStore = useRobotStore()

// 计算属性
const activeSensors = computed(() => {
  return Array.from(robotStore.sensors.values()).filter(sensor => {
    const now = Date.now()
    const timeDiff = now - sensor.timestamp
    return timeDiff < 5000 // 5秒内认为活跃
  }).length
})

const recentPackets = computed(() => {
  return robotStore.dataPackets.slice(-5).reverse()
})

// 方法
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'idle': '空闲',
    'normal': '正常',
    'warning': '警告',
    'error': '错误'
  }
  return statusMap[status] || status
}

function getStatusIcon(status: string): string {
  const iconMap: Record<string, string> = {
    'idle': 'icon-idle',
    'normal': 'icon-normal',
    'warning': 'icon-warning',
    'error': 'icon-error'
  }
  return iconMap[status] || 'icon-unknown'
}

function getProtocolIcon(protocol: string): string {
  const iconMap: Record<string, string> = {
    'ros': 'icon-ros',
    'mqtt': 'icon-mqtt',
    'websocket': 'icon-websocket'
  }
  return iconMap[protocol] || 'icon-protocol'
}

function formatTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 1000) return '刚刚'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  return `${Math.floor(diff / 3600000)}h`
}
</script>

<style scoped>
.dashboard-view {
  padding: 24px;
  min-height: 100vh;
  background: var(--bg-color);
  color: var(--text-color);
}

/* 欢迎区域 */
.welcome-section {
  background: linear-gradient(135deg, var(--primary-color) 0%, #42a5f5 100%);
  border-radius: 16px;
  padding: 40px;
  margin-bottom: 32px;
  color: white;
  position: relative;
  overflow: hidden;
}

.welcome-section::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.1); }
}

.welcome-content {
  position: relative;
  z-index: 1;
}

.welcome-title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.welcome-subtitle {
  font-size: 16px;
  opacity: 0.9;
  margin-bottom: 32px;
  max-width: 600px;
}

.quick-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.quick-action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.quick-action-btn.primary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.quick-action-btn.primary:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.quick-action-btn.secondary {
  background: transparent;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.quick-action-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.8);
}

/* 状态卡片 */
.status-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 32px;
}

.status-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.status-card.idle {
  border-color: #757575;
}

.status-card.normal {
  border-color: #4CAF50;
}

.status-card.warning {
  border-color: #FF9800;
}

.status-card.error {
  border-color: #f44336;
}

.status-icon {
  font-size: 32px;
  opacity: 0.8;
}

.status-content {
  flex: 1;
}

.status-title {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-value {
  font-size: 24px;
  font-weight: 700;
}

/* 主要内容区域 */
.dashboard-content {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 24px;
}

/* 侧边栏 */
.dashboard-sidebar {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard-card {
  background: var(--panel-bg, #fff);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px var(--shadow-color);
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-action {
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 快速设置 */
.quick-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.setting-label {
  font-size: 14px;
  color: var(--text-color);
  font-weight: 500;
}

.setting-select {
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--input-bg, #fff);
  color: var(--text-color);
  font-size: 12px;
}

/* 活动列表 */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  background: var(--item-bg, #f8f9fa);
}

.activity-icon {
  font-size: 16px;
  color: var(--primary-color);
  width: 16px;
  text-align: center;
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-topic {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-type {
  font-size: 10px;
  color: var(--text-secondary);
}

.activity-time {
  font-size: 10px;
  color: var(--text-secondary);
}

.no-activity {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  font-size: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* 主要内容 */
.dashboard-main {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 地图预览 */
.map-preview {
  position: relative;
}

.map-placeholder {
  height: 200px;
  border-radius: 8px;
  background: var(--item-bg, #f8f9fa);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--border-color);
}

.map-canvas {
  width: 100%;
  height: 100%;
  background: #e8f5e8;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.map-info {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.no-map {
  text-align: center;
  color: var(--text-secondary);
}

.no-map i {
  font-size: 32px;
  margin-bottom: 8px;
  display: block;
}

.no-map p {
  font-size: 12px;
  margin-top: 8px;
}

/* 性能指标 */
.performance-metrics {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.metric-icon {
  font-size: 24px;
  opacity: 0.8;
}

.metric-content {
  flex: 1;
}

.metric-value {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 2px;
}

.metric-label {
  font-size: 11px;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 快速导航 */
.quick-nav {
  background: var(--panel-bg, #fff);
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  background: var(--item-bg, #f8f9fa);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  color: var(--text-color);
}

.nav-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-color);
  border-color: var(--primary-color);
}

.nav-item i {
  font-size: 24px;
  color: var(--primary-color);
}

.nav-item span {
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}

/* 图标样式 */
.icon-robot::before { content: "🤖"; }
.icon-connection::before { content: "🔗"; }
.icon-navigation::before { content: "🧭"; }
.icon-sensor::before { content: "📡"; }
.icon-task::before { content: "📋"; }
.icon-analysis::before { content: "📊"; }
.icon-log::before { content: "📝"; }
.icon-arrow::before { content: "→"; }
.icon-fps::before { content: "🎯"; }
.icon-memory::before { content: "💾"; }
.icon-throughput::before { content: "📈"; }
.icon-latency::before { content: "⚡"; }
.icon-idle::before { content: "⏸️"; }
.icon-normal::before { content: "✅"; }
.icon-warning::before { content: "⚠️"; }
.icon-error::before { content: "❌"; }
.icon-ros::before { content: "🔴"; }
.icon-mqtt::before { content: "🟡"; }
.icon-websocket::before { content: "🟢"; }
.icon-inactive::before { content: "💤"; }

/* 响应式设计 */
@media (max-width: 1024px) {
  .dashboard-content {
    grid-template-columns: 1fr;
  }

  .dashboard-sidebar {
    order: 2;
  }

  .dashboard-main {
    order: 1;
  }
}

@media (max-width: 768px) {
  .welcome-section {
    padding: 24px;
  }

  .welcome-title {
    font-size: 24px;
  }

  .status-cards {
    grid-template-columns: 1fr;
  }

  .quick-actions {
    flex-direction: column;
  }

  .quick-action-btn {
    width: 100%;
    justify-content: center;
  }

  .nav-grid {
    grid-template-columns: 1fr;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }
}

/* 深色主题支持 */
[data-theme="dark"] {
  --panel-bg: #2d2d2d;
  --item-bg: #373737;
  --input-bg: #404040;
}
</style>
