<template>
  <div class="robot-sidebar">
    <!-- 连接状态区域 -->
    <div class="sidebar-section connection-section">
      <div class="section-header">
        <h3>连接状态</h3>
        <div class="connection-indicator" :class="connectionStatus.class">
          <i class="status-icon"></i>
        </div>
      </div>

      <div class="connection-details">
        <div class="connection-item">
          <span class="label">ROS Master:</span>
          <span class="value" :class="rosMasterStatus.class">
            {{ rosMasterStatus.text }}
          </span>
        </div>

        <div class="connection-item">
          <span class="label">协议:</span>
          <div class="protocols-list">
            <span
              v-for="protocol in activeProtocols"
              :key="protocol.name"
              class="protocol-tag"
              :class="protocol.status"
            >
              {{ protocol.name }}
            </span>
          </div>
        </div>

        <div class="connection-item">
          <span class="label">延迟:</span>
          <span class="value">{{ connectionLatency }}ms</span>
        </div>

        <div class="connection-item">
          <span class="label">数据速率:</span>
          <span class="value">{{ dataRate.toFixed(1) }} KB/s</span>
        </div>
      </div>
    </div>

    <!-- 机器人状态区域 -->
    <div class="sidebar-section robot-section">
      <div class="section-header">
        <h3>机器人状态</h3>
        <span class="robot-count">{{ connectedRobots.length }}/{{ totalRobots }}</span>
      </div>

      <div class="robot-list" v-if="connectedRobots.length > 0">
        <div
          v-for="robot in connectedRobots"
          :key="robot.id"
          class="robot-item"
          :class="{ active: robot.id === currentRobotId }"
          @click="selectRobot(robot.id)"
        >
          <div class="robot-avatar">
            <i class="robot-icon"></i>
          </div>

          <div class="robot-info">
            <div class="robot-name">{{ robot.name || `Robot ${robot.id}` }}</div>
            <div class="robot-details">
              <span class="robot-type">{{ getRobotTypeText(robot.type) }}</span>
              <span class="robot-status" :class="robot.status">
                {{ getRobotStatusText(robot.status) }}
              </span>
            </div>
          </div>

          <div class="robot-indicators">
            <div class="battery-indicator" :class="getBatteryClass(robot.battery)">
              <i class="battery-icon"></i>
              <span class="battery-text">{{ robot.battery }}%</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="no-robots">
        <i class="icon-robot-offline"></i>
        <p>暂无连接的机器人</p>
      </div>
    </div>

    <!-- 当前机器人详细信息 -->
    <div class="sidebar-section current-robot-section" v-if="currentRobot">
      <div class="section-header">
        <h3>当前机器人</h3>
      </div>

      <div class="robot-details">
        <!-- 基本信息 -->
        <div class="detail-group">
          <div class="detail-item">
            <span class="label">ID:</span>
            <span class="value">{{ currentRobot.id }}</span>
          </div>
          <div class="detail-item">
            <span class="label">类型:</span>
            <span class="value">{{ getRobotTypeText(currentRobot.type) }}</span>
          </div>
          <div class="detail-item">
            <span class="label">模式:</span>
            <span class="value">{{ getModeText(currentRobot.mode) }}</span>
          </div>
        </div>

        <!-- 位置信息 -->
        <div class="detail-group">
          <h4>位置信息</h4>
          <div class="position-display">
            <div class="position-coord">
              <span class="coord-label">X:</span>
              <span class="coord-value">{{ currentRobot.position.x.toFixed(3) }} m</span>
            </div>
            <div class="position-coord">
              <span class="coord-label">Y:</span>
              <span class="coord-value">{{ currentRobot.position.y.toFixed(3) }} m</span>
            </div>
            <div class="position-coord">
              <span class="coord-label">θ:</span>
              <span class="coord-value">{{ currentRobot.orientation.toFixed(1) }}°</span>
            </div>
          </div>
        </div>

        <!-- 速度信息 -->
        <div class="detail-group">
          <h4>速度信息</h4>
          <div class="velocity-display">
            <div class="velocity-item">
              <span class="velocity-label">线速度:</span>
              <span class="velocity-value">{{ currentRobot.linearVelocity.toFixed(2) }} m/s</span>
            </div>
            <div class="velocity-item">
              <span class="velocity-label">角速度:</span>
              <span class="velocity-value">{{ currentRobot.angularVelocity.toFixed(1) }} °/s</span>
            </div>
          </div>
        </div>

        <!-- 传感器状态 -->
        <div class="detail-group">
          <h4>传感器状态</h4>
          <div class="sensors-grid">
            <div
              v-for="sensor in currentRobot.sensors"
              :key="sensor.id"
              class="sensor-status"
              :class="{ active: sensor.active, error: sensor.error }"
            >
              <i :class="`sensor-icon icon-${sensor.type}`"></i>
              <span class="sensor-name">{{ getSensorName(sensor.type) }}</span>
            </div>
          </div>
        </div>

        <!-- 任务状态 -->
        <div class="detail-group" v-if="currentRobot.currentTask">
          <h4>当前任务</h4>
          <div class="task-info">
            <div class="task-name">{{ currentRobot.currentTask.name }}</div>
            <div class="task-progress">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: currentRobot.currentTask.progress + '%' }"
                ></div>
              </div>
              <span class="progress-text">{{ currentRobot.currentTask.progress }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 系统监控 -->
    <div class="sidebar-section system-section">
      <div class="section-header">
        <h3>系统监控</h3>
      </div>

      <div class="system-metrics">
        <div class="metric-item">
          <span class="label">CPU 使用率:</span>
          <span class="value">{{ systemMetrics.cpu }}%</span>
        </div>

        <div class="metric-item">
          <span class="label">内存使用:</span>
          <span class="value">{{ systemMetrics.memory }} MB</span>
        </div>

        <div class="metric-item">
          <span class="label">网络延迟:</span>
          <span class="value">{{ systemMetrics.networkLatency }}ms</span>
        </div>

        <div class="metric-item">
          <span class="label">磁盘使用:</span>
          <span class="value">{{ systemMetrics.disk }}%</span>
        </div>

        <div class="metric-item">
          <span class="label">运行时间:</span>
          <span class="value">{{ formatUptime(systemMetrics.uptime) }}</span>
        </div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="sidebar-section quick-actions-section">
      <div class="section-header">
        <h3>快捷操作</h3>
      </div>

      <div class="quick-actions">
        <button
          class="quick-btn"
          @click="emergencyStop"
          :disabled="!canEmergencyStop"
        >
          <i class="icon-emergency"></i>
          紧急停止
        </button>

        <button
          class="quick-btn"
          @click="returnHome"
          :disabled="!canReturnHome"
        >
          <i class="icon-home"></i>
          返回原点
        </button>

        <button
          class="quick-btn"
          @click="startMapping"
          :disabled="!canStartMapping"
        >
          <i class="icon-map"></i>
          开始建图
        </button>

        <button
          class="quick-btn"
          @click="saveData"
        >
          <i class="icon-save"></i>
          保存数据
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'

// 类型定义
interface Robot {
  id: string
  name?: string
  type: string
  status: 'online' | 'offline' | 'error' | 'charging' | 'busy'
  mode: 'manual' | 'auto' | 'idle'
  battery: number
  position: { x: number; y: number }
  orientation: number
  linearVelocity: number
  angularVelocity: number
  sensors: Array<{
    id: string
    type: string
    active: boolean
    error?: boolean
  }>
  currentTask?: {
    name: string
    progress: number
  }
}

// 响应式数据
const currentRobotId = ref<string | null>(null)
const totalRobots = ref(5)
const connectionLatency = ref(25)
const dataRate = ref(45.8)

const systemMetrics = reactive({
  cpu: 68,
  memory: 1247,
  networkLatency: 12,
  disk: 45,
  uptime: 345600 // 秒
})

// 模拟数据
const connectedRobots = ref<Robot[]>([
  {
    id: 'robot_001',
    name: 'TurtleBot 1',
    type: 'turtlebot',
    status: 'online',
    mode: 'auto',
    battery: 85,
    position: { x: 2.45, y: -1.23 },
    orientation: 45.2,
    linearVelocity: 0.25,
    angularVelocity: 0.0,
    sensors: [
      { id: 'laser', type: 'laser', active: true },
      { id: 'camera', type: 'camera', active: true },
      { id: 'imu', type: 'imu', active: true }
    ],
    currentTask: {
      name: '导航到厨房',
      progress: 67
    }
  },
  {
    id: 'robot_002',
    name: 'TurtleBot 2',
    type: 'turtlebot',
    status: 'busy',
    mode: 'manual',
    battery: 92,
    position: { x: -0.87, y: 3.12 },
    orientation: -23.8,
    linearVelocity: 0.0,
    angularVelocity: 0.5,
    sensors: [
      { id: 'laser', type: 'laser', active: true },
      { id: 'camera', type: 'camera', active: false, error: true },
      { id: 'imu', type: 'imu', active: true }
    ]
  }
])

// 状态管理
// const robotStore = useRobotStore()

// 计算属性
const connectionStatus = computed(() => {
  // 模拟连接状态
  return { text: '已连接', class: 'connected' as const }
})

const rosMasterStatus = computed(() => {
  // 模拟 ROS Master 状态
  return { text: '运行中', class: 'connected' }
})

const activeProtocols = computed(() => {
  // 模拟活跃协议数据
  return [
    { name: 'ROS', status: 'connected' as const },
    { name: 'MQTT', status: 'connected' as const }
  ]
})

const currentRobot = computed(() => {
  return connectedRobots.value.find(robot => robot.id === currentRobotId.value) || null
})

const canEmergencyStop = computed(() => {
  return connectedRobots.value.some(robot => robot.status === 'online' || robot.status === 'busy')
})

const canReturnHome = computed(() => {
  return currentRobot.value?.status === 'online'
})

const canStartMapping = computed(() => {
  return currentRobot.value?.status === 'online' && currentRobot.value.mode === 'idle'
})

// 方法
function selectRobot(robotId: string) {
  currentRobotId.value = robotId
}

function getRobotTypeText(type: string): string {
  const typeMap: Record<string, string> = {
    'turtlebot': 'TurtleBot',
    'pioneer': 'Pioneer',
    'custom': '自定义'
  }
  return typeMap[type] || type
}

function getRobotStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'online': '在线',
    'offline': '离线',
    'error': '错误',
    'charging': '充电中',
    'busy': '忙碌'
  }
  return statusMap[status] || status
}

function getModeText(mode: string): string {
  const modeMap: Record<string, string> = {
    'manual': '手动',
    'auto': '自动',
    'idle': '空闲'
  }
  return modeMap[mode] || mode
}

function getBatteryClass(battery: number): string {
  if (battery >= 80) return 'good'
  if (battery >= 50) return 'medium'
  if (battery >= 20) return 'low'
  return 'critical'
}

function getSensorName(type: string): string {
  const nameMap: Record<string, string> = {
    'laser': '激光',
    'camera': '摄像头',
    'imu': 'IMU',
    'gps': 'GPS',
    'ultrasonic': '超声波'
  }
  return nameMap[type] || type
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}时${minutes}分`
}

function emergencyStop() {
  // TODO: 实现紧急停止
  console.log('紧急停止所有机器人')
}

function returnHome() {
  if (!currentRobot.value) return
  // TODO: 实现返回原点
  console.log('机器人返回原点:', currentRobot.value.id)
}

function startMapping() {
  if (!currentRobot.value) return
  // TODO: 实现开始建图
  console.log('开始建图:', currentRobot.value.id)
}

function saveData() {
  // TODO: 实现保存数据
  console.log('保存机器人数据')
}

// 模拟数据更新
function updateMetrics() {
  // 模拟系统指标更新
  systemMetrics.cpu = Math.max(10, Math.min(95, systemMetrics.cpu + (Math.random() - 0.5) * 10))
  systemMetrics.memory = Math.max(800, Math.min(1500, systemMetrics.memory + (Math.random() - 0.5) * 50))
  systemMetrics.networkLatency = Math.max(5, Math.min(50, systemMetrics.networkLatency + (Math.random() - 0.5) * 5))
  systemMetrics.disk = Math.max(20, Math.min(90, systemMetrics.disk + (Math.random() - 0.5) * 2))

  // 模拟机器人状态更新
  connectedRobots.value.forEach(robot => {
    if (robot.status === 'online' || robot.status === 'busy') {
      robot.battery = Math.max(0, robot.battery - Math.random() * 0.1)
      robot.linearVelocity += (Math.random() - 0.5) * 0.1
      robot.linearVelocity = Math.max(0, Math.min(1, robot.linearVelocity))
      robot.angularVelocity += (Math.random() - 0.5) * 0.2
      robot.angularVelocity = Math.max(-1, Math.min(1, robot.angularVelocity))

      if (robot.currentTask) {
        robot.currentTask.progress = Math.min(100, robot.currentTask.progress + Math.random() * 2)
      }
    }
  })
}

// 生命周期钩子
onMounted(() => {
  // 默认选择第一个机器人
  if (connectedRobots.value.length > 0) {
    currentRobotId.value = connectedRobots.value[0].id
  }

  // 启动指标更新
  const updateInterval = setInterval(updateMetrics, 2000)

  onUnmounted(() => {
    clearInterval(updateInterval)
  })
})
</script>

<style scoped>
.robot-sidebar {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: var(--sidebar-bg, #f8f9fa);
  overflow-y: auto;
}

.sidebar-section {
  background: var(--panel-bg, #fff);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--header-bg, #f8f9fa);
  border-bottom: 1px solid var(--border-color);
}

.section-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.connection-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.connection-indicator.disconnected {
  background: #f44336;
}

.connection-indicator.connecting {
  background: #ff9800;
}

.connection-indicator.connected {
  background: #4caf50;
}

.connection-indicator .status-icon {
  font-size: 8px;
  color: white;
}

.robot-count {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--primary-color);
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
}

/* 连接状态 */
.connection-details {
  padding: 12px 16px;
}

.connection-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}

.connection-item:last-child {
  margin-bottom: 0;
}

.connection-item .label {
  color: var(--text-secondary);
}

.connection-item .value {
  font-weight: 500;
}

.connection-item .value.connected {
  color: #4caf50;
}

.connection-item .value.disconnected {
  color: #f44336;
}

.protocols-list {
  display: flex;
  gap: 4px;
}

.protocol-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 8px;
  font-weight: 500;
}

.protocol-tag.connected {
  background: #e8f5e8;
  color: #2e7d32;
}

.protocol-tag.disconnected {
  background: #ffeaea;
  color: #c62828;
}

/* 机器人列表 */
.robot-list {
  max-height: 200px;
  overflow-y: auto;
}

.robot-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid var(--border-color);
}

.robot-item:last-child {
  border-bottom: none;
}

.robot-item:hover {
  background: rgba(33, 150, 243, 0.05);
}

.robot-item.active {
  background: rgba(33, 150, 243, 0.1);
  border-left: 3px solid var(--primary-color);
}

.robot-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.robot-icon {
  font-size: 16px;
}

.robot-info {
  flex: 1;
  min-width: 0;
}

.robot-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
  margin-bottom: 2px;
}

.robot-details {
  display: flex;
  gap: 8px;
  font-size: 11px;
}

.robot-type {
  color: var(--text-secondary);
}

.robot-status.online {
  color: #4caf50;
  font-weight: 500;
}

.robot-status.offline {
  color: #757575;
}

.robot-status.error {
  color: #f44336;
  font-weight: 500;
}

.robot-status.charging {
  color: #2196f3;
  font-weight: 500;
}

.robot-status.busy {
  color: #ff9800;
  font-weight: 500;
}

.robot-indicators {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.battery-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 8px;
}

.battery-indicator.good {
  background: #e8f5e8;
  color: #2e7d32;
}

.battery-indicator.medium {
  background: #fff3e0;
  color: #ef6c00;
}

.battery-indicator.low {
  background: #ffebee;
  color: #c62828;
}

.battery-indicator.critical {
  background: #ffebee;
  color: #b71c1c;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.no-robots {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.no-robots i {
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.no-robots p {
  margin: 0;
  font-size: 14px;
}

/* 当前机器人详情 */
.robot-details {
  padding: 16px;
}

.detail-group {
  margin-bottom: 16px;
}

.detail-group:last-child {
  margin-bottom: 0;
}

.detail-group h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-color);
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 12px;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.detail-item .label {
  color: var(--text-secondary);
}

.detail-item .value {
  font-weight: 500;
  color: var(--text-color);
}

.position-display,
.velocity-display {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.position-coord,
.velocity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

.coord-label,
.velocity-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.coord-value,
.velocity-value {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: var(--text-color);
}

.sensors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
  gap: 8px;
}

.sensor-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-radius: 6px;
  background: #f5f5f5;
  font-size: 11px;
  text-align: center;
}

.sensor-status.active {
  background: #e8f5e8;
  color: #2e7d32;
}

.sensor-status.error {
  background: #ffebee;
  color: #c62828;
}

.sensor-icon {
  font-size: 16px;
}

.task-info {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 8px;
}

.task-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color);
  margin-bottom: 6px;
}

.task-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 11px;
  color: var(--text-secondary);
  min-width: 30px;
}

/* 系统监控 */
.system-metrics {
  padding: 12px 16px;
}

.metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}

.metric-item:last-child {
  margin-bottom: 0;
}

.metric-item .label {
  color: var(--text-secondary);
}

.metric-item .value {
  font-weight: 500;
  color: var(--text-color);
}

/* 快捷操作 */
.quick-actions {
  padding: 12px 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.quick-btn {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-color);
  cursor: pointer;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.quick-btn:not(:disabled):hover {
  background: rgba(33, 150, 243, 0.1);
  border-color: var(--primary-color);
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-btn i {
  font-size: 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .robot-sidebar {
    padding: 12px;
    gap: 12px;
  }

  .robot-item {
    padding: 10px 12px;
  }

  .connection-item,
  .detail-item,
  .metric-item {
    font-size: 11px;
  }

  .quick-actions {
    grid-template-columns: 1fr;
  }
}

/* 深色主题支持 */
[data-theme="dark"] {
  --sidebar-bg: #2d2d2d;
  --panel-bg: #373737;
  --header-bg: #424242;
  --bg-color: #373737;
}
</style>
