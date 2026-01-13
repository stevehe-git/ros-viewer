<template>
  <BasePanel title="工具面板" :icon="Tools">
    <div class="tool-group">
      <el-button-group>
        <el-button size="small" @click="$emit('takeScreenshot')" title="截图">
          <el-icon><Camera /></el-icon>
        </el-button>
        <el-button size="small" @click="$emit('exportScene')" title="导出场景">
          <el-icon><Download /></el-icon>
        </el-button>
        <el-button size="small" @click="$emit('resetScene')" title="重置场景">
          <el-icon><RefreshRight /></el-icon>
        </el-button>
      </el-button-group>
    </div>

    <div class="tool-group">
      <el-divider />
      <div class="tool-item">
        <span>录制状态:</span>
        <el-switch
          v-model="localIsRecording"
          @change="$emit('toggleRecording', $event)"
          size="small"
        />
      </div>
    </div>

    <div class="tool-group">
      <el-divider />
      <div class="tool-item">
        <span>性能模式:</span>
        <el-switch
          v-model="localPerformanceMode"
          @change="$emit('togglePerformanceMode', $event)"
          size="small"
        />
      </div>
    </div>

    <div class="tool-group">
      <el-divider />
      <div class="tool-item">
        <span>调试信息:</span>
        <el-switch
          v-model="localShowDebugInfo"
          @change="$emit('toggleDebugInfo', $event)"
          size="small"
        />
      </div>
    </div>
  </BasePanel>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import BasePanel from './BasePanel.vue'
import { Tools, Camera, Download, RefreshRight } from '@element-plus/icons-vue'

interface Props {
  isRecording: boolean
  performanceMode: boolean
  showDebugInfo: boolean
}

const props = defineProps<Props>()

// 本地状态
const localIsRecording = ref(props.isRecording)
const localPerformanceMode = ref(props.performanceMode)
const localShowDebugInfo = ref(props.showDebugInfo)

// 监听props变化，更新本地状态
watch(() => props.isRecording, (newVal) => { localIsRecording.value = newVal })
watch(() => props.performanceMode, (newVal) => { localPerformanceMode.value = newVal })
watch(() => props.showDebugInfo, (newVal) => { localShowDebugInfo.value = newVal })

defineEmits<{
  takeScreenshot: []
  exportScene: []
  resetScene: []
  toggleRecording: [value: boolean]
  togglePerformanceMode: [value: boolean]
  toggleDebugInfo: [value: boolean]
}>()
</script>

<style scoped>
.tool-group {
  margin-bottom: 12px;
}

.tool-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.tool-item span {
  font-size: 12px;
  color: #606266;
}
</style>