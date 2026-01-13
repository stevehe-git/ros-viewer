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
        <template v-for="route in mainNavigationRoutes" :key="route.name">
          <!-- 导航组 -->
          <div class="nav-group">
            <!-- 父菜单项 -->
            <div
              class="nav-item nav-parent"
              :class="{
                'is-expanded': isGroupExpanded(route.name),
                'is-active': isParentActive(route)
              }"
              @click="toggleGroup(route.name)"
            >
              <div class="nav-item-content">
                <i :class="`icon-${route.meta?.icon || 'default'}`"></i>
                <span v-if="!uiStore.uiState.sidebarCollapsed" class="nav-text">
                  {{ route.meta?.title || route.name }}
                </span>
              </div>
              <i
                v-if="!uiStore.uiState.sidebarCollapsed && route.children && route.children.length > 0"
                class="nav-arrow"
                :class="{ 'is-expanded': isGroupExpanded(route.name) }"
              >
                ▼
              </i>
            </div>

            <!-- 子菜单项 -->
            <transition name="submenu">
              <div
                v-if="isGroupExpanded(route.name) && !uiStore.uiState.sidebarCollapsed"
                class="nav-submenu"
              >
                <router-link
                  v-for="childRoute in route.children"
                  :key="childRoute.name"
                  :to="childRoute.path"
                  class="nav-item nav-child"
                  :class="{ 'is-active': isChildActive(childRoute.path) }"
                  active-class="is-active"
                >
                  <div class="nav-item-content">
                    <i :class="`icon-${childRoute.meta?.icon || 'default'}`"></i>
                    <span class="nav-text">
                      {{ childRoute.meta?.title || childRoute.name }}
                    </span>
                  </div>
                </router-link>
              </div>
            </transition>
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
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUIStore } from '../stores/ui'
import RobotSidebar from '../components/RobotSidebar.vue'
import SettingsModal from '../components/SettingsModal.vue'

// 路由和状态管理
const route = useRoute()
const uiStore = useUIStore()

// 导航状态
const expandedGroups = ref<string[]>(['navigation', 'control', 'analysis'])

// 计算属性
const currentRoute = computed(() => route)

// 检查路由是否匹配当前路径
const isGroupExpanded = (groupName: string): boolean => {
  return expandedGroups.value.includes(groupName)
}

// 检查父菜单是否激活（当前路由是否属于该组）
const isParentActive = (parentRoute: any): boolean => {
  if (!parentRoute.children) return false
  return parentRoute.children.some((child: any) => 
    route.path === child.path || route.path.startsWith(child.path + '/')
  )
}

// 检查子菜单项是否激活
const isChildActive = (childPath: string): boolean => {
  return route.path === childPath || route.path.startsWith(childPath + '/')
}

const mainNavigationRoutes = computed(() => {
  // 直接使用路由配置中的父子关系
  const navigation = {
    name: 'navigation',
    path: '/navigation',
    meta: { title: '导航', icon: 'navigation' },
    children: [
      { name: 'navigation-rviz', path: '/navigation/rviz', meta: { title: 'RViz 可视化', icon: 'rviz' } },
      { name: 'navigation-movebase', path: '/navigation/move_base', meta: { title: 'Move Base', icon: 'movebase' } }
    ]
  }

  const control = {
    name: 'control',
    path: '/control',
    meta: { title: '控制', icon: 'control' },
    children: [
      { name: 'control-task', path: '/control/task', meta: { title: '任务控制', icon: 'task' } },
      { name: 'control-teleop', path: '/control/teleop', meta: { title: '遥控控制', icon: 'teleop' } },
      { name: 'control-simulation', path: '/control/simulation', meta: { title: '仿真控制', icon: 'simulation' } }
    ]
  }

  const analysis = {
    name: 'analysis',
    path: '/analysis',
    meta: { title: '分析', icon: 'analysis' },
    children: [
      { name: 'analysis-bag', path: '/analysis/bag', meta: { title: 'Bag 分析', icon: 'bag' } },
      { name: 'analysis-logs', path: '/analysis/logs', meta: { title: '日志分析', icon: 'logs' } }
    ]
  }

  return [navigation, control, analysis]
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

const hasVisiblePanels = computed(() => {
  // 虚拟侧边栏始终可见（如果侧边栏没有折叠）
  return !uiStore.uiState.sidebarCollapsed
})


function toggleGroup(groupName: string): void {
  const index = expandedGroups.value.indexOf(groupName)
  if (index > -1) {
    expandedGroups.value.splice(index, 1)
  } else {
    expandedGroups.value.push(groupName)
  }
}

// 自动展开包含当前路由的组
watch(() => route.path, (newPath) => {
  mainNavigationRoutes.value.forEach(route => {
    if (route.children) {
      const hasActiveChild = route.children.some((child: any) => 
        newPath === child.path || newPath.startsWith(child.path + '/')
      )
      if (hasActiveChild && !expandedGroups.value.includes(route.name)) {
        expandedGroups.value.push(route.name)
      }
    }
  })
}, { immediate: true })
</script>

<style scoped>
.app-layout {
  width: 100vw;
  height: 100vh;
  display: flex;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  transition: all 0.3s ease;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 侧边栏 - 现代化玻璃拟态设计 */
.sidebar {
  width: 280px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  color: #ffffff;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
  position: sticky;
  top: 0;
  height: 100vh;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
  border-radius: 0 20px 20px 0;
}

.sidebar.collapsed {
  width: 72px;
  border-radius: 0 12px 12px 0;
}

.sidebar-header {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  position: relative;
}

.sidebar-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  border-radius: 0 20px 0 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 1;
}

.logo i {
  font-size: 28px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.logo-text {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.sidebar.collapsed .logo-text {
  opacity: 0;
  transform: translateX(-10px);
  pointer-events: none;
  width: 0;
  overflow: hidden;
}

.sidebar-toggle {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  cursor: pointer;
  padding: 10px;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 1;
}

.sidebar-toggle:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.sidebar-toggle:active {
  transform: translateY(0);
}

/* 导航菜单 */
.sidebar-nav {
  flex: 1;
  padding: 16px 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

/* 自定义滚动条样式 */
.sidebar-nav::-webkit-scrollbar {
  width: 6px;
}

.sidebar-nav::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  transition: all 0.3s ease;
}

.sidebar-nav::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

.nav-group {
  margin-bottom: 8px;
  padding: 0 12px;
}

/* 导航项基础样式 */
.nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0;
  margin: 0;
  border: none;
  background: none;
  cursor: pointer;
  text-decoration: none;
  color: #ffffff;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  border-radius: 12px;
  overflow: hidden;
}

.nav-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  opacity: 0;
  transition: all 0.3s ease;
  border-radius: 12px;
}

.nav-item:hover::before {
  opacity: 1;
  background: rgba(255, 255, 255, 0.15);
}

.nav-item-content {
  display: flex;
  align-items: center;
  gap: 0;
  flex: 1;
  padding: 16px 20px;
  min-height: 52px;
  justify-content: flex-start;
  position: relative;
  z-index: 1;
}

/* 父菜单项 */
.nav-parent {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.nav-parent:hover {
  transform: translateX(4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
}

.nav-parent.is-active {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%);
  color: #ffffff;
  box-shadow: 0 8px 32px rgba(255, 255, 255, 0.1);
  transform: translateX(4px);
}

.nav-parent.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 60%;
  background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
  border-radius: 0 2px 2px 0;
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
}

/* 子菜单项 */
.nav-child {
  font-size: 14px;
  font-weight: 500;
  padding-left: 0;
  margin-left: 16px;
  margin-right: 16px;
  margin-bottom: 4px;
}

.nav-child .nav-item-content {
  padding: 12px 16px;
  min-height: 44px;
  border-radius: 10px;
}

.nav-child:hover {
  transform: translateX(2px);
}

.nav-child.is-active {
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 153, 204, 0.2) 100%);
  color: #ffffff;
  box-shadow: 0 4px 16px rgba(0, 212, 255, 0.15);
}

.nav-child.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 50%;
  background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
  border-radius: 0 2px 2px 0;
  box-shadow: 0 0 8px rgba(0, 212, 255, 0.4);
}

/* 下拉箭头 */
.nav-arrow {
  padding: 12px 16px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.nav-arrow.is-expanded {
  transform: rotate(180deg) scale(1.1);
  color: #ffffff;
}

.nav-parent.is-expanded .nav-arrow {
  transform: rotate(180deg) scale(1.1);
}

/* 子菜单容器 */
.nav-submenu {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  overflow: hidden;
  border-radius: 0 0 12px 12px;
  margin: 4px 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 展开/折叠动画 */
.submenu-enter-active,
.submenu-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
}

.submenu-enter-from {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}

.submenu-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}

.submenu-enter-to,
.submenu-leave-from {
  opacity: 1;
  max-height: 500px;
  transform: translateY(0);
}

/* 图标样式 */
.nav-item i {
  font-size: 16px;
  width: auto;
  min-width: 16px;
  text-align: left;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-right: 6px;
}

.nav-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity 0.3s ease;
}

/* 侧边栏折叠时的样式 */
.sidebar.collapsed .nav-text {
  opacity: 0;
  pointer-events: none;
  width: 0;
}

.sidebar.collapsed .nav-submenu {
  display: none;
}

.sidebar.collapsed .nav-arrow {
  display: none;
}

.sidebar.collapsed .nav-item-content {
  padding: 12px;
  justify-content: center;
}

/* 侧边栏底部 */
.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  gap: 12px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.footer-btn {
  flex: 1;
  height: 44px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  color: #ffffff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 16px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.footer-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.footer-btn:active {
  transform: translateY(0);
}

/* 主内容区域 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0; /* 防止 flex 子项溢出 */
  overflow: hidden;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 20px 0 0 0;
  margin: 16px 16px 16px 0;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
}

/* 顶部工具栏 */
.top-toolbar {
  height: 70px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
  border-radius: 20px 0 0 0;
  position: relative;
}

.top-toolbar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  border-radius: 20px 0 0 0;
}

.toolbar-left {
  flex: 1;
  position: relative;
  z-index: 1;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.toolbar-center {
  flex: 2;
  display: flex;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #666;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 8px 16px;
  border-radius: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.breadcrumb-item {
  padding: 6px 12px;
  border-radius: 12px;
  transition: all 0.3s ease;
  font-weight: 500;
}

.breadcrumb-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.breadcrumb-separator {
  margin: 0 8px;
  color: #999;
  font-weight: bold;
}

.toolbar-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 20px;
  position: relative;
  z-index: 1;
}



/* 页面内容 */
.page-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 0 0 20px 0;
  margin: 16px;
  margin-top: 0;
  margin-right: 0;
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.05);
}

/* 右侧面板 */
.right-panels {
  width: 320px;
  min-width: 320px;
  max-width: 380px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-left: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
  border-radius: 20px 0 0 20px;
  margin: 16px 16px 16px 0;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
  scrollbar-width: thin;
  scrollbar-color: rgba(102, 126, 234, 0.3) transparent;
}

.right-panels::-webkit-scrollbar {
  width: 6px;
}

.right-panels::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.right-panels::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.3);
  border-radius: 10px;
  transition: all 0.3s ease;
}

.right-panels::-webkit-scrollbar-thumb:hover {
  background: rgba(102, 126, 234, 0.5);
}

.panel {
  margin: 20px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.panel:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
}

.robot-sidebar-panel {
  margin: 0;
  height: 100%;
  box-shadow: none;
  background: transparent;
  border: none;
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

/* 图标样式 - 现代化设计 */
.icon-robot::before {
  content: "🤖";
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.icon-chevron-left::before {
  content: "◀";
  font-weight: bold;
}

.icon-chevron-right::before {
  content: "▶";
  font-weight: bold;
}

.icon-minimize::before {
  content: "⊡";
  font-size: 18px;
  line-height: 1;
}

.icon-maximize::before {
  content: "⊞";
  font-size: 18px;
  line-height: 1;
}

.icon-settings::before {
  content: "⚙";
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.icon-close::before {
  content: "✕";
  font-weight: bold;
  color: #f44336;
}


/* 导航图标 - 使用更现代的图标 */
.icon-navigation::before {
  content: "🧭";
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.icon-rviz::before {
  content: "📊";
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.icon-movebase::before {
  content: "🎯";
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.icon-control::before {
  content: "🎮";
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.icon-task::before {
  content: "📋";
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.icon-teleop::before {
  content: "🚀";
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.icon-simulation::before {
  content: "🖥️";
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.icon-analysis::before {
  content: "📈";
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.icon-bag::before {
  content: "📦";
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.icon-logs::before {
  content: "📝";
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.icon-default::before {
  content: "●";
  color: #667eea;
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .sidebar {
    width: 260px;
  }

  .sidebar.collapsed {
    width: 72px;
  }

  .right-panels {
    width: 280px;
    min-width: 280px;
    max-width: 320px;
  }

  .main-content {
    margin: 12px 12px 12px 0;
  }

  .right-panels {
    margin: 12px 12px 12px 0;
  }
}

@media (max-width: 1200px) {
  .sidebar {
    width: 240px;
  }

  .sidebar.collapsed {
    width: 72px;
  }

  .right-panels {
    width: 260px;
    min-width: 260px;
    max-width: 300px;
  }
}

@media (max-width: 768px) {
  .app-layout {
    flex-direction: column;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .sidebar {
    width: 100%;
    height: auto;
    position: relative;
    transform: none;
    border-radius: 0 0 20px 20px;
    margin: 0;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  }

  .sidebar.collapsed {
    width: 100%;
  }

  .main-content {
    width: 100%;
    order: 2;
    margin: 16px 16px 16px 16px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.95);
  }

  .right-panels {
    width: 100%;
    order: 3;
    max-height: 50vh;
    border-left: none;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 20px;
    margin: 0 16px 16px 16px;
    background: rgba(255, 255, 255, 0.9);
  }

  .page-content {
    min-height: calc(100vh - 200px);
    border-radius: 0 0 20px 20px;
  }

  .toolbar-center {
    display: none;
  }

  .top-toolbar {
    border-radius: 20px 20px 0 0;
    height: 60px;
    padding: 0 20px;
  }

  .page-title {
    font-size: 20px;
  }
}


/* 现代化动画增强 */
.nav-item {
  animation: fadeInUp 0.5s ease-out;
  animation-fill-mode: both;
}

.nav-item:nth-child(1) { animation-delay: 0.1s; }
.nav-item:nth-child(2) { animation-delay: 0.15s; }
.nav-item:nth-child(3) { animation-delay: 0.2s; }

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 悬停时的微妙效果 */
.nav-parent:hover .nav-text {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.6) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 激活状态的发光效果 */
.nav-parent.is-active::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(0, 153, 204, 0.1) 100%);
  border-radius: 12px;
  z-index: -1;
}

/* 滚动时的平滑效果 */
.sidebar-nav {
  scroll-behavior: smooth;
}

/* 聚焦状态 */
.nav-item:focus-visible {
  outline: 2px solid #667eea;
  outline-offset: 2px;
  border-radius: 12px;
}

/* 加载动画 */
@keyframes shimmer {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
}

.nav-item.loading {
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.1) 25%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.1) 75%);
  background-size: 200px 100%;
  animation: shimmer 1.5s infinite;
}
</style>
