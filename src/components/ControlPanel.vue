<template>
  <div class="control-panel">
    <!-- 连接控制 -->
    <div class="control-section">
      <h4>连接控制</h4>
      <div class="connection-controls">
        <div class="form-group">
          <label>协议类型</label>
          <select v-model="selectedProtocol" class="form-control">
            <option value="ros">ROS</option>
            <option value="mqtt">MQTT</option>
            <option value="websocket">WebSocket</option>
          </select>
        </div>

        <div class="form-group">
          <label>服务器地址</label>
          <input
            v-model="connectionUrl"
            type="text"
            class="form-control"
            placeholder="ws://localhost:9090"
          />
        </div>

        <div class="connection-actions">
          <button
            @click="connect"
            :disabled="isConnecting || isConnected"
            class="btn btn-primary"
          >
            {{ isConnecting ? '连接中...' : isConnected ? '已连接' : '连接' }}
          </button>

          <button
            @click="disconnect"
            :disabled="!isConnected"
            class="btn btn-secondary"
          >
            断开
          </button>
        </div>

        <div v-if="connectionError" class="connection-error">
          <i class="error-icon">⚠️</i>
          <span>{{ connectionError }}</span>
        </div>
      </div>
    </div>

    <!-- 数据订阅 -->
    <div class="control-section">
      <h4>数据订阅</h4>
      <div class="subscription-controls">
        <div class="subscription-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="subscriptions.map"
              @change="updateSubscriptions"
            />
            <span class="checkmark"></span>
            地图数据
          </label>
        </div>

        <div class="subscription-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="subscriptions.odom"
              @change="updateSubscriptions"
            />
            <span class="checkmark"></span>
            里程计数据
          </label>
        </div>

        <div class="subscription-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="subscriptions.laserScan"
              @change="updateSubscriptions"
            />
            <span class="checkmark"></span>
            激光扫描
          </label>
        </div>

        <div class="subscription-item">
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="subscriptions.path"
              @change="updateSubscriptions"
            />
            <span class="checkmark"></span>
            路径规划
          </label>
        </div>
      </div>
    </div>

    <!-- 导航控制 -->
    <div class="control-section" v-if="isConnected">
      <h4>导航控制</h4>
      <div class="navigation-controls">
        <div class="form-group">
          <label>目标 X 坐标</label>
          <input
            v-model.number="goalPosition.x"
            type="number"
            step="0.1"
            class="form-control"
            placeholder="0.0"
          />
        </div>

        <div class="form-group">
          <label>目标 Y 坐标</label>
          <input
            v-model.number="goalPosition.y"
            type="number"
            step="0.1"
            class="form-control"
            placeholder="0.0"
          />
        </div>

        <div class="form-group">
          <label>目标角度 (°)</label>
          <input
            v-model.number="goalPosition.theta"
            type="number"
            step="1"
            class="form-control"
            placeholder="0"
          />
        </div>

        <div class="navigation-actions">
          <button
            @click="sendGoal"
            :disabled="!canSendGoal"
            class="btn btn-success"
          >
            发送目标
          </button>

          <button
            @click="cancelGoal"
            :disabled="!hasActiveGoal"
            class="btn btn-warning"
          >
            取消目标
          </button>
        </div>
      </div>
    </div>

    <!-- 服务调用 -->
    <div class="control-section" v-if="isConnected">
      <h4>服务调用</h4>
      <div class="service-controls">
        <button
          @click="clearCostmaps"
          :disabled="isCallingService"
          class="btn btn-outline"
        >
          {{ isCallingService ? '执行中...' : '清除代价地图' }}
        </button>
      </div>
    </div>

    <!-- 视图控制 -->
    <div class="control-section">
      <h4>视图控制</h4>
      <div class="view-controls">
        <button @click="centerOnRobot" class="btn btn-outline">
          <i class="icon-center"></i>
          居中机器人
        </button>

        <button @click="resetView" class="btn btn-outline">
          <i class="icon-reset"></i>
          重置视图
        </button>

        <div class="zoom-controls">
          <button @click="zoomIn" class="btn btn-outline btn-small">
            <i class="icon-zoom-in"></i>
          </button>

          <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>

          <button @click="zoomOut" class="btn btn-outline btn-small">
            <i class="icon-zoom-out"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUIStore } from '../stores/ui'
import { useRobotStore } from '../stores/robot'
import { protocolManager } from '../core/protocols/ProtocolManager'

// Store
const uiStore = useUIStore()
const robotStore = useRobotStore()

// 响应式数据
const selectedProtocol = ref<'ros' | 'mqtt' | 'websocket'>('ros')
const connectionUrl = ref('ws://localhost:9090')
const isConnecting = ref(false)
const isCallingService = ref(false)
const connectionError = ref<string | null>(null)

const goalPosition = ref({
  x: 0,
  y: 0,
  theta: 0
})

const subscriptions = ref({
  map: true,
  odom: true,
  laserScan: true,
  path: true
})

// 视图控制相关
const scale = ref(50) // 像素/米

// 计算属性
const isConnected = computed(() => {
  return protocolManager.getAllActiveProtocols().size > 0
})

const canSendGoal = computed(() => {
  return isConnected.value && robotStore.currentRobot?.status === 'online'
})

const hasActiveGoal = computed(() => {
  return robotStore.goals.size > 0
})

// 监听连接状态
watch(isConnected, (connected) => {
  if (connected) {
    // 连接成功后自动订阅数据
    updateSubscriptions()
  }
})

// 方法
const connect = async () => {
  if (isConnecting.value) return

  isConnecting.value = true
  connectionError.value = null

  try {
    await protocolManager.createAndConnectProtocol('main', selectedProtocol.value, {
      type: selectedProtocol.value,
      url: connectionUrl.value
    })

    console.log(`Connected to ${selectedProtocol.value}:`, connectionUrl.value)

    // 显示成功通知
    uiStore.addNotification({
      type: 'success',
      title: '连接成功',
      message: `已连接到 ${selectedProtocol.value} 服务器`
    })

  } catch (error) {
    console.error('Connection failed:', error)
    connectionError.value = (error as Error).message

    uiStore.addNotification({
      type: 'error',
      title: '连接失败',
      message: (error as Error).message
    })
  } finally {
    isConnecting.value = false
  }
}

const disconnect = async () => {
  try {
    await protocolManager.disconnectProtocol('main')
    console.log('Disconnected')

    uiStore.addNotification({
      type: 'info',
      title: '已断开连接',
      message: '与服务器的连接已断开'
    })

  } catch (error) {
    console.error('Disconnect failed:', error)
  }
}

const updateSubscriptions = () => {
  if (!isConnected.value) return

  const protocol = protocolManager.getActiveProtocol('main')
  if (!protocol) return

  // 取消所有当前订阅
  // TODO: 实现取消订阅

  // 根据选择重新订阅
  const subscribePromises: Promise<void>[] = []

  if (subscriptions.value.map) {
    subscribePromises.push(protocol.subscribe('/map', (packet) => {
      robotStore.processDataPacket(packet)
    }))
  }

  if (subscriptions.value.odom) {
    subscribePromises.push(protocol.subscribe('/odom', (packet) => {
      robotStore.processDataPacket(packet)
    }))
  }

  if (subscriptions.value.laserScan) {
    subscribePromises.push(protocol.subscribe('/scan', (packet) => {
      robotStore.processDataPacket(packet)
    }))
  }

  if (subscriptions.value.path) {
    subscribePromises.push(protocol.subscribe('/move_base/NavfnROS/plan', (packet) => {
      robotStore.processDataPacket(packet)
    }))
    subscribePromises.push(protocol.subscribe('/move_base/DWAPlannerROS/local_plan', (packet) => {
      robotStore.processDataPacket(packet)
    }))
  }

  Promise.all(subscribePromises).then(() => {
    console.log('Subscriptions updated')
  }).catch(error => {
    console.error('Subscription error:', error)
  })
}

const sendGoal = () => {
  if (!canSendGoal.value) return

  const protocol = protocolManager.getActiveProtocol('main')
  if (!protocol) return

  const goalData = {
    header: {
      stamp: {
        sec: Math.floor(Date.now() / 1000),
        nsec: (Date.now() % 1000) * 1000000
      },
      frame_id: 'map'
    },
    pose: {
      position: {
        x: goalPosition.value.x,
        y: goalPosition.value.y,
        z: 0
      },
      orientation: {
        x: 0,
        y: 0,
        z: Math.sin(goalPosition.value.theta * Math.PI / 360),
        w: Math.cos(goalPosition.value.theta * Math.PI / 360)
      }
    }
  }

  protocol.publish('/move_base_simple/goal', goalData, 'geometry_msgs/PoseStamped')
    .then(() => {
      uiStore.addNotification({
        type: 'success',
        title: '目标已发送',
        message: `目标位置: (${goalPosition.value.x}, ${goalPosition.value.y})`
      })
    })
    .catch(error => {
      console.error('Send goal failed:', error)
      uiStore.addNotification({
        type: 'error',
        title: '发送目标失败',
        message: error.message
      })
    })
}

const cancelGoal = () => {
  const protocol = protocolManager.getActiveProtocol('main')
  if (!protocol) return

  const cancelData = {
    stamp: {
      sec: Math.floor(Date.now() / 1000),
      nsec: (Date.now() % 1000) * 1000000
    },
    id: '' // 取消所有目标
  }

  protocol.publish('/move_base/cancel', cancelData, 'actionlib_msgs/GoalID')
    .then(() => {
      uiStore.addNotification({
        type: 'info',
        title: '目标已取消',
        message: '导航目标已取消'
      })
    })
    .catch(error => {
      console.error('Cancel goal failed:', error)
    })
}

const clearCostmaps = async () => {
  if (isCallingService.value) return

  const protocol = protocolManager.getActiveProtocol('main')
  if (!protocol) return

  isCallingService.value = true

  try {
    await protocol.callService('/move_base/clear_costmaps', {})

    uiStore.addNotification({
      type: 'success',
      title: '代价地图已清除',
      message: '全局和局部代价地图已重置'
    })

  } catch (error) {
    console.error('Clear costmaps failed:', error)
    uiStore.addNotification({
      type: 'error',
      title: '清除失败',
      message: (error as Error).message
    })
  } finally {
    isCallingService.value = false
  }
}

const centerOnRobot = () => {
  // TODO: 实现居中机器人视图
  uiStore.addNotification({
    type: 'info',
    title: '视图控制',
    message: '居中机器人功能开发中'
  })
}

const resetView = () => {
  scale.value = 50
  // TODO: 重置视图位置
  uiStore.addNotification({
    type: 'info',
    title: '视图控制',
    message: '重置视图功能开发中'
  })
}

const zoomIn = () => {
  scale.value = Math.min(200, scale.value * 1.2)
}

const zoomOut = () => {
  scale.value = Math.max(10, scale.value / 1.2)
}
</script>

<style scoped>
.control-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.control-section {
  background: var(--item-bg, #f8f9fa);
  border-radius: 8px;
  padding: 12px;
}

.control-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-color);
}

.form-group {
  margin-bottom: 8px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-control {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--input-bg, #fff);
  color: var(--text-color);
  font-size: 12px;
}

.form-control:focus {
  outline: none;
  border-color: var(--primary-color);
}

.connection-actions,
.navigation-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.btn {
  flex: 1;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-secondary {
  background: var(--secondary-color);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-success {
  background: var(--success-color);
  color: white;
}

.btn-success:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-warning {
  background: var(--warning-color);
  color: white;
}

.btn-warning:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-outline:hover:not(:disabled) {
  background: var(--hover-bg, rgba(0, 0, 0, 0.05));
}

.btn-small {
  padding: 4px 8px;
  font-size: 11px;
}

.connection-error {
  margin-top: 8px;
  padding: 6px 8px;
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid #f44336;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #f44336;
}

.error-icon {
  font-size: 14px;
}

/* 订阅控制 */
.subscription-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.subscription-item {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-color);
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  display: none;
}

.checkmark {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-color);
  border-radius: 3px;
  position: relative;
  transition: all 0.2s;
}

.checkbox-label input[type="checkbox"]:checked + .checkmark {
  background: var(--primary-color);
  border-color: var(--primary-color);
}

.checkbox-label input[type="checkbox"]:checked + .checkmark::after {
  content: '✓';
  position: absolute;
  top: -2px;
  left: 1px;
  font-size: 12px;
  color: white;
  font-weight: bold;
}

/* 导航控制 */
.navigation-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 服务控制 */
.service-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 视图控制 */
.view-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.zoom-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.zoom-level {
  font-size: 12px;
  font-family: 'Courier New', monospace;
  color: var(--text-secondary);
  min-width: 40px;
  text-align: center;
}

/* 图标样式 */
.icon-center::before { content: "⊕"; }
.icon-reset::before { content: "⊗"; }
.icon-zoom-in::before { content: "+"; }
.icon-zoom-out::before { content: "−"; }

/* 深色主题支持 */
[data-theme="dark"] {
  --item-bg: #2d2d2d;
  --input-bg: #373737;
  --hover-bg: rgba(255, 255, 255, 0.1);
}
</style>
