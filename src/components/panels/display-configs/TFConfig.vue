<template>
  <div class="config-content">
    <!-- Show Names -->
    <div class="config-row">
      <span class="config-label">Show Names</span>
      <el-checkbox
        :model-value="options.showNames"
        @update:model-value="update('showNames', $event)"
        class="config-value"
      />
    </div>

    <!-- Show Axes -->
    <div class="config-row">
      <span class="config-label">Show Axes</span>
      <el-checkbox
        :model-value="options.showAxes"
        @update:model-value="update('showAxes', $event)"
        class="config-value"
      />
    </div>

    <!-- Show Arrows -->
    <div class="config-row">
      <span class="config-label">Show Arrows</span>
      <el-checkbox
        :model-value="options.showArrows"
        @update:model-value="update('showArrows', $event)"
        class="config-value"
      />
    </div>

    <!-- Marker Scale -->
    <div class="config-row">
      <span class="config-label">Marker Scale</span>
      <el-input-number
        :model-value="options.markerScale"
        @update:model-value="update('markerScale', $event)"
        size="small"
        :min="0.1"
        :max="10"
        :step="0.1"
        class="config-value"
      />
    </div>

    <!-- Marker Alpha -->
    <div class="config-row">
      <span class="config-label">Marker Alpha</span>
      <el-input-number
        :model-value="options.markerAlpha"
        @update:model-value="update('markerAlpha', $event)"
        size="small"
        :min="0"
        :max="1"
        :step="0.1"
        class="config-value"
      />
    </div>

    <!-- Update Interval -->
    <div class="config-row">
      <span class="config-label">Update Interval</span>
      <el-input-number
        :model-value="options.updateInterval"
        @update:model-value="update('updateInterval', $event)"
        size="small"
        :min="0"
        :max="100"
        :step="0.1"
        class="config-value"
      />
    </div>

    <!-- Frame Timeout -->
    <div class="config-row">
      <span class="config-label">Frame Timeout</span>
      <el-input-number
        :model-value="options.frameTimeout"
        @update:model-value="update('frameTimeout', $event)"
        size="small"
        :min="0"
        :max="1000"
        :step="1"
        class="config-value"
      />
    </div>

    <!-- Filter (whitelist) -->
    <div class="config-row">
      <span class="config-label">Filter (whitelist)</span>
      <el-input
        :model-value="options.filterWhitelist"
        @update:model-value="update('filterWhitelist', $event)"
        size="small"
        class="config-value"
        placeholder=""
      />
    </div>

    <!-- Filter (blacklist) -->
    <div class="config-row">
      <span class="config-label">Filter (blacklist)</span>
      <el-input
        :model-value="options.filterBlacklist"
        @update:model-value="update('filterBlacklist', $event)"
        size="small"
        class="config-value"
        placeholder=""
      />
    </div>

    <!-- Frames Section -->
    <div class="display-sub-item">
      <div class="sub-item-header" @click="toggleFrames">
        <el-icon class="expand-icon" :class="{ expanded: framesExpanded }">
          <ArrowRight />
        </el-icon>
        <span class="sub-item-name">Frames</span>
      </div>
      <div v-show="framesExpanded" class="sub-item-content">
        <!-- All Enabled checkbox -->
        <div class="config-row">
          <span class="config-label">All Enabled</span>
          <el-checkbox
            :model-value="allFramesEnabled"
            @update:model-value="handleAllEnabledChange"
            class="config-value"
          />
        </div>

        <!-- Individual Frames List -->
        <div class="frames-list">
          <div
            v-for="frame in frames"
            :key="frame.name"
            class="frame-item"
          >
            <el-icon class="frame-expand-icon">
              <ArrowRight />
            </el-icon>
            <span class="frame-name">{{ frame.name }}</span>
            <el-checkbox
              :model-value="frame.enabled"
              @update:model-value="handleFrameEnabledChange(frame.name, $event)"
              class="frame-checkbox"
            />
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { ArrowRight } from '@element-plus/icons-vue'
import { tfManager } from '@/services/tfManager'

interface Props {
  componentId: string
  options: Record<string, any>
}

const props = defineProps<Props>()
const rvizStore = useRvizStore()

const framesExpanded = ref(false)

// 从options中获取frames列表，如果没有则从tfManager获取
const frames = computed(() => {
  if (props.options.frames && Array.isArray(props.options.frames) && props.options.frames.length > 0) {
    return props.options.frames
  }
  
  // 从tfManager获取frames列表
  const frameNames = tfManager.getFrames()
  
  return frameNames.map(name => ({
    name,
    enabled: props.options.frames?.find((f: any) => f.name === name)?.enabled ?? true
  }))
})

// 计算所有frames是否都启用
const allFramesEnabled = computed(() => {
  return frames.value.length > 0 && frames.value.every(frame => frame.enabled)
})

const toggleFrames = () => {
  framesExpanded.value = !framesExpanded.value
}

const handleAllEnabledChange = (value: boolean) => {
  const updatedFrames = frames.value.map(frame => ({
    ...frame,
    enabled: value
  }))
  update('frames', updatedFrames)
}

const handleFrameEnabledChange = (frameName: string, enabled: boolean) => {
  const updatedFrames = frames.value.map(frame =>
    frame.name === frameName ? { ...frame, enabled } : frame
  )
  update('frames', updatedFrames)
}

const update = (key: string, value: any) => {
  rvizStore.updateComponentOptions(props.componentId, { [key]: value })
}

// 监听 frameTimeout 变化，更新 tfManager
watch(() => props.options.frameTimeout, (timeout) => {
  if (timeout !== undefined) {
    tfManager.setFrameTimeout(timeout)
  }
}, { immediate: true })
</script>

<style scoped>
.config-content {
  padding: 4px 0;
}

.config-row {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  min-height: 28px;
  font-size: 12px;
}

.config-label {
  flex: 1;
  color: #606266;
}

.config-value {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-width: 120px;
}

.display-sub-item {
  border-top: 1px solid #ebeef5;
  margin-top: 2px;
}

.sub-item-header {
  display: flex;
  align-items: center;
  padding: 4px 8px 4px 16px;
  cursor: pointer;
  font-size: 12px;
  color: #606266;
  gap: 6px;
}

.sub-item-header:hover {
  background: #f0f2f5;
}

.expand-icon {
  font-size: 12px;
  color: #909399;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.sub-item-name {
  flex: 1;
}

.sub-item-content {
  padding-left: 32px;
  background: #f5f7fa;
}

.frames-list {
  max-height: 300px;
  overflow-y: auto;
}

.frame-item {
  display: flex;
  align-items: center;
  padding: 4px 8px 4px 16px;
  font-size: 12px;
  color: #606266;
  gap: 6px;
}

.frame-expand-icon {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
}

.frame-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.frame-checkbox {
  flex-shrink: 0;
}
</style>
