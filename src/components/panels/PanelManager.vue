<template>
  <div v-if="hasActivePanels" class="panel-manager">
    <!-- 选中的面板 -->
    <div class="active-panels">
      <ViewControlPanel
        v-if="isPanelEnabled('view-control')"
        :camera-mode="cameraMode"
        :show-grid="showGrid"
        :show-axes="showAxes"
        :show-robot="showRobot"
        :show-map="showMap"
        :show-path="showPath"
        :show-laser="showLaser"
        :background-color="backgroundColor"
        :is-fullscreen="isFullscreen"
        @reset-camera="$emit('resetCamera')"
        @toggle-grid="$emit('toggleGrid')"
        @toggle-axes="$emit('toggleAxes')"
        @update:camera-mode="$emit('update:cameraMode', $event)"
        @update:show-robot="$emit('update:showRobot', $event)"
        @update:show-map="$emit('update:showMap', $event)"
        @update:show-path="$emit('update:showPath', $event)"
        @update:show-laser="$emit('update:showLaser', $event)"
        @update:background-color="$emit('update:backgroundColor', $event)"
        @toggle-fullscreen="$emit('toggleFullscreen')"
      />

      <SceneInfoPanel
        v-if="isPanelEnabled('scene-info')"
        :fps="fps"
        :camera-pos="cameraPos"
        :object-count="objectCount"
        :memory-usage="memoryUsage"
        :texture-count="textureCount"
      />

      <ToolPanel
        v-if="isPanelEnabled('tools')"
        :is-recording="isRecording"
        :performance-mode="performanceMode"
        :show-debug-info="showDebugInfo"
        @take-screenshot="$emit('takeScreenshot')"
        @export-scene="$emit('exportScene')"
        @reset-scene="$emit('resetScene')"
        @toggle-recording="$emit('toggleRecording', $event)"
        @toggle-performance-mode="$emit('togglePerformanceMode', $event)"
        @toggle-debug-info="$emit('toggleDebugInfo', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ViewControlPanel from './ViewControlPanel.vue'
import SceneInfoPanel from './SceneInfoPanel.vue'
import ToolPanel from './ToolPanel.vue'

interface Props {
  enabledPanels: string[]
  cameraMode: string
  showGrid: boolean
  showAxes: boolean
  showRobot: boolean
  showMap: boolean
  showPath: boolean
  showLaser: boolean
  backgroundColor: string
  fps: number
  cameraPos: { x: number; y: number; z: number }
  objectCount: number
  memoryUsage: number
  textureCount: number
  isRecording: boolean
  performanceMode: boolean
  showDebugInfo: boolean
  isFullscreen: boolean
}

const props = defineProps<Props>()

const isPanelEnabled = (panelId: string): boolean => {
  return props.enabledPanels.indexOf(panelId) !== -1
}

const hasActivePanels = computed(() => {
  return props.enabledPanels.length > 0
})

defineEmits<{
  resetCamera: []
  toggleGrid: []
  toggleAxes: []
  'update:cameraMode': [value: string]
  'update:showRobot': [value: boolean]
  'update:showMap': [value: boolean]
  'update:showPath': [value: boolean]
  'update:showLaser': [value: boolean]
  'update:backgroundColor': [value: string]
  takeScreenshot: []
  exportScene: []
  resetScene: []
  toggleRecording: [value: boolean]
  togglePerformanceMode: [value: boolean]
  toggleDebugInfo: [value: boolean]
  toggleFullscreen: []
}>()
</script>

<style scoped>
.panel-manager {
  width: 300px;
  padding: 16px;
  background: #f5f7fa;
  overflow-y: auto;
  border-left: 1px solid #e4e7ed;
  height: 100%;
  flex-shrink: 0;
}

.panel-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-item {
  padding: 8px 0;
}

.panel-icon-small {
  font-size: 14px;
  margin-right: 6px;
}

.active-panels {
  margin-top: 16px;
}
</style>