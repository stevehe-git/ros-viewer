<template>
  <div class="analysis-view">
    <div class="analysis-content">
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
  // 确保分析面板可见
  uiStore.showPanel('analysis-panel')
})

onUnmounted(() => {
  // 清理状态
  uiStore.hidePanel('analysis-panel')
})
</script>

<style scoped>
.analysis-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.analysis-content {
  flex: 1;
  overflow: hidden;
}
</style>
