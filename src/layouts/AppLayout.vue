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
        <!-- 主导航项 -->
        <template v-for="route in mainNavigationRoutes" :key="route.name">
          <div v-if="!route.children || route.children.length === 0" class="nav-item-wrapper">
            <router-link
              :to="route.path"
              class="nav-item"
              active-class="active"
            >
              <i :class="`icon-${route.meta?.icon || 'default'}`"></i>
              <span v-if="!uiStore.uiState.sidebarCollapsed" class="nav-text">
                {{ route.meta?.title || route.name }}
              </span>
            </router-link>
          </div>

          <!-- 带子菜单的主导航项 -->
          <div v-else class="nav-group">
            <div
              class="nav-item nav-group-header"
              :class="{ expanded: expandedGroups.includes(route.name as string) }"
              @click="toggleGroup(route.name as string)"
            >
              <i :class="`icon-${route.meta?.icon || 'default'}`"></i>
              <span v-if="!uiStore.uiState.sidebarCollapsed" class="nav-text">
                {{ route.meta?.title || route.name }}
              </span>
              <i v-if="!uiStore.uiState.sidebarCollapsed" class="nav-arrow icon-chevron-down"></i>
            </div>

            <!-- 子导航项 -->
            <div
              v-if="!uiStore.uiState.sidebarCollapsed && expandedGroups.includes(route.name as string)"
              class="nav-submenu"
            >
              <router-link
                v-for="childRoute in route.children"
                :key="childRoute.name"
                :to="childRoute.path"
                class="nav-item nav-submenu-item"
                active-class="active"
              >
                <i :class="`icon-${childRoute.meta?.icon || 'default'}`"></i>
                <span class="nav-text">
                  {{ childRoute.meta?.title || childRoute.name }}
                </span>
              </router-link>
            </div>
          </div>
        </template>
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
    <aside class="right-panels" v-if="hasVisiblePanels && !uiStore.uiState.sidebarCollapsed">
      <!-- 虚拟侧边栏 - 机器人状态信息 -->
      <div class="panel robot-sidebar-panel">
        <RobotSidebar />
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
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUIStore } from '../stores/ui'
import { useRobotStore } from '../stores/robot'
import { protocolManager } from '../core/protocols/ProtocolManager'
import RobotSidebar from '../components/RobotSidebar.vue'
import SettingsModal from '../components/SettingsModal.vue'

// 路由和状态管理
const route = useRoute()
const router = useRouter()
const uiStore = useUIStore()
const robotStore = useRobotStore()

// 导航状态
const expandedGroups = ref<string[]>(['navigation', 'control', 'analysis'])

// 计算属性
const currentRoute = computed(() => route)

const mainNavigationRoutes = computed(() => {
  const routes = router.getRoutes().filter(route =>
    route.meta &&
    !route.path.includes('*') &&
    !route.path.includes('/:pathMatch') &&
    route.name !== 'dashboard' &&
    !route.path.includes('/') // 只获取顶级路由（路径不包含斜杠）
  )

  return routes.map(route => ({
    ...route,
    children: router.getRoutes().filter(childRoute =>
      childRoute.path.startsWith(route.path + '/') &&
      childRoute.path.split('/').length === route.path.split('/').length + 1
    )
  }))
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

const hasVisiblePanels = computed(() => {
  // 虚拟侧边栏始终可见（如果侧边栏没有折叠）
  return !uiStore.uiState.sidebarCollapsed
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

function toggleGroup(groupName: string): void {
  const index = expandedGroups.value.indexOf(groupName)
  if (index > -1) {
    expandedGroups.value.splice(index, 1)
  } else {
    expandedGroups.value.push(groupName)
  }
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
  position: sticky;
  top: 0;
  height: 100vh;
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

.nav-item-wrapper {
  margin-bottom: 4px;
}

.nav-group {
  margin-bottom: 8px;
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

.nav-group-header {
  position: relative;
}

.nav-group-header.expanded {
  background: rgba(255, 255, 255, 0.05);
}

.nav-arrow {
  margin-left: auto;
  transition: transform 0.2s ease;
  font-size: 12px;
}

.nav-group-header.expanded .nav-arrow {
  transform: rotate(180deg);
}

.nav-submenu {
  margin-left: 16px;
  border-left: 2px solid rgba(255, 255, 255, 0.1);
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;
  }
}

.nav-submenu-item {
  padding: 8px 16px;
  font-size: 13px;
  opacity: 0.8;
}

.nav-submenu-item:hover {
  opacity: 1;
}

.nav-submenu-item.active {
  opacity: 1;
  background: rgba(255, 255, 255, 0.15);
}

.nav-item i {
  font-size: 18px;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.nav-text {
  transition: opacity 0.3s ease;
  flex: 1;
}

.sidebar.collapsed .nav-text {
  opacity: 0;
  pointer-events: none;
}

.sidebar.collapsed .nav-submenu {
  display: none;
}

.sidebar.collapsed .nav-arrow {
  display: none;
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
  overflow: hidden;
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
  width: 280px;
  min-width: 280px;
  max-width: 320px;
  background: var(--bg-color);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
}

.panel {
  margin: 16px;
  background: var(--panel-bg, #fff);
  border-radius: 8px;
  box-shadow: 0 2px 8px var(--shadow-color);
  overflow: hidden;
}

.robot-sidebar-panel {
  margin: 0;
  height: 100%;
  box-shadow: none;
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
    min-width: 250px;
    max-width: 300px;
  }
}

@media (max-width: 768px) {
  .app-layout {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    height: auto;
    position: relative;
    transform: none;
  }

  .sidebar.collapsed {
    width: 100%;
  }

  .main-content {
    width: 100%;
    order: 2;
  }

  .right-panels {
    width: 100%;
    order: 3;
    max-height: 40vh;
    border-left: none;
    border-top: 1px solid var(--border-color);
  }

  .page-content {
    min-height: calc(100vh - 110px);
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
