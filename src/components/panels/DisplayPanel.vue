<template>
  <div class="display-panel-container">
    <div class="display-panel-header">
      <span class="panel-title">Displays</span>
    </div>

    <div class="display-list-container">
      <div class="display-list">
        <!-- Global Options -->
        <div class="display-item">
          <div class="display-item-header" @click="toggleItem('global-options')">
            <el-icon class="item-icon">
              <Setting />
            </el-icon>
            <span class="item-name">Global Options</span>
            <el-icon class="expand-icon" :class="{ expanded: expandedItems['global-options'] }">
              <ArrowDown />
            </el-icon>
          </div>
          <div v-show="expandedItems['global-options']" class="display-item-content">
            <div class="config-row">
              <span class="config-label">Fixed Frame</span>
              <el-input
                v-model="globalOptions.fixedFrame"
                size="small"
                class="config-value"
                @change="updateGlobalOptions"
              />
            </div>
            <div class="config-row">
              <span class="config-label">Background Color</span>
              <div class="config-value color-config">
                <el-color-picker
                  v-model="globalOptions.backgroundColor"
                  size="small"
                  @change="updateGlobalOptions"
                />
                <span class="color-text">{{ formatColor(globalOptions.backgroundColor) }}</span>
              </div>
            </div>
            <div class="config-row">
              <span class="config-label">Frame Rate</span>
              <el-input-number
                v-model="globalOptions.frameRate"
                size="small"
                :min="1"
                :max="120"
                class="config-value"
                @change="updateGlobalOptions"
              />
            </div>
            <div class="config-row">
              <span class="config-label">Default Light</span>
              <el-checkbox
                v-model="globalOptions.defaultLight"
                class="config-value"
                @change="updateGlobalOptions"
              />
            </div>
          </div>
        </div>

        <!-- Global Status -->
        <div class="display-item">
          <div class="display-item-header" @click="toggleItem('global-status')">
            <el-icon class="item-icon warning-icon">
              <Warning />
            </el-icon>
            <span class="item-name">Global Status</span>
            <el-icon class="expand-icon" :class="{ expanded: expandedItems['global-status'] }">
              <ArrowDown />
            </el-icon>
          </div>
          <div v-show="expandedItems['global-status']" class="display-item-content">
            <div class="config-row">
              <span class="config-label">
                <el-icon class="warning-icon-small">
                  <Warning />
                </el-icon>
                Fixed Frame
              </span>
              <span class="config-value status-text warning-text">No TF data</span>
            </div>
          </div>
        </div>

        <!-- 动态显示组件列表 -->
        <DisplayComponent
          v-for="component in displayComponents"
          :key="component.id"
          :component="component"
          :selected="selectedItem === component.id"
          @select="selectItem(component.id)"
          @toggle="handleToggleComponent"
          @update="updateComponent"
          @remove="removeComponent"
        />
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="display-actions">
      <div class="actions-title">Global Options</div>
      <div class="action-buttons">
        <el-button size="small" @click="showTypeSelector = true">Add</el-button>
        <el-button size="small" :disabled="!selectedItem" @click="duplicateDisplay">Duplicate</el-button>
        <el-button size="small" :disabled="!selectedItem" type="danger" @click="removeDisplay">Remove</el-button>
        <el-button size="small" :disabled="!selectedItem" @click="renameDisplay">Rename</el-button>
      </div>
    </div>

    <!-- 显示类型选择器 -->
    <DisplayTypeSelector
      v-model="showTypeSelector"
      @select="handleAddComponent"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import {
  Setting,
  Warning,
  ArrowDown
} from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import DisplayComponent from './DisplayComponent.vue'
import DisplayTypeSelector from './DisplayTypeSelector.vue'

// 展开状态
const expandedItems = reactive<Record<string, boolean>>({
  'global-options': true,
  'global-status': true
})

const selectedItem = ref<string>('')

// 显示组件列表
interface DisplayComponentData {
  id: string
  type: string
  name: string
  enabled: boolean
  expanded: boolean
  options: Record<string, any>
}

const displayComponents = ref<DisplayComponentData[]>([])

// 配置数据
const globalOptions = reactive({
  fixedFrame: 'map',
  backgroundColor: '#303030',
  frameRate: 30,
  defaultLight: true
})

// 显示类型选择器
const showTypeSelector = ref(false)

// 方法
const toggleItem = (itemId: string) => {
  expandedItems[itemId] = !expandedItems[itemId]
}

const handleToggleComponent = (componentId: string) => {
  const component = displayComponents.value.find((c: DisplayComponentData) => c.id === componentId)
  if (component) {
    component.expanded = !component.expanded
    expandedItems[componentId] = component.expanded
  }
}

const selectItem = (itemId: string) => {
  selectedItem.value = itemId
}

const formatColor = (color: string): string => {
  if (color && color.indexOf('#') === 0) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `${r}; ${g}; ${b}`
  }
  return color
}

const updateGlobalOptions = () => {
  emit('update:globalOptions', { ...globalOptions })
}

// 处理添加组件
const handleAddComponent = (type: any) => {
  const componentId = `${type.id}-${Date.now()}`
  const component: DisplayComponentData = {
    id: componentId,
    type: type.id,
    name: type.name,
    enabled: true,
    expanded: true,
    options: getDefaultOptions(type.id)
  }
  displayComponents.value.push(component)
  selectedItem.value = componentId
  expandedItems[componentId] = true
  
  emit('addComponent', component)
}

// 获取默认配置
const getDefaultOptions = (type: string): Record<string, any> => {
  const defaults: Record<string, any> = {
    grid: {
      referenceFrame: '<Fixed Frame>',
      planeCellCount: 10,
      normalCellCount: 0,
      cellSize: 1,
      lineStyle: 'Lines',
      color: '#a0a0a4',
      alpha: 0.5,
      plane: 'XY',
      offset: '0; 0; 0',
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0
    },
    axes: {
      referenceFrame: '<Fixed Frame>',
      length: 1,
      radius: 0.1,
      showTrail: false,
      alpha: 1
    },
    camera: {
      topic: '/camera/image_raw',
      queueSize: 2,
      transportHint: 'raw'
    },
    map: {
      topic: '/map',
      alpha: 0.7,
      drawBehind: false
    },
    path: {
      topic: '/path',
      color: '#ff0000',
      bufferLength: 1
    },
    marker: {
      topic: '/marker',
      queueSize: 100
    },
    image: {
      topic: '/camera/image_raw',
      queueSize: 2,
      transportHint: 'raw'
    },
    laserscan: {
      topic: '/scan',
      queueSize: 10
    },
    pointcloud2: {
      topic: '/pointcloud',
      queueSize: 10
    }
  }
  return defaults[type] || {}
}

// 更新组件配置
const updateComponent = (componentId: string, options: Record<string, any>) => {
  const component = displayComponents.value.find((c: DisplayComponentData) => c.id === componentId)
  if (component) {
    component.options = { ...component.options, ...options }
    emit('updateComponent', component)
  }
}

// 删除组件
const removeComponent = (componentId: string) => {
  const index = displayComponents.value.findIndex((c: DisplayComponentData) => c.id === componentId)
  if (index !== -1) {
    displayComponents.value.splice(index, 1)
    if (selectedItem.value === componentId) {
      selectedItem.value = ''
    }
    emit('removeComponent', componentId)
  }
}

const duplicateDisplay = () => {
  const component = displayComponents.value.find((c: DisplayComponentData) => c.id === selectedItem.value)
  if (component) {
    const duplicated: DisplayComponentData = {
      ...component,
      id: `${component.type}-${Date.now()}`,
      name: `${component.name} (Copy)`
    }
    displayComponents.value.push(duplicated)
    selectedItem.value = duplicated.id
    emit('duplicateComponent', duplicated)
  }
}

const removeDisplay = () => {
  if (!selectedItem.value) return
  const component = displayComponents.value.find((c: DisplayComponentData) => c.id === selectedItem.value)
  if (component) {
    ElMessageBox.confirm(
      `Are you sure you want to remove this display?`,
      'Remove Display',
      {
        confirmButtonText: 'Remove',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    ).then(() => {
      removeComponent(selectedItem.value)
    }).catch(() => {
      // User cancelled
    })
  }
}

const renameDisplay = () => {
  if (!selectedItem.value) return
  const component = displayComponents.value.find((c: DisplayComponentData) => c.id === selectedItem.value)
  if (!component) return

  ElMessageBox.prompt('Enter new name:', 'Rename Display', {
    confirmButtonText: 'Rename',
    cancelButtonText: 'Cancel',
    inputValue: component.name,
    inputPattern: /.+/,
    inputErrorMessage: 'Display name cannot be empty'
  }).then(({ value }) => {
    if (value) {
      component.name = value
      emit('renameComponent', component.id, value)
    }
  }).catch(() => {
    // User cancelled
  })
}

// 加载保存的组件
const loadComponents = () => {
  const saved = localStorage.getItem('rviz-display-components')
  if (saved) {
    try {
      displayComponents.value = JSON.parse(saved)
      displayComponents.value.forEach((comp: DisplayComponentData) => {
        expandedItems[comp.id] = comp.expanded || false
      })
    } catch (e) {
      console.error('Failed to load display components:', e)
    }
  } else {
    // 默认添加Grid和Axes
    handleAddComponent({ id: 'grid', name: 'Grid' })
    handleAddComponent({ id: 'axes', name: 'Axes' })
  }
}

// 保存组件
const saveComponents = () => {
  localStorage.setItem('rviz-display-components', JSON.stringify(displayComponents.value))
}

// 监听组件变化，自动保存
watch(() => displayComponents.value, () => {
  saveComponents()
}, { deep: true })

// 监听组件变化，自动保存展开状态
watch(() => expandedItems, () => {
  displayComponents.value.forEach((comp: DisplayComponentData) => {
    if (expandedItems[comp.id] !== undefined) {
      comp.expanded = expandedItems[comp.id] || false
    }
  })
  saveComponents()
}, { deep: true })

onMounted(() => {
  loadComponents()
})

const emit = defineEmits<{
  'update:globalOptions': [options: any]
  'update:gridOptions': [options: any]
  'update:axesOptions': [options: any]
  addComponent: [component: DisplayComponentData]
  updateComponent: [component: DisplayComponentData]
  removeComponent: [componentId: string]
  duplicateComponent: [component: DisplayComponentData]
  renameComponent: [componentId: string, newName: string]
  addDisplay: [name: string]
  duplicateDisplay: [itemId: string]
  removeDisplay: [itemId: string]
  renameDisplay: [itemId: string, newName: string]
}>()
</script>

<style scoped>
.display-panel-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 400px;
  background: white;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.display-panel-header {
  padding: 8px 12px;
  border-bottom: 1px solid #dcdfe6;
  background: #f5f7fa;
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.panel-title {
  user-select: none;
}

.display-list-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.display-list {
  padding: 4px 0;
}

.display-item {
  border-bottom: 1px solid #ebeef5;
  user-select: none;
}

.display-item.active {
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

.warning-icon {
  color: #e6a23c;
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
  display: flex;
  align-items: center;
  gap: 4px;
}

.warning-icon-small {
  font-size: 14px;
  color: #e6a23c;
}

.config-value {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-width: 120px;
}

.color-config {
  gap: 8px;
}

.color-text {
  font-size: 11px;
  color: #909399;
  font-family: monospace;
}

.status-text {
  font-size: 12px;
  color: #606266;
}

.warning-text {
  color: #e6a23c;
}

.display-actions {
  border-top: 2px solid #dcdfe6;
  padding: 12px;
  background: #f5f7fa;
}

.actions-title {
  font-weight: 600;
  font-size: 13px;
  color: #303133;
  margin-bottom: 8px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.action-buttons .el-button {
  flex: 1;
}

/* 滚动条样式 */
.display-list-container::-webkit-scrollbar {
  width: 8px;
}

.display-list-container::-webkit-scrollbar-track {
  background: #f5f7fa;
}

.display-list-container::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 4px;
}

.display-list-container::-webkit-scrollbar-thumb:hover {
  background: #a0a4ac;
}
</style>