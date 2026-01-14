<template>
  <div class="rviz-viewer" :class="{ resizing: isResizing }">
    <div class="viewer-container" ref="containerRef" :style="{ width: viewerWidth }"></div>

    <!-- 可拖动分割条 -->
    <div
      v-if="rvizStore.panelConfig.enabledPanels.length > 0"
      class="splitter"
      @mousedown="startResize"
      :class="{ resizing: isResizing }"
    >
      <div class="splitter-handle"></div>
    </div>

    <!-- 面板管理系统 -->
    <PanelManager
      v-if="rvizStore.panelConfig.enabledPanels.length > 0"
      ref="panelManagerRef"
      :camera-mode="rvizStore.sceneState.cameraMode"
      :show-grid="rvizStore.sceneState.showGrid"
      :show-axes="rvizStore.sceneState.showAxes"
      :show-robot="rvizStore.sceneState.showRobot"
      :show-map="rvizStore.sceneState.showMap"
      :show-path="rvizStore.sceneState.showPath"
      :show-laser="rvizStore.sceneState.showLaser"
      :background-color="rvizStore.sceneState.backgroundColor"
      :fps="rvizStore.sceneState.fps"
      :camera-pos="rvizStore.sceneState.cameraPos"
      :object-count="rvizStore.sceneState.objectCount"
      :memory-usage="rvizStore.sceneState.memoryUsage"
      :texture-count="rvizStore.sceneState.textureCount"
      :is-recording="rvizStore.sceneState.isRecording"
      :performance-mode="rvizStore.sceneState.performanceMode"
      :show-debug-info="rvizStore.sceneState.showDebugInfo"
      :is-fullscreen="props.isFullscreen"
      @reset-camera="resetCamera"
      @toggle-grid="toggleGrid"
      @toggle-axes="toggleAxes"
      @update:camera-mode="handleCameraModeUpdate"
      @update:show-robot="handleShowRobotUpdate"
      @update:show-map="handleShowMapUpdate"
      @update:show-path="handleShowPathUpdate"
      @update:show-laser="handleShowLaserUpdate"
      @update:background-color="handleBackgroundColorUpdate"
      @take-screenshot="takeScreenshot"
      @export-scene="exportScene"
      @reset-scene="resetScene"
      @toggle-recording="toggleRecording"
      @toggle-performance-mode="togglePerformanceMode"
      @toggle-debug-info="toggleDebugInfo"
      @toggle-fullscreen="emit('toggleFullscreen')"
      @update:global-options="handleGlobalOptionsUpdate"
      @update:grid-options="handleGridOptionsUpdate"
      @update:axes-options="handleAxesOptionsUpdate"
      @add-display="handleAddDisplay"
      @duplicate-display="handleDuplicateDisplay"
      @remove-display="handleRemoveDisplay"
      @rename-display="handleRenameDisplay"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MOUSE } from 'three'
import PanelManager from './panels/PanelManager.vue'

// 使用RViz store
const rvizStore = useRvizStore()

interface Props {
  isFullscreen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isFullscreen: false
})

const emit = defineEmits<{
  toggleFullscreen: []
}>()

// Refs
const containerRef = ref<HTMLElement>()
const panelManagerRef = ref<InstanceType<typeof PanelManager> | null>(null)
let resizeObserver: ResizeObserver | null = null
let resizeTimer: number | null = null

// 分割条相关
const viewerWidth = ref('calc(100% - 300px)')
const panelWidth = ref(300)
const isResizing = ref(false)
let startX = 0
let startPanelWidth = 0

// 中键平移相关
let isMiddleMouseDown = false
let lastMousePosition = { x: 0, y: 0 }

// 场景相关
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let animationId: number

// 使用store的状态（通过计算属性或直接访问）

// FPS控制
let targetFPS = 30
let frameInterval = 1000 / targetFPS
let lastRenderTime = 0

// 3D对象
let gridHelper: THREE.GridHelper
let axesHelper: THREE.AxesHelper
let robotGroup: THREE.Group
let mapMesh: THREE.Mesh
let pathLine: THREE.Line

// 性能监控
let lastTime = performance.now()
let frameCount = 0

const initScene = () => {
  if (!containerRef.value) return

  // 创建场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(rvizStore.sceneState.backgroundColor)

  // 创建相机
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
  camera.position.set(10, 10, 10)
  camera.lookAt(0, 0, 0)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  containerRef.value.appendChild(renderer.domElement)

  // 创建控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.minDistance = 2
  controls.maxDistance = 100
  controls.maxPolarAngle = Math.PI / 2
  
  // 配置鼠标按钮：左键旋转，中键平移
  controls.mouseButtons = {
    LEFT: MOUSE.ROTATE,      // 左键：旋转
    MIDDLE: MOUSE.PAN,       // 中键：平移
    RIGHT: MOUSE.ROTATE      // 右键：也设置为旋转（可选）
  }
  
  // 启用平移功能
  controls.enablePan = true
  controls.panSpeed = 0.8

  // 创建网格和坐标轴（使用配置选项）
  updateGridHelper()
  updateAxesHelper()

  // 创建机器人模型
  createRobot()

  // 创建地图
  createMap()

  // 创建路径
  createPath()

  // 添加灯光
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(10, 10, 5)
  directionalLight.castShadow = true
  scene.add(directionalLight)

  // 窗口大小调整
  window.addEventListener('resize', onWindowResize)

  // 使用ResizeObserver监听容器尺寸变化（更可靠）
  if (containerRef.value && window.ResizeObserver) {
    resizeObserver = new ResizeObserver((entries) => {
      // 使用防抖避免频繁调用
      if (resizeTimer) {
        cancelAnimationFrame(resizeTimer)
      }
      resizeTimer = requestAnimationFrame(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          if (width > 0 && height > 0 && renderer && camera) {
            camera.aspect = width / height
            camera.updateProjectionMatrix()
            renderer.setSize(width, height)
          }
        }
      })
    })
    resizeObserver.observe(containerRef.value)
  }

  // 设置中键平移功能
  setupMiddleMousePan()

  // 开始渲染循环
  animate()
}

const updateGridHelper = () => {
  if (!scene) return

  // 移除现有的网格
  if (gridHelper) {
    scene.remove(gridHelper)
  }

  // 获取grid配置
  const gridComponent = rvizStore.displayComponents.find(c => c.type === 'grid')
  const options = gridComponent?.options || {}

  // 使用配置选项创建网格
  const cellSize = options.cellSize || 1
  const planeCellCount = options.planeCellCount || 10
  const color = options.color || '#a0a0a4'

  // 将颜色字符串转换为Three.js颜色
  const threeColor = new THREE.Color(color)

  gridHelper = new THREE.GridHelper(
    planeCellCount * cellSize,
    planeCellCount,
    threeColor,
    threeColor.clone().multiplyScalar(0.5)
  )

  // 设置透明度
  if (options.alpha !== undefined) {
    gridHelper.material.transparent = true
    gridHelper.material.opacity = options.alpha
  }

  // 设置位置偏移
  if (options.offsetX || options.offsetY || options.offsetZ) {
    gridHelper.position.set(
      options.offsetX || 0,
      options.offsetY || 0,
      options.offsetZ || 0
    )
  }

  scene.add(gridHelper)
  gridHelper.visible = rvizStore.sceneState.showGrid
}

const updateAxesHelper = () => {
  if (!scene) return

  // 移除现有的坐标轴
  if (axesHelper) {
    scene.remove(axesHelper)
  }

  // 获取axes配置
  const axesComponent = rvizStore.displayComponents.find(c => c.type === 'axes')
  const options = axesComponent?.options || {}

  // 使用配置选项创建坐标轴
  const length = options.length || 1
  axesHelper = new THREE.AxesHelper(length)

  // 设置透明度
  if (options.alpha !== undefined) {
    axesHelper.material.transparent = true
    axesHelper.material.opacity = options.alpha
  }

  scene.add(axesHelper)
  axesHelper.visible = rvizStore.sceneState.showAxes
}

const createRobot = () => {
  robotGroup = new THREE.Group()

  // 机器人主体（立方体）
  const bodyGeometry = new THREE.BoxGeometry(1, 0.5, 1)
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x409eff })
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
  body.position.y = 0.25
  body.castShadow = true
  robotGroup.add(body)

  // 机器人顶部（圆柱体）
  const topGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16)
  const topMaterial = new THREE.MeshStandardMaterial({ color: 0x67c23a })
  const top = new THREE.Mesh(topGeometry, topMaterial)
  top.position.set(0, 0.6, 0)
  top.castShadow = true
  robotGroup.add(top)

  // 机器人位置
  robotGroup.position.set(0, 0, 0)
  scene.add(robotGroup)
}

const createMap = () => {
  // 创建简单的占用网格地图
  const mapGeometry = new THREE.PlaneGeometry(10, 10, 10, 10)
  const mapMaterial = new THREE.MeshStandardMaterial({
    color: 0x666666,
    wireframe: false,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide
  })
  mapMesh = new THREE.Mesh(mapGeometry, mapMaterial)
  mapMesh.rotation.x = -Math.PI / 2
  mapMesh.position.y = 0
  mapMesh.receiveShadow = true
  scene.add(mapMesh)
}

const createPath = () => {
  // 创建路径点
  const points = [
    new THREE.Vector3(-5, 0.1, -5),
    new THREE.Vector3(-3, 0.1, -3),
    new THREE.Vector3(0, 0.1, 0),
    new THREE.Vector3(3, 0.1, 3),
    new THREE.Vector3(5, 0.1, 5)
  ]

  const pathGeometry = new THREE.BufferGeometry().setFromPoints(points)
  const pathMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 })
  pathLine = new THREE.Line(pathGeometry, pathMaterial)
  scene.add(pathLine)
}

const resetCamera = () => {
  camera.position.set(10, 10, 10)
  camera.lookAt(0, 0, 0)
  controls.reset()
}

const toggleGrid = () => {
  rvizStore.sceneState.showGrid = !rvizStore.sceneState.showGrid
  if (gridHelper) {
    gridHelper.visible = rvizStore.sceneState.showGrid
  }
}

const toggleAxes = () => {
  rvizStore.sceneState.showAxes = !rvizStore.sceneState.showAxes
  if (axesHelper) {
    axesHelper.visible = rvizStore.sceneState.showAxes
  }
}

// 设置中键平移功能
const setupMiddleMousePan = () => {
  if (!containerRef.value) return

  const canvas = containerRef.value

  // 中键按下
  const onMouseDown = (event: MouseEvent) => {
    if (event.button === 1) { // 中键
      event.preventDefault()
      isMiddleMouseDown = true
      lastMousePosition.x = event.clientX
      lastMousePosition.y = event.clientY
      canvas.style.cursor = 'move'
    }
  }

  // 中键移动
  const onMouseMove = (event: MouseEvent) => {
    if (isMiddleMouseDown && controls) {
      event.preventDefault()
      
      const deltaX = event.clientX - lastMousePosition.x
      const deltaY = event.clientY - lastMousePosition.y
      
      // 计算平移距离（根据屏幕尺寸和相机距离调整）
      const panSpeed = 0.002
      const panVector = new THREE.Vector3()
      
      // 计算平移方向
      const right = new THREE.Vector3()
      const up = new THREE.Vector3()
      camera.getWorldDirection(new THREE.Vector3())
      right.setFromMatrixColumn(camera.matrixWorld, 0)
      up.setFromMatrixColumn(camera.matrixWorld, 1)
      
      // 应用平移
      panVector.addScaledVector(right, -deltaX * panSpeed)
      panVector.addScaledVector(up, deltaY * panSpeed)
      
      controls.target.add(panVector)
      camera.position.add(panVector)
      
      lastMousePosition.x = event.clientX
      lastMousePosition.y = event.clientY
    }
  }

  // 中键释放
  const onMouseUp = (event: MouseEvent) => {
    if (event.button === 1) { // 中键
      event.preventDefault()
      isMiddleMouseDown = false
      canvas.style.cursor = 'default'
    }
  }

  // 防止中键默认行为（打开新标签页等）
  const onContextMenu = (event: MouseEvent) => {
    if (event.button === 1) {
      event.preventDefault()
    }
  }

  // 防止中键滚动
  const onWheel = (event: WheelEvent) => {
    if (event.button === 1) {
      event.preventDefault()
    }
  }

  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('mouseleave', () => {
    isMiddleMouseDown = false
    canvas.style.cursor = 'default'
  })
  canvas.addEventListener('contextmenu', onContextMenu)

  // 保存事件处理器以便清理
  ;(canvas as any)._middleMouseHandlers = {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onContextMenu,
    onWheel
  }
}

const onWindowResize = () => {
  if (!containerRef.value || !renderer || !camera) return

  // 使用requestAnimationFrame确保在下一帧更新，避免布局抖动
  if (resizeTimer) {
    cancelAnimationFrame(resizeTimer)
  }

  resizeTimer = requestAnimationFrame(() => {
    // 再次检查containerRef.value是否仍然有效
    if (!containerRef.value || !renderer || !camera) return

    const width = containerRef.value.clientWidth
    const height = containerRef.value.clientHeight

    // 确保尺寸有效
    if (width > 0 && height > 0) {
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
  })
}

const updateObjectCount = () => {
  let count = 0
  scene.traverse(() => {
    count++
  })
  rvizStore.sceneState.objectCount = count
}

const updateMemoryUsage = () => {
  if (renderer && renderer.info) {
    // Three.js的内存信息 (MB)
    const memoryInfo = renderer.info.memory
    rvizStore.sceneState.memoryUsage = Math.round((memoryInfo.geometries + memoryInfo.textures) * 0.001)
  }
}

const updateTextureCount = () => {
  let count = 0
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      if (Array.isArray(child.material)) {
        count += child.material.length
      } else {
        count += 1
      }
    }
  })
  rvizStore.sceneState.textureCount = count
}

// 处理面板事件
const handleCameraModeUpdate = (value: string) => {
  rvizStore.sceneState.cameraMode = value
}

const handleShowRobotUpdate = (value: boolean) => {
  rvizStore.sceneState.showRobot = value
}

const handleShowMapUpdate = (value: boolean) => {
  rvizStore.sceneState.showMap = value
}

const handleShowPathUpdate = (value: boolean) => {
  rvizStore.sceneState.showPath = value
}

const handleShowLaserUpdate = (value: boolean) => {
  rvizStore.sceneState.showLaser = value
}

const handleBackgroundColorUpdate = (value: string) => {
  rvizStore.sceneState.backgroundColor = value
}

// 工具面板处理函数
const takeScreenshot = () => {
  if (renderer && containerRef.value) {
    const canvas = renderer.domElement
    const link = document.createElement('a')
    link.download = `rviz-screenshot-${new Date().getTime()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }
}

const exportScene = () => {
  // 导出场景数据的功能
  const sceneData = {
    camera: {
      position: camera.position,
      target: controls.target
    },
    objects: {
      showRobot: rvizStore.sceneState.showRobot,
      showMap: rvizStore.sceneState.showMap,
      showPath: rvizStore.sceneState.showPath,
      showLaser: rvizStore.sceneState.showLaser
    },
    display: {
      showGrid: rvizStore.sceneState.showGrid,
      showAxes: rvizStore.sceneState.showAxes,
      backgroundColor: rvizStore.sceneState.backgroundColor
    }
  }

  const blob = new Blob([JSON.stringify(sceneData, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.download = `rviz-scene-${new Date().getTime()}.json`
  link.href = URL.createObjectURL(blob)
  link.click()
}

const resetScene = () => {
  // 重置所有场景设置
  rvizStore.resetScene()
  resetCamera()
}

const toggleRecording = (value: boolean) => {
  rvizStore.sceneState.isRecording = value
  // 这里可以添加录制功能的实现
}

const togglePerformanceMode = (value: boolean) => {
  rvizStore.sceneState.performanceMode = value
  // 这里可以添加性能模式的实现
}

const toggleDebugInfo = (value: boolean) => {
  rvizStore.sceneState.showDebugInfo = value
  // 这里可以添加调试信息的显示/隐藏
}

// 处理全局选项更新
const handleGlobalOptionsUpdate = (options: any) => {
  rvizStore.updateGlobalOptions(options)
  if (options.frameRate !== undefined) {
    // 可以更新FPS设置
    targetFPS = options.frameRate
    frameInterval = 1000 / targetFPS
  }
}

// 处理网格选项更新
const handleGridOptionsUpdate = (options: any) => {
  if (options.enabled !== undefined) {
    rvizStore.sceneState.showGrid = options.enabled
  }
  // 可以更新网格的其他属性，如cellSize等
  if (options.cellSize !== undefined && gridHelper) {
    // 更新网格大小
    scene.remove(gridHelper)
    gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222)
    scene.add(gridHelper)
  }
}

// 处理坐标轴选项更新
const handleAxesOptionsUpdate = (options: any) => {
  if (options.enabled !== undefined) {
    rvizStore.sceneState.showAxes = options.enabled
  }
  // 可以更新坐标轴的其他属性，如length、radius等
  if (options.length !== undefined && axesHelper) {
    scene.remove(axesHelper)
    axesHelper = new THREE.AxesHelper(options.length)
    scene.add(axesHelper)
  }
}

// 处理添加显示项
const handleAddDisplay = (name: string) => {
  console.log('Add display:', name)
  // 可以在这里添加新的显示项
}

// 处理复制显示项
const handleDuplicateDisplay = (itemId: string) => {
  console.log('Duplicate display:', itemId)
  // 可以在这里复制显示项
}

// 处理删除显示项
const handleRemoveDisplay = (itemId: string) => {
  console.log('Remove display:', itemId)
  // 可以在这里删除显示项
}

// 处理重命名显示项
const handleRenameDisplay = (itemId: string, newName: string) => {
  console.log('Rename display:', itemId, 'to', newName)
  // 可以在这里重命名显示项
}

// 分割条拖动功能
const startResize = (e: MouseEvent) => {
  e.preventDefault()
  isResizing.value = true
  startX = e.clientX
  
  // 获取当前宽度
  startPanelWidth = panelWidth.value

  // 添加全局事件监听
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const handleResize = (e: MouseEvent) => {
  if (!isResizing.value) return

  const deltaX = e.clientX - startX
  const newPanelWidth = Math.max(200, Math.min(600, startPanelWidth - deltaX))
  const newViewerWidth = `calc(100% - ${newPanelWidth}px)`

  panelWidth.value = newPanelWidth
  viewerWidth.value = newViewerWidth

  // 更新面板管理器宽度
  if (panelManagerRef.value) {
    const panelElement = (panelManagerRef.value.$el as HTMLElement)
    if (panelElement) {
      panelElement.style.width = `${newPanelWidth}px`
    }
  }

  // 触发窗口resize以更新3D视图
  onWindowResize()
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''

  // 更新store中的面板宽度
  rvizStore.updatePanelConfig({ panelWidth: panelWidth.value })
}


const updateFPS = () => {
  frameCount++
  const currentTime = performance.now()
  const delta = currentTime - lastTime

  if (delta >= 1000) {
    // 由于我们限制了渲染频率，这里显示目标FPS而不是实际的requestAnimationFrame频率
    rvizStore.sceneState.fps = targetFPS
    frameCount = 0
    lastTime = currentTime
  }
}

const updateCameraPos = () => {
  rvizStore.sceneState.cameraPos = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z
  }
}

const animate = (currentTime: number = 0) => {
  animationId = requestAnimationFrame(animate)

  // 控制渲染频率
  if (currentTime - lastRenderTime >= frameInterval) {
    lastRenderTime = currentTime

    // 更新控制器
    controls.update()

    // 更新机器人旋转（演示动画）
    if (robotGroup && rvizStore.sceneState.showRobot) {
      robotGroup.rotation.y += 0.01
    }

    // 渲染场景
    renderer.render(scene, camera)

    // 更新信息
    updateFPS()
    updateCameraPos()
    updateObjectCount()
    updateMemoryUsage()
    updateTextureCount()
  }
}

// 监听器
watch(() => rvizStore.sceneState.showRobot, (val: boolean) => {
  if (robotGroup) {
    robotGroup.visible = val
  }
})

watch(() => rvizStore.sceneState.showMap, (val: boolean) => {
  if (mapMesh) {
    mapMesh.visible = val
  }
})

watch(() => rvizStore.sceneState.showPath, (val: boolean) => {
  if (pathLine) {
    pathLine.visible = val
  }
})

watch(() => rvizStore.sceneState.backgroundColor, (val: string) => {
  if (scene) {
    scene.background = new THREE.Color(val)
  }
})

// 监听网格和坐标轴显示状态
watch(() => rvizStore.sceneState.showGrid, (val: boolean) => {
  if (gridHelper) {
    gridHelper.visible = val
  }
})

watch(() => rvizStore.sceneState.showAxes, (val: boolean) => {
  if (axesHelper) {
    axesHelper.visible = val
  }
})

// 监听grid组件的选项变化
watch(() => {
  const gridComponent = rvizStore.displayComponents.find(c => c.type === 'grid')
  return gridComponent?.options
}, () => {
  updateGridHelper()
}, { deep: true })

// 监听axes组件的选项变化
watch(() => {
  const axesComponent = rvizStore.displayComponents.find(c => c.type === 'axes')
  return axesComponent?.options
}, () => {
  updateAxesHelper()
}, { deep: true })

// 监听面板变化，当面板显示/隐藏时触发resize
watch(() => rvizStore.panelConfig.enabledPanels, (newPanels) => {
  // 如果面板被隐藏，恢复viewer-container为100%宽度
  if (newPanels.length === 0) {
    viewerWidth.value = '100%'
  } else {
    // 如果有面板，使用store中的面板宽度
    viewerWidth.value = `calc(100% - ${rvizStore.panelConfig.panelWidth}px)`
  }
  // 延迟执行，等待DOM更新完成
  nextTick(() => {
    setTimeout(() => {
      onWindowResize()
    }, 100)
  })
}, { deep: true })

onMounted(() => {
  // 初始化面板管理器宽度
  nextTick(() => {
    if (panelManagerRef.value) {
      const panelElement = (panelManagerRef.value.$el as HTMLElement)
      if (panelElement) {
        panelElement.style.width = `${rvizStore.panelConfig.panelWidth}px`
      }
    }
  })

  initScene()
})

onUnmounted(() => {
  // 清理资源
  if (animationId) {
    cancelAnimationFrame(animationId)
  }

  if (resizeTimer) {
    cancelAnimationFrame(resizeTimer)
  }

  window.removeEventListener('resize', onWindowResize)

  // 清理ResizeObserver
  if (resizeObserver && containerRef.value) {
    resizeObserver.unobserve(containerRef.value)
    resizeObserver.disconnect()
    resizeObserver = null
  }

  // 清理中键平移事件监听器
  if (containerRef.value) {
    const canvas = containerRef.value
    const handlers = (canvas as any)._middleMouseHandlers
    if (handlers) {
      canvas.removeEventListener('mousedown', handlers.onMouseDown)
      canvas.removeEventListener('mousemove', handlers.onMouseMove)
      canvas.removeEventListener('mouseup', handlers.onMouseUp)
      canvas.removeEventListener('contextmenu', handlers.onContextMenu)
      delete (canvas as any)._middleMouseHandlers
    }
  }

  if (renderer) {
    renderer.dispose()
  }

  // 安全地移除renderer的DOM元素
  if (containerRef.value && renderer && renderer.domElement && renderer.domElement.parentNode === containerRef.value) {
    try {
      containerRef.value.removeChild(renderer.domElement)
    } catch (error) {
      console.warn('Failed to remove renderer DOM element:', error)
    }
  }
})
</script>

<style scoped>
.rviz-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.rviz-viewer.resizing {
  user-select: none;
}

.viewer-container {
  position: relative;
  background: #1a1a1a;
  height: 100%;
  overflow: hidden;
  min-width: 200px;
  flex-shrink: 0;
}

.rviz-viewer.resizing .viewer-container {
  transition: none;
}

.splitter {
  width: 4px;
  background: #dcdfe6;
  cursor: col-resize;
  position: relative;
  flex-shrink: 0;
  z-index: 10;
  transition: background 0.2s;
  user-select: none;
}

.splitter:hover {
  background: #409eff;
}

.splitter.resizing {
  background: #409eff;
  width: 4px;
}

.splitter-handle {
  position: absolute;
  top: 0;
  left: -2px;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: 1;
}

</style>