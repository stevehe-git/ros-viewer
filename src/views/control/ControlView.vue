<template>
  <div class="control-view">
    <div class="control-content">
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
  // 确保控制面板可见
  uiStore.showPanel('control-panel')
})

onUnmounted(() => {
  // 清理状态
  uiStore.hidePanel('control-panel')
})
</script>

<style scoped>
.control-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.control-content {
  flex: 1;
  overflow: hidden;
}
</style>
