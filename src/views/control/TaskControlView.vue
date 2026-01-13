<template>
  <div class="task-control-view">
    <!-- 任务控制区域 -->
    <div class="task-container">
      <div class="task-header">
        <h2>任务控制</h2>
        <div class="task-status">
          <div class="status-indicator" :class="taskStatus">
            <i class="status-icon"></i>
            {{ getStatusText(taskStatus) }}
          </div>
        </div>
      </div>

      <!-- 任务列表区域 -->
      <div class="task-list-section">
        <div class="section-header">
          <h3>任务队列</h3>
          <button class="action-btn primary" @click="createNewTask">
            <i class="icon-plus"></i>
            新建任务
          </button>
        </div>

        <div class="task-list" v-if="tasks.length > 0">
          <div
            v-for="task in tasks"
            :key="task.id"
            class="task-item"
            :class="{ active: task.id === currentTaskId }"
          >
            <div class="task-info">
              <div class="task-name">{{ task.name }}</div>
              <div class="task-description">{{ task.description }}</div>
              <div class="task-meta">
                <span class="task-type">{{ getTaskTypeText(task.type) }}</span>
                <span class="task-priority" :class="task.priority">{{ getPriorityText(task.priority) }}</span>
                <span class="task-status" :class="task.status">{{ getTaskStatusText(task.status) }}</span>
              </div>
            </div>

            <div class="task-actions">
              <button
                class="action-btn small"
                @click="editTask(task)"
                :disabled="task.status === 'running'"
              >
                编辑
              </button>
              <button
                class="action-btn small primary"
                @click="startTask(task)"
                :disabled="task.status !== 'pending'"
              >
                开始
              </button>
              <button
                class="action-btn small danger"
                @click="stopTask(task)"
                :disabled="task.status !== 'running'"
              >
                停止
              </button>
              <button
                class="action-btn small secondary"
                @click="deleteTask(task)"
                :disabled="task.status === 'running'"
              >
                删除
              </button>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <i class="icon-task"></i>
          <p>暂无任务</p>
          <p class="hint">点击"新建任务"开始创建机器人任务</p>
        </div>
      </div>

      <!-- 任务执行监控 -->
      <div class="task-monitor-section" v-if="currentTask">
        <div class="section-header">
          <h3>任务执行监控</h3>
        </div>

        <div class="monitor-content">
          <div class="monitor-item">
            <span class="label">当前任务:</span>
            <span class="value">{{ currentTask.name }}</span>
          </div>
          <div class="monitor-item">
            <span class="label">执行进度:</span>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: currentTask.progress + '%' }"></div>
              <span class="progress-text">{{ currentTask.progress }}%</span>
            </div>
          </div>
          <div class="monitor-item">
            <span class="label">执行时间:</span>
            <span class="value">{{ formatDuration(currentTask.elapsedTime) }}</span>
          </div>
          <div class="monitor-item">
            <span class="label">剩余时间:</span>
            <span class="value">{{ formatDuration(currentTask.remainingTime) }}</span>
          </div>

          <div class="current-step" v-if="currentTask.currentStep">
            <h4>当前步骤</h4>
            <p>{{ currentTask.currentStep.description }}</p>
            <div class="step-progress">
              <span>步骤 {{ currentTask.currentStep.index + 1 }} / {{ currentTask.totalSteps }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 任务配置面板 -->
      <div class="task-config-section">
        <div class="section-header">
          <h3>任务配置</h3>
        </div>

        <div class="config-content">
          <div class="config-group">
            <h4>基本设置</h4>
            <div class="config-item">
              <label>任务名称:</label>
              <input type="text" v-model="newTask.name" placeholder="输入任务名称" />
            </div>
            <div class="config-item">
              <label>任务描述:</label>
              <textarea v-model="newTask.description" placeholder="输入任务描述"></textarea>
            </div>
            <div class="config-item">
              <label>任务类型:</label>
              <select v-model="newTask.type">
                <option value="navigation">导航任务</option>
                <option value="inspection">巡检任务</option>
                <option value="delivery">配送任务</option>
                <option value="custom">自定义任务</option>
              </select>
            </div>
            <div class="config-item">
              <label>优先级:</label>
              <select v-model="newTask.priority">
                <option value="low">低</option>
                <option value="normal">普通</option>
                <option value="high">高</option>
                <option value="urgent">紧急</option>
              </select>
            </div>
          </div>

          <div class="config-group" v-if="newTask.type === 'navigation'">
            <h4>导航参数</h4>
            <div class="config-item">
              <label>目标位置 X:</label>
              <input type="number" v-model.number="newTask.params.targetX" step="0.1" />
            </div>
            <div class="config-item">
              <label>目标位置 Y:</label>
              <input type="number" v-model.number="newTask.params.targetY" step="0.1" />
            </div>
            <div class="config-item">
              <label>目标朝向:</label>
              <input type="number" v-model.number="newTask.params.targetYaw" step="0.1" />
            </div>
          </div>

          <div class="config-actions">
            <button class="action-btn primary" @click="saveTask" :disabled="!canSaveTask">
              保存任务
            </button>
            <button class="action-btn secondary" @click="clearTaskForm">
              清空
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'

// 类型定义
interface Task {
  id: string
  name: string
  description: string
  type: 'navigation' | 'inspection' | 'delivery' | 'custom'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused'
  progress: number
  elapsedTime: number
  remainingTime: number
  currentStep?: {
    index: number
    description: string
  }
  totalSteps: number
  createdAt: Date
  params: Record<string, any>
}

interface NewTask {
  name: string
  description: string
  type: 'navigation' | 'inspection' | 'delivery' | 'custom'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  params: {
    targetX?: number
    targetY?: number
    targetYaw?: number
  }
}

// 响应式数据
const taskStatus = ref('idle') // idle, running, paused, completed
const currentTaskId = ref<string | null>(null)
const tasks = ref<Task[]>([])

const newTask = reactive<NewTask>({
  name: '',
  description: '',
  type: 'navigation',
  priority: 'normal',
  params: {}
})

// 计算属性
const currentTask = computed(() => {
  return tasks.value.find(task => task.id === currentTaskId.value) || null
})

const canSaveTask = computed(() => {
  return newTask.name.trim() && newTask.description.trim()
})

// 方法
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'idle': '空闲',
    'running': '运行中',
    'paused': '暂停',
    'completed': '完成'
  }
  return statusMap[status] || status
}

function getTaskTypeText(type: string): string {
  const typeMap: Record<string, string> = {
    'navigation': '导航',
    'inspection': '巡检',
    'delivery': '配送',
    'custom': '自定义'
  }
  return typeMap[type] || type
}

function getPriorityText(priority: string): string {
  const priorityMap: Record<string, string> = {
    'low': '低',
    'normal': '普通',
    'high': '高',
    'urgent': '紧急'
  }
  return priorityMap[priority] || priority
}

function getTaskStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': '待执行',
    'running': '执行中',
    'completed': '已完成',
    'failed': '失败',
    'paused': '暂停'
  }
  return statusMap[status] || status
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function createNewTask() {
  clearTaskForm()
  // 可以在这里打开任务创建模态框或切换到配置面板
}

function editTask(task: Task) {
  Object.assign(newTask, {
    name: task.name,
    description: task.description,
    type: task.type,
    priority: task.priority,
    params: { ...task.params }
  })
}

function startTask(task: Task) {
  if (currentTaskId.value) {
    // 停止当前任务
    stopTask(tasks.value.find(t => t.id === currentTaskId.value)!)
  }

  task.status = 'running'
  currentTaskId.value = task.id
  taskStatus.value = 'running'

  // 模拟任务执行
  simulateTaskExecution(task)
}

function stopTask(task: Task) {
  task.status = 'paused'
  if (currentTaskId.value === task.id) {
    currentTaskId.value = null
    taskStatus.value = 'idle'
  }
}

function deleteTask(task: Task) {
  const index = tasks.value.findIndex(t => t.id === task.id)
  if (index > -1) {
    tasks.value.splice(index, 1)
  }
}

function saveTask() {
  if (!canSaveTask.value) return

  const task: Task = {
    id: Date.now().toString(),
    name: newTask.name,
    description: newTask.description,
    type: newTask.type,
    priority: newTask.priority,
    status: 'pending',
    progress: 0,
    elapsedTime: 0,
    remainingTime: 0,
    totalSteps: 3, // 模拟步骤数
    createdAt: new Date(),
    params: { ...newTask.params }
  }

  tasks.value.push(task)
  clearTaskForm()
}

function clearTaskForm() {
  Object.assign(newTask, {
    name: '',
    description: '',
    type: 'navigation',
    priority: 'normal',
    params: {}
  })
}

function simulateTaskExecution(task: Task) {
  let elapsed = 0
  const totalDuration = 30 // 30秒
  const steps = ['初始化任务', '执行导航', '完成任务']

  const interval = setInterval(() => {
    elapsed++
    task.elapsedTime = elapsed
    task.remainingTime = Math.max(0, totalDuration - elapsed)
    task.progress = Math.min(100, (elapsed / totalDuration) * 100)

    // 更新当前步骤
    const stepIndex = Math.floor((elapsed / totalDuration) * steps.length)
    if (stepIndex < steps.length) {
      task.currentStep = {
        index: stepIndex,
        description: steps[stepIndex]
      }
    }

    if (elapsed >= totalDuration) {
      task.status = 'completed'
      task.progress = 100
      currentTaskId.value = null
      taskStatus.value = 'completed'
      clearInterval(interval)
    }
  }, 1000)
}

// 生命周期钩子
onMounted(() => {
  // 初始化一些示例任务
  tasks.value = [
    {
      id: '1',
      name: '导航到厨房',
      description: '从客厅导航到厨房位置',
      type: 'navigation',
      priority: 'normal',
      status: 'pending',
      progress: 0,
      elapsedTime: 0,
      remainingTime: 0,
      totalSteps: 3,
      createdAt: new Date(),
      params: { targetX: 5.0, targetY: 2.0, targetYaw: 0.0 }
    },
    {
      id: '2',
      name: '房间巡检',
      description: '对所有房间进行巡检',
      type: 'inspection',
      priority: 'high',
      status: 'pending',
      progress: 0,
      elapsedTime: 0,
      remainingTime: 0,
      totalSteps: 5,
      createdAt: new Date(),
      params: {}
    }
  ]
})
</script>

<style scoped>
.task-control-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
}

.task-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--panel-bg, #fff);
  border-bottom: 1px solid var(--border-color);
}

.task-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}

.task-status {
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

.status-indicator.running {
  background: #d1ecf1;
  color: #0c5460;
}

.status-indicator.paused {
  background: #fff3cd;
  color: #856404;
}

.status-indicator.completed {
  background: #d4edda;
  color: #155724;
}

.task-list-section,
.task-monitor-section,
.task-config-section {
  background: var(--panel-bg, #fff);
  border-bottom: 1px solid var(--border-color);
  overflow: hidden;
}

.task-list-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.task-monitor-section {
  max-height: 200px;
}

.task-config-section {
  max-height: 400px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.task-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  transition: all 0.2s;
}

.task-item:hover {
  border-color: var(--primary-color);
}

.task-item.active {
  border-color: var(--primary-color);
  background: rgba(33, 150, 243, 0.05);
}

.task-info {
  flex: 1;
  margin-right: 16px;
}

.task-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 4px;
}

.task-description {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.task-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.task-type {
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 6px;
  border-radius: 4px;
}

.task-priority.low {
  background: #e8f5e8;
  color: #2e7d32;
}

.task-priority.normal {
  background: #fff3e0;
  color: #ef6c00;
}

.task-priority.high {
  background: #fff3cd;
  color: #856404;
}

.task-priority.urgent {
  background: #f8d7da;
  color: #721c24;
}

.task-status.pending {
  background: #e0e0e0;
  color: #666;
}

.task-status.running {
  background: #d1ecf1;
  color: #0c5460;
}

.task-status.completed {
  background: #d4edda;
  color: #155724;
}

.task-status.failed {
  background: #f8d7da;
  color: #721c24;
}

.task-status.paused {
  background: #fff3cd;
  color: #856404;
}

.task-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn:not(:disabled):hover {
  opacity: 0.9;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.small {
  padding: 6px 12px;
  font-size: 12px;
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

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  padding: 40px;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 4px 0;
  text-align: center;
}

.hint {
  font-size: 14px !important;
  opacity: 0.7 !important;
}

.monitor-content {
  padding: 16px;
}

.monitor-item {
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.monitor-item .label {
  color: var(--text-secondary);
}

.monitor-item .value {
  color: var(--text-color);
  font-weight: 500;
}

.progress-bar {
  flex: 1;
  max-width: 200px;
  height: 20px;
  background: #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
  margin: 0 12px;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color);
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 12px;
  font-weight: 500;
}

.current-step {
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-color);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.current-step h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.current-step p {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.step-progress {
  font-size: 12px;
  color: var(--text-secondary);
}

.config-content {
  padding: 16px;
  overflow-y: auto;
}

.config-group {
  margin-bottom: 20px;
}

.config-group h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.config-item {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.config-item label {
  font-size: 14px;
  color: var(--text-color);
  font-weight: 500;
}

.config-item input,
.config-item select,
.config-item textarea {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
}

.config-item textarea {
  resize: vertical;
  min-height: 60px;
}

.config-actions {
  display: flex;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .task-item {
    flex-direction: column;
    gap: 12px;
  }

  .task-actions {
    align-self: stretch;
    justify-content: flex-end;
  }

  .section-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .config-actions {
    flex-direction: column;
  }

  .action-btn.small {
    flex: 1;
    justify-content: center;
  }
}
</style>
