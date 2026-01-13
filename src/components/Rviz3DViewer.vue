<template>
  <div class="rviz-viewer">
    <div class="viewer-container" ref="containerRef"></div>
    
    <!-- 控制面板 -->
    <div class="control-panel">
      <el-card class="control-card">
        <template #header>
          <div class="card-header">
            <span>视图控制</span>
          </div>
        </template>
        
        <div class="control-group">
          <el-button-group>
            <el-button size="small" @click="resetCamera">
              <el-icon><Refresh /></el-icon>
              重置视角
            </el-button>
            <el-button size="small" @click="toggleGrid">
              <el-icon><Grid /></el-icon>
              {{ showGrid ? '隐藏网格' : '显示网格' }}
            </el-button>
            <el-button size="small" @click="toggleAxes">
              <el-icon><Position /></el-icon>
              {{ showAxes ? '隐藏坐标轴' : '显示坐标轴' }}
            </el-button>
          </el-button-group>
        </div>

        <div class="control-group">
          <el-divider />
          <div class="control-item">
            <span>相机模式:</span>
            <el-radio-group v-model="cameraMode" size="small">
              <el-radio-button label="orbit">轨道</el-radio-button>
              <el-radio-button label="firstPerson">第一人称</el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <div class="control-group">
          <el-divider />
          <div class="control-item">
            <span>显示选项:</span>
            <el-checkbox v-model="showRobot">机器人模型</el-checkbox>
            <el-checkbox v-model="showMap">地图</el-checkbox>
            <el-checkbox v-model="showPath">路径</el-checkbox>
            <el-checkbox v-model="showLaser">激光扫描</el-checkbox>
          </div>
        </div>

        <div class="control-group">
          <el-divider />
          <div class="control-item">
            <span>背景颜色:</span>
            <el-color-picker v-model="backgroundColor" size="small" />
          </div>
        </div>
      </el-card>

      <el-card class="info-card">
        <template #header>
          <div class="card-header">
            <span>场景信息</span>
          </div>
        </template>
        
        <div class="info-item">
          <span>FPS:</span>
          <span>{{ fps }}</span>
        </div>
        <div class="info-item">
          <span>相机位置:</span>
          <span>X: {{ cameraPos.x.toFixed(2) }}, Y: {{ cameraPos.y.toFixed(2) }}, Z: {{ cameraPos.z.toFixed(2) }}</span>
        </div>
        <div class="info-item">
          <span>渲染对象:</span>
          <span>{{ objectCount }}</span>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Refresh, Grid, Position } from '@element-plus/icons-vue'

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
const backgroundColor = ref('#1a1a1a')
const fps = ref(60)
const cameraPos = ref({ x: 0, y: 0, z: 0 })
const objectCount = ref(0)

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

const updateFPS = () => {
  frameCount++
  const currentTime = performance.now()
  const delta = currentTime - lastTime

  if (delta >= 1000) {
    fps.value = Math.round((frameCount * 1000) / delta)
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

const animate = () => {
  animationId = requestAnimationFrame(animate)

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
}

// 监听器
watch(showRobot, (val) => {
  if (robotGroup) {
    robotGroup.visible = val
  }
})

watch(showMap, (val) => {
  if (mapMesh) {
    mapMesh.visible = val
  }
})

watch(showPath, (val) => {
  if (pathLine) {
    pathLine.visible = val
  }
})

watch(backgroundColor, (val) => {
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
  display: flex;
}

.viewer-container {
  flex: 1;
  position: relative;
  background: #1a1a1a;
}

.control-panel {
  width: 300px;
  padding: 16px;
  background: #f5f7fa;
  overflow-y: auto;
  border-left: 1px solid #e4e7ed;
}

.control-card,
.info-card {
  margin-bottom: 16px;
}

.card-header {
  font-weight: 600;
  color: #303133;
  font-size: 14px;
}

.control-group {
  margin-bottom: 12px;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-item span {
  font-size: 12px;
  color: #606266;
  margin-bottom: 4px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 12px;
  color: #606266;
  border-bottom: 1px solid #f0f0f0;
}

.info-item:last-child {
  border-bottom: none;
}

.info-item span:first-child {
  font-weight: 500;
  color: #303133;
}
</style>