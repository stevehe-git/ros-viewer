/**
 * Map 渲染器（增量更新版本）
 * 负责渲染 nav_msgs/OccupancyGrid 地图数据
 * 实现增量更新，只渲染改变的部分，大幅降低 CPU 使用率
 */
import * as THREE from 'three'
import { convertROSTranslationToThree, convertROSRotationToThree } from '@/services/coordinateConverter'
import type { Ref } from 'vue'
import type { RendererObjects } from '../use3DRenderer'

export interface MapRendererContext {
  scene: THREE.Scene
  renderObjects: Ref<RendererObjects>
  getComponent: (componentId: string) => any
}

/**
 * 地图数据缓存
 */
interface MapDataCache {
  width: number
  height: number
  resolution: number
  data: Int8Array // 原始占用值数组
  colorArray: Float32Array // 颜色数组 (r, g, b) per vertex
  headerSeq: number // header.seq 用于检测数据变化
}

// 每个组件的地图数据缓存
const mapDataCache = new Map<string, MapDataCache>()

// 更新节流：每个组件独立节流
const lastUpdateTime = new Map<string, number>()
const UPDATE_THROTTLE_MS = 200 // 200ms 节流，避免过于频繁的更新

/**
 * 将占用值转换为颜色
 * -1: 未知 (灰色)
 * 0-100: 占用概率 (0=白色/自由, 100=黑色/占用)
 */
function occupancyToColor(occupancy: number, colorScheme: string = 'map'): [number, number, number] {
  if (occupancy < 0) {
    // 未知区域：灰色
    return [0.5, 0.5, 0.5]
  }

  const probability = occupancy / 100.0

  if (colorScheme === 'costmap') {
    // Costmap 颜色方案：绿色渐变
    return [0, probability, 0]
  } else if (colorScheme === 'raw') {
    // Raw 颜色方案：灰度
    const gray = 1.0 - probability
    return [gray, gray, gray]
  } else {
    // 默认 map 颜色方案：白色(自由) -> 黑色(占用)
    const gray = 1.0 - probability
    return [gray, gray, gray]
  }
}

/**
 * 创建地图几何体（使用 BufferGeometry 支持增量更新）
 */
function createMapGeometry(
  width: number,
  height: number,
  resolution: number,
  colorArray: Float32Array
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()

  // 创建顶点位置
  const vertices: number[] = []
  const indices: number[] = []
  const uvs: number[] = []

  const mapWidth = width * resolution
  const mapHeight = height * resolution
  const halfWidth = mapWidth / 2
  const halfHeight = mapHeight / 2

  // 为每个网格单元创建顶点
  for (let y = 0; y <= height; y++) {
    for (let x = 0; x <= width; x++) {
      const px = (x / width) * mapWidth - halfWidth
      const pz = (y / height) * mapHeight - halfHeight
      vertices.push(px, 0, pz)
      uvs.push(x / width, 1 - y / height) // 翻转 V 坐标以匹配 THREE.js 坐标系
    }
  }

  // 创建索引（每个网格单元由两个三角形组成）
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * (width + 1) + x
      // 第一个三角形
      indices.push(i, i + width + 1, i + 1)
      // 第二个三角形
      indices.push(i + 1, i + width + 1, i + width + 2)
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)

  // 设置颜色属性（每个顶点一个颜色）
  const vertexCount = (width + 1) * (height + 1)
  if (colorArray.length < vertexCount * 3) {
    // 初始化颜色数组
    colorArray = new Float32Array(vertexCount * 3)
    colorArray.fill(0.5) // 默认灰色
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorArray, 3))

  return geometry
}

/**
 * 增量更新地图颜色（只更新变化的网格单元）
 */
function updateMapColorsIncremental(
  geometry: THREE.BufferGeometry,
  oldData: Int8Array | null,
  newData: Int8Array,
  width: number,
  height: number,
  colorScheme: string
): number {
  const colorAttribute = geometry.getAttribute('color') as THREE.BufferAttribute
  if (!colorAttribute) return 0

  const colorArray = colorAttribute.array as Float32Array
  let changedCount = 0

  // 验证数据长度
  if (newData.length !== width * height) {
    console.warn(`Map data length mismatch: expected ${width * height}, got ${newData.length}`)
    return 0
  }

  // 如果旧数据不存在，需要初始化所有颜色
  if (!oldData || oldData.length !== newData.length) {
    for (let i = 0; i < newData.length; i++) {
      const y = Math.floor(i / width)
      const x = i % width
      
      // 边界检查
      if (y >= height || x >= width) continue
      
      // 每个网格单元有4个顶点（共享），我们更新所有相关顶点
      const occupancy = newData[i] ?? -1
      const color = occupancyToColor(occupancy, colorScheme)
      
      // 更新4个顶点的颜色
      const baseIdx = y * (width + 1) + x
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const idx = (baseIdx + dy * (width + 1) + dx) * 3
          if (idx < colorArray.length) {
            colorArray[idx] = color[0]
            colorArray[idx + 1] = color[1]
            colorArray[idx + 2] = color[2]
          }
        }
      }
    }
    colorAttribute.needsUpdate = true
    return newData.length
  }

  // 增量更新：只更新变化的网格单元
  for (let i = 0; i < newData.length; i++) {
    if (oldData[i] !== newData[i]) {
      const y = Math.floor(i / width)
      const x = i % width
      
      const occupancy = newData[i] ?? -1
      const color = occupancyToColor(occupancy, colorScheme)
      
      // 更新4个顶点的颜色
      const baseIdx = y * (width + 1) + x
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const idx = (baseIdx + dy * (width + 1) + dx) * 3
          if (idx < colorArray.length) {
            colorArray[idx] = color[0]
            colorArray[idx + 1] = color[1]
            colorArray[idx + 2] = color[2]
          }
        }
      }
      changedCount++
    }
  }

  if (changedCount > 0) {
    colorAttribute.needsUpdate = true
  }

  return changedCount
}

/**
 * 更新地图渲染（增量更新版本）
 */
export function updateMapRender(
  context: MapRendererContext,
  componentId: string,
  message: any
) {
  const { scene, renderObjects, getComponent } = context

  if (!message || !message.info || !message.data) return

  // 节流检查
  const now = Date.now()
  const lastUpdate = lastUpdateTime.get(componentId) || 0
  if (now - lastUpdate < UPDATE_THROTTLE_MS) {
    return // 跳过，还在节流期内
  }
  lastUpdateTime.set(componentId, now)

  // 获取组件配置
  const component = getComponent(componentId)
  if (!component) {
    console.warn('Map: Component not found', componentId)
    return
  }

  const options = component.options || {}
  const alpha = options.alpha ?? 0.7
  const colorScheme = options.colorScheme || 'map'
  const drawBehind = options.drawBehind ?? false
  const positionX = options.positionX ?? 0
  const positionY = options.positionY ?? 0
  const positionZ = options.positionZ ?? 0
  const orientationX = options.orientationX ?? 0
  const orientationY = options.orientationY ?? 0
  const orientationZ = options.orientationZ ?? 0
  const orientationW = options.orientationW ?? 1

  const mapInfo = message.info
  const width = options.width || mapInfo.width || 10
  const height = options.height || mapInfo.height || 10
  const resolution = options.resolution || mapInfo.resolution || 0.05
  const headerSeq = message.header?.seq || 0

  // 检查数据是否真的变化了
  const cache = mapDataCache.get(componentId)
  if (cache && cache.headerSeq === headerSeq && cache.width === width && cache.height === height) {
    // 数据没有变化，跳过渲染
    return
  }

  // 转换数据为 Int8Array（占用值范围：-1 到 100）
  const dataArray = new Int8Array(message.data)

  // 使用组件ID作为key
  const mapKey = `map_${componentId}`
  let mapMesh = renderObjects.value[mapKey] as THREE.Mesh | undefined

  if (!mapMesh) {
    // 创建新地图
    const vertexCount = (width + 1) * (height + 1)
    const colorArray = new Float32Array(vertexCount * 3)
    colorArray.fill(0.5) // 初始化为灰色

    const geometry = createMapGeometry(width, height, resolution, colorArray)
    
    // 更新所有颜色
    updateMapColorsIncremental(geometry, null, dataArray, width, height, colorScheme)

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: alpha,
      side: THREE.DoubleSide
    })

    mapMesh = new THREE.Mesh(geometry, material)
    mapMesh.userData.componentId = componentId

    // ROS 地图在 XY 平面，转换后应该在 THREE.js 的 XZ 平面
    mapMesh.rotation.set(-Math.PI / 2, 0, 0)
    mapMesh.receiveShadow = true

    // 设置位置和方向
    const rosPosition = { x: positionX, y: positionY, z: positionZ }
    const rosOrientation = { x: orientationX, y: orientationY, z: orientationZ, w: orientationW }

    const threePosition = convertROSTranslationToThree(rosPosition)
    const threeQuat = convertROSRotationToThree(rosOrientation)

    mapMesh.position.copy(threePosition)
    mapMesh.quaternion.copy(threeQuat)

    if (drawBehind) {
      mapMesh.renderOrder = -1
    }

    scene.add(mapMesh)
    renderObjects.value[mapKey] = mapMesh

    // 保存缓存
    const colorAttribute = geometry.getAttribute('color') as THREE.BufferAttribute
    mapDataCache.set(componentId, {
      width,
      height,
      resolution,
      data: new Int8Array(dataArray),
      colorArray: colorAttribute ? (colorAttribute.array as Float32Array).slice() : new Float32Array(0),
      headerSeq
    })
  } else {
    // 更新现有地图
    const geometry = mapMesh.geometry as THREE.BufferGeometry

    // 检查尺寸是否变化
    if (cache && (cache.width !== width || cache.height !== height)) {
      // 尺寸变化，需要重建几何体
      geometry.dispose()
      const vertexCount = (width + 1) * (height + 1)
      const colorArray = new Float32Array(vertexCount * 3)
      const newGeometry = createMapGeometry(width, height, resolution, colorArray)
      updateMapColorsIncremental(newGeometry, null, dataArray, width, height, colorScheme)
      mapMesh.geometry = newGeometry
    } else {
      // 尺寸未变化，增量更新颜色
      const oldData = cache?.data || null
      const changedCount = updateMapColorsIncremental(
        geometry,
        oldData,
        dataArray,
        width,
        height,
        colorScheme
      )

      if (changedCount > 0) {
        // 只在有变化时输出日志（调试用）
        // console.log(`Map ${componentId}: Updated ${changedCount} cells`)
      }
    }

    // 更新材质属性
    if (mapMesh.material instanceof THREE.MeshStandardMaterial) {
      mapMesh.material.opacity = alpha
    }

    // 更新位置和方向
    const rosPosition = { x: positionX, y: positionY, z: positionZ }
    const rosOrientation = { x: orientationX, y: orientationY, z: orientationZ, w: orientationW }

    const threePosition = convertROSTranslationToThree(rosPosition)
    const threeQuat = convertROSRotationToThree(rosOrientation)

    mapMesh.position.copy(threePosition)
    mapMesh.quaternion.copy(threeQuat)

    if (drawBehind) {
      mapMesh.renderOrder = -1
    } else {
      mapMesh.renderOrder = 0
    }

    // 更新缓存
    const colorAttribute = geometry.getAttribute('color') as THREE.BufferAttribute
    mapDataCache.set(componentId, {
      width,
      height,
      resolution,
      data: new Int8Array(dataArray),
      colorArray: colorAttribute ? (colorAttribute.array as Float32Array).slice() : new Float32Array(0),
      headerSeq
    })
  }
}

/**
 * 清理组件的地图数据缓存
 */
export function cleanupMapComponent(componentId: string) {
  mapDataCache.delete(componentId)
  lastUpdateTime.delete(componentId)
}
