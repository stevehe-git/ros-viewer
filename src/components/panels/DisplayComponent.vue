<template>
  <div
    class="display-component-item"
    :class="{ active: selected }"
    @click="$emit('select', component.id)"
  >
    <div class="display-item-header">
      <el-icon class="item-icon">
        <component :is="getComponentIcon(component.type)" />
      </el-icon>
      <el-checkbox
        v-model="localEnabled"
        @change="handleEnabledChange"
        @click.stop
      />
      <span class="item-name">{{ component.name }}</span>
      <el-icon 
        class="expand-icon" 
        :class="{ expanded: component.expanded }"
        @click.stop="$emit('toggle', component.id)"
      >
        <ArrowDown />
      </el-icon>
    </div>

    <div v-show="component.expanded" class="display-item-content">
      <!-- Status子项 -->
      <div class="display-sub-item">
        <div class="sub-item-header" @click.stop="toggleSubItem('status')">
          <el-icon class="sub-item-icon success-icon">
            <CircleCheck />
          </el-icon>
          <span class="sub-item-name">Status: Ok</span>
          <el-icon class="expand-icon" :class="{ expanded: expandedSubItems['status'] }">
            <ArrowDown />
          </el-icon>
        </div>
        <div v-show="expandedSubItems['status']" class="sub-item-content">
          <!-- Status内容 -->
        </div>
      </div>

      <!-- 根据组件类型渲染不同的配置项 -->
      <component
        :is="getConfigComponent(component.type)"
        :options="component.options"
        @update="handleOptionsUpdate"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import {
  Grid,
  Position,
  Camera,
  Connection,
  Location,
  Picture,
  DataLine,
  Monitor,
  ArrowDown,
  CircleCheck
} from '@element-plus/icons-vue'
import GridConfig from './display-configs/GridConfig.vue'
import AxesConfig from './display-configs/AxesConfig.vue'
import CameraConfig from './display-configs/CameraConfig.vue'
import MapConfig from './display-configs/MapConfig.vue'
import { Files } from '@element-plus/icons-vue'
import PathConfig from './display-configs/PathConfig.vue'
import MarkerConfig from './display-configs/MarkerConfig.vue'
import ImageConfig from './display-configs/ImageConfig.vue'
import LaserScanConfig from './display-configs/LaserScanConfig.vue'
import PointCloud2Config from './display-configs/PointCloud2Config.vue'

interface DisplayComponentData {
  id: string
  type: string
  name: string
  enabled: boolean
  expanded: boolean
  options: Record<string, any>
}

interface Props {
  component: DisplayComponentData
  selected: boolean
}

const props = defineProps<Props>()

const localEnabled = ref(props.component.enabled)

watch(() => props.component.enabled, (newVal) => {
  localEnabled.value = newVal
})

const expandedSubItems = reactive<Record<string, boolean>>({
  status: true
})

const getComponentIcon = (type: string) => {
  const icons: Record<string, any> = {
    grid: Grid,
    axes: Position,
    camera: Camera,
    map: Files,
    path: Connection,
    marker: Location,
    image: Picture,
    laserscan: DataLine,
    pointcloud2: Monitor
  }
  return icons[type] || Monitor
}

const getConfigComponent = (type: string) => {
  const components: Record<string, any> = {
    grid: GridConfig,
    axes: AxesConfig,
    camera: CameraConfig,
    map: MapConfig,
    path: PathConfig,
    marker: MarkerConfig,
    image: ImageConfig,
    laserscan: LaserScanConfig,
    pointcloud2: PointCloud2Config
  }
  return components[type] || 'div'
}

const toggleSubItem = (itemId: string) => {
  expandedSubItems[itemId] = !expandedSubItems[itemId]
}

const handleEnabledChange = (value: boolean) => {
  props.component.enabled = value
  emit('update', props.component.id, { enabled: value })
}

const handleOptionsUpdate = (options: Record<string, any>) => {
  emit('update', props.component.id, options)
}

const emit = defineEmits<{
  select: [id: string]
  toggle: [id: string]
  update: [id: string, options: Record<string, any>]
  remove: [id: string]
}>()
</script>

<style scoped>
.display-component-item {
  border-bottom: 1px solid #ebeef5;
  user-select: none;
}

.display-component-item.active {
  background: #ecf5ff;
}

.display-item-header {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  cursor: pointer;
  font-size: 13px;
  color: #303133;
  gap: 6px;
}

.display-item-header:hover {
  background: #f5f7fa;
}

.item-icon {
  font-size: 16px;
  color: #606266;
  flex-shrink: 0;
}

.item-name {
  flex: 1;
  font-weight: 500;
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

.display-item-content {
  padding-left: 24px;
  background: #fafafa;
  border-top: 1px solid #ebeef5;
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

.sub-item-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.success-icon {
  color: #67c23a;
}

.sub-item-name {
  flex: 1;
}

.sub-item-content {
  padding-left: 32px;
  background: #f5f7fa;
}
</style>