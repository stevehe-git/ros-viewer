<template>
  <div class="rviz-view">
    <!-- RViz 可视化区域 -->
    <div class="rviz-container">
      <div class="rviz-header">
        <h2>RViz 可视化</h2>
        <div class="rviz-controls">
          <button
            class="control-btn"
            @click="toggleRViz"
            :class="{ active: isRVizActive }"
          >
            <i class="icon-play-pause"></i>
            {{ isRVizActive ? '停止' : '启动' }}
          </button>
          <button
            class="control-btn"
            @click="resetView"
          >
            <i class="icon-reset"></i>
            重置视图
          </button>
        </div>
      </div>

      <!-- RViz 显示区域 -->
      <div class="rviz-display" ref="rvizDisplay">
        <div v-if="!isRVizActive" class="rviz-placeholder">
          <div class="placeholder-content">
            <i class="icon-rviz"></i>
            <p>RViz 未启动</p>
            <p class="hint">点击上方启动按钮开始可视化</p>
          </div>
        </div>

        <div v-else class="rviz-active">
          <!-- RViz WebGL 画布 -->
          <canvas
            ref="rvizCanvas"
            class="rviz-canvas"
            :width="canvasWidth"
            :height="canvasHeight"
          ></canvas>

          <!-- RViz 工具栏 -->
          <div class="rviz-toolbar">
            <div class="tool-group">
              <button class="tool-btn" @click="selectTool('move')" :class="{ active: activeTool === 'move' }">
                <i class="icon-move"></i>
                移动
              </button>
              <button class="tool-btn" @click="selectTool('rotate')" :class="{ active: activeTool === 'rotate' }">
                <i class="icon-rotate"></i>
                旋转
              </button>
              <button class="tool-btn" @click="selectTool('zoom')" :class="{ active: activeTool === 'zoom' }">
                <i class="icon-zoom"></i>
                缩放
              </button>
            </div>

            <div class="tool-group">
              <button class="tool-btn" @click="toggleGrid" :class="{ active: showGrid }">
                <i class="icon-grid"></i>
                网格
              </button>
              <button class="tool-btn" @click="toggleAxes" :class="{ active: showAxes }">
                <i class="icon-axes"></i>
                坐标轴
              </button>
            </div>
          </div>

          <!-- RViz 状态信息 -->
          <div class="rviz-status">
            <div class="status-item">
              <span class="label">FPS:</span>
              <span class="value">{{ fps }}</span>
            </div>
            <div class="status-item">
              <span class="label">相机位置:</span>
              <span class="value">{{ cameraPosition }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- RViz 配置面板 -->
      <div class="rviz-config-panel">
        <div class="config-section">
          <h3>显示项</h3>
          <div class="config-item">
            <label>
              <input type="checkbox" v-model="displayOptions.laserScan" />
              激光扫描
            </label>
          </div>
          <div class="config-item">
            <label>
              <input type="checkbox" v-model="displayOptions.pointCloud" />
              点云
            </label>
          </div>
          <div class="config-item">
            <label>
              <input type="checkbox" v-model="displayOptions.robotModel" />
              机器人模型
            </label>
          </div>
          <div class="config-item">
            <label>
              <input type="checkbox" v-model="displayOptions.path" />
              路径规划
            </label>
          </div>
          <div class="config-item">
            <label>
              <input type="checkbox" v-model="displayOptions.map" />
              地图
            </label>
          </div>
        </div>

        <div class="config-section">
          <h3>相机设置</h3>
          <div class="config-item">
            <label>视角:</label>
            <select v-model="cameraView">
              <option value="top">俯视</option>
              <option value="side">侧视</option>
              <option value="front">前视</option>
              <option value="free">自由</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useRobotStore } from '../../stores/robot'

// 响应式数据
const isRVizActive = ref(false)
const activeTool = ref('move')
const showGrid = ref(true)
const showAxes = ref(true)
const fps = ref(0)
const cameraPosition = ref('0, 0, 0')

const displayOptions = reactive({
  laserScan: true,
  pointCloud: true,
  robotModel: true,
  path: true,
  map: true
})

const cameraView = ref('free')

// DOM 引用
const rvizDisplay = ref<HTMLElement>()
// const rvizCanvas = ref<HTMLCanvasElement>()

// 计算属性
const canvasWidth = computed(() => rvizDisplay.value?.clientWidth || 800)
const canvasHeight = computed(() => rvizDisplay.value?.clientHeight || 600)

// 状态管理
// const robotStore = useRobotStore()

// 方法
function toggleRViz() {
  isRVizActive.value = !isRVizActive.value
  if (isRVizActive.value) {
    initializeRViz()
  } else {
    stopRViz()
  }
}

function resetView() {
  // 重置相机视图
  cameraView.value = 'top'
  // TODO: 实现实际的重置逻辑
}

function selectTool(tool: string) {
  activeTool.value = tool
}

function toggleGrid() {
  showGrid.value = !showGrid.value
}

function toggleAxes() {
  showAxes.value = !showAxes.value
}

function initializeRViz() {
  // TODO: 初始化 RViz WebGL 渲染
  console.log('初始化 RViz 可视化')

  // 模拟 FPS 更新
  const fpsInterval = setInterval(() => {
    fps.value = Math.floor(Math.random() * 10) + 55
  }, 1000)

  // 清理函数
  onUnmounted(() => {
    clearInterval(fpsInterval)
  })
}

function stopRViz() {
  // TODO: 停止 RViz 渲染
  console.log('停止 RViz 可视化')
}

// 生命周期钩子
onMounted(() => {
  // 组件挂载时的初始化逻辑
})

onUnmounted(() => {
  // 组件卸载时的清理逻辑
  if (isRVizActive.value) {
    stopRViz()
  }
})
</script>

<style scoped>
.rviz-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
}

.rviz-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rviz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--panel-bg, #fff);
  border-bottom: 1px solid var(--border-color);
}

.rviz-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}

.rviz-controls {
  display: flex;
  gap: 12px;
}

.control-btn {
  padding: 8px 16px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  transition: background-color 0.2s;
}

.control-btn:hover {
  background: var(--primary-color-dark, #1976d2);
}

.control-btn.active {
  background: var(--success-color, #4caf50);
}

.rviz-display {
  flex: 1;
  position: relative;
  background: #1a1a1a;
  overflow: hidden;
}

.rviz-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}

.placeholder-content {
  text-align: center;
}

.placeholder-content i {
  font-size: 64px;
  margin-bottom: 16px;
  display: block;
}

.placeholder-content p {
  margin: 8px 0;
  font-size: 16px;
}

.hint {
  font-size: 14px !important;
  color: #999 !important;
}

.rviz-active {
  width: 100%;
  height: 100%;
  position: relative;
}

.rviz-canvas {
  width: 100%;
  height: 100%;
  display: block;
  background: #2a2a2a;
}

.rviz-toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  gap: 16px;
}

.tool-group {
  display: flex;
  gap: 4px;
}

.tool-btn {
  padding: 8px;
  background: transparent;
  border: 1px solid #555;
  border-radius: 4px;
  color: #ccc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: #777;
}

.tool-btn.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.rviz-status {
  position: absolute;
  bottom: 16px;
  left: 16px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #ccc;
}

.status-item {
  display: flex;
  gap: 4px;
}

.status-item .label {
  color: #999;
}

.status-item .value {
  color: #fff;
  font-weight: 500;
}

.rviz-config-panel {
  width: 280px;
  background: var(--panel-bg, #fff);
  border-left: 1px solid var(--border-color);
  overflow-y: auto;
  flex-shrink: 0;
}

.config-section {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.config-section:last-child {
  border-bottom: none;
}

.config-section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.config-item {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.config-item label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-color);
  cursor: pointer;
}

.config-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.config-item select {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .rviz-config-panel {
    width: 250px;
  }
}

@media (max-width: 768px) {
  .rviz-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .rviz-controls {
    align-self: stretch;
    justify-content: flex-end;
  }

  .rviz-container {
    flex-direction: column;
  }

  .rviz-config-panel {
    width: 100%;
    max-height: 200px;
    border-left: none;
    border-top: 1px solid var(--border-color);
  }

  .rviz-toolbar {
    position: static;
    margin: 8px;
    justify-content: center;
  }

  .rviz-status {
    position: static;
    margin: 8px;
    justify-content: center;
  }
}
</style>
