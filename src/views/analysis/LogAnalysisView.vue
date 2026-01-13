<template>
  <div class="log-analysis-view">
    <!-- 日志分析区域 -->
    <div class="log-container">
      <div class="log-header">
        <h2>日志分析</h2>
        <div class="log-actions">
          <button class="action-btn primary" @click="openLogFile">
            <i class="icon-open"></i>
            打开日志文件
          </button>
          <button class="action-btn" @click="exportAnalysis" :disabled="!currentLog">
            <i class="icon-export"></i>
            导出分析结果
          </button>
          <button class="action-btn secondary" @click="clearLogs">
            <i class="icon-clear"></i>
            清空
          </button>
        </div>
      </div>

      <!-- 日志统计信息 -->
      <div class="log-stats-section" v-if="currentLog">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon error">
              <i class="icon-error"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ logStats.errors }}</div>
              <div class="stat-label">错误</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon warning">
              <i class="icon-warning"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ logStats.warnings }}</div>
              <div class="stat-label">警告</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon info">
              <i class="icon-info"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ logStats.infos }}</div>
              <div class="stat-label">信息</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon debug">
              <i class="icon-debug"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ logStats.debugs }}</div>
              <div class="stat-label">调试</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-content full-width">
              <div class="stat-value">{{ logStats.total }}</div>
              <div class="stat-label">总日志条数</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-content full-width">
              <div class="stat-value">{{ formatDuration(logStats.duration) }}</div>
              <div class="stat-label">日志时长</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 日志过滤和搜索 -->
      <div class="log-filters-section">
        <div class="filters-container">
          <div class="filter-group">
            <label>日志级别:</label>
            <div class="level-filters">
              <label v-for="level in logLevels" :key="level.value" class="level-filter">
                <input
                  type="checkbox"
                  :value="level.value"
                  v-model="activeLevels"
                />
                <span :class="`level-${level.value}`">{{ level.label }}</span>
              </label>
            </div>
          </div>

          <div class="filter-group">
            <label>时间范围:</label>
            <div class="time-filters">
              <input
                type="datetime-local"
                v-model="startTime"
                placeholder="开始时间"
              />
              <span>至</span>
              <input
                type="datetime-local"
                v-model="endTime"
                placeholder="结束时间"
              />
              <button @click="applyTimeFilter" class="filter-btn">应用</button>
            </div>
          </div>

          <div class="filter-group">
            <label>搜索内容:</label>
            <div class="search-group">
              <input
                type="text"
                v-model="searchQuery"
                placeholder="搜索日志内容..."
                @keyup.enter="applySearch"
              />
              <button @click="applySearch" class="search-btn">
                <i class="icon-search"></i>
              </button>
            </div>
          </div>

          <div class="filter-group">
            <label>节点过滤:</label>
            <select v-model="selectedNode" @change="applyNodeFilter">
              <option value="">所有节点</option>
                  <option
                    v-for="node in availableNodes"
                    :key="node"
                    :value="node"
                  >
                    {{ node || '未知节点' }}
                  </option>
            </select>
          </div>
        </div>
      </div>

      <!-- 日志显示区域 -->
      <div class="log-display-section">
        <div class="log-toolbar">
          <div class="log-info">
            <span>显示 {{ filteredLogs.length }} / {{ allLogs.length }} 条日志</span>
          </div>
          <div class="log-controls">
            <button @click="toggleAutoScroll" class="control-btn" :class="{ active: autoScroll }">
              <i class="icon-scroll"></i>
              自动滚动
            </button>
            <button @click="toggleWrapText" class="control-btn" :class="{ active: wrapText }">
              <i class="icon-wrap"></i>
              换行显示
            </button>
            <div class="font-size-control">
              <label>字体大小:</label>
              <select v-model="fontSize">
                <option value="small">小</option>
                <option value="medium">中</option>
                <option value="large">大</option>
              </select>
            </div>
          </div>
        </div>

        <div class="log-entries" ref="logContainer" :class="{ 'wrap-text': wrapText }">
          <div
            v-for="log in displayedLogs"
            :key="log.id"
            class="log-entry"
            :class="`level-${log.level}`"
          >
            <div class="log-meta">
              <span class="log-time">{{ formatTimestamp(log.timestamp) }}</span>
              <span class="log-level" :class="`level-${log.level}`">{{ getLevelText(log.level) }}</span>
              <span class="log-node">{{ log.node }}</span>
            </div>
            <div class="log-message" :class="fontSize">
              {{ log.message }}
            </div>
            <div v-if="log.stacktrace" class="log-stacktrace">
              <pre>{{ log.stacktrace }}</pre>
            </div>
          </div>

          <div v-if="filteredLogs.length === 0 && allLogs.length > 0" class="no-results">
            <i class="icon-search"></i>
            <p>没有找到匹配的日志</p>
          </div>

          <div v-if="allLogs.length === 0" class="no-logs">
            <i class="icon-file"></i>
            <p>暂无日志数据</p>
            <p class="hint">点击"打开日志文件"开始分析</p>
          </div>
        </div>

        <!-- 分页控制 -->
        <div class="log-pagination" v-if="totalPages > 1">
          <div class="pagination-info">
            第 {{ currentPage }} 页 / 共 {{ totalPages }} 页
          </div>
          <div class="pagination-controls">
            <button
              @click="goToPage(currentPage - 1)"
              :disabled="currentPage <= 1"
              class="page-btn"
            >
              上一页
            </button>
            <button
              v-for="page in visiblePages"
              :key="page"
              @click="goToPage(page)"
              :class="{ active: page === currentPage }"
              class="page-btn"
            >
              {{ page }}
            </button>
            <button
              @click="goToPage(currentPage + 1)"
              :disabled="currentPage >= totalPages"
              class="page-btn"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      <!-- 日志分析图表 -->
      <div class="log-charts-section" v-if="currentLog">
        <div class="charts-container">
          <div class="chart-card">
            <h4>日志级别分布</h4>
            <canvas ref="levelChart" class="chart-canvas"></canvas>
          </div>

          <div class="chart-card">
            <h4>日志时间分布</h4>
            <canvas ref="timeChart" class="chart-canvas"></canvas>
          </div>

          <div class="chart-card">
            <h4>节点日志统计</h4>
            <canvas ref="nodeChart" class="chart-canvas"></canvas>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

// 类型定义
interface LogEntry {
  id: string
  timestamp: Date
  level: 'error' | 'warning' | 'info' | 'debug'
  node: string
  message: string
  stacktrace?: string
}

interface LogFile {
  filename: string
  entries: LogEntry[]
  startTime: Date
  endTime: Date
}

// 响应式数据
const currentLog = ref<LogFile | null>(null)
const allLogs = ref<LogEntry[]>([])
const filteredLogs = ref<LogEntry[]>([])
const activeLevels = ref(['error', 'warning', 'info'])
const startTime = ref('')
const endTime = ref('')
const searchQuery = ref('')
const selectedNode = ref('')
const autoScroll = ref(true)
const wrapText = ref(false)
const fontSize = ref('medium')
const currentPage = ref(1)
const pageSize = ref(100)

const logLevels = [
  { value: 'error', label: '错误' },
  { value: 'warning', label: '警告' },
  { value: 'info', label: '信息' },
  { value: 'debug', label: '调试' }
]

// DOM 引用
const logContainer = ref<HTMLElement>()
// const levelChart = ref<HTMLCanvasElement>()
// const timeChart = ref<HTMLCanvasElement>()
// const nodeChart = ref<HTMLCanvasElement>()

// 计算属性
const logStats = computed(() => {
  const stats = {
    errors: 0,
    warnings: 0,
    infos: 0,
    debugs: 0,
    total: allLogs.value.length,
    duration: 0
  }

  if (allLogs.value.length > 0) {
    const timestamps = allLogs.value.map(log => log.timestamp.getTime())
    stats.duration = (Math.max(...timestamps) - Math.min(...timestamps)) / 1000

    allLogs.value.forEach(log => {
      switch (log.level) {
        case 'error':
          stats.errors++
          break
        case 'warning':
          stats.warnings++
          break
        case 'info':
          stats.infos++
          break
        case 'debug':
          stats.debugs++
          break
      }
    })
  }

  return stats
})

const availableNodes = computed(() => {
  const nodes = new Set<string>()
  allLogs.value.forEach(log => {
    if (log.node) nodes.add(log.node)
  })
  return Array.from(nodes).sort()
})

const totalPages = computed(() => {
  return Math.ceil(filteredLogs.value.length / pageSize.value)
})

const displayedLogs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredLogs.value.slice(start, end)
})

const visiblePages = computed(() => {
  const pages: number[] = []
  const start = Math.max(1, currentPage.value - 2)
  const end = Math.min(totalPages.value, currentPage.value + 2)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return pages
})

// 方法
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}时 ${minutes}分 ${secs}秒`
  } else if (minutes > 0) {
    return `${minutes}分 ${secs}秒`
  }
  return `${secs}秒`
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function getLevelText(level: string): string {
  const levelMap: Record<string, string> = {
    'error': '错误',
    'warning': '警告',
    'info': '信息',
    'debug': '调试'
  }
  return levelMap[level] || level
}

function openLogFile() {
  // TODO: 实现文件选择对话框
  console.log('打开日志文件')

  // 模拟加载日志文件
  setTimeout(() => {
    const mockLogs: LogEntry[] = []
    const nodes = ['/move_base', '/amcl', '/robot_state_publisher', '/rviz', '/rosout']
    const messages = [
      '机器人导航初始化完成',
      '收到新的目标位置',
      '路径规划成功',
      '开始执行导航任务',
      '检测到障碍物',
      '激光雷达数据异常',
      '里程计数据更新',
      'TF变换发布',
      '传感器数据丢失',
      '网络连接超时'
    ]

    const now = new Date()
    for (let i = 0; i < 500; i++) {
      const timestamp = new Date(now.getTime() - (500 - i) * 1000)
      const level = ['debug', 'info', 'warning', 'error'][Math.floor(Math.random() * 4)] as any
      const node = nodes[Math.floor(Math.random() * nodes.length)]
      const message = messages[Math.floor(Math.random() * messages.length)]

      mockLogs.push({
        id: `log-${i}`,
        timestamp,
        level,
        node,
        message: `[${node}] ${message} (ID: ${i})`,
        stacktrace: level === 'error' && Math.random() > 0.7 ? 'Stack trace...\n  at function1\n  at function2' : undefined
      })
    }

    currentLog.value = {
      filename: 'ros.log',
      entries: mockLogs,
      startTime: mockLogs[0].timestamp,
      endTime: mockLogs[mockLogs.length - 1].timestamp
    }

    allLogs.value = mockLogs
    applyFilters()
  }, 1000)
}

function exportAnalysis() {
  if (!currentLog.value) return
  // TODO: 实现分析结果导出
  console.log('导出分析结果')
}

function clearLogs() {
  currentLog.value = null
  allLogs.value = []
  filteredLogs.value = []
  currentPage.value = 1
}

function applyFilters() {
  let filtered = allLogs.value

  // 级别过滤
  if (activeLevels.value.length > 0) {
    filtered = filtered.filter(log => activeLevels.value.includes(log.level))
  }

  // 时间过滤
  if (startTime.value) {
    const start = new Date(startTime.value)
    filtered = filtered.filter(log => log.timestamp >= start)
  }
  if (endTime.value) {
    const end = new Date(endTime.value)
    filtered = filtered.filter(log => log.timestamp <= end)
  }

  // 搜索过滤
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(log =>
      log.message.toLowerCase().includes(query) ||
      log.node.toLowerCase().includes(query)
    )
  }

  // 节点过滤
  if (selectedNode.value) {
    filtered = filtered.filter(log => log.node === selectedNode.value)
  }

  filteredLogs.value = filtered
  currentPage.value = 1
}

function applyTimeFilter() {
  applyFilters()
}

function applySearch() {
  applyFilters()
}

function applyNodeFilter() {
  applyFilters()
}

function toggleAutoScroll() {
  autoScroll.value = !autoScroll.value
}

function toggleWrapText() {
  wrapText.value = !wrapText.value
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    if (autoScroll.value) {
      scrollToBottom()
    }
  }
}

function scrollToBottom() {
  if (logContainer.value) {
    setTimeout(() => {
      logContainer.value!.scrollTop = logContainer.value!.scrollHeight
    }, 100)
  }
}

// 监听过滤器变化
watch([activeLevels, searchQuery, selectedNode], () => {
  applyFilters()
})

// 监听当前页变化，自动滚动
watch(currentPage, () => {
  if (autoScroll.value) {
    scrollToBottom()
  }
})

// 生命周期钩子
onMounted(() => {
  // 初始化图表
})

onUnmounted(() => {
  // 清理资源
})
</script>

<style scoped>
.log-analysis-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
}

.log-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--panel-bg, #fff);
  border-bottom: 1px solid var(--border-color);
}

.log-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}

.log-actions {
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

.action-btn.secondary {
  background: var(--secondary-color, #757575);
  color: white;
}

.log-stats-section {
  background: var(--panel-bg, #fff);
  border-bottom: 1px solid var(--border-color);
  padding: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.stat-card {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.stat-icon.error {
  background: #fee;
  color: #d32f2f;
}

.stat-icon.warning {
  background: #fff3cd;
  color: #f57c00;
}

.stat-icon.info {
  background: #e3f2fd;
  color: #1976d2;
}

.stat-icon.debug {
  background: #f3e5f5;
  color: #7b1fa2;
}

.stat-content {
  flex: 1;
}

.stat-content.full-width {
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-color);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.log-filters-section {
  background: var(--panel-bg, #fff);
  border-bottom: 1px solid var(--border-color);
  padding: 16px;
}

.filters-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-group label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
}

.level-filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.level-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 14px;
}

.level-filter input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.level-error {
  color: #d32f2f;
}

.level-warning {
  color: #f57c00;
}

.level-info {
  color: #1976d2;
}

.level-debug {
  color: #7b1fa2;
}

.time-filters {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-filters input {
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
}

.filter-btn {
  padding: 6px 12px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.search-group {
  display: flex;
  gap: 8px;
}

.search-group input {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
}

.search-btn {
  padding: 6px 12px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-group select {
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
}

.log-display-section {
  flex: 1;
  background: var(--panel-bg, #fff);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.log-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-color);
}

.log-info {
  font-size: 14px;
  color: var(--text-secondary);
}

.log-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.control-btn {
  padding: 6px 12px;
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

.control-btn:hover {
  background: rgba(33, 150, 243, 0.1);
}

.control-btn.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.font-size-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.font-size-control label {
  font-size: 14px;
  color: var(--text-color);
}

.font-size-control select {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
}

.log-entries {
  flex: 1;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  background: #1a1a1a;
  color: #e0e0e0;
}

.log-entry {
  border-bottom: 1px solid #333;
  padding: 8px 16px;
  transition: background-color 0.2s;
}

.log-entry:hover {
  background: rgba(255, 255, 255, 0.05);
}

.log-entry.level-error {
  border-left: 4px solid #d32f2f;
}

.log-entry.level-warning {
  border-left: 4px solid #f57c00;
}

.log-entry.level-info {
  border-left: 4px solid #1976d2;
}

.log-entry.level-debug {
  border-left: 4px solid #7b1fa2;
}

.log-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 4px;
  font-size: 12px;
  color: #999;
}

.log-time {
  min-width: 160px;
}

.log-level {
  min-width: 60px;
  font-weight: 500;
}

.log-node {
  color: #4fc3f7;
}

.log-message {
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.log-message.small {
  font-size: 12px;
}

.log-message.large {
  font-size: 16px;
}

.log-stacktrace {
  margin-top: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.log-stacktrace pre {
  margin: 0;
  font-size: 12px;
  color: #ffab91;
  white-space: pre-wrap;
}

.wrap-text .log-message {
  white-space: pre-wrap;
  word-break: break-all;
}

.no-results,
.no-logs {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #666;
}

.no-results i,
.no-logs i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-results p,
.no-logs p {
  margin: 4px 0;
  text-align: center;
}

.hint {
  font-size: 14px !important;
  opacity: 0.7 !important;
}

.log-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-color);
}

.pagination-info {
  font-size: 14px;
  color: var(--text-secondary);
}

.pagination-controls {
  display: flex;
  gap: 4px;
}

.page-btn {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.page-btn:hover:not(.active) {
  background: rgba(33, 150, 243, 0.1);
}

.page-btn.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.log-charts-section {
  background: var(--panel-bg, #fff);
  border-top: 1px solid var(--border-color);
  padding: 16px;
}

.charts-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.chart-card {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
}

.chart-card h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
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

/* 响应式设计 */
@media (max-width: 768px) {
  .log-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .log-actions {
    align-self: stretch;
    justify-content: flex-end;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .filters-container {
    grid-template-columns: 1fr;
  }

  .level-filters {
    flex-direction: column;
    gap: 8px;
  }

  .time-filters {
    flex-direction: column;
    align-items: stretch;
  }

  .log-toolbar {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .log-controls {
    align-self: stretch;
    justify-content: flex-end;
  }

  .log-pagination {
    flex-direction: column;
    gap: 12px;
  }

  .charts-container {
    grid-template-columns: 1fr;
  }
}
</style>
