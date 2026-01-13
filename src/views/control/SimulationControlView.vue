<template>
  <div class="simulation-control-view">
    <!-- 仿真控制区域 -->
    <div class="simulation-container">
      <div class="simulation-header">
        <h2>仿真控制</h2>
        <div class="simulation-status">
          <div class="status-indicator" :class="simulationStatus">
            <i class="status-icon"></i>
            {{ getStatusText(simulationStatus) }}
          </div>
        </div>
      </div>

      <!-- 仿真控制面板 -->
      <div class="control-panel">
        <!-- 仿真设置 -->
        <div class="simulation-settings">
          <h3>仿真设置</h3>

          <div class="settings-group">
            <div class="setting-item">
              <label>仿真环境:</label>
              <select v-model="simulationEnvironment">
                <option value="empty">空环境</option>
                <option value="office">办公室</option>
                <option value="warehouse">仓库</option>
                <option value="custom">自定义</option>
              </select>
            </div>

            <div class="setting-item">
              <label>机器人模型:</label>
              <select v-model="robotModel">
                <option value="turtlebot3">TurtleBot3</option>
                <option value="pioneer">Pioneer</option>
                <option value="custom">自定义</option>
              </select>
            </div>

            <div class="setting-item">
              <label>物理引擎:</label>
              <select v-model="physicsEngine">
                <option value="gazebo">Gazebo</option>
                <option value="webots">Webots</option>
                <option value="coppelia">CoppeliaSim</option>
              </select>
            </div>

            <div class="setting-item">
              <label>
                <input type="checkbox" v-model="realTimeSimulation" />
                实时仿真
              </label>
            </div>

            <div class="setting-item">
              <label>仿真速度:</label>
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                v-model.number="simulationSpeed"
              />
              <span>{{ simulationSpeed }}x</span>
            </div>
          </div>
        </div>

        <!-- 仿真控制 -->
        <div class="simulation-controls">
          <h3>仿真控制</h3>

          <div class="control-buttons">
            <button
              class="control-btn primary"
              @click="startSimulation"
              :disabled="!canStartSimulation"
            >
              <i class="icon-play"></i>
              开始仿真
            </button>

            <button
              class="control-btn danger"
              @click="stopSimulation"
              :disabled="!isSimulationRunning"
            >
              <i class="icon-stop"></i>
              停止仿真
            </button>

            <button
              class="control-btn secondary"
              @click="pauseSimulation"
              :disabled="!isSimulationRunning"
            >
              <i class="icon-pause"></i>
              {{ isSimulationPaused ? '继续' : '暂停' }}
            </button>

            <button
              class="control-btn"
              @click="resetSimulation"
            >
              <i class="icon-reset"></i>
              重置
            </button>
          </div>

          <div class="simulation-progress" v-if="isSimulationRunning">
            <div class="progress-info">
              <span>仿真时间: {{ formatTime(simulationTime) }}</span>
              <span>实时因子: {{ realTimeFactor.toFixed(2) }}</span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: simulationProgress + '%' }"
              ></div>
            </div>
          </div>
        </div>

        <!-- 场景编辑 -->
        <div class="scene-editor">
          <h3>场景编辑</h3>

          <div class="editor-tools">
            <div class="tool-group">
              <button class="tool-btn" @click="selectTool('select')" :class="{ active: activeTool === 'select' }">
                <i class="icon-select"></i>
                选择
              </button>
              <button class="tool-btn" @click="selectTool('move')" :class="{ active: activeTool === 'move' }">
                <i class="icon-move"></i>
                移动
              </button>
              <button class="tool-btn" @click="selectTool('rotate')" :class="{ active: activeTool === 'rotate' }">
                <i class="icon-rotate"></i>
                旋转
              </button>
              <button class="tool-btn" @click="selectTool('scale')" :class="{ active: activeTool === 'scale' }">
                <i class="icon-scale"></i>
                缩放
              </button>
            </div>

            <div class="tool-group">
              <button class="tool-btn" @click="addObject('wall')">
                <i class="icon-wall"></i>
                墙壁
              </button>
              <button class="tool-btn" @click="addObject('obstacle')">
                <i class="icon-obstacle"></i>
                障碍物
              </button>
              <button class="tool-btn" @click="addObject('goal')">
                <i class="icon-goal"></i>
                目标点
              </button>
            </div>
          </div>

          <div class="object-list">
            <h4>场景对象</h4>
            <div class="object-items" v-if="sceneObjects.length > 0">
              <div
                v-for="obj in sceneObjects"
                :key="obj.id"
                class="object-item"
                :class="{ selected: obj.id === selectedObjectId }"
                @click="selectObject(obj.id)"
              >
                <i :class="`icon-${obj.type}`"></i>
                <span>{{ obj.name }}</span>
                <div class="object-actions">
                  <button @click.stop="editObject(obj)" class="action-btn small">编辑</button>
                  <button @click.stop="deleteObject(obj.id)" class="action-btn small danger">删除</button>
                </div>
              </div>
            </div>
            <div v-else class="empty-objects">
              <p>暂无场景对象</p>
            </div>
          </div>
        </div>

        <!-- 传感器配置 -->
        <div class="sensor-config">
          <h3>传感器配置</h3>

          <div class="sensor-list">
            <div
              v-for="sensor in availableSensors"
              :key="sensor.id"
              class="sensor-item"
            >
              <div class="sensor-info">
                <label>
                  <input
                    type="checkbox"
                    v-model="sensor.enabled"
                    @change="toggleSensor(sensor)"
                  />
                  <i :class="`icon-${sensor.type}`"></i>
                  {{ sensor.name }}
                </label>
                <span class="sensor-type">{{ getSensorTypeText(sensor.type) }}</span>
              </div>

              <div class="sensor-settings" v-if="sensor.enabled">
                <div class="setting-row">
                  <label>更新频率:</label>
                  <input
                    type="number"
                    v-model.number="sensor.frequency"
                    min="1"
                    max="100"
                    step="1"
                  />
                  <span>Hz</span>
                </div>

                <div class="setting-row" v-if="sensor.type === 'laser'">
                  <label>角度范围:</label>
                  <input
                    type="number"
                    v-model.number="sensor.angleRange"
                    min="30"
                    max="360"
                    step="30"
                  />
                  <span>°</span>
                </div>

                <div class="setting-row" v-if="sensor.type === 'camera'">
                  <label>分辨率:</label>
                  <select v-model="sensor.resolution">
                    <option value="640x480">640x480</option>
                    <option value="1280x720">1280x720</option>
                    <option value="1920x1080">1920x1080</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 仿真输出区域 -->
      <div class="simulation-output">
        <div class="output-tabs">
          <button
            v-for="tab in outputTabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="{ active: activeTab === tab.id }"
            class="tab-btn"
          >
            {{ tab.name }}
          </button>
        </div>

        <div class="output-content">
          <!-- 控制台输出 -->
          <div v-if="activeTab === 'console'" class="console-output">
            <div class="console-messages">
              <div
                v-for="message in consoleMessages"
                :key="message.id"
                class="console-message"
                :class="message.type"
              >
                <span class="timestamp">{{ formatTimestamp(message.timestamp) }}</span>
                <span class="content">{{ message.content }}</span>
              </div>
            </div>
            <div class="console-input">
              <input
                type="text"
                v-model="consoleCommand"
                @keyup.enter="executeCommand"
                placeholder="输入控制台命令..."
              />
              <button @click="executeCommand">执行</button>
            </div>
          </div>

          <!-- 数据图表 -->
          <div v-if="activeTab === 'charts'" class="charts-output">
            <div class="chart-container">
              <h4>位置跟踪</h4>
              <canvas ref="positionChart" class="chart-canvas"></canvas>
            </div>
            <div class="chart-container">
              <h4>速度变化</h4>
              <canvas ref="velocityChart" class="chart-canvas"></canvas>
            </div>
          </div>

          <!-- 传感器数据 -->
          <div v-if="activeTab === 'sensors'" class="sensors-output">
            <div class="sensor-data-grid">
              <div
                v-for="sensor in enabledSensors"
                :key="sensor.id"
                class="sensor-data-item"
              >
                <h4>{{ sensor.name }}</h4>
                <div class="sensor-values">
                  <div
                    v-for="value in sensor.data"
                    :key="value.key"
                    class="sensor-value"
                  >
                    <span class="label">{{ value.label }}:</span>
                    <span class="value">{{ value.value }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

// 类型定义
interface SceneObject {
  id: string
  name: string
  type: 'wall' | 'obstacle' | 'goal' | 'robot'
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
}

interface Sensor {
  id: string
  name: string
  type: 'laser' | 'camera' | 'imu' | 'gps'
  enabled: boolean
  frequency: number
  angleRange?: number
  resolution?: string
  data?: Array<{ key: string; label: string; value: string }>
}

interface ConsoleMessage {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  content: string
  timestamp: Date
}

// 响应式数据
const simulationStatus = ref('stopped') // stopped, starting, running, paused, stopping
const isSimulationRunning = ref(false)
const isSimulationPaused = ref(false)
const simulationTime = ref(0)
const simulationProgress = ref(0)
const realTimeFactor = ref(1.0)

const simulationEnvironment = ref('empty')
const robotModel = ref('turtlebot3')
const physicsEngine = ref('gazebo')
const realTimeSimulation = ref(true)
const simulationSpeed = ref(1.0)

const activeTool = ref('select')
const selectedObjectId = ref<string | null>(null)
const sceneObjects = ref<SceneObject[]>([])

const availableSensors = ref<Sensor[]>([
  {
    id: 'laser1',
    name: '激光雷达',
    type: 'laser',
    enabled: true,
    frequency: 10,
    angleRange: 360
  },
  {
    id: 'camera1',
    name: '前置摄像头',
    type: 'camera',
    enabled: true,
    frequency: 30,
    resolution: '640x480'
  },
  {
    id: 'imu1',
    name: 'IMU传感器',
    type: 'imu',
    enabled: true,
    frequency: 100
  },
  {
    id: 'gps1',
    name: 'GPS模块',
    type: 'gps',
    enabled: false,
    frequency: 1
  }
])

const activeTab = ref('console')
const outputTabs = [
  { id: 'console', name: '控制台' },
  { id: 'charts', name: '图表' },
  { id: 'sensors', name: '传感器' }
]

const consoleMessages = ref<ConsoleMessage[]>([])
const consoleCommand = ref('')

// DOM 引用
// const positionChart = ref<HTMLCanvasElement>()
// const velocityChart = ref<HTMLCanvasElement>()

// 计算属性
const canStartSimulation = computed(() => {
  return simulationStatus.value === 'stopped'
})

const enabledSensors = computed(() => {
  return availableSensors.value.filter(sensor => sensor.enabled)
})

// 方法
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'stopped': '已停止',
    'starting': '启动中',
    'running': '运行中',
    'paused': '已暂停',
    'stopping': '停止中'
  }
  return statusMap[status] || status
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString()
}

function selectTool(tool: string) {
  activeTool.value = tool
}

function addObject(type: string) {
  const object: SceneObject = {
    id: Date.now().toString(),
    name: `${type} ${sceneObjects.value.length + 1}`,
    type: type as any,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  }
  sceneObjects.value.push(object)
  selectedObjectId.value = object.id
}

function selectObject(id: string) {
  selectedObjectId.value = id
}

function editObject(object: SceneObject) {
  // TODO: 打开对象编辑对话框
  console.log('编辑对象:', object)
}

function deleteObject(id: string) {
  const index = sceneObjects.value.findIndex(obj => obj.id === id)
  if (index > -1) {
    sceneObjects.value.splice(index, 1)
    if (selectedObjectId.value === id) {
      selectedObjectId.value = null
    }
  }
}

function toggleSensor(sensor: Sensor) {
  // TODO: 通知仿真引擎传感器状态变化
  console.log('传感器状态变化:', sensor)
}

function getSensorTypeText(type: string): string {
  const typeMap: Record<string, string> = {
    'laser': '激光雷达',
    'camera': '摄像头',
    'imu': '惯性测量单元',
    'gps': '全球定位系统'
  }
  return typeMap[type] || type
}

function startSimulation() {
  if (!canStartSimulation.value) return

  simulationStatus.value = 'starting'
  addConsoleMessage('info', '开始启动仿真环境...')

  setTimeout(() => {
    simulationStatus.value = 'running'
    isSimulationRunning.value = true
    addConsoleMessage('success', '仿真环境启动成功')

    // 开始仿真循环
    startSimulationLoop()
  }, 2000)
}

function stopSimulation() {
  if (!isSimulationRunning.value) return

  simulationStatus.value = 'stopping'
  addConsoleMessage('warning', '正在停止仿真...')

  setTimeout(() => {
    simulationStatus.value = 'stopped'
    isSimulationRunning.value = false
    isSimulationPaused.value = false
    simulationTime.value = 0
    simulationProgress.value = 0
    addConsoleMessage('info', '仿真已停止')
  }, 1000)
}

function pauseSimulation() {
  if (!isSimulationRunning.value) return

  isSimulationPaused.value = !isSimulationPaused.value
  simulationStatus.value = isSimulationPaused.value ? 'paused' : 'running'

  addConsoleMessage('info', isSimulationPaused.value ? '仿真已暂停' : '仿真已继续')
}

function resetSimulation() {
  stopSimulation()
  sceneObjects.value = []
  selectedObjectId.value = null
  addConsoleMessage('info', '仿真环境已重置')
}

function startSimulationLoop() {
  const interval = setInterval(() => {
    if (!isSimulationRunning.value || isSimulationPaused.value) {
      if (!isSimulationRunning.value) {
        clearInterval(interval)
      }
      return
    }

    simulationTime.value += 0.1
    simulationProgress.value = Math.min(100, (simulationTime.value / 100) * 100)

    // 更新传感器数据
    updateSensorData()

    // 检查仿真是否完成
    if (simulationTime.value >= 100) {
      stopSimulation()
      addConsoleMessage('success', '仿真完成')
    }
  }, 100)
}

function updateSensorData() {
  availableSensors.value.forEach(sensor => {
    if (!sensor.enabled) return

    switch (sensor.type) {
      case 'laser':
        sensor.data = [
          { key: 'range', label: '距离', value: (Math.random() * 10).toFixed(2) + ' m' },
          { key: 'intensity', label: '强度', value: (Math.random() * 100).toFixed(0) }
        ]
        break
      case 'camera':
        sensor.data = [
          { key: 'fps', label: '帧率', value: sensor.frequency + ' FPS' },
          { key: 'resolution', label: '分辨率', value: sensor.resolution || '640x480' }
        ]
        break
      case 'imu':
        sensor.data = [
          { key: 'accel', label: '加速度', value: (Math.random() * 20 - 10).toFixed(2) + ' m/s²' },
          { key: 'gyro', label: '角速度', value: (Math.random() * 10 - 5).toFixed(2) + ' rad/s' }
        ]
        break
      case 'gps':
        sensor.data = [
          { key: 'lat', label: '纬度', value: (Math.random() * 180 - 90).toFixed(6) + '°' },
          { key: 'lon', label: '经度', value: (Math.random() * 360 - 180).toFixed(6) + '°' }
        ]
        break
    }
  })
}

function addConsoleMessage(type: 'info' | 'warning' | 'error' | 'success', content: string) {
  const message: ConsoleMessage = {
    id: Date.now().toString(),
    type,
    content,
    timestamp: new Date()
  }
  consoleMessages.value.push(message)

  // 限制消息数量
  if (consoleMessages.value.length > 100) {
    consoleMessages.value.shift()
  }
}

function executeCommand() {
  if (!consoleCommand.value.trim()) return

  addConsoleMessage('info', `> ${consoleCommand.value}`)
  // TODO: 执行控制台命令
  consoleCommand.value = ''
}

// 生命周期钩子
onMounted(() => {
  // 初始化一些示例对象
  sceneObjects.value = [
    {
      id: 'robot1',
      name: '机器人',
      type: 'robot',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    },
    {
      id: 'goal1',
      name: '目标点',
      type: 'goal',
      position: { x: 5, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    }
  ]

  // 添加欢迎消息
  addConsoleMessage('info', '仿真控制系统已就绪')
})

onUnmounted(() => {
  if (isSimulationRunning.value) {
    stopSimulation()
  }
})
</script>

<style scoped>
.simulation-control-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
}

.simulation-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.simulation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--panel-bg, #fff);
  border-bottom: 1px solid var(--border-color);
}

.simulation-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}

.simulation-status {
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

.status-indicator.stopped {
  background: #e0e0e0;
  color: #666;
}

.status-indicator.starting {
  background: #fff3cd;
  color: #856404;
}

.status-indicator.running {
  background: #d4edda;
  color: #155724;
}

.status-indicator.paused {
  background: #d1ecf1;
  color: #0c5460;
}

.status-indicator.stopping {
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

.simulation-settings,
.simulation-controls,
.scene-editor,
.sensor-config {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.simulation-settings:last-child,
.simulation-controls:last-child,
.scene-editor:last-child,
.sensor-config:last-child {
  border-bottom: none;
}

.control-panel h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.settings-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-item label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-color);
  font-weight: 500;
  cursor: pointer;
}

.setting-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.setting-item select,
.setting-item input[type="range"] {
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
}

.setting-item input[type="range"] {
  width: 100%;
}

.control-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.control-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.control-btn:not(:disabled):hover {
  opacity: 0.9;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.control-btn.primary {
  background: var(--primary-color);
  color: white;
}

.control-btn.danger {
  background: var(--error-color, #f44336);
  color: white;
}

.control-btn.secondary {
  background: var(--secondary-color, #757575);
  color: white;
}

.simulation-progress {
  margin-top: 16px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.progress-bar {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color);
  transition: width 0.3s ease;
}

.editor-tools {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.tool-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tool-btn {
  padding: 8px 12px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.tool-btn:hover {
  background: rgba(33, 150, 243, 0.1);
}

.tool-btn.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.object-list h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.object-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.object-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.object-item:hover {
  border-color: var(--primary-color);
}

.object-item.selected {
  border-color: var(--primary-color);
  background: rgba(33, 150, 243, 0.05);
}

.object-item i {
  font-size: 16px;
  color: var(--text-secondary);
}

.object-item span {
  flex: 1;
  font-size: 14px;
  color: var(--text-color);
}

.object-actions {
  display: flex;
  gap: 6px;
}

.action-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;
}

.action-btn.small {
  padding: 4px 8px;
  font-size: 12px;
}

.action-btn.danger {
  background: var(--error-color, #f44336);
  color: white;
}

.empty-objects {
  text-align: center;
  padding: 20px;
  color: var(--text-secondary);
}

.sensor-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sensor-item {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.sensor-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-color);
}

.sensor-info label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-color);
  cursor: pointer;
  flex: 1;
}

.sensor-info input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.sensor-type {
  font-size: 12px;
  color: var(--text-secondary);
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 10px;
}

.sensor-settings {
  padding: 12px;
  background: var(--panel-bg, #f8f9fa);
  border-top: 1px solid var(--border-color);
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.setting-row label {
  min-width: 80px;
  font-size: 14px;
  color: var(--text-color);
}

.setting-row input,
.setting-row select {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
}

.simulation-output {
  background: var(--panel-bg, #fff);
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  min-height: 300px;
}

.output-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
}

.tab-btn {
  padding: 12px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--text-color);
}

.tab-btn.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.output-content {
  flex: 1;
  overflow: hidden;
}

.console-output {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.console-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  background: #1a1a1a;
  color: #e0e0e0;
}

.console-message {
  margin-bottom: 4px;
  display: flex;
  gap: 8px;
}

.console-message.info {
  color: #e0e0e0;
}

.console-message.warning {
  color: #ffcc00;
}

.console-message.error {
  color: #ff6b6b;
}

.console-message.success {
  color: #4ecdc4;
}

.timestamp {
  color: #666;
  font-size: 12px;
}

.console-input {
  display: flex;
  padding: 12px;
  background: #2a2a2a;
  border-top: 1px solid #444;
}

.console-input input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #555;
  border-radius: 4px;
  background: #1a1a1a;
  color: #e0e0e0;
  font-family: 'Courier New', monospace;
  font-size: 14px;
}

.console-input button {
  margin-left: 8px;
  padding: 8px 16px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.charts-output {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
}

.chart-container {
  margin-bottom: 20px;
}

.chart-container h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.chart-canvas {
  width: 100%;
  height: 200px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
}

.sensors-output {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
}

.sensor-data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.sensor-data-item {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 16px;
}

.sensor-data-item h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.sensor-values {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sensor-value {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.sensor-value .label {
  color: var(--text-secondary);
}

.sensor-value .value {
  color: var(--text-color);
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .simulation-container {
    flex-direction: column;
  }

  .control-panel {
    max-height: 60vh;
  }

  .settings-group {
    grid-template-columns: 1fr;
  }

  .control-buttons {
    flex-direction: column;
  }

  .editor-tools {
    flex-direction: column;
  }

  .tool-group {
    justify-content: center;
  }

  .sensor-data-grid {
    grid-template-columns: 1fr;
  }

  .output-tabs {
    overflow-x: auto;
  }
}
</style>
