<template>
  <div class="notification-container">
    <TransitionGroup name="notification" tag="div" class="notification-list">
      <div
        v-for="notification in uiStore.notifications"
        :key="notification.id"
        class="notification-item"
        :class="`notification-${notification.type}`"
        @click="removeNotification(notification.id)"
      >
        <div class="notification-icon">
          <i :class="getNotificationIcon(notification.type)"></i>
        </div>

        <div class="notification-content">
          <div class="notification-title">{{ notification.title }}</div>
          <div class="notification-message">{{ notification.message }}</div>
        </div>

        <button
          class="notification-close"
          @click.stop="removeNotification(notification.id)"
        >
          <i class="icon-close"></i>
        </button>

        <!-- 进度条 -->
        <div
          v-if="notification.duration && notification.duration > 0"
          class="notification-progress"
        >
          <div
            class="progress-bar"
            :style="{ animationDuration: notification.duration + 'ms' }"
          ></div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useUIStore } from '../stores/ui'

// Store
const uiStore = useUIStore()

// 方法
function removeNotification(id: string) {
  uiStore.removeNotification(id)
}

function getNotificationIcon(type: string): string {
  const iconMap: Record<string, string> = {
    'info': 'icon-info',
    'success': 'icon-success',
    'warning': 'icon-warning',
    'error': 'icon-error'
  }
  return iconMap[type] || 'icon-info'
}
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  pointer-events: none;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.notification-item {
  pointer-events: auto;
  min-width: 300px;
  max-width: 400px;
  background: var(--notification-bg, #fff);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-left: 4px solid var(--notification-border, #2196F3);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
}

.notification-item:hover {
  transform: translateX(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

/* 通知类型样式 */
.notification-info {
  --notification-border: #2196F3;
  --notification-bg: #e3f2fd;
}

.notification-success {
  --notification-border: #4CAF50;
  --notification-bg: #e8f5e8;
}

.notification-warning {
  --notification-border: #FF9800;
  --notification-bg: #fff3e0;
}

.notification-error {
  --notification-border: #f44336;
  --notification-bg: #ffebee;
}

.notification-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  color: var(--notification-border);
  font-size: 18px;
}

.icon-info::before { content: "ℹ"; }
.icon-success::before { content: "✓"; }
.icon-warning::before { content: "⚠"; }
.icon-error::before { content: "✕"; }

.notification-content {
  flex: 1;
  padding: 12px 8px;
  min-width: 0;
}

.notification-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color, #333);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notification-message {
  font-size: 12px;
  color: var(--text-secondary, #666);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notification-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  color: var(--text-secondary, #666);
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 4px;
  margin: 4px;
}

.notification-close:hover {
  background: rgba(0, 0, 0, 0.1);
  color: var(--text-color, #333);
}

.icon-close::before { content: "×"; }

.notification-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.3);
}

.progress-bar {
  height: 100%;
  background: var(--notification-border);
  animation: progress linear forwards;
}

@keyframes progress {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}

/* 深色主题支持 */
[data-theme="dark"] {
  --notification-bg: #2d2d2d;
}

/* 动画过渡 */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
  max-height: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.notification-move {
  transition: transform 0.3s ease;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .notification-container {
    top: 10px;
    right: 10px;
    left: 10px;
  }

  .notification-list {
    align-items: stretch;
  }

  .notification-item {
    min-width: auto;
    max-width: none;
  }
}
</style>
