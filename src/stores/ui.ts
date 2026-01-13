import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import type { UIState } from '../types/data'

/**
 * UI 状态管理 Store
 * 管理界面相关的状态和配置
 */
export const useUIStore = defineStore('ui', () => {
  // UI 状态
  const uiState = reactive<UIState>({
    theme: 'light',
    layout: 'default',
    sidebarCollapsed: false,
    fullscreenMode: false,
    activeView: 'dashboard',
    layers: {
      map: true,
      robot: true,
      path: true,
      laser: true,
      goal: true,
      grid: true,
      sensors: false,
      obstacles: true
    }
  })

  // 视图导航
  const navigationHistory = ref<string[]>(['dashboard'])
  const currentViewIndex = ref(0)

  // 面板状态
  const panels = ref<Map<string, boolean>>(new Map([
    ['control-panel', true],
    ['map-panel', true],
    ['status-panel', true],
    ['sensor-panel', false],
    ['task-panel', false],
    ['log-panel', false]
  ]))

  // 模态框状态
  const modals = ref<Map<string, boolean>>(new Map([
    ['settings', false],
    ['connection', false],
    ['about', false],
    ['export', false]
  ]))

  // 通知消息
  const notifications = ref<Array<{
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    title: string
    message: string
    timestamp: number
    duration?: number
  }>>([])

  // 动作方法
  function setTheme(theme: 'light' | 'dark' | 'auto') {
    uiState.theme = theme
    updateTheme()
  }

function setLayout(layout: string) {
  uiState.layout = layout as 'default' | 'minimal' | 'extended'
}

  function toggleSidebar() {
    uiState.sidebarCollapsed = !uiState.sidebarCollapsed
  }

  function toggleFullscreen() {
    uiState.fullscreenMode = !uiState.fullscreenMode
    if (uiState.fullscreenMode) {
      document.documentElement.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }

function setActiveView(view: string) {
  uiState.activeView = view

  // 添加到导航历史
  const lastView = navigationHistory.value[navigationHistory.value.length - 1]
  if (lastView !== view) {
    navigationHistory.value.push(view)
    currentViewIndex.value = navigationHistory.value.length - 1
  }
}

function navigateBack() {
  if (currentViewIndex.value > 0) {
    currentViewIndex.value--
    uiState.activeView = navigationHistory.value[currentViewIndex.value] || 'dashboard'
  }
}

function navigateForward() {
  if (currentViewIndex.value < navigationHistory.value.length - 1) {
    currentViewIndex.value++
    uiState.activeView = navigationHistory.value[currentViewIndex.value] || 'dashboard'
  }
}

  function toggleLayer(layerName: keyof typeof uiState.layers) {
    uiState.layers[layerName] = !uiState.layers[layerName]
  }

  function setLayerVisibility(layerName: keyof typeof uiState.layers, visible: boolean) {
    uiState.layers[layerName] = visible
  }

  function togglePanel(panelId: string) {
    const current = panels.value.get(panelId) ?? false
    panels.value.set(panelId, !current)
  }

  function setPanelVisibility(panelId: string, visible: boolean) {
    panels.value.set(panelId, visible)
  }

  function showPanel(panelId: string) {
    panels.value.set(panelId, true)
  }

  function hidePanel(panelId: string) {
    panels.value.set(panelId, false)
  }

  function showModal(modalId: string) {
    modals.value.set(modalId, true)
  }

  function hideModal(modalId: string) {
    modals.value.set(modalId, false)
  }

  function toggleModal(modalId: string) {
    const current = modals.value.get(modalId) ?? false
    modals.value.set(modalId, !current)
  }

  function addNotification(notification: Omit<typeof notifications.value[0], 'id' | 'timestamp'>) {
    const id = Math.random().toString(36).substr(2, 9)
    const fullNotification = {
      ...notification,
      id,
      timestamp: Date.now()
    }

    notifications.value.push(fullNotification)

    // 自动移除通知
    if (fullNotification.duration !== 0) {
      setTimeout(() => {
        removeNotification(id)
      }, fullNotification.duration || 5000)
    }

    return id
  }

  function removeNotification(id: string) {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  function clearNotifications() {
    notifications.value = []
  }

  // 私有方法
  function updateTheme() {
    document.documentElement.setAttribute('data-theme', uiState.theme)

    // 在自动主题模式下监听系统主题变化
    if (uiState.theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
      }

      mediaQuery.addEventListener('change', handleChange)

      // 立即应用当前系统主题
      document.documentElement.setAttribute('data-theme', mediaQuery.matches ? 'dark' : 'light')
    }
  }

  // 初始化
  function initialize() {
    updateTheme()
  }

  // 调用初始化
  initialize()

  return {
    // 状态
    uiState,
    navigationHistory,
    currentViewIndex,
    panels,
    modals,
    notifications,

    // 方法
    setTheme,
    setLayout,
    toggleSidebar,
    toggleFullscreen,
    setActiveView,
    navigateBack,
    navigateForward,
    toggleLayer,
    setLayerVisibility,
    togglePanel,
    setPanelVisibility,
    showPanel,
    hidePanel,
    showModal,
    hideModal,
    toggleModal,
    addNotification,
    removeNotification,
    clearNotifications,
    initialize
  }
})
