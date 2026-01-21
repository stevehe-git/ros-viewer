<template>
  <div class="config-content">
    <div class="config-row">
      <span class="config-label">Topic</span>
      <el-input
        :model-value="options.topic"
        @update:model-value="update('topic', $event)"
        size="small"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Alpha</span>
      <el-input-number
        :model-value="options.alpha"
        @update:model-value="update('alpha', $event)"
        size="small"
        :min="0"
        :max="1"
        :step="0.1"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Color Scheme</span>
      <el-select
        :model-value="options.colorScheme"
        @update:model-value="update('colorScheme', $event)"
        size="small"
        class="config-value"
      >
        <el-option label="map" value="map" />
        <el-option label="costmap" value="costmap" />
        <el-option label="raw" value="raw" />
      </el-select>
    </div>
    <div class="config-row">
      <span class="config-label">Draw Behind</span>
      <el-checkbox
        :model-value="options.drawBehind"
        @update:model-value="update('drawBehind', $event)"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Resolution</span>
      <el-input-number
        :model-value="options.resolution"
        @update:model-value="update('resolution', $event)"
        size="small"
        :min="0"
        :step="0.01"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Width</span>
      <el-input-number
        :model-value="options.width"
        @update:model-value="update('width', $event)"
        size="small"
        :min="0"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Height</span>
      <el-input-number
        :model-value="options.height"
        @update:model-value="update('height', $event)"
        size="small"
        :min="0"
        class="config-value"
      />
    </div>

    <!-- Position (可展开) -->
    <div class="display-sub-item">
      <div class="sub-item-header" @click="togglePosition">
        <el-icon class="expand-icon" :class="{ expanded: positionExpanded }">
          <ArrowRight />
        </el-icon>
        <span class="sub-item-name">Position</span>
        <span class="config-value-text">{{ `${options.positionX || 0}; ${options.positionY || 0}; ${options.positionZ || 0}` }}</span>
      </div>
      <div v-show="positionExpanded" class="sub-item-content">
        <div class="config-row">
          <span class="config-label">X</span>
          <el-input-number
            :model-value="options.positionX"
            @update:model-value="update('positionX', $event)"
            size="small"
            class="config-value"
          />
        </div>
        <div class="config-row">
          <span class="config-label">Y</span>
          <el-input-number
            :model-value="options.positionY"
            @update:model-value="update('positionY', $event)"
            size="small"
            class="config-value"
          />
        </div>
        <div class="config-row">
          <span class="config-label">Z</span>
          <el-input-number
            :model-value="options.positionZ"
            @update:model-value="update('positionZ', $event)"
            size="small"
            class="config-value"
          />
        </div>
      </div>
    </div>

    <!-- Orientation (可展开) -->
    <div class="display-sub-item">
      <div class="sub-item-header" @click="toggleOrientation">
        <el-icon class="expand-icon" :class="{ expanded: orientationExpanded }">
          <ArrowRight />
        </el-icon>
        <span class="sub-item-name">Orientation</span>
        <span class="config-value-text">{{ `${options.orientationX || 0}; ${options.orientationY || 0}; ${options.orientationZ || 0}; ${options.orientationW || 1}` }}</span>
      </div>
      <div v-show="orientationExpanded" class="sub-item-content">
        <div class="config-row">
          <span class="config-label">X</span>
          <el-input-number
            :model-value="options.orientationX"
            @update:model-value="update('orientationX', $event)"
            size="small"
            :step="0.01"
            class="config-value"
          />
        </div>
        <div class="config-row">
          <span class="config-label">Y</span>
          <el-input-number
            :model-value="options.orientationY"
            @update:model-value="update('orientationY', $event)"
            size="small"
            :step="0.01"
            class="config-value"
          />
        </div>
        <div class="config-row">
          <span class="config-label">Z</span>
          <el-input-number
            :model-value="options.orientationZ"
            @update:model-value="update('orientationZ', $event)"
            size="small"
            :step="0.01"
            class="config-value"
          />
        </div>
        <div class="config-row">
          <span class="config-label">W</span>
          <el-input-number
            :model-value="options.orientationW"
            @update:model-value="update('orientationW', $event)"
            size="small"
            :step="0.01"
            class="config-value"
          />
        </div>
      </div>
    </div>

    <div class="config-row">
      <span class="config-label">Unreliable</span>
      <el-checkbox
        :model-value="options.unreliable"
        @update:model-value="update('unreliable', $event)"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Use Timestamp</span>
      <el-checkbox
        :model-value="options.useTimestamp"
        @update:model-value="update('useTimestamp', $event)"
        class="config-value"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { ArrowRight } from '@element-plus/icons-vue'

interface Props {
  componentId: string
  options: Record<string, any>
}

const props = defineProps<Props>()
const rvizStore = useRvizStore()

const positionExpanded = ref(false)
const orientationExpanded = ref(false)

const togglePosition = () => {
  positionExpanded.value = !positionExpanded.value
}

const toggleOrientation = () => {
  orientationExpanded.value = !orientationExpanded.value
}

const update = (key: string, value: any) => {
  rvizStore.updateComponentOptions(props.componentId, { [key]: value })
}
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

.config-value-text {
  font-size: 11px;
  color: #909399;
  font-family: monospace;
  margin-left: auto;
}

.sub-item-content {
  padding-left: 32px;
  background: #f5f7fa;
}
</style>
