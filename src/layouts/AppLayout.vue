<template>
  <div class="app-layout">
    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ 'collapsed': uiStore.uiState.sidebarCollapsed }">
      <div class="sidebar-header">
        <div class="logo">
          <i class="icon-robot"></i>
          <span v-if="!uiStore.uiState.sidebarCollapsed" class="logo-text">机器人平台</span>
        </div>
        <button
          class="sidebar-toggle"
          @click="uiStore.toggleSidebar()"
          :title="uiStore.uiState.sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'"
        >
          <i :class="uiStore.uiState.sidebarCollapsed ? 'icon-chevron-right' : 'icon-chevron-left'"></i>
        </button>
      </div>

      <!-- 导航菜单 -->
      <nav class="sidebar-nav">
        <router-link
          v-for="route in navigationRoutes"
          :key="route.name"
          :to="route.path"
          class="nav-item"
          active-class="active"
        >
          <i :class="`icon-${route.meta?.icon || 'default'}`"></i>
          <span v-if="!uiStore.uiState.sidebarCollapsed" class="nav-text">
            {{ route.meta?.title || route.name }}
          </span>
        </router-link>
      </nav>

      <!-- 底部操作区 -->
      <div class="sidebar-footer">
        <button
          class="footer-btn"
          @click="uiStore.toggleFullscreen()"
          :title="uiStore.uiState.fullscreenMode ? '退出全屏' : '全屏'"
        >
          <i :class="uiStore.uiState.fullscreenMode ? 'icon-minimize' : 'icon-maximize'"></i>
        </button>

        <button
          class="footer-btn"
          @click="uiStore.showModal('settings')"
          title="设置"
        >
          <i class="icon-settings"></i>
        </button>
      </div>
    </aside>

    <!-- 主内容区域 -->
    <main class="main-content">
      <!-- 顶部工具栏 -->
      <header class="top-toolbar">
        <div class="toolbar-left">
          <h1 class="page-title">
            {{ currentRoute?.meta?.title || '机器人可视化平台' }}
          </h1>
        </div>

        <div class="toolbar-center">
          <!-- 面包屑导航 -->
          <nav class="breadcrumb" v-if="breadcrumb.length > 1">
            <span
              v-for="(crumb, index) in breadcrumb"
              :key="crumb.path"
              class="breadcrumb-item"
              :class="{ 'active': index === breadcrumb.length - 1 }"
            >
              {{ crumb.title }}
              <i v-if="index < breadcrumb.length - 1" class="breadcrumb-separator">></i>
            </span>
          </nav>
        </div>

        <div class="toolbar-right">
          <!-- 系统状态指示器 -->
          <div class="status-indicators">
            <div
              class="status-indicator"
              :class="robotStore.systemStatus"
              :title="`系统状态: ${getStatusText(robotStore.systemStatus)}`"
            >
              <i class="status-icon"></i>
            </div>

            <div
              class="status-indicator"
              :class="robotStore.dataFreshness"
              :title="`数据新鲜度: ${getFreshnessText(robotStore.dataFreshness)}`"
            >
              <i class="status-icon"></i>
            </div>

            <div class="status-indicator connection" :class="{ 'connected': hasActiveConnections }">
              <i class="status-icon"></i>
            </div>
          </div>

          <!-- 主题切换 -->
          <div class="theme-selector">
            <button
              v-for="theme in ['light', 'dark', 'auto']"
              :key="theme"
              @click="uiStore.setTheme(theme as any)"
              :class="{ 'active': uiStore.uiState.theme === theme }"
              :title="`切换到${getThemeText(theme)}主题`"
            >
              <i :class="`icon-theme-${theme}`"></i>
            </button>
          </div>
        </div>
      </header>

      <!-- 页面内容 -->
      <div class="page-content">
        <slot />
      </div>
    </main>

    <!-- 右侧面板区域 -->
    <aside class="right-panels" v-if="!uiStore.uiState.sidebarCollapsed">
      <!-- 状态面板 -->
      <div class="panel status-panel" v-if="uiStore.panels.get('status-panel')">
        <div class="panel-header">
          <h3>系统状态</h3>
          <button @click="uiStore.togglePanel('status-panel')" class="panel-close">
            <i class="icon-close"></i>
          </button>
        </div>
        <div class="panel-content">
          <StatusPanel />
        </div>
      </div>

      <!-- 控制面板 -->
      <div class="panel control-panel" v-if="uiStore.panels.get('control-panel')">
        <div class="panel-header">
          <h3>控制面板</h3>
          <button @click="uiStore.togglePanel('control-panel')" class="panel-close">
            <i class="icon-close"></i>
          </button>
        </div>
        <div class="panel-content">
          <ControlPanel />
        </div>
      </div>

      <!-- 传感器面板 -->
      <div class="panel sensor-panel" v-if="uiStore.panels.get('sensor-panel')">
        <div class="panel-header">
          <h3>传感器数据</h3>
          <button @click="uiStore.togglePanel('sensor-panel')" class="panel-close">
            <i class="icon-close"></i>
          </button>
        </div>
        <div class="panel-content">
          <SensorPanel />
        </div>
      </div>
    </aside>

    <!-- 设置模态框 -->
    <SettingsModal
      v-if="uiStore.modals.get('settings')"
      @close="uiStore.hideModal('settings')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUIStore } from '../stores/ui'
import { useRobotStore } from '../stores/robot'
import { protocolManager } from '../core/protocols/ProtocolManager'
import StatusPanel from '../components/StatusPanel.vue'
import ControlPanel from '../components/ControlPanel.vue'
import SensorPanel from '../components/SensorPanel.vue'
import SettingsModal from '../components/SettingsModal.vue'

// 路由和状态管理
const route = useRoute()
const router = useRouter()
const uiStore = useUIStore()
const robotStore = useRobotStore()

// 计算属性
const currentRoute = computed(() => route)

const navigationRoutes = computed(() => {
  return router.getRoutes().filter(route =>
    route.meta && !route.path.includes('*')
  )
})

const breadcrumb = computed(() => {
  const crumbs = []
  const current = route.matched[route.matched.length - 1]
  if (current) {
    crumbs.push({
      title: current.meta?.title || current.name || '首页',
      path: current.path
    })
  }
  return crumbs
})

const hasActiveConnections = computed(() => {
  return protocolManager.getAllActiveProtocols().size > 0
})

// 方法
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'idle': '空闲',
    'normal': '正常',
    'warning': '警告',
    'error': '错误'
  }
  return statusMap[status] || status
}

function getFreshnessText(freshness: string): string {
  const freshnessMap: Record<string, string> = {
    'fresh': '新鲜',
    'normal': '正常',
    'stale': '过期'
  }
  return freshnessMap[freshness] || freshness
}

function getThemeText(theme: string): string {
  const themeMap: Record<string, string> = {
    'light': '浅色',
    'dark': '深色',
    'auto': '自动'
  }
  return themeMap[theme] || theme
}
</script>

<style scoped>
.app-layout {
  width: 100vw;
  height: 100vh;
  display: flex;
  background: var(--bg-color);
  color: var(--text-color);
  transition: all 0.3s ease;
}

/* 侧边栏 */
.sidebar {
  width: 240px;
  background: var(--sidebar-bg, #2d2d2d);
  color: var(--sidebar-text, #e0e0e0);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  transition: width 0.3s ease;
  z-index: 100;
}

.sidebar.collapsed {
  width: 60px;
}

.sidebar-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 600;
}

.logo-text {
  transition: opacity 0.3s ease;
}

.sidebar.collapsed .logo-text {
  opacity: 0;
  pointer-events: none;
}

.sidebar-toggle {
  background: none;
  border: none;
  color: var(--sidebar-text);
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.sidebar-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* 导航菜单 */
.sidebar-nav {
  flex: 1;
  padding: 16px 0;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  color: var(--sidebar-text);
  text-decoration: none;
  transition: all 0.2s ease;
  border: none;
  background: none;
  width: 100%;
  cursor: pointer;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.nav-item.active {
  background: var(--primary-color);
  color: white;
}

.nav-item i {
  font-size: 18px;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.nav-text {
  transition: opacity 0.3s ease;
}

.sidebar.collapsed .nav-text {
  opacity: 0;
  pointer-events: none;
}

/* 侧边栏底部 */
.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 8px;
}

.footer-btn {
  flex: 1;
  height: 36px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: var(--sidebar-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.footer-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 主内容区域 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0; /* 防止 flex 子项溢出 */
}

/* 顶部工具栏 */
.top-toolbar {
  height: 50px;
  background: var(--toolbar-bg, #fff);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 2px 4px var(--shadow-color);
  flex-shrink: 0;
}

.toolbar-left {
  flex: 1;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}

.toolbar-center {
  flex: 2;
  display: flex;
  justify-content: center;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.breadcrumb-item {
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.breadcrumb-item.active {
  background: var(--primary-color);
  color: white;
}

.breadcrumb-separator {
  margin: 0 4px;
  color: var(--text-secondary);
}

.toolbar-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 16px;
}

/* 状态指示器 */
.status-indicators {
  display: flex;
  gap: 8px;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  position: relative;
}

.status-indicator::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.3;
  animation: pulse 2s infinite;
}

.status-indicator.idle {
  color: #757575;
}

.status-indicator.normal {
  color: #4CAF50;
}

.status-indicator.warning {
  color: #FF9800;
}

.status-indicator.error {
  color: #f44336;
}

.status-indicator.fresh {
  color: #4CAF50;
}

.status-indicator.stale {
  color: #f44336;
}

.status-indicator.connection:not(.connected) {
  color: #f44336;
}

.status-indicator.connection.connected {
  color: #4CAF50;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

/* 主题选择器 */
.theme-selector {
  display: flex;
  gap: 4px;
}

.theme-selector button {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.theme-selector button:hover {
  background: var(--hover-bg, rgba(0, 0, 0, 0.1));
}

.theme-selector button.active {
  background: var(--primary-color);
  color: white;
}

/* 页面内容 */
.page-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* 右侧面板 */
.right-panels {
  width: 300px;
  background: var(--bg-color);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.panel {
  margin: 16px;
  background: var(--panel-bg, #fff);
  border-radius: 8px;
  box-shadow: 0 2px 8px var(--shadow-color);
  overflow: hidden;
}

.panel:first-child {
  margin-top: 0;
}

.panel:last-child {
  margin-bottom: 0;
}

.panel-header {
  padding: 16px;
  background: var(--header-bg, #f8f9fa);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.panel-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.panel-close:hover {
  background: var(--hover-bg, rgba(0, 0, 0, 0.1));
  color: var(--text-color);
}

.panel-content {
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}

/* 图标样式 */
.icon-robot::before { content: "🤖"; }
.icon-chevron-left::before { content: "◀"; }
.icon-chevron-right::before { content: "▶"; }
.icon-minimize::before { content: "⛶"; }
.icon-maximize::before { content: "⛶"; }
.icon-settings::before { content: "⚙"; }
.icon-close::before { content: "×"; }
.icon-theme-light::before { content: "☀"; }
.icon-theme-dark::before { content: "☾"; }
.icon-theme-auto::before { content: "◐"; }

/* 响应式设计 */
@media (max-width: 1200px) {
  .sidebar {
    width: 200px;
  }

  .sidebar.collapsed {
    width: 50px;
  }

  .right-panels {
    width: 250px;
  }
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 1000;
    transform: translateX(-100%);
  }

  .sidebar:not(.collapsed) {
    transform: translateX(0);
  }

  .main-content {
    width: 100vw;
  }

  .right-panels {
    display: none;
  }

  .toolbar-center {
    display: none;
  }
}

/* 深色主题支持 */
[data-theme="dark"] {
  --sidebar-bg: #1a1a1a;
  --sidebar-text: #e0e0e0;
  --toolbar-bg: #2d2d2d;
  --panel-bg: #2d2d2d;
  --header-bg: #373737;
  --hover-bg: rgba(255, 255, 255, 0.1);
}
</style>
