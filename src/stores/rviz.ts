import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { PluginRegistry } from '@/plugins/communication'
import { topicSubscriptionManager } from '@/services/topicSubscriptionManager'

// Display组件配置接口
export interface DisplayComponentData {
  id: string
  type: string
  name: string
  enabled: boolean
  expanded: boolean
  options: Record<string, any>
}

// 全局选项接口
export interface GlobalOptions {
  fixedFrame: string
  backgroundColor: string
  frameRate: number
  defaultLight: boolean
}

// 连接参数接口
export interface ConnectionParams {
  host: string
  port: number
  [key: string]: any
}

// 通信插件接口
export interface CommunicationPlugin {
  id: string
  name: string
  description: string
  // 获取连接参数配置
  getConnectionParams(): ConnectionParam[]
  connect(params: ConnectionParams): Promise<boolean>
  disconnect(): void
  isConnected(): boolean
  getConnectionInfo(): ConnectionParams & { status: string }
}

// 连接参数配置接口
export interface ConnectionParam {
  key: string
  label: string
  type: 'text' | 'number' | 'password' | 'select'
  required: boolean
  defaultValue: any
  options?: { label: string; value: any }[] // 用于select类型
  placeholder?: string
  description?: string
}

// 机器人连接接口
export interface RobotConnection {
  protocol: string
  params: ConnectionParams
  connected: boolean
  availablePlugins: CommunicationPlugin[]
}

// 悬浮面板信息接口
export interface FloatingPanelInfo {
  panelId: string
  x: number
  y: number
  width: number
  height: number
}

// 面板配置接口
export interface PanelConfig {
  enabledPanels: string[]
  panelWidth: number
  isFullscreen: boolean
  floatingPanels?: FloatingPanelInfo[]
  imagePanelOrder?: string[] // 图像面板的显示顺序（componentId 数组）
  allPanelsOrder?: string[] // 所有面板的统一顺序（标准面板ID + image-${componentId}）
}

// 3D场景状态接口
export interface SceneState {
  showGrid: boolean
  showAxes: boolean
  showRobot: boolean
  showMap: boolean
  showPath: boolean
  showLaser: boolean
  cameraMode: string
  backgroundColor: string
  fps: number
  cameraPos: { x: number; y: number; z: number }
  objectCount: number
  memoryUsage: number
  textureCount: number
  isRecording: boolean
  performanceMode: boolean
  showDebugInfo: boolean
}

export const useRvizStore = defineStore('rviz', () => {
  // 通信插件注册表
  const communicationPlugins = ref<Map<string, CommunicationPlugin>>(new Map())

  // 当前使用的插件实例
  let currentPlugin: CommunicationPlugin | null = null

  // 机器人连接
  const robotConnection = reactive<RobotConnection>({
    protocol: 'ros',
    params: {
      host: 'localhost',
      port: 9090
    },
    connected: false,
    availablePlugins: []
  })

  // 面板配置
  const panelConfig = reactive<PanelConfig>({
    enabledPanels: ['view-control', 'scene-info', 'tools', 'display'],
    panelWidth: 300,
    isFullscreen: false,
    floatingPanels: [],
    imagePanelOrder: [],
    allPanelsOrder: [] // 统一的面板顺序
  })

  // 全局选项
  const globalOptions = reactive<GlobalOptions>({
    fixedFrame: 'map',
    backgroundColor: '#303030',
    frameRate: 30,
    defaultLight: true
  })

  // 3D场景状态
  const sceneState = reactive<SceneState>({
    showGrid: true,
    showAxes: true,
    showRobot: true,
    showMap: true,
    showPath: false,
    showLaser: false,
    cameraMode: 'orbit',
    backgroundColor: '#fdfdfd',
    fps: 30,
    cameraPos: { x: 0, y: 0, z: 0 },
    objectCount: 0,
    memoryUsage: 0,
    textureCount: 0,
    isRecording: false,
    performanceMode: false,
    showDebugInfo: false
  })

  // Display组件列表
  const displayComponents = ref<DisplayComponentData[]>([])

  // 选中的组件ID
  const selectedItem = ref<string>('')

  // 组件数据缓存（用于存储从话题订阅接收的数据）
  const componentDataCache = ref<Map<string, any>>(new Map())

  // 更新组件数据（从话题订阅接收的数据）
  const updateComponentData = (componentId: string, data: any) => {
    componentDataCache.value.set(componentId, data)
  }

  // 获取组件数据
  // 优先从统一订阅管理器获取最新数据（单一数据源）
  const getComponentData = (componentId: string): any | null => {
    // 优先从统一订阅管理器获取最新数据
    const latestMessage = topicSubscriptionManager.getLatestMessage(componentId)
    if (latestMessage) {
      return latestMessage
    }
    // 回退到缓存（兼容旧代码，但应该逐步移除）
    return componentDataCache.value.get(componentId) || null
  }

  // 清除组件数据
  const clearComponentData = (componentId: string) => {
    componentDataCache.value.delete(componentId)
    topicSubscriptionManager.clearCache(componentId)
  }

  // 订阅组件话题（统一管理）
  const subscribeComponentTopic = (componentId: string, componentType: string, topic: string | undefined, queueSize: number = 10): boolean => {
    console.log("subscribeComponentTopic", componentId, componentType, topic, queueSize)
    return topicSubscriptionManager.subscribe(componentId, componentType, topic, queueSize)
  }

  // 取消订阅组件话题
  const unsubscribeComponentTopic = (componentId: string) => {
    topicSubscriptionManager.unsubscribe(componentId)
  }

  // 获取组件订阅状态
  const getComponentSubscriptionStatus = (componentId: string) => {
    return topicSubscriptionManager.getStatus(componentId)
  }

  // 默认配置选项
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
        topic: '/camera/rgb/image_raw',
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
        topic: '/camera/rgb/image_raw',
        queueSize: 2,
        transportHint: 'raw'
      },
      laserscan: {
        topic: '/scan',
        queueSize: 10,
        style: 'Flat Squares',
        size: 0.01,
        alpha: 1,
        colorTransformer: 'Intensity',
        useRainbow: true,
        autocomputeIntensityBounds: true,
        minIntensity: 0,
        maxIntensity: 0,
        minColor: { r: 0, g: 0, b: 0 },
        maxColor: { r: 255, g: 255, b: 255 },
        invertRainbow: false
      },
      pointcloud2: {
        topic: '/pointcloud',
        queueSize: 10
      },
      tf: {
        showNames: true,
        showAxes: true,
        showArrows: true,
        markerScale: 1,
        markerAlpha: 1,
        updateInterval: 0,
        frameTimeout: 15,
        filterWhitelist: '',
        filterBlacklist: '',
        frames: [
          { name: 'base_footprint', enabled: true },
          { name: 'base_link', enabled: true },
          { name: 'base_scan', enabled: true },
          { name: 'camera_link', enabled: true },
          { name: 'camera_rgb_frame', enabled: true },
          { name: 'camera_rgb_optical_frame', enabled: true },
          { name: 'caster_back_left_link', enabled: true },
          { name: 'caster_back_right_link', enabled: true },
          { name: 'imu_link', enabled: true },
          { name: 'map', enabled: true },
          { name: 'odom', enabled: true },
          { name: 'wheel_left_link', enabled: true },
          { name: 'wheel_right_link', enabled: true }
        ]
      }
    }
    return defaults[type] || {}
  }

  // 添加组件
  const addComponent = (type: string, name: string) => {
    const componentId = `${type}-${Date.now()}`
    const component: DisplayComponentData = {
      id: componentId,
      type,
      name,
      enabled: true,
      expanded: true,
      options: getDefaultOptions(type)
    }
    displayComponents.value.push(component)
    selectedItem.value = componentId
    
    // 如果是图像组件，添加到统一顺序和 imagePanelOrder
    if (type === 'camera' || type === 'image') {
      if (!panelConfig.imagePanelOrder) {
        panelConfig.imagePanelOrder = []
      }
      panelConfig.imagePanelOrder.push(componentId)
      
      // 添加到统一顺序（图像面板总是添加到末尾）
      if (!panelConfig.allPanelsOrder) {
        panelConfig.allPanelsOrder = []
      }
      panelConfig.allPanelsOrder.push(`image-${componentId}`)
      
      savePanelConfig()
    }
    
    saveComponents()
    return component
  }

  // 更新组件
  const updateComponent = (componentId: string, updates: Partial<DisplayComponentData>) => {
    const component = displayComponents.value.find(c => c.id === componentId)
    if (component) {
      Object.assign(component, updates)
      // 如果更新了enabled状态，同步到sceneState
      if (updates.enabled !== undefined) {
        syncComponentToScene(component)
      }
      saveComponents()
    }
  }

  // 更新组件配置选项
  const updateComponentOptions = (componentId: string, options: Record<string, any>) => {
    const component = displayComponents.value.find(c => c.id === componentId)
    if (component) {
      component.options = { ...component.options, ...options }
      // 同步到sceneState
      syncComponentToScene(component)
      saveComponents()
    }
  }

  // 删除组件
  const removeComponent = (componentId: string) => {
    const component = displayComponents.value.find(c => c.id === componentId)
    if (component) {
      displayComponents.value.splice(displayComponents.value.indexOf(component), 1)
      if (selectedItem.value === componentId) {
        selectedItem.value = ''
      }
      // 如果是图像组件，从 imagePanelOrder 和统一顺序中移除
      if ((component.type === 'camera' || component.type === 'image')) {
        if (panelConfig.imagePanelOrder) {
          const orderIndex = panelConfig.imagePanelOrder.indexOf(componentId)
          if (orderIndex > -1) {
            panelConfig.imagePanelOrder.splice(orderIndex, 1)
          }
        }
        if (panelConfig.allPanelsOrder) {
          const allOrderIndex = panelConfig.allPanelsOrder.indexOf(`image-${componentId}`)
          if (allOrderIndex > -1) {
            panelConfig.allPanelsOrder.splice(allOrderIndex, 1)
          }
        }
        savePanelConfig()
      }
      // 同步到sceneState - 设置为false
      syncComponentToScene({ ...component, enabled: false })
      saveComponents()
    }
  }

  // 重命名组件
  const renameComponent = (componentId: string, newName: string) => {
    const component = displayComponents.value.find(c => c.id === componentId)
    if (component) {
      component.name = newName
      saveComponents()
    }
  }

  // 复制组件
  const duplicateComponent = (componentId: string) => {
    const component = displayComponents.value.find(c => c.id === componentId)
    if (component) {
      const duplicated: DisplayComponentData = {
        ...component,
        id: `${component.type}-${Date.now()}`,
        name: `${component.name} (Copy)`
      }
      displayComponents.value.push(duplicated)
      selectedItem.value = duplicated.id
      saveComponents()
      return duplicated
    }
  }

  // 选择组件
  const selectComponent = (componentId: string) => {
    selectedItem.value = componentId
  }

  // 同步组件状态到3D场景
  const syncComponentToScene = (component: DisplayComponentData) => {
    switch (component.type) {
      case 'grid':
        sceneState.showGrid = component.enabled
        if (component.options.alpha !== undefined) {
          sceneState.showGrid = component.enabled && component.options.alpha > 0
        }
        break
      case 'axes':
        sceneState.showAxes = component.enabled
        break
      case 'map':
        sceneState.showMap = component.enabled
        break
      case 'path':
        sceneState.showPath = component.enabled
        break
      case 'laserscan':
        sceneState.showLaser = component.enabled
        break
      // 其他组件类型可以在这里添加
    }
  }


  // 更新全局选项
  const updateGlobalOptions = (options: Partial<GlobalOptions>) => {
    Object.assign(globalOptions, options)
    // 同步backgroundColor到sceneState
    if (options.backgroundColor !== undefined) {
      sceneState.backgroundColor = options.backgroundColor
    }
    if (options.frameRate !== undefined) {
      sceneState.fps = options.frameRate
    }
    saveGlobalOptions()
  }

  // 更新场景状态
  const updateSceneState = (updates: Partial<SceneState>) => {
    Object.assign(sceneState, updates)
  }

  // 保存组件到本地存储
  const saveComponents = () => {
    localStorage.setItem('rviz-display-components', JSON.stringify(displayComponents.value))
  }

  // 保存全局选项到本地存储
  const saveGlobalOptions = () => {
    localStorage.setItem('rviz-global-options', JSON.stringify(globalOptions))
  }

  // 保存面板配置到本地存储
  const savePanelConfig = () => {
    localStorage.setItem('rviz-panel-config', JSON.stringify(panelConfig))
  }

  // 加载组件从本地存储
  const loadComponents = () => {
    const saved = localStorage.getItem('rviz-display-components')
    if (saved) {
      try {
        displayComponents.value = JSON.parse(saved)
        // 同步所有组件到sceneState
        displayComponents.value.forEach(component => {
          syncComponentToScene(component)
        })
      } catch (e) {
        console.error('Failed to load display components:', e)
      }
    } else {
      // 默认添加Grid和Axes
      addComponent('grid', 'Grid')
      addComponent('axes', 'Axes')
    }
  }

  // 加载全局选项从本地存储
  const loadGlobalOptions = () => {
    const saved = localStorage.getItem('rviz-global-options')
    if (saved) {
      try {
        const options = JSON.parse(saved)
        Object.assign(globalOptions, options)
        // 同步到sceneState
        sceneState.backgroundColor = globalOptions.backgroundColor
        sceneState.fps = globalOptions.frameRate
      } catch (e) {
        console.error('Failed to load global options:', e)
      }
    }
  }

  // 加载面板配置从本地存储
  const loadPanelConfig = () => {
    const saved = localStorage.getItem('rviz-panel-config')
    if (saved) {
      try {
        const config = JSON.parse(saved)
        Object.assign(panelConfig, config)
      } catch (e) {
        console.error('Failed to load panel config:', e)
      }
    }
  }

  // 插件管理方法
  const registerPlugin = (plugin: CommunicationPlugin) => {
    communicationPlugins.value.set(plugin.id, plugin)
    updateAvailablePlugins()
  }

  const unregisterPlugin = (pluginId: string) => {
    communicationPlugins.value.delete(pluginId)
    updateAvailablePlugins()
  }

  const getPlugin = (pluginId: string): CommunicationPlugin | null => {
    return communicationPlugins.value.get(pluginId) || null
  }

  const updateAvailablePlugins = () => {
    robotConnection.availablePlugins = Array.from(communicationPlugins.value.values())
  }

  // 机器人连接管理方法
  const connectRobot = async (protocol: string, params: ConnectionParams) => {
    try {
      // 如果已经连接，先断开
      if (currentPlugin) {
        await disconnectRobot()
      }

      // 获取对应的插件
      currentPlugin = getPlugin(protocol)
      if (!currentPlugin) {
        throw new Error(`Plugin '${protocol}' not found`)
      }

      robotConnection.protocol = protocol
      robotConnection.params = { ...params }

      // 使用插件连接
      const success = await currentPlugin.connect(params)
      if (!success) {
        throw new Error('Connection failed')
      } else {
        console.log('Connection successful')
      }

      // 先更新话题订阅管理器的 ROS 插件（在设置 connected 之前）
      // 对于 ROS 协议，在连接成功后立即设置插件
      // ROS 实例在 connect 方法中已经创建（在 connection 事件之前）
      if (protocol === 'ros' && currentPlugin) {
        topicSubscriptionManager.setROSPlugin(currentPlugin)
      }

      // 最后设置连接状态，这会触发 watch 订阅话题
      robotConnection.connected = true

      return true
    } catch (error) {
      console.error('Robot connection failed:', error)
      robotConnection.connected = false
      currentPlugin = null
      return false
    }
  }

  const disconnectRobot = () => {
    try {
      if (currentPlugin) {
        currentPlugin.disconnect()
        currentPlugin = null
      }

      robotConnection.connected = false

      // 断开连接时取消所有订阅
      topicSubscriptionManager.unsubscribeAll()
      topicSubscriptionManager.clearAllCache()
      topicSubscriptionManager.setROSPlugin(null)
    } catch (error) {
      console.error('Robot disconnection failed:', error)
    }
  }

  // ROS连接实现

  // MQTT连接实现（预留）

  // 面板配置管理方法
  const updatePanelConfig = (config: Partial<PanelConfig>) => {
    Object.assign(panelConfig, config)
    savePanelConfig()
  }

  const togglePanel = (panelId: string) => {
    const index = panelConfig.enabledPanels.indexOf(panelId)
    if (index === -1) {
      panelConfig.enabledPanels.push(panelId)
    } else {
      panelConfig.enabledPanels.splice(index, 1)
    }
    savePanelConfig()
  }

  const isPanelEnabled = (panelId: string): boolean => {
    return panelConfig.enabledPanels.includes(panelId)
  }

  // 将面板移到悬浮窗口
  const floatPanel = (panelId: string, x?: number, y?: number, width?: number, height?: number) => {
    if (!panelConfig.floatingPanels) {
      panelConfig.floatingPanels = []
    }
    
    // 如果已经在悬浮列表中，更新位置
    const existingPanel = panelConfig.floatingPanels.find(p => p.panelId === panelId)
    if (existingPanel) {
      if (x !== undefined) existingPanel.x = x
      if (y !== undefined) existingPanel.y = y
      if (width !== undefined) existingPanel.width = width
      if (height !== undefined) existingPanel.height = height
      savePanelConfig()
      return
    }
    
    // 从 enabledPanels 中移除（仅对标准面板）
    if (!panelId.startsWith('image-')) {
      const index = panelConfig.enabledPanels.indexOf(panelId)
      if (index > -1) {
        panelConfig.enabledPanels.splice(index, 1)
      }
    }
    
    // 从统一顺序中移除
    if (!panelConfig.allPanelsOrder) {
      panelConfig.allPanelsOrder = []
    }
    const orderIndex = panelConfig.allPanelsOrder.indexOf(panelId)
    if (orderIndex > -1) {
      panelConfig.allPanelsOrder.splice(orderIndex, 1)
    }
    
    // 添加到悬浮列表
    panelConfig.floatingPanels.push({
      panelId,
      x: x || 100,
      y: y || 100,
      width: width || 268,
      height: height || 500
    })
    
    savePanelConfig()
  }

  // 将面板从悬浮窗口移回 PanelManager
  const dockPanel = (panelId: string, insertIndex?: number) => {
    if (!panelConfig.floatingPanels) return
    
    // 从悬浮列表中移除
    const floatingIndex = panelConfig.floatingPanels.findIndex(p => p.panelId === panelId)
    if (floatingIndex > -1) {
      panelConfig.floatingPanels.splice(floatingIndex, 1)
    }
    
    // 确保统一顺序存在
    if (!panelConfig.allPanelsOrder) {
      panelConfig.allPanelsOrder = []
    }
    
    // 从统一顺序中移除（如果存在）
    const currentOrderIndex = panelConfig.allPanelsOrder.indexOf(panelId)
    if (currentOrderIndex > -1) {
      panelConfig.allPanelsOrder.splice(currentOrderIndex, 1)
    }
    
    // 添加到 enabledPanels（仅对标准面板）
    if (!panelId.startsWith('image-') && !panelConfig.enabledPanels.includes(panelId)) {
      panelConfig.enabledPanels.push(panelId)
    }
    
    // 插入到统一顺序的指定位置
    if (insertIndex !== undefined && insertIndex >= 0) {
      panelConfig.allPanelsOrder.splice(insertIndex, 0, panelId)
    } else {
      // 如果没有指定位置，添加到末尾
      panelConfig.allPanelsOrder.push(panelId)
    }
    
    savePanelConfig()
  }

  // 更新悬浮面板位置
  const updateFloatingPanelPosition = (panelId: string, x: number, y: number) => {
    if (!panelConfig.floatingPanels) return
    
    const panel = panelConfig.floatingPanels.find(p => p.panelId === panelId)
    if (panel) {
      panel.x = x
      panel.y = y
      savePanelConfig()
    }
  }

  // 关闭悬浮面板
  const closeFloatingPanel = (panelId: string, insertIndex?: number) => {
    if (!panelConfig.floatingPanels) return
    
    const index = panelConfig.floatingPanels.findIndex(p => p.panelId === panelId)
    if (index > -1) {
      panelConfig.floatingPanels.splice(index, 1)
      
      // 使用统一的面板顺序管理
      if (!panelConfig.allPanelsOrder) {
        panelConfig.allPanelsOrder = []
      }
      
      // 从统一顺序中移除（如果存在）
      const currentOrderIndex = panelConfig.allPanelsOrder.indexOf(panelId)
      if (currentOrderIndex > -1) {
        panelConfig.allPanelsOrder.splice(currentOrderIndex, 1)
      }
      
      // 将面板重新添加到 enabledPanels（仅对标准面板）
      if (!panelId.startsWith('image-') && !panelConfig.enabledPanels.includes(panelId)) {
        panelConfig.enabledPanels.push(panelId)
      }
      
      // 插入到统一顺序的指定位置
      if (insertIndex !== undefined && insertIndex >= 0) {
        panelConfig.allPanelsOrder.splice(insertIndex, 0, panelId)
      } else {
        // 如果没有指定位置，添加到末尾
        panelConfig.allPanelsOrder.push(panelId)
      }
      
      savePanelConfig()
    }
  }


  // 获取悬浮面板列表
  const getFloatingPanels = (): FloatingPanelInfo[] => {
    return panelConfig.floatingPanels || []
  }

  // 重新排序所有面板（用于 PanelManager 内部拖拽）
  const reorderAllPanels = (fromIndex: number, toIndex: number) => {
    if (!panelConfig.allPanelsOrder) {
      panelConfig.allPanelsOrder = []
      // 初始化：先添加标准面板，再添加图像面板
      for (const panelId of panelConfig.enabledPanels) {
        panelConfig.allPanelsOrder.push(panelId)
      }
      if (panelConfig.imagePanelOrder) {
        for (const componentId of panelConfig.imagePanelOrder) {
          panelConfig.allPanelsOrder.push(`image-${componentId}`)
        }
      }
    }
    
    if (fromIndex === toIndex) return
    if (fromIndex < 0 || fromIndex >= panelConfig.allPanelsOrder.length) return
    if (toIndex < 0 || toIndex >= panelConfig.allPanelsOrder.length) return
    
    const panelId = panelConfig.allPanelsOrder[fromIndex]
    if (!panelId) return
    
    // 从原位置移除
    panelConfig.allPanelsOrder.splice(fromIndex, 1)
    
    // 调整目标索引（如果从前面移除，目标索引需要减1）
    const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
    
    // 插入到新位置
    panelConfig.allPanelsOrder.splice(adjustedToIndex, 0, panelId)
    
    savePanelConfig()
  }

  // 配置管理方法
  const saveCurrentConfig = () => {
    const config = {
      panelConfig: { ...panelConfig },
      globalOptions: { ...globalOptions },
      displayComponents: [...displayComponents.value],
      sceneState: { ...sceneState }
    }
    localStorage.setItem('rviz-full-config', JSON.stringify(config))
    return config
  }

  const loadSavedConfig = () => {
    const saved = localStorage.getItem('rviz-full-config')
    if (saved) {
      try {
        const config = JSON.parse(saved)
        if (config.panelConfig) Object.assign(panelConfig, config.panelConfig)
        if (config.globalOptions) Object.assign(globalOptions, config.globalOptions)
        if (config.displayComponents) displayComponents.value = config.displayComponents
        if (config.sceneState) Object.assign(sceneState, config.sceneState)
        return config
      } catch (e) {
        console.error('Failed to load config:', e)
      }
    }
    return null
  }

  const exportConfig = () => {
    const config = saveCurrentConfig()
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.download = `rviz-config-${new Date().getTime()}.json`
    link.href = URL.createObjectURL(blob)
    link.click()
  }

  const importConfig = (configData: any) => {
    try {
      if (configData.panelConfig) Object.assign(panelConfig, configData.panelConfig)
      if (configData.globalOptions) Object.assign(globalOptions, configData.globalOptions)
      if (configData.displayComponents) displayComponents.value = configData.displayComponents
      if (configData.sceneState) Object.assign(sceneState, configData.sceneState)

      // 保存到本地存储
      saveCurrentConfig()
      return true
    } catch (e) {
      console.error('Failed to import config:', e)
      return false
    }
  }

  // 初始化统一面板顺序（如果不存在）
  const initAllPanelsOrder = () => {
    if (!panelConfig.allPanelsOrder || panelConfig.allPanelsOrder.length === 0) {
      // 从现有的 enabledPanels 和 imagePanelOrder 创建统一顺序
      panelConfig.allPanelsOrder = []
      
      // 先添加标准面板
      for (const panelId of panelConfig.enabledPanels) {
        panelConfig.allPanelsOrder.push(panelId)
      }
      
      // 再添加图像面板
      if (panelConfig.imagePanelOrder) {
        for (const componentId of panelConfig.imagePanelOrder) {
          panelConfig.allPanelsOrder.push(`image-${componentId}`)
        }
      }
      
      savePanelConfig()
    }
  }

  // 初始化
  const init = () => {
    // 初始化统一面板顺序
    initAllPanelsOrder()
    
    // 注册所有通信插件
    PluginRegistry.registerAll({ registerPlugin })

    loadPanelConfig()
    loadGlobalOptions()
    loadComponents()
  }

  // 重置场景
  const resetScene = () => {
    sceneState.showRobot = true
    sceneState.showMap = true
    sceneState.showPath = false
    sceneState.showLaser = false
    sceneState.showGrid = true
    sceneState.showAxes = true
    sceneState.backgroundColor = '#fdfdfd'
    sceneState.cameraMode = 'orbit'
    sceneState.isRecording = false
    sceneState.performanceMode = false
    sceneState.showDebugInfo = false

    // 更新全局选项
    globalOptions.backgroundColor = '#303030'
    globalOptions.frameRate = 30
    globalOptions.defaultLight = true

    saveGlobalOptions()
  }

  return {
    // 状态
    robotConnection,
    panelConfig,
    globalOptions,
    sceneState,
    displayComponents,
    selectedItem,
    componentDataCache,

    // 方法
    addComponent,
    updateComponent,
    updateComponentOptions,
    updateComponentData,
    getComponentData,
    clearComponentData,
    subscribeComponentTopic,
    unsubscribeComponentTopic,
    getComponentSubscriptionStatus,
    removeComponent,
    renameComponent,
    duplicateComponent,
    selectComponent,
    updateGlobalOptions,
    updateSceneState,
    connectRobot,
    disconnectRobot,
    registerPlugin,
    unregisterPlugin,
    getPlugin,
    updatePanelConfig,
    togglePanel,
    isPanelEnabled,
    floatPanel,
    dockPanel,
    updateFloatingPanelPosition,
    closeFloatingPanel,
    getFloatingPanels,
    reorderAllPanels,
    saveCurrentConfig,
    loadSavedConfig,
    exportConfig,
    importConfig,
    init,
    resetScene,
    saveComponents,
    saveGlobalOptions,
    savePanelConfig,
    loadComponents,
    loadGlobalOptions,
    loadPanelConfig
  }
})