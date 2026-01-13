<template>
  <div class="navigation-view">
    <div class="navigation-content">
      <!-- 子路由内容区域 -->
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useUIStore } from '../../stores/ui'

// 状态管理
const uiStore = useUIStore()

// 生命周期钩子
onMounted(() => {
  // 确保导航面板可见
  uiStore.showPanel('navigation-panel')
})

onUnmounted(() => {
  // 清理状态
  uiStore.hidePanel('navigation-panel')
})
</script>

<style scoped>
.navigation-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.navigation-content {
  flex: 1;
  overflow: hidden;
}
</style>
