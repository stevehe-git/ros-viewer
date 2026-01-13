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

        <!-- Grid -->
        <div class="display-item" :class="{ active: selectedItem === 'grid' }" @click="selectItem('grid')">
          <div class="display-item-header" @click.stop="toggleItem('grid')">
            <el-icon class="item-icon">
              <Grid />
            </el-icon>
            <el-checkbox
              v-model="gridOptions.enabled"
              @change="updateGridOptions"
              @click.stop
            />
            <span class="item-name">Grid</span>
            <el-icon class="expand-icon" :class="{ expanded: expandedItems['grid'] }">
              <ArrowDown />
            </el-icon>
          </div>
          <div v-show="expandedItems['grid']" class="display-item-content">
            <!-- Grid Status -->
            <div class="display-sub-item">
              <div class="sub-item-header" @click.stop="toggleSubItem('grid-status')">
                <el-icon class="sub-item-icon success-icon">
                  <CircleCheck />
                </el-icon>
                <span class="sub-item-name">Status: Ok</span>
                <el-icon class="expand-icon" :class="{ expanded: expandedSubItems['grid-status'] }">
                  <ArrowDown />
                </el-icon>
              </div>
              <div v-show="expandedSubItems['grid-status']" class="sub-item-content">
                <!-- Status content can be added here if needed -->
              </div>
            </div>

            <div class="config-row">
              <span class="config-label">Reference Frame</span>
              <el-select
                v-model="gridOptions.referenceFrame"
                size="small"
                class="config-value"
                @change="updateGridOptions"
              >
                <el-option label="<Fixed Frame>" value="<Fixed Frame>" />
              </el-select>
            </div>
            <div class="config-row">
              <span class="config-label">Plane Cell Count</span>
              <el-input-number
                v-model="gridOptions.planeCellCount"
                size="small"
                :min="1"
                :max="100"
                class="config-value"
                @change="updateGridOptions"
              />
            </div>
            <div class="config-row">
              <span class="config-label">Normal Cell Count</span>
              <el-input-number
                v-model="gridOptions.normalCellCount"
                size="small"
                :min="0"
                :max="100"
                class="config-value"
                @change="updateGridOptions"
              />
            </div>
            <div class="config-row">
              <span class="config-label">Cell Size</span>
              <el-input-number
                v-model="gridOptions.cellSize"
                size="small"
                :min="0.1"
                :max="10"
                :step="0.1"
                class="config-value"
                @change="updateGridOptions"
              />
            </div>
            <div class="config-row">
              <span class="config-label">Line Style</span>
              <el-select
                v-model="gridOptions.lineStyle"
                size="small"
                class="config-value"
                @change="updateGridOptions"
              >
                <el-option label="Lines" value="Lines" />
                <el-option label="Billboards" value="Billboards" />
              </el-select>
            </div>
            <div class="config-row">
              <span class="config-label">Color</span>
              <div class="config-value color-config">
                <el-color-picker
                  v-model="gridOptions.color"
                  size="small"
                  @change="updateGridOptions"
                />
                <span class="color-text">{{ formatColor(gridOptions.color) }}</span>
              </div>
            </div>
            <div class="config-row">
              <span class="config-label">Alpha</span>
              <el-input-number
                v-model="gridOptions.alpha"
                size="small"
                :min="0"
                :max="1"
                :step="0.1"
                class="config-value"
                @change="updateGridOptions"
              />
            </div>
            <div class="config-row">
              <span class="config-label">Plane</span>
              <el-select
                v-model="gridOptions.plane"
                size="small"
                class="config-value"
                @change="updateGridOptions"
              >
                <el-option label="XY" value="XY" />
                <el-option label="XZ" value="XZ" />
                <el-option label="YZ" value="YZ" />
              </el-select>
            </div>
            <!-- Offset (collapsed by default) -->
            <div class="display-sub-item">
              <div class="sub-item-header" @click.stop="toggleSubItem('grid-offset')">
                <el-icon class="expand-icon" :class="{ expanded: expandedSubItems['grid-offset'] }">
                  <ArrowRight />
                </el-icon>
                <span class="sub-item-name">Offset</span>
                <span class="config-value-text">{{ gridOptions.offset }}</span>
              </div>
              <div v-show="expandedSubItems['grid-offset']" class="sub-item-content">
                <div class="config-row">
                  <span class="config-label">X</span>
                  <el-input-number
                    v-model="gridOptions.offsetX"
                    size="small"
                    class="config-value"
                    @change="updateGridOffset"
                  />
                </div>
                <div class="config-row">
                  <span class="config-label">Y</span>
                  <el-input-number
                    v-model="gridOptions.offsetY"
                    size="small"
                    class="config-value"
                    @change="updateGridOffset"
                  />
                </div>
                <div class="config-row">
                  <span class="config-label">Z</span>
                  <el-input-number
                    v-model="gridOptions.offsetZ"
                    size="small"
                    class="config-value"
                    @change="updateGridOffset"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Axes -->
        <div class="display-item" :class="{ active: selectedItem === 'axes' }" @click="selectItem('axes')">
          <div class="display-item-header" @click.stop="toggleItem('axes')">
            <el-icon class="item-icon">
              <Position />
            </el-icon>
            <el-checkbox
              v-model="axesOptions.enabled"
              @change="updateAxesOptions"
              @click.stop
            />
            <span class="item-name">Axes</span>
            <el-icon class="expand-icon" :class="{ expanded: expandedItems['axes'] }">
              <ArrowDown />
            </el-icon>
          </div>
          <div v-show="expandedItems['axes']" class="display-item-content">
            <!-- Axes Status -->
            <div class="display-sub-item">
              <div class="sub-item-header" @click.stop="toggleSubItem('axes-status')">
                <el-icon class="sub-item-icon success-icon">
                  <CircleCheck />
                </el-icon>
                <span class="sub-item-name">Status: Ok</span>
                <el-icon class="expand-icon" :class="{ expanded: expandedSubItems['axes-status'] }">
                  <ArrowDown />
                </el-icon>
              </div>
              <div v-show="expandedSubItems['axes-status']" class="sub-item-content">
                <!-- Status content can be added here if needed -->
              </div>
            </div>

            <div class="config-row">
              <span class="config-label">Reference Frame</span>
              <el-select
                v-model="axesOptions.referenceFrame"
                size="small"
                class="config-value"
                @change="updateAxesOptions"
              >
                <el-option label="<Fixed Frame>" value="<Fixed Frame>" />
              </el-select>
            </div>
            <div class="config-row">
              <span class="config-label">Length</span>
              <el-input-number
                v-model="axesOptions.length"
                size="small"
                :min="0.1"
                :max="10"
                :step="0.1"
                class="config-value"
                @change="updateAxesOptions"
              />
            </div>
            <div class="config-row">
              <span class="config-label">Radius</span>
              <el-input-number
                v-model="axesOptions.radius"
                size="small"
                :min="0.01"
                :max="0.5"
                :step="0.01"
                class="config-value"
                @change="updateAxesOptions"
              />
            </div>
            <div class="config-row">
              <span class="config-label">Show Trail</span>
              <el-checkbox
                v-model="axesOptions.showTrail"
                class="config-value"
                @change="updateAxesOptions"
              />
            </div>
            <div class="config-row">
              <span class="config-label">Alpha</span>
              <el-input-number
                v-model="axesOptions.alpha"
                size="small"
                :min="0"
                :max="1"
                :step="0.1"
                class="config-value"
                @change="updateAxesOptions"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="display-actions">
      <div class="actions-title">Global Options</div>
      <div class="action-buttons">
        <el-button size="small" @click="addDisplay">Add</el-button>
        <el-button size="small" :disabled="!selectedItem" @click="duplicateDisplay">Duplicate</el-button>
        <el-button size="small" :disabled="!selectedItem" type="danger" @click="removeDisplay">Remove</el-button>
        <el-button size="small" :disabled="!selectedItem" @click="renameDisplay">Rename</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import {
  Setting,
  Warning,
  Grid,
  Position,
  ArrowDown,
  ArrowRight,
  CircleCheck
} from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'

// 展开状态
const expandedItems = reactive<Record<string, boolean>>({
  'global-options': true,
  'global-status': true,
  'grid': true,
  'axes': true
})

const expandedSubItems = reactive<Record<string, boolean>>({
  'grid-status': true,
  'axes-status': true,
  'grid-offset': false
})

const selectedItem = ref<string>('grid')

// 配置数据
const globalOptions = reactive({
  fixedFrame: 'map',
  backgroundColor: '#303030',
  frameRate: 30,
  defaultLight: true
})

const gridOptions = reactive({
  enabled: true,
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
})

const axesOptions = reactive({
  enabled: true,
  referenceFrame: '<Fixed Frame>',
  length: 1,
  radius: 0.1,
  showTrail: false,
  alpha: 1
})

// 方法
const toggleItem = (itemId: string) => {
  expandedItems[itemId] = !expandedItems[itemId]
}

const toggleSubItem = (itemId: string) => {
  expandedSubItems[itemId] = !expandedSubItems[itemId]
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

const updateGridOptions = () => {
  emit('update:gridOptions', { ...gridOptions })
}

const updateGridOffset = () => {
  gridOptions.offset = `${gridOptions.offsetX}; ${gridOptions.offsetY}; ${gridOptions.offsetZ}`
  updateGridOptions()
}

const updateAxesOptions = () => {
  emit('update:axesOptions', { ...axesOptions })
}

const addDisplay = () => {
  ElMessageBox.prompt('Enter display name:', 'Add Display', {
    confirmButtonText: 'Add',
    cancelButtonText: 'Cancel',
    inputPattern: /.+/,
    inputErrorMessage: 'Display name cannot be empty'
  }).then(({ value }) => {
    if (value) {
      emit('addDisplay', value)
    }
  }).catch(() => {
    // User cancelled
  })
}

const duplicateDisplay = () => {
  if (selectedItem.value) {
    emit('duplicateDisplay', selectedItem.value)
  }
}

const removeDisplay = () => {
  if (!selectedItem.value) return
  ElMessageBox.confirm(
    `Are you sure you want to remove this display?`,
    'Remove Display',
    {
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel',
      type: 'warning'
    }
  ).then(() => {
    emit('removeDisplay', selectedItem.value)
  }).catch(() => {
    // User cancelled
  })
}

const renameDisplay = () => {
  if (!selectedItem.value) return
  ElMessageBox.prompt('Enter new name:', 'Rename Display', {
    confirmButtonText: 'Rename',
    cancelButtonText: 'Cancel',
    inputPattern: /.+/,
    inputErrorMessage: 'Display name cannot be empty'
  }).then(({ value }) => {
    if (value) {
      emit('renameDisplay', selectedItem.value, value)
    }
  }).catch(() => {
    // User cancelled
  })
}

const emit = defineEmits<{
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

.config-value-text {
  font-size: 12px;
  color: #909399;
  margin-left: auto;
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