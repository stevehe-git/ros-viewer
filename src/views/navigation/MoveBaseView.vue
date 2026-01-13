<template>
  <div class="movebase-view">
    <!-- Move Base 控制区域 -->
    <div class="movebase-container">
      <div class="movebase-header">
        <h2>Move Base 导航</h2>
        <div class="movebase-status">
          <div class="status-indicator" :class="navigationStatus">
            <i class="status-icon"></i>
            {{ getStatusText(navigationStatus) }}
          </div>
        </div>
      </div>

      <!-- 导航地图区域 -->
      <div class="navigation-map" ref="navigationMap">
        <div v-if="!isMapLoaded" class="map-placeholder">
          <div class="placeholder-content">
            <i class="icon-map"></i>
            <p>地图加载中...</p>
          </div>
        </div>

        <div v-else class="map-content">
          <!-- 地图画布 -->
          <canvas
            ref="mapCanvas"
            class="map-canvas"
            :width="mapWidth"
            :height="mapHeight"
          ></canvas>

          <!-- 机器人位置指示器 -->
          <div
            class="robot-position"
            :style="{ left: robotX + 'px', top: robotY + 'px' }"
          >
            <div class="robot-icon" :style="{ transform: `rotate(${robotRotation}deg)` }">
              <i class="icon-robot"></i>
            </div>
          </div>

          <!-- 目标点 -->
          <div
            v-if="targetPosition"
            class="target-position"
            :style="{ left: targetPosition.x + 'px', top: targetPosition.y + 'px' }"
          >
            <i class="icon-target"></i>
          </div>

          <!-- 路径规划 -->
          <svg
            v-if="plannedPath.length > 0"
            class="path-overlay"
            :width="mapWidth"
            :height="mapHeight"
          >
            <path
              :d="pathD"
              stroke="#4CAF50"
              stroke-width="3"
              fill="none"
              stroke-dasharray="5,5"
            />
          </svg>
        </div>
      </div>

      <!-- 控制面板 -->
      <div class="control-panel">
        <div class="control-section">
          <h3>目标设置</h3>
          <div class="control-group">
            <label>X 坐标:</label>
            <input
              type="number"
              v-model.number="targetX"
              step="0.1"
              min="-10"
              max="10"
            />
          </div>
          <div class="control-group">
            <label>Y 坐标:</label>
            <input
              type="number"
              v-model.number="targetY"
              step="0.1"
              min="-10"
              max="10"
            />
          </div>
          <div class="control-group">
            <label>朝向:</label>
            <input
              type="number"
              v-model.number="targetYaw"
              step="0.1"
              min="-3.14"
              max="3.14"
            />
          </div>
          <button
            class="action-btn primary"
            @click="setGoal"
            :disabled="!canSetGoal"
          >
            设置目标
          </button>
        </div>

        <div class="control-section">
          <h3>导航控制</h3>
          <div class="control-group">
            <button
              class="action-btn"
              @click="startNavigation"
              :disabled="!canStartNavigation"
            >
              开始导航
            </button>
            <button
              class="action-btn danger"
              @click="stopNavigation"
              :disabled="!isNavigating"
            >
              停止导航
            </button>
          </div>
          <div class="control-group">
            <button
              class="action-btn secondary"
              @click="clearCostmap"
            >
              清除代价地图
            </button>
          </div>
        </div>

        <div class="control-section">
          <h3>导航参数</h3>
          <div class="control-group">
            <label>最大速度:</label>
            <input
              type="number"
              v-model.number="maxVelocity"
              step="0.1"
              min="0.1"
              max="2.0"
            />
          </div>
          <div class="control-group">
            <label>最大角速度:</label>
            <input
              type="number"
              v-model.number="maxAngularVelocity"
              step="0.1"
              min="0.1"
              max="3.0"
            />
          </div>
          <div class="control-group">
            <label>
              <input type="checkbox" v-model="useGlobalPlanner" />
              使用全局规划器
            </label>
          </div>
          <div class="control-group">
            <label>
              <input type="checkbox" v-model="useLocalPlanner" />
              使用局部规划器
            </label>
          </div>
        </div>

        <div class="control-section">
          <h3>导航信息</h3>
          <div class="info-item">
            <span class="label">当前位置:</span>
            <span class="value">{{ currentPosition }}</span>
          </div>
          <div class="info-item">
            <span class="label">目标位置:</span>
            <span class="value">{{ targetPositionText }}</span>
          </div>
          <div class="info-item">
            <span class="label">距离目标:</span>
            <span class="value">{{ distanceToGoal.toFixed(2) }} m</span>
          </div>
          <div class="info-item">
            <span class="label">当前速度:</span>
            <span class="value">{{ currentVelocity.toFixed(2) }} m/s</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
// import { useRobotStore } from '../../stores/robot'

// 响应式数据
const isMapLoaded = ref(false)
const navigationStatus = ref('idle') // idle, planning, moving, reached, failed
const isNavigating = ref(false)
const robotX = ref(200)
const robotY = ref(200)
const robotRotation = ref(0)
const mapWidth = ref(400)
const mapHeight = ref(400)

const targetX = ref(0)
const targetY = ref(0)
const targetYaw = ref(0)
const maxVelocity = ref(0.5)
const maxAngularVelocity = ref(1.0)
const useGlobalPlanner = ref(true)
const useLocalPlanner = ref(true)

const plannedPath = ref<Array<{x: number, y: number}>>([])
const currentVelocity = ref(0)

// 计算属性
const targetPosition = computed(() => {
  if (targetX.value !== null && targetY.value !== null) {
    return {
      x: targetX.value * 20 + 200, // 简单的坐标变换
      y: -targetY.value * 20 + 200
    }
  }
  return null
})

const canSetGoal = computed(() => {
  return navigationStatus.value !== 'planning' && navigationStatus.value !== 'moving'
})

const canStartNavigation = computed(() => {
  return targetPosition.value && !isNavigating.value && navigationStatus.value === 'idle'
})

const currentPosition = computed(() => {
  return `(${((robotX.value - 200) / 20).toFixed(2)}, ${(-(robotY.value - 200) / 20).toFixed(2)})`
})

const targetPositionText = computed(() => {
  if (targetPosition.value) {
    return `(${targetX.value.toFixed(2)}, ${targetY.value.toFixed(2)})`
  }
  return '未设置'
})

const distanceToGoal = computed(() => {
  if (targetPosition.value) {
    const dx = targetPosition.value.x - robotX.value
    const dy = targetPosition.value.y - robotY.value
    return Math.sqrt(dx * dx + dy * dy) / 20 // 转换为米
  }
  return 0
})

const pathD = computed(() => {
  if (plannedPath.value.length === 0) return ''
  return 'M ' + plannedPath.value.map(point => `${point.x},${point.y}`).join(' L ')
})

// DOM 引用
// const navigationMap = ref<HTMLElement>()
const mapCanvas = ref<HTMLCanvasElement>()

// 状态管理
// const robotStore = useRobotStore()

// 方法
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'idle': '空闲',
    'planning': '规划中',
    'moving': '移动中',
    'reached': '已到达',
    'failed': '失败'
  }
  return statusMap[status] || status
}

function setGoal() {
  if (!canSetGoal.value) return

  console.log('设置导航目标:', { x: targetX.value, y: targetY.value, yaw: targetYaw.value })
  // TODO: 发送目标到 Move Base

  // 模拟路径规划
  planPath()
}

function startNavigation() {
  if (!canStartNavigation.value) return

  isNavigating.value = true
  navigationStatus.value = 'moving'

  console.log('开始导航')

  // 模拟导航过程
  simulateNavigation()
}

function stopNavigation() {
  isNavigating.value = false
  navigationStatus.value = 'idle'
  currentVelocity.value = 0

  console.log('停止导航')
  // TODO: 发送停止命令到 Move Base
}

function clearCostmap() {
  console.log('清除代价地图')
  // TODO: 发送清除代价地图命令
}

function planPath() {
  // 模拟路径规划
  plannedPath.value = []
  const startX = robotX.value
  const startY = robotY.value
  const endX = targetPosition.value?.x || 0
  const endY = targetPosition.value?.y || 0

  // 简单的直线路径
  const steps = 10
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = startX + (endX - startX) * t
    const y = startY + (endY - startY) * t
    plannedPath.value.push({ x, y })
  }

  navigationStatus.value = 'planning'
  setTimeout(() => {
    navigationStatus.value = 'idle'
  }, 1000)
}

function simulateNavigation() {
  if (!targetPosition.value) return

  const startX = robotX.value
  const startY = robotY.value
  const endX = targetPosition.value.x
  const endY = targetPosition.value.y

  const distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2)
  const duration = distance / 20 // 假设速度为 1 unit/秒
  const steps = Math.max(10, Math.floor(duration * 10))

  let step = 0
  const interval = setInterval(() => {
    if (!isNavigating.value) {
      clearInterval(interval)
      return
    }

    step++
    const t = step / steps

    if (t >= 1) {
      // 到达目标
      robotX.value = endX
      robotY.value = endY
      navigationStatus.value = 'reached'
      isNavigating.value = false
      currentVelocity.value = 0
      clearInterval(interval)
    } else {
      // 更新位置
      robotX.value = startX + (endX - startX) * t
      robotY.value = startY + (endY - startY) * t
      currentVelocity.value = maxVelocity.value * (1 - Math.abs(t - 0.5) * 2) // 模拟速度变化

      // 更新朝向
      const angle = Math.atan2(endY - robotY.value, endX - robotX.value)
      robotRotation.value = angle * 180 / Math.PI
    }
  }, 100)
}

// 生命周期钩子
onMounted(() => {
  // 初始化地图
  setTimeout(() => {
    isMapLoaded.value = true
    drawMap()
  }, 1000)
})

onUnmounted(() => {
  stopNavigation()
})

function drawMap() {
  if (!mapCanvas.value) return

  const ctx = mapCanvas.value.getContext('2d')
  if (!ctx) return

  // 绘制网格
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 1

  for (let i = 0; i <= mapWidth.value; i += 40) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, mapHeight.value)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(mapWidth.value, i)
    ctx.stroke()
  }

  // 绘制坐标轴
  ctx.strokeStyle = '#666'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, mapHeight.value / 2)
  ctx.lineTo(mapWidth.value, mapHeight.value / 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(mapWidth.value / 2, 0)
  ctx.lineTo(mapWidth.value / 2, mapHeight.value)
  ctx.stroke()
}
</script>

<style scoped>
.movebase-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
}

.movebase-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.movebase-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--panel-bg, #fff);
  border-bottom: 1px solid var(--border-color);
}

.movebase-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}

.movebase-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
}

.status-indicator.idle {
  background: #e0e0e0;
  color: #666;
}

.status-indicator.planning {
  background: #fff3cd;
  color: #856404;
}

.status-indicator.moving {
  background: #d1ecf1;
  color: #0c5460;
}

.status-indicator.reached {
  background: #d4edda;
  color: #155724;
}

.status-indicator.failed {
  background: #f8d7da;
  color: #721c24;
}

.navigation-map {
  flex: 1;
  position: relative;
  background: #1a1a1a;
  overflow: hidden;
}

.map-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}

.placeholder-content {
  text-align: center;
}

.placeholder-content i {
  font-size: 48px;
  margin-bottom: 16px;
  display: block;
}

.map-content {
  width: 100%;
  height: 100%;
  position: relative;
}

.map-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.robot-position {
  position: absolute;
  width: 20px;
  height: 20px;
  transform: translate(-50%, -50%);
}

.robot-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4CAF50;
  font-size: 16px;
}

.target-position {
  position: absolute;
  width: 16px;
  height: 16px;
  transform: translate(-50%, -50%);
  color: #FF9800;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.path-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.control-panel {
  width: 320px;
  background: var(--panel-bg, #fff);
  border-left: 1px solid var(--border-color);
  overflow-y: auto;
  flex-shrink: 0;
}

.control-section {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.control-section:last-child {
  border-bottom: none;
}

.control-section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.control-group {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.control-group label {
  font-size: 14px;
  color: var(--text-color);
  font-weight: 500;
}

.control-group input {
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
}

.control-group input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin-right: 8px;
}

.control-group input[type="number"] {
  width: 100%;
}

.action-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.action-btn:not(:disabled):hover {
  opacity: 0.9;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.primary {
  background: var(--primary-color);
  color: white;
}

.action-btn.danger {
  background: var(--error-color, #f44336);
  color: white;
}

.action-btn.secondary {
  background: var(--secondary-color, #757575);
  color: white;
}

.info-item {
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.info-item .label {
  color: var(--text-secondary, #666);
}

.info-item .value {
  color: var(--text-color);
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .control-panel {
    width: 280px;
  }
}

@media (max-width: 768px) {
  .movebase-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .movebase-container {
    flex-direction: column;
  }

  .control-panel {
    width: 100%;
    max-height: 300px;
    border-left: none;
    border-top: 1px solid var(--border-color);
  }

  .navigation-map {
    min-height: 400px;
  }
}
</style>
