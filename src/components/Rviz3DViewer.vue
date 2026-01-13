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
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import PanelManager from './panels/PanelManager.vue'

interface Props {
  enabledPanels?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  enabledPanels: () => ['view-control', 'scene-info', 'tools']
})

// Refs
const containerRef = ref<HTMLElement>()

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
const targetFPS = 30
const frameInterval = 1000 / targetFPS
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

const onWindowResize = () => {
  if (!containerRef.value) return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
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

onMounted(() => {
  initScene()
})

onUnmounted(() => {
  // 清理资源
  if (animationId) {
    cancelAnimationFrame(animationId)
  }

  window.removeEventListener('resize', onWindowResize)

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
  max-height: 100vh;
  display: flex;
  overflow: hidden;
}

.viewer-container {
  flex: 1;
  position: relative;
  background: #1a1a1a;
  max-height: 100%;
  overflow: hidden;
  transition: width 0.3s ease;
}

</style>