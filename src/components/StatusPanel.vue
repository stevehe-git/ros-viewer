<template>
  <div class="status-panel">
    <!-- 系统状态 -->
    <div class="status-section">
      <div class="status-item">
        <span class="label">连接状态</span>
        <span :class="['value', connectionStatus.class]">
          {{ connectionStatus.text }}
        </span>
      </div>

      <div class="status-item">
        <span class="label">活跃机器人</span>
        <span class="value">{{ robotStore.connectedRobots.length }}</span>
      </div>

      <div class="status-item">
        <span class="label">活跃任务</span>
        <span class="value">{{ robotStore.activeTasks.length }}</span>
      </div>

      <div class="status-item">
        <span class="label">数据新鲜度</span>
        <span :class="['value', robotStore.dataFreshness]">
          {{ getFreshnessText(robotStore.dataFreshness) }}
        </span>
      </div>
    </div>

    <!-- 当前机器人状态 -->
    <div class="status-section" v-if="robotStore.currentRobot">
      <h4>当前机器人</h4>
      <div class="robot-status">
        <div class="status-item">
          <span class="label">ID</span>
          <span class="value">{{ robotStore.currentRobot.id }}</span>
        </div>

        <div class="status-item">
          <span class="label">类型</span>
          <span class="value">{{ robotStore.currentRobot.type }}</span>
        </div>

        <div class="status-item">
          <span class="label">状态</span>
          <span :class="['value', getRobotStatusClass(robotStore.currentRobot.status)]">
            {{ getRobotStatusText(robotStore.currentRobot.status) }}
          </span>
        </div>

        <div class="status-item" v-if="robotStore.currentRobot.battery_level !== undefined">
          <span class="label">电量</span>
          <span class="value">{{ robotStore.currentRobot.battery_level }}%</span>
        </div>

        <div class="position-info">
          <h5>位置信息</h5>
          <div class="coord-item">
            <span class="coord-label">X:</span>
            <span class="coord-value">{{ robotStore.currentRobot.pose.position.x.toFixed(2) }} m</span>
          </div>
          <div class="coord-item">
            <span class="coord-label">Y:</span>
            <span class="coord-value">{{ robotStore.currentRobot.pose.position.y.toFixed(2) }} m</span>
          </div>
          <div class="coord-item">
            <span class="coord-label">角度:</span>
            <span class="coord-value">{{ getRobotYaw().toFixed(1) }}°</span>
          </div>
        </div>

        <div class="velocity-info" v-if="robotStore.currentRobot.velocity">
          <h5>速度信息</h5>
          <div class="velocity-item">
            <span class="velocity-label">线速度:</span>
            <span class="velocity-value">
              {{ Math.sqrt(
                robotStore.currentRobot.velocity.linear.x ** 2 +
                robotStore.currentRobot.velocity.linear.y ** 2
              ).toFixed(2) }} m/s
            </span>
          </div>
          <div class="velocity-item">
            <span class="velocity-label">角速度:</span>
            <span class="velocity-value">{{ (robotStore.currentRobot.velocity.angular.z * 180 / Math.PI).toFixed(1) }} °/s</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 地图信息 -->
    <div class="status-section" v-if="robotStore.currentMap">
      <h4>地图信息</h4>
      <div class="map-info">
        <div class="status-item">
          <span class="label">尺寸</span>
          <span class="value">
            {{ robotStore.currentMap.info.width }} × {{ robotStore.currentMap.info.height }}
          </span>
        </div>

        <div class="status-item">
          <span class="label">分辨率</span>
          <span class="value">{{ (robotStore.currentMap.info.resolution * 100).toFixed(1) }} cm</span>
        </div>

        <div class="status-item">
          <span class="label">原点</span>
          <span class="value">
            ({{ robotStore.currentMap.info.origin.position.x.toFixed(2) }},
            {{ robotStore.currentMap.info.origin.position.y.toFixed(2) }})
          </span>
        </div>
      </div>
    </div>

    <!-- 传感器状态 -->
    <div class="status-section">
      <h4>传感器状态</h4>
      <div class="sensor-list">
        <div
          v-for="[id, sensor] in Array.from(robotStore.sensors)"
          :key="id"
          class="sensor-item"
          :class="{ 'active': isSensorActive(sensor) }"
        >
          <div class="sensor-name">{{ getSensorDisplayName(sensor.type) }}</div>
          <div class="sensor-status">
            <span class="status-dot" :class="{ 'active': isSensorActive(sensor) }"></span>
            <span class="status-text">{{ isSensorActive(sensor) ? '活跃' : '无数据' }}</span>
          </div>
        </div>

        <div v-if="robotStore.sensors.size === 0" class="no-sensors">
          无传感器数据
        </div>
      </div>
    </div>

    <!-- 性能指标 -->
    <div class="status-section">
      <h4>性能指标</h4>
      <div class="performance-info">
        <div class="status-item">
          <span class="label">FPS</span>
          <span class="value">{{ robotStore.performanceMetrics.fps }}</span>
        </div>

        <div class="status-item">
          <span class="label">内存</span>
          <span class="value">{{ robotStore.performanceMetrics.memoryUsage }} MB</span>
        </div>

        <div class="status-item">
          <span class="label">数据吞吐量</span>
          <span class="value">{{ robotStore.performanceMetrics.dataThroughput.toFixed(1) }} KB/s</span>
        </div>

        <div class="status-item">
          <span class="label">延迟</span>
          <span class="value">{{ robotStore.performanceMetrics.latency.toFixed(1) }} ms</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRobotStore } from '../stores/robot'
import { protocolManager } from '../core/protocols/ProtocolManager'
import type { SensorData } from '../types/data'

// Store
const robotStore = useRobotStore()

// 计算属性
const connectionStatus = computed(() => {
  const protocols = protocolManager.getAllActiveProtocols()
  if (protocols.size === 0) {
    return { text: '未连接', class: 'disconnected' }
  }
  // 检查是否有活跃连接
  const hasActive = Array.from(protocols.values()).some(protocol => protocol.isConnected())
  return hasActive
    ? { text: '已连接', class: 'connected' }
    : { text: '连接中', class: 'connecting' }
})

// 方法
function getFreshnessText(freshness: string): string {
  const map: Record<string, string> = {
    'fresh': '新鲜',
    'normal': '正常',
    'stale': '过期'
  }
  return map[freshness] || freshness
}

function getRobotStatusText(status: string): string {
  const map: Record<string, string> = {
    'online': '在线',
    'offline': '离线',
    'error': '错误',
    'charging': '充电中'
  }
  return map[status] || status
}

function getRobotStatusClass(status: string): string {
  const map: Record<string, string> = {
    'online': 'online',
    'offline': 'offline',
    'error': 'error',
    'charging': 'charging'
  }
  return map[status] || 'unknown'
}

function getRobotYaw(): number {
  if (!robotStore.currentRobot) return 0

  const q = robotStore.currentRobot.pose.orientation
  // 四元数转欧拉角 (yaw)
  return Math.atan2(
    2 * (q.w * q.z + q.x * q.y),
    1 - 2 * (q.y * q.y + q.z * q.z)
  ) * 180 / Math.PI
}

function getSensorDisplayName(type: string): string {
  const map: Record<string, string> = {
    'laser': '激光雷达',
    'camera': '摄像头',
    'imu': '惯性测量单元',
    'gps': 'GPS',
    'ultrasonic': '超声波'
  }
  return map[type] || type
}

function isSensorActive(sensor: SensorData): boolean {
  const now = Date.now()
  const timeDiff = now - sensor.timestamp
  return timeDiff < 5000 // 5秒内认为活跃
}
</script>

<style scoped>
.status-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-section {
  background: var(--item-bg, #f8f9fa);
  border-radius: 8px;
  padding: 12px;
}

.status-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-color);
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 12px;
}

.status-item:last-child {
  margin-bottom: 0;
}

.status-item .label {
  color: var(--text-secondary);
  font-weight: 500;
}

.status-item .value {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
}

.status-item .value.connected {
  background: #4CAF50;
  color: white;
}

.status-item .value.disconnected {
  background: #f44336;
  color: white;
}

.status-item .value.connecting {
  background: #FF9800;
  color: white;
}

.status-item .value.fresh {
  background: #4CAF50;
  color: white;
}

.status-item .value.stale {
  background: #f44336;
  color: white;
}

.status-item .value.online {
  background: #4CAF50;
  color: white;
}

.status-item .value.offline {
  background: #757575;
  color: white;
}

.status-item .value.error {
  background: #f44336;
  color: white;
}

.status-item .value.charging {
  background: #2196F3;
  color: white;
}

/* 机器人状态 */
.robot-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.position-info,
.velocity-info {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  padding: 8px;
}

.position-info h5,
.velocity-info h5 {
  margin: 0 0 6px 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-color);
}

.coord-item,
.velocity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  margin-bottom: 2px;
}

.coord-item:last-child,
.velocity-item:last-child {
  margin-bottom: 0;
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
}

/* 地图信息 */
.map-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 传感器列表 */
.sensor-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sensor-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
}

.sensor-item.active {
  border-color: var(--success-color);
  background: rgba(76, 175, 80, 0.1);
}

.sensor-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-color);
}

.sensor-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #757575;
  transition: background-color 0.2s;
}

.status-dot.active {
  background: #4CAF50;
}

.status-text {
  color: var(--text-secondary);
}

.no-sensors {
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 20px;
  font-style: italic;
}

/* 性能指标 */
.performance-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

/* 深色主题支持 */
[data-theme="dark"] {
  --item-bg: #2d2d2d;
}
</style>
