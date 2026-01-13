<template>
  <div class="teleop-control-view">
    <!-- 遥控控制区域 -->
    <div class="teleop-container">
      <div class="teleop-header">
        <h2>遥控控制</h2>
        <div class="teleop-status">
          <div class="status-indicator" :class="connectionStatus">
            <i class="status-icon"></i>
            {{ getStatusText(connectionStatus) }}
          </div>
        </div>
      </div>

      <!-- 控制面板 -->
      <div class="control-panel">
        <!-- 虚拟摇杆区域 -->
        <div class="joystick-section">
          <h3>运动控制</h3>
          <div class="joystick-container">
            <div class="joystick-area" @mousedown="startJoystick" @touchstart="startJoystick">
              <div
                class="joystick-handle"
                :style="{ left: joystickX + 'px', top: joystickY + 'px' }"
                @mousedown.stop
                @touchstart.stop
              ></div>
            </div>
            <div class="joystick-info">
              <div class="info-item">
                <span class="label">线速度:</span>
                <span class="value">{{ linearVelocity.toFixed(2) }} m/s</span>
              </div>
              <div class="info-item">
                <span class="label">角速度:</span>
                <span class="value">{{ angularVelocity.toFixed(2) }} rad/s</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 快捷控制按钮 -->
        <div class="quick-controls-section">
          <h3>快捷控制</h3>
          <div class="quick-controls">
            <button
              class="direction-btn"
              @mousedown="startMove('forward')"
              @mouseup="stopMove"
              @touchstart="startMove('forward')"
              @touchend="stopMove"
            >
              <i class="icon-up"></i>
              前进
            </button>
            <button
              class="direction-btn"
              @mousedown="startMove('backward')"
              @mouseup="stopMove"
              @touchstart="startMove('backward')"
              @touchend="stopMove"
            >
              <i class="icon-down"></i>
              后退
            </button>
            <button
              class="direction-btn"
              @mousedown="startMove('left')"
              @mouseup="stopMove"
              @touchstart="startMove('left')"
              @touchend="stopMove"
            >
              <i class="icon-left"></i>
              左转
            </button>
            <button
              class="direction-btn"
              @mousedown="startMove('right')"
              @mouseup="stopMove"
              @touchstart="startMove('right')"
              @touchend="stopMove"
            >
              <i class="icon-right"></i>
              右转
            </button>
          </div>

          <div class="speed-controls">
            <div class="speed-item">
              <label>最大线速度:</label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                v-model.number="maxLinearVelocity"
              />
              <span>{{ maxLinearVelocity }} m/s</span>
            </div>
            <div class="speed-item">
              <label>最大角速度:</label>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.1"
                v-model.number="maxAngularVelocity"
              />
              <span>{{ maxAngularVelocity }} rad/s</span>
            </div>
          </div>
        </div>

        <!-- 高级控制 -->
        <div class="advanced-controls-section">
          <h3>高级控制</h3>

          <div class="control-group">
            <h4>位置控制</h4>
            <div class="position-controls">
              <div class="control-item">
                <label>X 位置:</label>
                <input type="number" v-model.number="targetPosition.x" step="0.1" />
              </div>
              <div class="control-item">
                <label>Y 位置:</label>
                <input type="number" v-model.number="targetPosition.y" step="0.1" />
              </div>
              <div class="control-item">
                <label>朝向:</label>
                <input type="number" v-model.number="targetPosition.yaw" step="0.1" />
              </div>
              <button class="action-btn primary" @click="goToPosition">
                前往位置
              </button>
            </div>
          </div>

          <div class="control-group">
            <h4>路径跟随</h4>
            <div class="path-controls">
              <button class="action-btn" @click="startPathFollowing" :disabled="!hasPath">
                开始跟随
              </button>
              <button class="action-btn danger" @click="stopPathFollowing">
                停止跟随
              </button>
              <button class="action-btn secondary" @click="clearPath">
                清除路径
              </button>
            </div>
          </div>

          <div class="control-group">
            <h4>安全设置</h4>
            <div class="safety-controls">
              <div class="safety-item">
                <label>
                  <input type="checkbox" v-model="safetyEnabled" />
                  启用安全停止
                </label>
              </div>
              <div class="safety-item">
                <label>
                  <input type="checkbox" v-model="obstacleAvoidance" />
                  障碍物避让
                </label>
              </div>
              <div class="safety-item">
                <label>安全距离:</label>
                <input type="number" v-model.number="safetyDistance" step="0.1" min="0.1" max="2.0" />
                <span>m</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 状态显示区域 -->
      <div class="status-display">
        <div class="status-section">
          <h3>机器人状态</h3>
          <div class="status-grid">
            <div class="status-item">
              <span class="label">当前位置:</span>
              <span class="value">{{ formatPosition(currentPosition) }}</span>
            </div>
            <div class="status-item">
              <span class="label">当前速度:</span>
              <span class="value">{{ formatVelocity(currentVelocity) }}</span>
            </div>
            <div class="status-item">
              <span class="label">电池电量:</span>
              <span class="value">{{ batteryLevel }}%</span>
            </div>
            <div class="status-item">
              <span class="label">连接质量:</span>
              <span class="value">{{ connectionQuality }}</span>
            </div>
            <div class="status-item">
              <span class="label">最后更新:</span>
              <span class="value">{{ lastUpdate }}</span>
            </div>
            <div class="status-item">
              <span class="label">控制模式:</span>
              <span class="value">{{ controlMode }}</span>
            </div>
          </div>
        </div>

        <div class="status-section">
          <h3>传感器状态</h3>
          <div class="sensor-indicators">
            <div class="sensor-item" :class="{ active: sensorStates.laser }">
              <i class="icon-laser"></i>
              <span>激光雷达</span>
            </div>
            <div class="sensor-item" :class="{ active: sensorStates.camera }">
              <i class="icon-camera"></i>
              <span>摄像头</span>
            </div>
            <div class="sensor-item" :class="{ active: sensorStates.imu }">
              <i class="icon-imu"></i>
              <span>IMU</span>
            </div>
            <div class="sensor-item" :class="{ active: sensorStates.gps }">
              <i class="icon-gps"></i>
              <span>GPS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'

// 响应式数据
const connectionStatus = ref('disconnected') // disconnected, connecting, connected, error
const linearVelocity = ref(0)
const angularVelocity = ref(0)
const maxLinearVelocity = ref(1.0)
const maxAngularVelocity = ref(1.5)
const joystickX = ref(75)
const joystickY = ref(75)
const joystickActive = ref(false)
const joystickRadius = 75

const targetPosition = reactive({
  x: 0,
  y: 0,
  yaw: 0
})

const safetyEnabled = ref(true)
const obstacleAvoidance = ref(true)
const safetyDistance = ref(0.5)

const currentPosition = reactive({
  x: 0,
  y: 0,
  yaw: 0
})

const currentVelocity = reactive({
  linear: 0,
  angular: 0
})

const batteryLevel = ref(85)
const connectionQuality = ref('良好')
const lastUpdate = ref('--')
const controlMode = ref('手动控制')

const sensorStates = reactive({
  laser: true,
  camera: true,
  imu: true,
  gps: false
})

const hasPath = ref(false)
const isPathFollowing = ref(false)

// DOM 引用
let joystickArea: HTMLElement | null = null
let joystickHandle: HTMLElement | null = null

// 方法
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'disconnected': '未连接',
    'connecting': '连接中',
    'connected': '已连接',
    'error': '连接错误'
  }
  return statusMap[status] || status
}

function formatPosition(position: {x: number, y: number, yaw: number}): string {
  return `(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.yaw.toFixed(2)})`
}

function formatVelocity(velocity: {linear: number, angular: number}): string {
  return `线: ${velocity.linear.toFixed(2)} m/s, 角: ${velocity.angular.toFixed(2)} rad/s`
}

function startJoystick(event: MouseEvent | TouchEvent) {
  joystickActive.value = true
  updateJoystickPosition(event)

  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (joystickActive.value) {
      updateJoystickPosition(e)
    }
  }

  const handleMouseUp = () => {
    joystickActive.value = false
    joystickX.value = 75
    joystickY.value = 75
    linearVelocity.value = 0
    angularVelocity.value = 0
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('touchmove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    document.removeEventListener('touchend', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('touchmove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('touchend', handleMouseUp)
}

function updateJoystickPosition(event: MouseEvent | TouchEvent) {
  if (!joystickArea) return

  const rect = joystickArea.getBoundingClientRect()
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY

  let x = clientX - rect.left - joystickRadius
  let y = clientY - rect.top - joystickRadius

  // 限制在圆形范围内
  const distance = Math.sqrt(x * x + y * y)
  if (distance > joystickRadius) {
    x = (x / distance) * joystickRadius
    y = (y / distance) * joystickRadius
  }

  joystickX.value = x + joystickRadius
  joystickY.value = y + joystickRadius

  // 计算速度
  const normalizedX = x / joystickRadius
  const normalizedY = y / joystickRadius

  linearVelocity.value = -normalizedY * maxLinearVelocity.value
  angularVelocity.value = -normalizedX * maxAngularVelocity.value

  // 发送控制命令
  sendVelocityCommand()
}

function startMove(direction: 'forward' | 'backward' | 'left' | 'right') {
  switch (direction) {
    case 'forward':
      linearVelocity.value = maxLinearVelocity.value
      angularVelocity.value = 0
      break
    case 'backward':
      linearVelocity.value = -maxLinearVelocity.value
      angularVelocity.value = 0
      break
    case 'left':
      linearVelocity.value = 0
      angularVelocity.value = maxAngularVelocity.value
      break
    case 'right':
      linearVelocity.value = 0
      angularVelocity.value = -maxAngularVelocity.value
      break
  }
  sendVelocityCommand()
}

function stopMove() {
  linearVelocity.value = 0
  angularVelocity.value = 0
  sendVelocityCommand()
}

function sendVelocityCommand() {
  // TODO: 发送速度控制命令到机器人
  console.log('发送速度命令:', { linear: linearVelocity.value, angular: angularVelocity.value })
}

function goToPosition() {
  // TODO: 发送位置导航命令
  console.log('前往位置:', targetPosition)
}

function startPathFollowing() {
  if (!hasPath.value) return
  isPathFollowing.value = true
  // TODO: 开始路径跟随
  console.log('开始路径跟随')
}

function stopPathFollowing() {
  isPathFollowing.value = false
  // TODO: 停止路径跟随
  console.log('停止路径跟随')
}

function clearPath() {
  hasPath.value = false
  // TODO: 清除路径
  console.log('清除路径')
}

// 模拟状态更新
function updateRobotStatus() {
  // 模拟位置更新
  currentPosition.x += linearVelocity.value * 0.1 * Math.cos(currentPosition.yaw)
  currentPosition.y += linearVelocity.value * 0.1 * Math.sin(currentPosition.yaw)
  currentPosition.yaw += angularVelocity.value * 0.1

  currentVelocity.linear = linearVelocity.value
  currentVelocity.angular = angularVelocity.value

  // 模拟电池电量变化
  if (Math.abs(linearVelocity.value) > 0 || Math.abs(angularVelocity.value) > 0) {
    batteryLevel.value = Math.max(0, batteryLevel.value - 0.01)
  }

  lastUpdate.value = new Date().toLocaleTimeString()
}

// 生命周期钩子
onMounted(() => {
  // 初始化连接
  connectionStatus.value = 'connecting'
  setTimeout(() => {
    connectionStatus.value = 'connected'
  }, 2000)

  // 获取DOM引用
  joystickArea = document.querySelector('.joystick-area') as HTMLElement

  // 启动状态更新循环
  const statusInterval = setInterval(updateRobotStatus, 100)

  // 清理函数
  onUnmounted(() => {
    clearInterval(statusInterval)
  })
})

onUnmounted(() => {
  stopMove()
})
</script>

<style scoped>
.teleop-control-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
}

.teleop-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.teleop-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--panel-bg, #fff);
  border-bottom: 1px solid var(--border-color);
}

.teleop-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}

.teleop-status {
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

.status-indicator.disconnected {
  background: #f8d7da;
  color: #721c24;
}

.status-indicator.connecting {
  background: #fff3cd;
  color: #856404;
}

.status-indicator.connected {
  background: #d4edda;
  color: #155724;
}

.status-indicator.error {
  background: #f8d7da;
  color: #721c24;
}

.control-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--panel-bg, #fff);
  border-bottom: 1px solid var(--border-color);
  overflow-y: auto;
}

.joystick-section,
.quick-controls-section,
.advanced-controls-section {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.joystick-section:last-child,
.quick-controls-section:last-child,
.advanced-controls-section:last-child {
  border-bottom: none;
}

.control-panel h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.joystick-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.joystick-area {
  width: 150px;
  height: 150px;
  background: #f5f5f5;
  border: 2px solid #ddd;
  border-radius: 50%;
  position: relative;
  cursor: pointer;
  touch-action: none;
}

.joystick-handle {
  width: 30px;
  height: 30px;
  background: var(--primary-color);
  border-radius: 50%;
  position: absolute;
  transform: translate(-50%, -50%);
  cursor: grab;
  transition: background-color 0.2s;
}

.joystick-handle:active {
  cursor: grabbing;
  background: var(--primary-color-dark, #1976d2);
}

.joystick-info {
  display: flex;
  gap: 20px;
  font-size: 14px;
}

.info-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.info-item .label {
  color: var(--text-secondary);
  font-size: 12px;
}

.info-item .value {
  color: var(--text-color);
  font-weight: 500;
}

.quick-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.direction-btn {
  padding: 12px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
  touch-action: none;
}

.direction-btn:active {
  background: var(--primary-color-dark, #1976d2);
}

.speed-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.speed-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.speed-item label {
  min-width: 80px;
  font-size: 14px;
  color: var(--text-color);
}

.speed-item input[type="range"] {
  flex: 1;
  height: 6px;
  background: #ddd;
  border-radius: 3px;
  outline: none;
}

.speed-item span {
  min-width: 50px;
  text-align: right;
  font-size: 14px;
  color: var(--text-color);
  font-weight: 500;
}

.control-group {
  margin-bottom: 20px;
}

.control-group h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.position-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.control-item label {
  font-size: 14px;
  color: var(--text-color);
  font-weight: 500;
}

.control-item input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
}

.path-controls {
  display: flex;
  gap: 12px;
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

.safety-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.safety-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.safety-item label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-color);
  cursor: pointer;
}

.safety-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.safety-item input[type="number"] {
  width: 80px;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
}

.status-display {
  background: var(--panel-bg, #fff);
  border-top: 1px solid var(--border-color);
  padding: 16px;
}

.status-section {
  margin-bottom: 20px;
}

.status-section:last-child {
  margin-bottom: 0;
}

.status-section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-color);
  border-radius: 6px;
  font-size: 14px;
}

.status-item .label {
  color: var(--text-secondary);
}

.status-item .value {
  color: var(--text-color);
  font-weight: 500;
}

.sensor-indicators {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.sensor-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.sensor-item.active {
  background: #d4edda;
  color: #155724;
}

.sensor-item i {
  font-size: 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .teleop-container {
    flex-direction: column;
  }

  .control-panel {
    max-height: 60vh;
  }

  .joystick-container {
    flex-direction: column;
  }

  .quick-controls {
    grid-template-columns: 1fr;
  }

  .position-controls {
    grid-template-columns: 1fr;
  }

  .path-controls {
    flex-direction: column;
  }

  .status-grid {
    grid-template-columns: 1fr;
  }

  .sensor-indicators {
    justify-content: center;
  }
}
</style>
