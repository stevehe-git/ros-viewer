<template>
  <div class="sensor-panel">
    <!-- 传感器概览 -->
    <div class="sensor-overview">
      <div class="overview-item">
        <div class="overview-label">总传感器</div>
        <div class="overview-value">{{ totalSensors }}</div>
      </div>

      <div class="overview-item">
        <div class="overview-label">活跃传感器</div>
        <div class="overview-value active">{{ activeSensors }}</div>
      </div>

      <div class="overview-item">
        <div class="overview-label">数据频率</div>
        <div class="overview-value">{{ averageFrequency.toFixed(1) }} Hz</div>
      </div>
    </div>

    <!-- 传感器列表 -->
    <div class="sensor-list">
      <div
        v-for="[id, sensor] in Array.from(robotStore.sensors)"
        :key="id"
        class="sensor-item"
        :class="{ 'active': isSensorActive(sensor), 'error': hasSensorError(sensor) }"
      >
        <div class="sensor-header">
          <div class="sensor-info">
            <div class="sensor-name">{{ getSensorDisplayName(sensor.type) }}</div>
            <div class="sensor-id">{{ id }}</div>
          </div>

          <div class="sensor-status">
            <span
              class="status-indicator"
              :class="getSensorStatus(sensor)"
            ></span>
            <span class="status-text">{{ getSensorStatusText(sensor) }}</span>
          </div>
        </div>

        <div class="sensor-details">
          <div class="detail-item">
            <span class="detail-label">最后更新</span>
            <span class="detail-value">{{ formatTimestamp(sensor.timestamp) }}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label">数据大小</span>
            <span class="detail-value">{{ getDataSize(sensor.data) }}</span>
          </div>

          <div class="detail-item" v-if="sensor.type === 'laser'">
            <span class="detail-label">扫描点数</span>
            <span class="detail-value">{{ getLaserScanPointCount(sensor.data) }}</span>
          </div>
        </div>

        <!-- 传感器特定信息 -->
        <div class="sensor-specific" v-if="sensor.type === 'laser' && sensor.data">
          <div class="laser-info">
            <div class="range-info">
              <span class="range-label">检测范围:</span>
              <span class="range-value">
                {{ sensor.data.range_min?.toFixed(2) || 0 }} - {{ sensor.data.range_max?.toFixed(2) || 0 }} m
              </span>
            </div>

            <div class="angle-info">
              <span class="angle-label">扫描角度:</span>
              <span class="angle-value">
                {{ ((sensor.data.angle_min || 0) * 180 / Math.PI).toFixed(0) }}° -
                {{ ((sensor.data.angle_max || 0) * 180 / Math.PI).toFixed(0) }}°
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="robotStore.sensors.size === 0" class="no-sensors">
        <div class="no-sensors-icon">📡</div>
        <div class="no-sensors-text">暂无传感器数据</div>
        <div class="no-sensors-hint">请确保机器人已连接并配置了传感器</div>
      </div>
    </div>

    <!-- 数据流量统计 -->
    <div class="data-stats" v-if="robotStore.dataPackets.length > 0">
      <h5>数据流量统计</h5>

      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-label">总数据包</div>
          <div class="stat-value">{{ robotStore.dataPackets.length }}</div>
        </div>

        <div class="stat-item">
          <div class="stat-label">数据速率</div>
          <div class="stat-value">{{ calculateDataRate() }} pkt/s</div>
        </div>

        <div class="stat-item">
          <div class="stat-label">最新数据</div>
          <div class="stat-value">{{ getLatestDataAge() }}</div>
        </div>
      </div>

      <!-- 数据类型分布 -->
      <div class="data-types">
        <h6>数据类型分布</h6>
        <div class="type-distribution">
          <div
            v-for="[type, count] in dataTypeDistribution"
            :key="type"
            class="type-item"
          >
            <span class="type-name">{{ getMessageTypeDisplayName(type) }}</span>
            <span class="type-count">{{ count }}</span>
            <div class="type-bar">
              <div
                class="type-fill"
                :style="{ width: (count / robotStore.dataPackets.length * 100) + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRobotStore } from '../stores/robot'
import type { SensorData } from '../types/data'

// Store
const robotStore = useRobotStore()

// 计算属性
const totalSensors = computed(() => robotStore.sensors.size)

const activeSensors = computed(() => {
  return Array.from(robotStore.sensors.values()).filter(sensor => isSensorActive(sensor)).length
})

const averageFrequency = computed(() => {
  if (robotStore.sensors.size === 0) return 0

  const frequencies = Array.from(robotStore.sensors.values()).map(_sensor => {
    // 简化的频率计算，实际应该基于时间序列数据
    return 10 // 假设 10Hz
  })

  return frequencies.reduce((sum, freq) => sum + freq, 0) / frequencies.length
})

const dataTypeDistribution = computed(() => {
  const distribution = new Map<string, number>()

  robotStore.dataPackets.forEach(packet => {
    const count = distribution.get(packet.type) || 0
    distribution.set(packet.type, count + 1)
  })

  return Array.from(distribution.entries()).sort((a, b) => b[1] - a[1])
})

// 方法
function isSensorActive(sensorData: SensorData): boolean {
  const now = Date.now()
  const timeDiff = now - sensorData.timestamp
  return timeDiff < 5000 // 5秒内认为活跃
}

function hasSensorError(sensorData: SensorData): boolean {
  const now = Date.now()
  const timeDiff = now - sensorData.timestamp
  return timeDiff > 30000 // 30秒无数据认为有错误
}

function getSensorStatus(sensorData: SensorData): string {
  if (hasSensorError(sensorData)) return 'error'
  if (isSensorActive(sensorData)) return 'active'
  return 'inactive'
}

function getSensorStatusText(sensor: SensorData): string {
  const status = getSensorStatus(sensor)
  const statusMap: Record<string, string> = {
    'active': '活跃',
    'inactive': '无数据',
    'error': '错误'
  }
  return statusMap[status] || status
}

function getSensorDisplayName(type: string): string {
  const nameMap: Record<string, string> = {
    'laser': '激光雷达',
    'camera': '摄像头',
    'imu': '惯性测量单元',
    'gps': 'GPS定位',
    'ultrasonic': '超声波传感器',
    'generic': '通用传感器'
  }
  return nameMap[type] || type
}

function formatTimestamp(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 1000) return '刚刚'
  if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  return `${Math.floor(diff / 3600000)}小时前`
}

function getDataSize(data: any): string {
  try {
    const size = JSON.stringify(data).length
    if (size < 1024) return `${size} B`
    return `${(size / 1024).toFixed(1)} KB`
  } catch {
    return '未知'
  }
}

function getLaserScanPointCount(data: any): string {
  if (data?.ranges) {
    return data.ranges.length.toString()
  }
  return '0'
}

function calculateDataRate(): string {
  if (robotStore.dataPackets.length < 2) return '0.0'

  const now = Date.now()
  const recentPackets = robotStore.dataPackets.filter(packet =>
    now - packet.timestamp < 10000 // 最近10秒的数据
  )

  if (recentPackets.length < 2) return '0.0'

  const firstPacket = recentPackets[0]
  const lastPacket = recentPackets[recentPackets.length - 1]
  if (!firstPacket || !lastPacket) return '0.0'

  const timeSpan = (firstPacket.timestamp - lastPacket.timestamp) / 1000
  const rate = recentPackets.length / timeSpan

  return rate.toFixed(1)
}

function getLatestDataAge(): string {
  if (robotStore.dataPackets.length === 0) return '无'

  const latest = Math.max(...robotStore.dataPackets.map(p => p.timestamp))
  return formatTimestamp(latest)
}

function getMessageTypeDisplayName(type: string): string {
  const nameMap: Record<string, string> = {
    'nav_msgs/Odometry': '里程计',
    'nav_msgs/OccupancyGrid': '地图',
    'sensor_msgs/LaserScan': '激光扫描',
    'nav_msgs/Path': '路径',
    'geometry_msgs/PoseStamped': '位姿'
  }
  return nameMap[type] || type.split('/').pop() || type
}
</script>

<style scoped>
.sensor-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 传感器概览 */
.sensor-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 8px;
}

.overview-item {
  background: var(--item-bg, #f8f9fa);
  border-radius: 6px;
  padding: 8px;
  text-align: center;
}

.overview-label {
  font-size: 10px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.overview-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.overview-value.active {
  color: var(--success-color);
}

/* 传感器列表 */
.sensor-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.sensor-item {
  background: var(--item-bg, #f8f9fa);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  padding: 10px;
  transition: all 0.2s ease;
}

.sensor-item.active {
  border-color: var(--success-color);
  box-shadow: 0 0 0 1px rgba(76, 175, 80, 0.2);
}

.sensor-item.error {
  border-color: var(--error-color);
  box-shadow: 0 0 0 1px rgba(244, 67, 54, 0.2);
}

.sensor-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.sensor-info {
  flex: 1;
}

.sensor-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 2px;
}

.sensor-id {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: 'Courier New', monospace;
}

.sensor-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #757575;
}

.status-indicator.active {
  background: #4CAF50;
}

.status-indicator.error {
  background: #f44336;
}

.status-text {
  font-size: 11px;
  color: var(--text-secondary);
}

.sensor-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  font-size: 11px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  color: var(--text-secondary);
}

.detail-value {
  font-family: 'Courier New', monospace;
  font-weight: 500;
}

/* 传感器特定信息 */
.sensor-specific {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.laser-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
}

.range-info,
.angle-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.range-label,
.angle-label {
  color: var(--text-secondary);
}

.range-value,
.angle-value {
  font-family: 'Courier New', monospace;
  font-weight: 500;
}

/* 无传感器提示 */
.no-sensors {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.no-sensors-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.no-sensors-text {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.no-sensors-hint {
  font-size: 12px;
  opacity: 0.7;
}

/* 数据统计 */
.data-stats {
  background: var(--item-bg, #f8f9fa);
  border-radius: 8px;
  padding: 12px;
}

.data-stats h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-color);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.stat-item {
  text-align: center;
}

.stat-label {
  font-size: 10px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  font-family: 'Courier New', monospace;
}

.data-types h6 {
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-color);
}

.type-distribution {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.type-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.type-name {
  flex: 1;
  color: var(--text-secondary);
}

.type-count {
  font-family: 'Courier New', monospace;
  font-weight: 500;
  color: var(--text-color);
}

.type-bar {
  flex: 2;
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  overflow: hidden;
}

.type-fill {
  height: 100%;
  background: var(--primary-color);
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* 滚动条样式 */
.sensor-list::-webkit-scrollbar {
  width: 4px;
}

.sensor-list::-webkit-scrollbar-track {
  background: transparent;
}

.sensor-list::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 2px;
}

.sensor-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* 深色主题支持 */
[data-theme="dark"] {
  --item-bg: #2d2d2d;
}
</style>
