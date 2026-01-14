import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

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
    const index = displayComponents.value.findIndex(c => c.id === componentId)
    if (index !== -1) {
      displayComponents.value.splice(index, 1)
      if (selectedItem.value === componentId) {
        selectedItem.value = ''
      }
      // 同步到sceneState
      syncComponentRemoval(componentId)
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

  // 同步组件删除到3D场景
  const syncComponentRemoval = (componentId: string) => {
    const component = displayComponents.value.find(c => c.id === componentId)
    if (component) {
      syncComponentToScene({ ...component, enabled: false })
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

  // 初始化
  const init = () => {
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
    globalOptions,
    sceneState,
    displayComponents,
    selectedItem,

    // 方法
    addComponent,
    updateComponent,
    updateComponentOptions,
    removeComponent,
    renameComponent,
    duplicateComponent,
    selectComponent,
    updateGlobalOptions,
    updateSceneState,
    init,
    resetScene,
    saveComponents,
    saveGlobalOptions,
    loadComponents,
    loadGlobalOptions
  }
})