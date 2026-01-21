/**
 * Map 渲染器
 * 负责渲染 nav_msgs/OccupancyGrid 地图数据
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
 * 更新地图渲染
 */
export function updateMapRender(
  context: MapRendererContext,
  componentId: string,
  message: any
) {
  const { scene, renderObjects, getComponent } = context
  
  if (!message || !message.info) return

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
  // 优先使用配置中的值，如果没有则使用消息中的值
  const width = options.width || mapInfo.width || 10
  const height = options.height || mapInfo.height || 10
  const resolution = options.resolution || mapInfo.resolution || 0.05

  // 使用组件ID作为key，支持多个Map组件
  const mapKey = `map_${componentId}`
  let mapMesh = renderObjects.value[mapKey] as THREE.Mesh | undefined

  if (!mapMesh) {
    const mapGeometry = new THREE.PlaneGeometry(
      width * resolution,
      height * resolution,
      width,
      height
    )
    
    // 根据 colorScheme 选择颜色
    let mapColor = 0x666666 // 默认灰色
    if (colorScheme === 'costmap') {
      mapColor = 0x00ff00 // 绿色
    } else if (colorScheme === 'raw') {
      mapColor = 0x888888 // 浅灰色
    }

    const mapMaterial = new THREE.MeshStandardMaterial({
      color: mapColor,
      wireframe: false,
      transparent: true,
      opacity: alpha,
      side: THREE.DoubleSide
    })
    
    mapMesh = new THREE.Mesh(mapGeometry, mapMaterial)
    mapMesh.userData.componentId = componentId
    
    // ROS 地图在 XY 平面（水平面，Z=0），转换后应该在 THREE.js 的 XZ 平面（Y=0）
    // 绕X轴旋转-90度，使XY平面变为XZ平面
    mapMesh.rotation.set(-Math.PI / 2, 0, 0)
    mapMesh.receiveShadow = true
    
    // 设置位置和方向
    const rosPosition = { x: positionX, y: positionY, z: positionZ }
    const rosOrientation = { x: orientationX, y: orientationY, z: orientationZ, w: orientationW }
    
    // 转换到 THREE.js 坐标系
    const threePosition = convertROSTranslationToThree(rosPosition)
    const threeQuat = convertROSRotationToThree(rosOrientation)
    
    mapMesh.position.copy(threePosition)
    mapMesh.quaternion.copy(threeQuat)
    
    // 根据 drawBehind 设置渲染顺序
    if (drawBehind) {
      mapMesh.renderOrder = -1
    }
    
    scene.add(mapMesh)
    renderObjects.value[mapKey] = mapMesh
  } else {
    // 更新现有地图的配置
    if (mapMesh.material instanceof THREE.MeshStandardMaterial) {
      mapMesh.material.opacity = alpha
      
      // 更新颜色方案
      let mapColor = 0x666666
      if (colorScheme === 'costmap') {
        mapColor = 0x00ff00
      } else if (colorScheme === 'raw') {
        mapColor = 0x888888
      }
      mapMesh.material.color.setHex(mapColor)
    }
    
    // 更新位置和方向
    const rosPosition = { x: positionX, y: positionY, z: positionZ }
    const rosOrientation = { x: orientationX, y: orientationY, z: orientationZ, w: orientationW }
    
    const threePosition = convertROSTranslationToThree(rosPosition)
    const threeQuat = convertROSRotationToThree(rosOrientation)
    
    mapMesh.position.copy(threePosition)
    mapMesh.quaternion.copy(threeQuat)
    
    // 更新渲染顺序
    if (drawBehind) {
      mapMesh.renderOrder = -1
    } else {
      mapMesh.renderOrder = 0
    }
  }

  // 更新地图数据（这里可以添加实际的地图数据处理逻辑）
  // TODO: 根据 message.data 更新地图网格的顶点颜色或位置
}
