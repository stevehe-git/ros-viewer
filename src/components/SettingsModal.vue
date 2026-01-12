<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click="handleOverlayClick">
        <div class="modal-container" @click.stop>
          <!-- 模态框头部 -->
          <div class="modal-header">
            <h3 class="modal-title">系统设置</h3>
            <button class="modal-close" @click="close">
              <i class="icon-close"></i>
            </button>
          </div>

          <!-- 模态框内容 -->
          <div class="modal-body">
            <!-- 设置选项卡 -->
            <div class="settings-tabs">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                class="tab-button"
                :class="{ 'active': activeTab === tab.id }"
                @click="activeTab = tab.id"
              >
                <i :class="tab.icon"></i>
                {{ tab.name }}
              </button>
            </div>

            <!-- 设置内容 -->
            <div class="settings-content">
              <!-- 外观设置 -->
              <div v-if="activeTab === 'appearance'" class="settings-section">
                <h4>外观设置</h4>

                <div class="setting-item">
                  <label class="setting-label">主题模式</label>
                  <div class="setting-control">
                    <select v-model="localSettings.theme" class="setting-select">
                      <option value="light">浅色主题</option>
                      <option value="dark">深色主题</option>
                      <option value="auto">自动切换</option>
                    </select>
                  </div>
                </div>

                <div class="setting-item">
                  <label class="setting-label">布局模式</label>
                  <div class="setting-control">
                    <select v-model="localSettings.layout" class="setting-select">
                      <option value="default">默认布局</option>
                      <option value="minimal">极简布局</option>
                      <option value="extended">扩展布局</option>
                    </select>
                  </div>
                </div>

                <div class="setting-item">
                  <label class="setting-label">侧边栏折叠</label>
                  <div class="setting-control">
                    <label class="toggle-switch">
                      <input
                        type="checkbox"
                        v-model="localSettings.sidebarCollapsed"
                      />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- 连接设置 -->
              <div v-if="activeTab === 'connection'" class="settings-section">
                <h4>连接设置</h4>

                <div class="setting-item">
                  <label class="setting-label">默认协议</label>
                  <div class="setting-control">
                    <select v-model="localSettings.defaultProtocol" class="setting-select">
                      <option value="ros">ROS</option>
                      <option value="mqtt">MQTT</option>
                      <option value="websocket">WebSocket</option>
                    </select>
                  </div>
                </div>

                <div class="setting-item">
                  <label class="setting-label">自动重连</label>
                  <div class="setting-control">
                    <label class="toggle-switch">
                      <input
                        type="checkbox"
                        v-model="localSettings.autoReconnect"
                      />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div class="setting-item">
                  <label class="setting-label">重连间隔 (秒)</label>
                  <div class="setting-control">
                    <input
                      type="number"
                      v-model.number="localSettings.reconnectInterval"
                      min="1"
                      max="60"
                      class="setting-input"
                    />
                  </div>
                </div>
              </div>

              <!-- 性能设置 -->
              <div v-if="activeTab === 'performance'" class="settings-section">
                <h4>性能设置</h4>

                <div class="setting-item">
                  <label class="setting-label">数据更新频率</label>
                  <div class="setting-control">
                    <select v-model="localSettings.updateFrequency" class="setting-select">
                      <option value="high">高 (60Hz)</option>
                      <option value="medium">中 (30Hz)</option>
                      <option value="low">低 (10Hz)</option>
                    </select>
                  </div>
                </div>

                <div class="setting-item">
                  <label class="setting-label">最大数据历史</label>
                  <div class="setting-control">
                    <input
                      type="number"
                      v-model.number="localSettings.maxDataHistory"
                      min="100"
                      max="10000"
                      step="100"
                      class="setting-input"
                    />
                  </div>
                </div>

                <div class="setting-item">
                  <label class="setting-label">启用性能监控</label>
                  <div class="setting-control">
                    <label class="toggle-switch">
                      <input
                        type="checkbox"
                        v-model="localSettings.enablePerformanceMonitoring"
                      />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- 数据设置 -->
              <div v-if="activeTab === 'data'" class="settings-section">
                <h4>数据设置</h4>

                <div class="setting-item">
                  <label class="setting-label">自动保存数据</label>
                  <div class="setting-control">
                    <label class="toggle-switch">
                      <input
                        type="checkbox"
                        v-model="localSettings.autoSaveData"
                      />
                      <span class="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div class="setting-item">
                  <label class="setting-label">数据导出格式</label>
                  <div class="setting-control">
                    <select v-model="localSettings.exportFormat" class="setting-select">
                      <option value="json">JSON</option>
                      <option value="csv">CSV</option>
                      <option value="protobuf">Protocol Buffers</option>
                    </select>
                  </div>
                </div>

                <div class="setting-actions">
                  <button @click="exportData" class="btn btn-outline">
                    <i class="icon-export"></i>
                    导出数据
                  </button>

                  <button @click="importData" class="btn btn-outline">
                    <i class="icon-import"></i>
                    导入数据
                  </button>

                  <button @click="clearData" class="btn btn-danger">
                    <i class="icon-clear"></i>
                    清空数据
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 模态框底部 -->
          <div class="modal-footer">
            <button @click="resetSettings" class="btn btn-secondary">
              重置为默认
            </button>

            <div class="footer-actions">
              <button @click="close" class="btn btn-outline">
                取消
              </button>

              <button @click="saveSettings" class="btn btn-primary">
                保存设置
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useUIStore } from '../stores/ui'
import { useRobotStore } from '../stores/robot'

// Props
interface Props {
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false
})

// Emits
const emit = defineEmits<{
  close: []
}>()

// Store
const uiStore = useUIStore()
const robotStore = useRobotStore()

// 状态
const activeTab = ref('appearance')

const tabs = [
  { id: 'appearance', name: '外观', icon: 'icon-appearance' },
  { id: 'connection', name: '连接', icon: 'icon-connection' },
  { id: 'performance', name: '性能', icon: 'icon-performance' },
  { id: 'data', name: '数据', icon: 'icon-data' }
]

// 本地设置状态
const localSettings = reactive({
  // 外观
  theme: uiStore.uiState.theme,
  layout: uiStore.uiState.layout,
  sidebarCollapsed: uiStore.uiState.sidebarCollapsed,

  // 连接
  defaultProtocol: 'ros',
  autoReconnect: true,
  reconnectInterval: 5,

  // 性能
  updateFrequency: 'medium',
  maxDataHistory: 1000,
  enablePerformanceMonitoring: true,

  // 数据
  autoSaveData: false,
  exportFormat: 'json'
})

// 监听设置变化
watch(() => uiStore.uiState.theme, (newTheme) => {
  localSettings.theme = newTheme
})

watch(() => uiStore.uiState.layout, (newLayout) => {
  localSettings.layout = newLayout
})

watch(() => uiStore.uiState.sidebarCollapsed, (collapsed) => {
  localSettings.sidebarCollapsed = collapsed
})

// 计算属性
const visible = computed(() => props.visible)

// 方法
function handleOverlayClick() {
  close()
}

function close() {
  emit('close')
}

function saveSettings() {
  // 保存UI设置
  uiStore.setTheme(localSettings.theme)
  uiStore.uiState.layout = localSettings.layout
  uiStore.uiState.sidebarCollapsed = localSettings.sidebarCollapsed

  // 保存其他设置到本地存储
  const settings = {
    ...localSettings,
    timestamp: Date.now()
  }
  localStorage.setItem('robot-viewer-settings', JSON.stringify(settings))

  uiStore.addNotification({
    type: 'success',
    title: '设置已保存',
    message: '系统设置已成功保存'
  })

  close()
}

function resetSettings() {
  // 重置为默认值
  Object.assign(localSettings, {
    theme: 'light',
    layout: 'default',
    sidebarCollapsed: false,
    defaultProtocol: 'ros',
    autoReconnect: true,
    reconnectInterval: 5,
    updateFrequency: 'medium',
    maxDataHistory: 1000,
    enablePerformanceMonitoring: true,
    autoSaveData: false,
    exportFormat: 'json'
  })

  uiStore.addNotification({
    type: 'info',
    title: '设置已重置',
    message: '已重置为默认设置'
  })
}

function exportData() {
  try {
    const data = robotStore.exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `robot-data-${new Date().toISOString().slice(0, 19)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    uiStore.addNotification({
      type: 'success',
      title: '数据导出成功',
      message: '机器人数据已导出到文件'
    })
  } catch (error) {
    console.error('Export failed:', error)
    uiStore.addNotification({
      type: 'error',
      title: '导出失败',
      message: '数据导出过程中发生错误'
    })
  }
}

function importData() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)
          robotStore.importData(data)

          uiStore.addNotification({
            type: 'success',
            title: '数据导入成功',
            message: '机器人数据已从文件导入'
          })
        } catch (error) {
          console.error('Import failed:', error)
          uiStore.addNotification({
            type: 'error',
            title: '导入失败',
            message: '数据文件格式不正确'
          })
        }
      }
      reader.readAsText(file)
    }
  }
  input.click()
}

function clearData() {
  if (confirm('确定要清空所有数据吗？此操作不可撤销。')) {
    robotStore.clearAllData()
    robotStore.clearDataPackets()

    uiStore.addNotification({
      type: 'warning',
      title: '数据已清空',
      message: '所有机器人数据已被清空'
    })
  }
}

// 初始化时加载保存的设置
function loadSavedSettings() {
  try {
    const saved = localStorage.getItem('robot-viewer-settings')
    if (saved) {
      const settings = JSON.parse(saved)
      Object.assign(localSettings, settings)
    }
  } catch (error) {
    console.warn('Failed to load saved settings:', error)
  }
}

loadSavedSettings()
</script>

<style scoped>
/* 模态框基础样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.modal-container {
  background: var(--bg-color, #fff);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 90vw;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: var(--hover-bg, rgba(0, 0, 0, 0.1));
  color: var(--text-color);
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  background: var(--item-bg, #f8f9fa);
}

/* 设置选项卡 */
.settings-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border-color);
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.tab-button:hover {
  color: var(--text-color);
  background: var(--hover-bg, rgba(0, 0, 0, 0.05));
}

.tab-button.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.tab-button i {
  font-size: 16px;
}

.icon-appearance::before { content: "🎨"; }
.icon-connection::before { content: "🔗"; }
.icon-performance::before { content: "⚡"; }
.icon-data::before { content: "💾"; }

/* 设置内容 */
.settings-content {
  min-height: 300px;
}

.settings-section {
  margin-bottom: 24px;
}

.settings-section h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--primary-color);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 8px 0;
}

.setting-label {
  font-size: 14px;
  color: var(--text-color);
  font-weight: 500;
  flex: 1;
}

.setting-control {
  flex: 1;
  max-width: 200px;
}

.setting-select,
.setting-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--input-bg, #fff);
  color: var(--text-color);
  font-size: 14px;
}

.setting-select:focus,
.setting-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

/* 切换开关 */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #ccc;
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background: var(--primary-color);
}

input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

/* 设置操作按钮 */
.setting-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.footer-actions {
  display: flex;
  gap: 8px;
}

/* 模态框过渡动画 */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(-20px);
}

/* 深色主题支持 */
[data-theme="dark"] {
  --bg-color: #2d2d2d;
  --item-bg: #373737;
  --input-bg: #404040;
  --hover-bg: rgba(255, 255, 255, 0.1);
}

/* 响应式设计 */
@media (max-width: 640px) {
  .modal-container {
    width: 95vw;
    max-height: 90vh;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 16px;
  }

  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .setting-control {
    max-width: none;
    width: 100%;
  }

  .settings-tabs {
    flex-wrap: wrap;
  }

  .tab-button {
    flex: 1;
    justify-content: center;
    min-width: 80px;
  }

  .modal-footer {
    flex-direction: column;
    gap: 12px;
  }

  .footer-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
