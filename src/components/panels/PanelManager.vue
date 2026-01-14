<template>
  <div v-if="hasActivePanels" class="panel-manager">
    <!-- 选中的面板 -->
    <div class="active-panels">
      <ViewControlPanel
        v-if="isPanelEnabled('view-control')"
        :camera-mode="rvizStore.sceneState.cameraMode"
        :show-grid="rvizStore.sceneState.showGrid"
        :show-axes="rvizStore.sceneState.showAxes"
        :show-robot="rvizStore.sceneState.showRobot"
        :show-map="rvizStore.sceneState.showMap"
        :show-path="rvizStore.sceneState.showPath"
        :show-laser="rvizStore.sceneState.showLaser"
        :background-color="rvizStore.sceneState.backgroundColor"
        :is-fullscreen="props.isFullscreen"
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
        :fps="rvizStore.sceneState.fps"
        :camera-pos="rvizStore.sceneState.cameraPos"
        :object-count="rvizStore.sceneState.objectCount"
        :memory-usage="rvizStore.sceneState.memoryUsage"
        :texture-count="rvizStore.sceneState.textureCount"
      />

      <ToolPanel
        v-if="isPanelEnabled('tools')"
        :is-recording="rvizStore.sceneState.isRecording"
        :performance-mode="rvizStore.sceneState.performanceMode"
        :show-debug-info="rvizStore.sceneState.showDebugInfo"
        @take-screenshot="$emit('takeScreenshot')"
        @export-scene="$emit('exportScene')"
        @reset-scene="$emit('resetScene')"
        @toggle-recording="$emit('toggleRecording', $event)"
        @toggle-performance-mode="$emit('togglePerformanceMode', $event)"
        @toggle-debug-info="$emit('toggleDebugInfo', $event)"
      />

      <DisplayPanel
        v-if="isPanelEnabled('display')"
        @update:global-options="handleGlobalOptionsUpdate"
        @update:grid-options="handleGridOptionsUpdate"
        @update:axes-options="handleAxesOptionsUpdate"
        @add-display="handleAddDisplay"
        @duplicate-display="handleDuplicateDisplay"
        @remove-display="handleRemoveDisplay"
        @rename-display="handleRenameDisplay"
      />

      <RobotConnectionPanel
        v-if="isPanelEnabled('robot-connection')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import ViewControlPanel from './ViewControlPanel.vue'
import SceneInfoPanel from './SceneInfoPanel.vue'
import ToolPanel from './ToolPanel.vue'
import DisplayPanel from './DisplayPanel.vue'
import RobotConnectionPanel from './RobotConnectionPanel.vue'

// 使用RViz store
const rvizStore = useRvizStore()

// 使用store中的数据，减少props依赖
interface Props {
  isFullscreen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isFullscreen: false
})

// 使用store中的面板启用状态
const isPanelEnabled = (panelId: string): boolean => {
  return rvizStore.isPanelEnabled(panelId)
}

const handleGlobalOptionsUpdate = (options: any) => {
  emit('update:globalOptions', options)
}

const handleGridOptionsUpdate = (options: any) => {
  emit('update:gridOptions', options)
}

const handleAxesOptionsUpdate = (options: any) => {
  emit('update:axesOptions', options)
}

const handleAddDisplay = (name: string) => {
  emit('addDisplay', name)
}

const handleDuplicateDisplay = (itemId: string) => {
  emit('duplicateDisplay', itemId)
}

const handleRemoveDisplay = (itemId: string) => {
  emit('removeDisplay', itemId)
}

const handleRenameDisplay = (itemId: string, newName: string) => {
  emit('renameDisplay', itemId, newName)
}

const hasActivePanels = computed(() => {
  return rvizStore.panelConfig.enabledPanels.length > 0
})

const emit = defineEmits<{
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
  'update:globalOptions': [options: any]
  'update:gridOptions': [options: any]
  'update:axesOptions': [options: any]
  addDisplay: [name: string]
  duplicateDisplay: [itemId: string]
  removeDisplay: [itemId: string]
  renameDisplay: [itemId: string, newName: string]
}>()
</script>

<style scoped>
.panel-manager {
  width: 300px;
  min-width: 200px;
  max-width: 600px;
  padding: 16px;
  background: #f5f7fa;
  overflow-y: auto;
  height: 100%;
  flex-shrink: 0;
  transition: width 0.2s ease;
}

.rviz-viewer.resizing .panel-manager {
  transition: none;
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