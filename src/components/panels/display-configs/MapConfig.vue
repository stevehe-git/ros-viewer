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
      <span class="config-label">Draw Behind</span>
      <el-checkbox
        :model-value="options.drawBehind"
        @update:model-value="update('drawBehind', $event)"
        class="config-value"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRvizStore } from '@/stores/rviz'

interface Props {
  componentId: string
  options: Record<string, any>
}

const props = defineProps<Props>()
const rvizStore = useRvizStore()

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
</style>