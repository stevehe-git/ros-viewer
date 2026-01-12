<template>
  <div id="app" :class="{ 'fullscreen': uiStore.uiState.fullscreenMode }">
    <!-- 全局加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>{{ loadingMessage }}</p>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-toast" @click="clearError">
      <div class="error-content">
        <i class="error-icon">⚠️</i>
        <div class="error-text">
          <h4>{{ error.title }}</h4>
          <p>{{ error.message }}</p>
        </div>
        <button class="error-close">×</button>
      </div>
    </div>

    <!-- 主布局 -->
    <AppLayout>
      <router-view v-slot="{ Component, route }">
        <transition name="fade" mode="out-in">
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </AppLayout>

    <!-- 全局通知 -->
    <NotificationContainer />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useUIStore } from './stores/ui'
import AppLayout from './layouts/AppLayout.vue'
import NotificationContainer from './components/NotificationContainer.vue'

// 状态管理
const uiStore = useUIStore()

// 应用状态
const loading = ref(false)
const loadingMessage = ref('')
const error = ref<{
  title: string
  message: string
} | null>(null)

// 方法
function setLoading(message: string) {
  loading.value = true
  loadingMessage.value = message
}

function clearLoading() {
  loading.value = false
  loadingMessage.value = ''
}

function setError(title: string, message: string) {
  error.value = { title, message }

  // 5秒后自动清除错误
  setTimeout(() => {
    clearError()
  }, 5000)
}

function clearError() {
  error.value = null
}

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error)
  setError('应用程序错误', event.error?.message || '发生未知错误')
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
  setError('异步操作错误', event.reason?.message || '异步操作失败')
})

// 性能监控
let performanceObserver: PerformanceObserver | null = null

function startPerformanceMonitoring() {
  if ('PerformanceObserver' in window) {
    try {
      performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry.entryType === 'measure') {
            console.log(`Performance: ${entry.name} took ${entry.duration}ms`)
          }
        })
      })

      performanceObserver.observe({ entryTypes: ['measure', 'navigation'] })
    } catch (error) {
      console.warn('Performance monitoring not supported:', error)
    }
  }
}

function stopPerformanceMonitoring() {
  if (performanceObserver) {
    performanceObserver.disconnect()
    performanceObserver = null
  }
}

// 生命周期
onMounted(() => {
  startPerformanceMonitoring()

  // 初始化应用
  console.log('Robot Visualization Platform initialized')
})

onUnmounted(() => {
  stopPerformanceMonitoring()
})

// 导出方法供全局使用
if (import.meta.env.DEV) {
  // @ts-ignore
  window.app = {
    setLoading,
    clearLoading,
    setError,
    clearError
  }
}
</script>

<style>
/* 全局样式重置和基础样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: var(--bg-color, #f5f5f5);
  color: var(--text-color, #333);
  overflow: hidden;
}

#app {
  width: 100vw;
  height: 100vh;
  position: relative;
  transition: all 0.3s ease;
}

#app.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
}

/* 加载状态样式 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.loading-spinner {
  text-align: center;
  color: white;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 错误提示样式 */
.error-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  max-width: 400px;
  z-index: 10001;
  cursor: pointer;
}

.error-content {
  background: #f44336;
  color: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.error-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.error-text h4 {
  margin-bottom: 4px;
  font-weight: 600;
}

.error-text p {
  font-size: 14px;
  opacity: 0.9;
}

.error-close {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.error-close:hover {
  opacity: 1;
}

/* 页面过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 主题变量 */
:root {
  --bg-color: #f5f5f5;
  --text-color: #333;
  --text-secondary: #666;
  --primary-color: #2196F3;
  --secondary-color: #757575;
  --success-color: #4CAF50;
  --warning-color: #FF9800;
  --error-color: #f44336;
  --border-color: #e0e0e0;
  --shadow-color: rgba(0, 0, 0, 0.1);
}

/* 深色主题 */
[data-theme="dark"] {
  --bg-color: #1a1a1a;
  --text-color: #e0e0e0;
  --text-secondary: #b0b0b0;
  --primary-color: #64B5F6;
  --border-color: #404040;
  --shadow-color: rgba(0, 0, 0, 0.3);
}

/* 自动主题 */
@media (prefers-color-scheme: dark) {
  [data-theme="auto"] {
    --bg-color: #1a1a1a;
    --text-color: #e0e0e0;
    --text-secondary: #b0b0b0;
    --primary-color: #64B5F6;
    --border-color: #404040;
    --shadow-color: rgba(0, 0, 0, 0.3);
  }
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-color);
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* 选择框样式 */
select {
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1rem;
  padding-right: 2rem;
}

/* 输入框聚焦样式 */
input:focus,
select:focus,
textarea:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: -1px;
}

/* 按钮基础样式 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-secondary {
  background: var(--secondary-color);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-success {
  background: var(--success-color);
  color: white;
}

.btn-success:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-warning {
  background: var(--warning-color);
  color: white;
}

.btn-warning:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-danger {
  background: var(--error-color);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-color);
}

.btn-outline:hover:not(:disabled) {
  background: var(--text-color);
  color: var(--bg-color);
}

/* 图标字体 */
.icon-dashboard::before { content: "📊"; }
.icon-navigation::before { content: "🧭"; }
.icon-control::before { content: "🎛️"; }
.icon-map::before { content: "🗺️"; }
.icon-sensor::before { content: "📡"; }
.icon-task::before { content: "📋"; }
.icon-analysis::before { content: "📈"; }
.icon-log::before { content: "📝"; }
.icon-settings::before { content: "⚙️"; }
.icon-about::before { content: "ℹ️"; }

/* 响应式设计 */
@media (max-width: 768px) {
  .error-content {
    max-width: calc(100vw - 40px);
  }
}
</style>