<template>
  <div class="rviz-viewer">
    <div class="viewer-container" ref="containerRef"></div>

    <!-- 面板管理系统 -->
    <PanelManager
      v-if="enabledPanels.length > 0"
      :enabled-panels="enabledPanels"
      :camera-mode="cameraMode"
      :show-grid="showGrid"
      :show-axes="showAxes"
      :show-robot="showRobot"
      :show-map="showMap"
      :show-path="showPath"
      :show-laser="showLaser"
      :background-color="backgroundColor"
      :fps="fps"
      :camera-pos="cameraPos"
      :object-count="objectCount"
      :memory-usage="memoryUsage"
      :texture-count="textureCount"
      :is-recording="isRecording"
      :performance-mode="performanceMode"
      :show-debug-info="showDebugInfo"
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
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MOUSE } from 'three'
import PanelManager from './panels/PanelManager.vue'

interface Props {
  enabledPanels?: string[]
  isFullscreen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  enabledPanels: () => ['view-control', 'scene-info', 'tools'],
  isFullscreen: false
})

const emit = defineEmits<{
  toggleFullscreen: []
}>()

// Refs
const containerRef = ref<HTMLElement>()
let resizeObserver: ResizeObserver | null = null
let resizeTimer: number | null = null

// 中键平移相关
let isMiddleMouseDown = false
let lastMousePosition = { x: 0, y: 0 }

// 场景相关
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let animationId: number

// 状态
const showGrid = ref(true)
const showAxes = ref(true)
const showRobot = ref(true)
const showMap = ref(true)
const showPath = ref(false)
const showLaser = ref(false)
const cameraMode = ref('orbit')
const backgroundColor = ref('#fdfdfd')
const fps = ref(30)
const cameraPos = ref({ x: 0, y: 0, z: 0 })
const objectCount = ref(0)
const memoryUsage = ref(0)
const textureCount = ref(0)
const isRecording = ref(false)
const performanceMode = ref(false)
const showDebugInfo = ref(false)

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
  scene.background = new THREE.Color(backgroundColor.value)

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

  // 创建网格
  gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222)
  scene.add(gridHelper)

  // 创建坐标轴
  axesHelper = new THREE.AxesHelper(5)
  scene.add(axesHelper)

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
  showGrid.value = !showGrid.value
  if (gridHelper) {
    gridHelper.visible = showGrid.value
  }
}

const toggleAxes = () => {
  showAxes.value = !showAxes.value
  if (axesHelper) {
    axesHelper.visible = showAxes.value
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
    const width = containerRef.value!.clientWidth
    const height = containerRef.value!.clientHeight

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
  objectCount.value = count
}

const updateMemoryUsage = () => {
  if (renderer && renderer.info) {
    // Three.js的内存信息 (MB)
    const memoryInfo = renderer.info.memory
    memoryUsage.value = Math.round((memoryInfo.geometries + memoryInfo.textures) * 0.001)
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
  textureCount.value = count
}

// 处理面板事件
const handleCameraModeUpdate = (value: string) => {
  cameraMode.value = value
}

const handleShowRobotUpdate = (value: boolean) => {
  showRobot.value = value
}

const handleShowMapUpdate = (value: boolean) => {
  showMap.value = value
}

const handleShowPathUpdate = (value: boolean) => {
  showPath.value = value
}

const handleShowLaserUpdate = (value: boolean) => {
  showLaser.value = value
}

const handleBackgroundColorUpdate = (value: string) => {
  backgroundColor.value = value
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
      showRobot: showRobot.value,
      showMap: showMap.value,
      showPath: showPath.value,
      showLaser: showLaser.value
    },
    display: {
      showGrid: showGrid.value,
      showAxes: showAxes.value,
      backgroundColor: backgroundColor.value
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
  showRobot.value = true
  showMap.value = true
  showPath.value = false
  showLaser.value = false
  showGrid.value = true
  showAxes.value = true
  backgroundColor.value = '#1a1a1a'
  cameraMode.value = 'orbit'
  resetCamera()
}

const toggleRecording = (value: boolean) => {
  isRecording.value = value
  // 这里可以添加录制功能的实现
}

const togglePerformanceMode = (value: boolean) => {
  performanceMode.value = value
  // 这里可以添加性能模式的实现
}

const toggleDebugInfo = (value: boolean) => {
  showDebugInfo.value = value
  // 这里可以添加调试信息的显示/隐藏
}

// 处理全局选项更新
const handleGlobalOptionsUpdate = (options: any) => {
  if (options.backgroundColor) {
    backgroundColor.value = options.backgroundColor
  }
  if (options.frameRate !== undefined) {
    // 可以更新FPS设置
    targetFPS = options.frameRate
    frameInterval = 1000 / targetFPS
  }
}

// 处理网格选项更新
const handleGridOptionsUpdate = (options: any) => {
  if (options.enabled !== undefined) {
    showGrid.value = options.enabled
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
    showAxes.value = options.enabled
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

const updateFPS = () => {
  frameCount++
  const currentTime = performance.now()
  const delta = currentTime - lastTime

  if (delta >= 1000) {
    // 由于我们限制了渲染频率，这里显示目标FPS而不是实际的requestAnimationFrame频率
    fps.value = targetFPS
    frameCount = 0
    lastTime = currentTime
  }
}

const updateCameraPos = () => {
  cameraPos.value = {
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
    if (robotGroup && showRobot.value) {
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
watch(showRobot, (val: boolean) => {
  if (robotGroup) {
    robotGroup.visible = val
  }
})

watch(showMap, (val: boolean) => {
  if (mapMesh) {
    mapMesh.visible = val
  }
})

watch(showPath, (val: boolean) => {
  if (pathLine) {
    pathLine.visible = val
  }
})

watch(backgroundColor, (val: string) => {
  if (scene) {
    scene.background = new THREE.Color(val)
  }
})

// 监听面板变化，当面板显示/隐藏时触发resize
watch(() => props.enabledPanels, () => {
  // 延迟执行，等待DOM更新完成
  nextTick(() => {
    setTimeout(() => {
      onWindowResize()
    }, 100)
  })
}, { deep: true })

onMounted(() => {
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

  if (containerRef.value && renderer) {
    containerRef.value.removeChild(renderer.domElement)
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

.viewer-container {
  flex: 1;
  position: relative;
  background: #1a1a1a;
  height: 100%;
  width: 100%;
  overflow: hidden;
  transition: width 0.3s ease, flex 0.3s ease;
  min-width: 0;
}

</style>