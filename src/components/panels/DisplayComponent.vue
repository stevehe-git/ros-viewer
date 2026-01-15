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
          <el-icon 
            class="sub-item-icon" 
            :class="{
              'success-icon': subscriptionStatus.subscribed && subscriptionStatus.hasData,
              'warning-icon': subscriptionStatus.subscribed && !subscriptionStatus.hasData,
              'error-icon': subscriptionStatus.error
            }"
          >
            <CircleCheck v-if="subscriptionStatus.subscribed && subscriptionStatus.hasData" />
            <Warning v-else-if="subscriptionStatus.error" />
            <CircleCheck v-else />
          </el-icon>
          <span class="sub-item-name">
            Status: {{ getStatusText() }}
          </span>
          <el-icon class="expand-icon" :class="{ expanded: expandedSubItems['status'] }">
            <ArrowDown />
          </el-icon>
        </div>
        <div v-show="expandedSubItems['status']" class="sub-item-content">
          <div class="status-detail">
            <div class="status-row">
              <span class="status-label">Subscribed:</span>
              <span class="status-value">{{ subscriptionStatus.subscribed ? 'Yes' : 'No' }}</span>
            </div>
            <div class="status-row" v-if="subscriptionStatus.subscribed">
              <span class="status-label">Messages:</span>
              <span class="status-value">{{ subscriptionStatus.messageCount }}</span>
            </div>
            <div class="status-row" v-if="subscriptionStatus.lastMessageTime">
              <span class="status-label">Last Message:</span>
              <span class="status-value">{{ formatTime(subscriptionStatus.lastMessageTime) }}</span>
            </div>
            <div class="status-row" v-if="subscriptionStatus.error">
              <span class="status-label error-text">Error:</span>
              <span class="status-value error-text">{{ subscriptionStatus.error }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 根据组件类型渲染不同的配置项 -->
      <component
        :is="getConfigComponent(component.type)"
        :component-id="component.id"
        :options="component.options"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { useTopicSubscription } from '@/composables/useTopicSubscription'
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
  CircleCheck,
  Share,
  Warning
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
import TFConfig from './display-configs/TFConfig.vue'

// 使用RViz store
const rvizStore = useRvizStore()

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

// 组件类型到消息类型的映射
const COMPONENT_MESSAGE_TYPES: Record<string, string> = {
  map: 'nav_msgs/OccupancyGrid',
  path: 'nav_msgs/Path',
  laserscan: 'sensor_msgs/LaserScan',
  pointcloud2: 'sensor_msgs/PointCloud2',
  marker: 'visualization_msgs/Marker',
  image: 'sensor_msgs/Image',
  camera: 'sensor_msgs/Image'
}

// 获取消息类型
const messageType = computed(() => {
  return COMPONENT_MESSAGE_TYPES[props.component.type] || ''
})

// 话题订阅（仅对需要话题的组件类型）
const needsTopic = computed(() => {
  return ['map', 'path', 'laserscan', 'pointcloud2', 'marker', 'image', 'camera'].includes(props.component.type)
})

// 使用话题订阅 composable
const {
  status: subscriptionStatus,
  messageQueue,
  getLatestMessage,
  subscribe,
  unsubscribe
} = useTopicSubscription(
  props.component.id,
  props.component.options?.topic,
  messageType.value,
  props.component.options?.queueSize || 10
)

// 监听组件启用状态
watch(() => props.component.enabled, (enabled) => {
  if (enabled && needsTopic.value) {
    subscribe()
  } else {
    unsubscribe()
  }
}, { immediate: true })

// 监听话题变化
watch(() => props.component.options?.topic, () => {
  if (props.component.enabled && needsTopic.value) {
    subscribe()
  }
})

// 监听队列大小变化
watch(() => props.component.options?.queueSize, () => {
  if (props.component.enabled && needsTopic.value) {
    subscribe()
  }
})

// 将最新消息存储到 store 中供 rviz-viewer 使用
watch(() => getLatestMessage(), (message) => {
  if (message && props.component.enabled) {
    // 将数据存储到 store 中供 rviz-viewer 使用
    rvizStore.updateComponentData(props.component.id, message)
  } else if (!props.component.enabled) {
    // 组件禁用时清除数据
    rvizStore.clearComponentData(props.component.id)
  }
}, { immediate: true })

// 获取状态文本
const getStatusText = (): string => {
  if (subscriptionStatus.value.error) {
    return 'Error'
  }
  if (!subscriptionStatus.value.subscribed) {
    return 'Not Subscribed'
  }
  if (subscriptionStatus.value.hasData) {
    return 'Ok'
  }
  return 'Waiting for data...'
}

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

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
    pointcloud2: Monitor,
    tf: Share
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
    pointcloud2: PointCloud2Config,
    tf: TFConfig
  }
  return components[type] || 'div'
}

const toggleSubItem = (itemId: string) => {
  expandedSubItems[itemId] = !expandedSubItems[itemId]
}

const handleEnabledChange = (value: boolean) => {
  rvizStore.updateComponent(props.component.id, { enabled: value })
}

const emit = defineEmits<{
  select: [id: string]
  toggle: [id: string]
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

.warning-icon {
  color: #e6a23c;
}

.error-icon {
  color: #f56c6c;
}

.status-detail {
  padding: 8px;
  font-size: 11px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
  color: #606266;
}

.status-label {
  font-weight: 500;
}

.status-value {
  color: #909399;
}

.error-text {
  color: #f56c6c;
}
</style>