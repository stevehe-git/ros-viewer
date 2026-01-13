<template>
  <div class="config-content">
    <div class="config-row">
      <span class="config-label">Reference Frame</span>
      <el-select
        :model-value="options.referenceFrame"
        @update:model-value="update('referenceFrame', $event)"
        size="small"
        class="config-value"
      >
        <el-option label="<Fixed Frame>" value="<Fixed Frame>" />
      </el-select>
    </div>
    <div class="config-row">
      <span class="config-label">Length</span>
      <el-input-number
        :model-value="options.length"
        @update:model-value="update('length', $event)"
        size="small"
        :min="0.1"
        :max="10"
        :step="0.1"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Radius</span>
      <el-input-number
        :model-value="options.radius"
        @update:model-value="update('radius', $event)"
        size="small"
        :min="0.01"
        :max="0.5"
        :step="0.01"
        class="config-value"
      />
    </div>
    <div class="config-row">
      <span class="config-label">Show Trail</span>
      <el-checkbox
        :model-value="options.showTrail"
        @update:model-value="update('showTrail', $event)"
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
  </div>
</template>

<script setup lang="ts">
interface Props {
  options: Record<string, any>
}

defineProps<Props>()

const update = (key: string, value: any) => {
  emit('update', { [key]: value })
}

defineEmits<{
  update: [options: Record<string, any>]
}>()
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