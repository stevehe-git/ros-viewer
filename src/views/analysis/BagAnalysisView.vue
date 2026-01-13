<template>
  <div class="bag-analysis-view">
    <!-- Bag 分析区域 -->
    <div class="bag-container">
      <div class="bag-header">
        <h2>Bag 文件分析</h2>
        <div class="bag-actions">
          <button class="action-btn primary" @click="openBagFile">
            <i class="icon-open"></i>
            打开 Bag 文件
          </button>
          <button class="action-btn" @click="exportAnalysis" :disabled="!currentBag">
            <i class="icon-export"></i>
            导出分析结果
          </button>
        </div>
      </div>

      <!-- Bag 文件信息 -->
      <div class="bag-info-section" v-if="currentBag">
        <div class="info-card">
          <h3>文件信息</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">文件名:</span>
              <span class="value">{{ currentBag.filename }}</span>
            </div>
            <div class="info-item">
              <span class="label">文件大小:</span>
              <span class="value">{{ formatFileSize(currentBag.size) }}</span>
            </div>
            <div class="info-item">
              <span class="label">持续时间:</span>
              <span class="value">{{ formatDuration(currentBag.duration) }}</span>
            </div>
            <div class="info-item">
              <span class="label">开始时间:</span>
              <span class="value">{{ formatTimestamp(currentBag.startTime) }}</span>
            </div>
            <div class="info-item">
              <span class="label">结束时间:</span>
              <span class="value">{{ formatTimestamp(currentBag.endTime) }}</span>
            </div>
            <div class="info-item">
              <span class="label">消息数量:</span>
              <span class="value">{{ currentBag.messageCount.toLocaleString() }}</span>
            </div>
          </div>
        </div>

        <div class="info-card">
          <h3>Topic 统计</h3>
          <div class="topics-list">
            <div
              v-for="topic in currentBag.topics"
              :key="topic.name"
              class="topic-item"
              @click="selectTopic(topic)"
              :class="{ selected: selectedTopic?.name === topic.name }"
            >
              <div class="topic-info">
                <div class="topic-name">{{ topic.name }}</div>
                <div class="topic-meta">
                  <span class="topic-type">{{ topic.type }}</span>
                  <span class="topic-count">{{ topic.messageCount }} 条消息</span>
                  <span class="topic-frequency">{{ topic.frequency.toFixed(1) }} Hz</span>
                </div>
              </div>
              <div class="topic-actions">
                <button @click.stop="visualizeTopic(topic)" class="action-btn small">
                  可视化
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 时间轴控制 -->
      <div class="timeline-section" v-if="currentBag">
        <div class="timeline-header">
          <h3>时间轴控制</h3>
          <div class="timeline-controls">
            <button @click="playPause" class="control-btn">
              <i :class="isPlaying ? 'icon-pause' : 'icon-play'"></i>
            </button>
            <button @click="stopPlayback" class="control-btn">
              <i class="icon-stop"></i>
            </button>
            <button @click="resetPlayback" class="control-btn">
              <i class="icon-reset"></i>
            </button>
            <div class="speed-control">
              <label>播放速度:</label>
              <select v-model="playbackSpeed">
                <option value="0.25">0.25x</option>
                <option value="0.5">0.5x</option>
                <option value="1">1x</option>
                <option value="2">2x</option>
                <option value="4">4x</option>
              </select>
            </div>
          </div>
        </div>

        <div class="timeline-container">
          <div class="timeline-track">
            <div
              class="timeline-progress"
              :style="{ width: progressPercentage + '%' }"
            ></div>
            <div
              class="timeline-cursor"
              :style="{ left: progressPercentage + '%' }"
              @mousedown="startSeeking"
            ></div>
          </div>
          <div class="timeline-markers">
            <div class="timeline-time">
              <span>{{ formatDuration(currentTime) }}</span>
              <span>/</span>
              <span>{{ formatDuration(currentBag.duration) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 数据可视化区域 -->
      <div class="visualization-section">
        <div class="visualization-tabs">
          <button
            v-for="tab in visualizationTabs"
            :key="tab.id"
            @click="activeVisualizationTab = tab.id"
            :class="{ active: activeVisualizationTab === tab.id }"
            class="tab-btn"
          >
            {{ tab.name }}
          </button>
        </div>

        <div class="visualization-content">
          <!-- 图表可视化 -->
          <div v-if="activeVisualizationTab === 'charts'" class="charts-view">
            <div class="chart-container" v-if="selectedTopic">
              <h4>{{ selectedTopic.name }} - 数据图表</h4>
              <div class="chart-controls">
                <div class="control-group">
                  <label>X 轴字段:</label>
                  <select v-model="chartConfig.xField">
                    <option v-for="field in availableFields" :key="field" :value="field">
                      {{ field }}
                    </option>
                  </select>
                </div>
                <div class="control-group">
                  <label>Y 轴字段:</label>
                  <select v-model="chartConfig.yField">
                    <option v-for="field in availableFields" :key="field" :value="field">
                      {{ field }}
                    </option>
                  </select>
                </div>
                <div class="control-group">
                  <label>图表类型:</label>
                  <select v-model="chartConfig.chartType">
                    <option value="line">折线图</option>
                    <option value="scatter">散点图</option>
                    <option value="bar">柱状图</option>
                  </select>
                </div>
              </div>
              <canvas ref="dataChart" class="chart-canvas"></canvas>
            </div>
            <div v-else class="no-data">
              <i class="icon-chart"></i>
              <p>请选择一个 Topic 来查看图表</p>
            </div>
          </div>

          <!-- 3D 可视化 -->
          <div v-if="activeVisualizationTab === '3d'" class="3d-view">
            <div class="3d-container">
              <canvas ref="visualizationCanvas" class="visualization-canvas"></canvas>
              <div class="3d-controls">
                <button @click="resetCamera" class="control-btn small">
                  <i class="icon-reset"></i>
                  重置视角
                </button>
                <button @click="toggleGrid" class="control-btn small">
                  <i class="icon-grid"></i>
                  {{ showGrid ? '隐藏' : '显示' }}网格
                </button>
                <button @click="toggleAxes" class="control-btn small">
                  <i class="icon-axes"></i>
                  {{ showAxes ? '隐藏' : '显示' }}坐标轴
                </button>
              </div>
            </div>
          </div>

          <!-- 数据表格 -->
          <div v-if="activeVisualizationTab === 'table'" class="table-view">
            <div class="table-container" v-if="selectedTopic">
              <div class="table-header">
                <h4>{{ selectedTopic.name }} - 消息数据</h4>
                <div class="table-controls">
                  <input
                    type="text"
                    v-model="tableSearch"
                    placeholder="搜索消息..."
                    class="search-input"
                  />
                  <select v-model="tablePageSize" class="page-size-select">
                    <option :value="10">10 条/页</option>
                    <option :value="25">25 条/页</option>
                    <option :value="50">50 条/页</option>
                    <option :value="100">100 条/页</option>
                  </select>
                </div>
              </div>
              <div class="table-wrapper">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>时间戳</th>
                      <th>序列号</th>
                      <th v-for="field in tableFields" :key="field">{{ field }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="message in paginatedMessages" :key="message.id">
                      <td>{{ formatTimestamp(message.timestamp) }}</td>
                      <td>{{ message.seq }}</td>
                      <td v-for="field in tableFields" :key="field">
                        {{ getMessageFieldValue(message, field) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="table-footer">
                <div class="pagination-info">
                  显示 {{ ((currentPage - 1) * tablePageSize) + 1 }} -
                  {{ Math.min(currentPage * tablePageSize, filteredMessages.length) }} 条，
                  共 {{ filteredMessages.length }} 条
                </div>
                <div class="pagination-controls">
                  <button
                    @click="currentPage--"
                    :disabled="currentPage <= 1"
                    class="page-btn"
                  >
                    上一页
                  </button>
                  <span class="page-info">
                    第 {{ currentPage }} 页 / 共 {{ totalPages }} 页
                  </span>
                  <button
                    @click="currentPage++"
                    :disabled="currentPage >= totalPages"
                    class="page-btn"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="no-data">
              <i class="icon-table"></i>
              <p>请选择一个 Topic 来查看数据表格</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'

// 类型定义
interface BagFile {
  filename: string
  size: number
  duration: number
  startTime: Date
  endTime: Date
  messageCount: number
  topics: TopicInfo[]
}

interface TopicInfo {
  name: string
  type: string
  messageCount: number
  frequency: number
}

interface Message {
  id: string
  timestamp: Date
  seq: number
  data: Record<string, any>
}

// 响应式数据
const currentBag = ref<BagFile | null>(null)
const selectedTopic = ref<TopicInfo | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const playbackSpeed = ref(1)
const activeVisualizationTab = ref('charts')
const showGrid = ref(true)
const showAxes = ref(true)

const visualizationTabs = [
  { id: 'charts', name: '图表' },
  { id: '3d', name: '3D 可视化' },
  { id: 'table', name: '数据表格' }
]

const chartConfig = reactive({
  xField: 'timestamp',
  yField: 'data',
  chartType: 'line'
})

const tableSearch = ref('')
const tablePageSize = ref(25)
const currentPage = ref(1)

// DOM 引用
// const dataChart = ref<HTMLCanvasElement>()
// const visualizationCanvas = ref<HTMLCanvasElement>()

// 计算属性
const progressPercentage = computed(() => {
  if (!currentBag.value) return 0
  return (currentTime.value / currentBag.value.duration) * 100
})

const availableFields = computed(() => {
  if (!selectedTopic.value) return []
  // TODO: 从消息数据中提取可用字段
  return ['timestamp', 'x', 'y', 'z', 'vx', 'vy', 'vz']
})

const tableFields = computed(() => {
  if (!selectedTopic.value) return []
  // TODO: 根据消息类型确定表格字段
  return ['x', 'y', 'z', 'qx', 'qy', 'qz', 'qw']
})

const filteredMessages = computed(() => {
  if (!selectedTopic.value) return []
  // TODO: 实现消息过滤逻辑
  return [] as Message[]
})

const paginatedMessages = computed(() => {
  const start = (currentPage.value - 1) * tablePageSize.value
  const end = start + tablePageSize.value
  return filteredMessages.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredMessages.value.length / tablePageSize.value)
})

// 方法
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString()
}

function openBagFile() {
  // TODO: 实现文件选择对话框
  console.log('打开 Bag 文件')

  // 模拟加载 Bag 文件
  setTimeout(() => {
    currentBag.value = {
      filename: 'example.bag',
      size: 104857600, // 100MB
      duration: 3600, // 1小时
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(),
      messageCount: 150000,
      topics: [
        {
          name: '/odom',
          type: 'nav_msgs/Odometry',
          messageCount: 30000,
          frequency: 30
        },
        {
          name: '/scan',
          type: 'sensor_msgs/LaserScan',
          messageCount: 45000,
          frequency: 10
        },
        {
          name: '/tf',
          type: 'tf2_msgs/TFMessage',
          messageCount: 60000,
          frequency: 50
        },
        {
          name: '/cmd_vel',
          type: 'geometry_msgs/Twist',
          messageCount: 15000,
          frequency: 20
        }
      ]
    }
  }, 1000)
}

function exportAnalysis() {
  if (!currentBag.value) return
  // TODO: 实现分析结果导出
  console.log('导出分析结果')
}

function selectTopic(topic: TopicInfo) {
  selectedTopic.value = topic
  // TODO: 加载该 Topic 的消息数据
}

function visualizeTopic(topic: TopicInfo) {
  selectedTopic.value = topic
  activeVisualizationTab.value = 'charts'
  // TODO: 初始化可视化
}

function playPause() {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    // TODO: 开始播放
  } else {
    // TODO: 暂停播放
  }
}

function stopPlayback() {
  isPlaying.value = false
  currentTime.value = 0
  // TODO: 停止播放
}

function resetPlayback() {
  currentTime.value = 0
  // TODO: 重置播放位置
}

function startSeeking(_event: MouseEvent) {
  // TODO: 实现时间轴拖拽定位
}

function resetCamera() {
  // TODO: 重置 3D 视角
}

function toggleGrid() {
  showGrid.value = !showGrid.value
}

function toggleAxes() {
  showAxes.value = !showAxes.value
}

function getMessageFieldValue(message: Message, field: string): string {
  // TODO: 从消息数据中提取字段值
  return message.data[field] || '--'
}

// 生命周期钩子
onMounted(() => {
  // 初始化图表等
})

onUnmounted(() => {
  // 清理资源
  stopPlayback()
})
</script>

<style scoped>
.bag-analysis-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
}

.bag-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bag-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--panel-bg, #fff);
  border-bottom: 1px solid var(--border-color);
}

.bag-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}

.bag-actions {
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
  display: flex;
  align-items: center;
  gap: 8px;
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

.bag-info-section {
  background: var(--panel-bg, #fff);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  gap: 20px;
  padding: 16px;
}

.info-card {
  flex: 1;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
}

.info-card h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}

.info-item:last-child {
  border-bottom: none;
}

.info-item .label {
  color: var(--text-secondary);
  font-size: 14px;
}

.info-item .value {
  color: var(--text-color);
  font-weight: 500;
  font-size: 14px;
}

.topics-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.topic-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.topic-item:hover {
  border-color: var(--primary-color);
}

.topic-item.selected {
  border-color: var(--primary-color);
  background: rgba(33, 150, 243, 0.05);
}

.topic-info {
  flex: 1;
}

.topic-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 4px;
}

.topic-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.topic-type {
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 6px;
  border-radius: 4px;
}

.topic-actions {
  margin-left: 12px;
}

.action-btn.small {
  padding: 6px 12px;
  font-size: 12px;
}

.timeline-section {
  background: var(--panel-bg, #fff);
  border-bottom: 1px solid var(--border-color);
  padding: 16px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.timeline-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.timeline-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-btn {
  padding: 8px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.control-btn:hover {
  background: rgba(33, 150, 243, 0.1);
}

.speed-control {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
}

.speed-control label {
  font-size: 14px;
  color: var(--text-color);
}

.speed-control select {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
}

.timeline-container {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 12px;
}

.timeline-track {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  position: relative;
  margin-bottom: 8px;
  cursor: pointer;
}

.timeline-progress {
  height: 100%;
  background: var(--primary-color);
  border-radius: 4px;
  transition: width 0.1s ease;
}

.timeline-cursor {
  position: absolute;
  top: 50%;
  width: 16px;
  height: 16px;
  background: var(--primary-color);
  border: 2px solid white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  cursor: grab;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.timeline-cursor:active {
  cursor: grabbing;
}

.timeline-markers {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: var(--text-secondary);
}

.visualization-section {
  flex: 1;
  background: var(--panel-bg, #fff);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.visualization-tabs {
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

.visualization-content {
  flex: 1;
  overflow: hidden;
}

.charts-view,
.table-view {
  height: 100%;
  padding: 16px;
  overflow-y: auto;
}

.chart-container {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.chart-container h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.chart-controls {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.control-group label {
  font-size: 14px;
  color: var(--text-color);
  font-weight: 500;
}

.control-group select {
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
}

.chart-canvas {
  width: 100%;
  height: 400px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
}

.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-secondary);
}

.no-data i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-data p {
  margin: 0;
  font-size: 16px;
}

.table-container {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.table-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.table-controls {
  display: flex;
  gap: 12px;
}

.search-input {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
}

.page-size-select {
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
}

.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  font-size: 14px;
}

.data-table th {
  background: var(--panel-bg, #f8f9fa);
  font-weight: 600;
  color: var(--text-color);
  position: sticky;
  top: 0;
}

.data-table tbody tr:hover {
  background: rgba(33, 150, 243, 0.05);
}

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-top: 1px solid var(--border-color);
  background: var(--panel-bg, #f8f9fa);
}

.pagination-info {
  font-size: 14px;
  color: var(--text-secondary);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: rgba(33, 150, 243, 0.1);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 8px;
}

.visualization-canvas {
  width: 100%;
  height: 100%;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: #1a1a1a;
}

.visualization-canvas {
  width: 100%;
  height: 100%;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: #1a1a1a;
}

.three-d-view {
  height: 100%;
  position: relative;
}

.three-d-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.three-d-controls {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-btn.small {
  padding: 8px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.control-btn.small:hover {
  background: rgba(0, 0, 0, 0.9);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .bag-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .bag-actions {
    align-self: stretch;
    justify-content: flex-end;
  }

  .bag-info-section {
    flex-direction: column;
    gap: 16px;
  }

  .timeline-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .timeline-controls {
    align-self: stretch;
    justify-content: flex-end;
  }

  .chart-controls {
    flex-direction: column;
  }

  .table-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .table-footer {
    flex-direction: column;
    gap: 12px;
  }

  .pagination-controls {
    order: -1;
  }
}
</style>
