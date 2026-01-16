/**
 * 3D 渲染 composable
 * 负责将数据渲染到 THREE.js 场景中
 * 分离业务逻辑和 UI 代码
 */
import * as THREE from 'three'
import { ref, watch } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { DataConverter } from '@/services/dataConverter'

export interface RendererObjects {
  mapMesh?: THREE.Mesh
  pathLine?: THREE.Line
  laserscanMesh?: THREE.Mesh
  laserscanPoints?: THREE.Points
  laserscanGroup?: THREE.Group // 支持多个 LaserScan 组件
  pointcloudMesh?: THREE.Mesh
  [key: string]: any
}

/**
 * 3D 渲染器 composable
 */
export function use3DRenderer(scene: THREE.Scene) {
  const rvizStore = useRvizStore()
  const renderObjects = ref<RendererObjects>({})

  /**
   * 更新地图渲染
   */
  const updateMapRender = (componentId: string, message: any) => {
    if (!message || !message.info) return

    const mapInfo = message.info
    const width = mapInfo.width || 10
    const height = mapInfo.height || 10
    const resolution = mapInfo.resolution || 0.05

    // 如果地图网格不存在，创建它
    if (!renderObjects.value.mapMesh) {
      const mapGeometry = new THREE.PlaneGeometry(
        width * resolution,
        height * resolution,
        width,
        height
      )
      const mapMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666,
        wireframe: false,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      })
      renderObjects.value.mapMesh = new THREE.Mesh(mapGeometry, mapMaterial)
      renderObjects.value.mapMesh.rotation.x = -Math.PI / 2
      renderObjects.value.mapMesh.position.y = 0
      renderObjects.value.mapMesh.receiveShadow = true
      scene.add(renderObjects.value.mapMesh)
    }

    // 更新地图数据（这里可以添加实际的地图数据处理逻辑）
    // TODO: 根据 message.data 更新地图网格的顶点颜色或位置
  }

  /**
   * 更新路径渲染
   */
  const updatePathRender = (componentId: string, message: any) => {
    if (!message || !message.poses || message.poses.length === 0) return

    // 提取路径点
    const points = message.poses.map((pose: any) => {
      const position = pose.pose?.position || pose.position || {}
      return new THREE.Vector3(
        position.x || 0,
        position.y || 0,
        position.z || 0.1
      )
    })

    if (points.length === 0) return

    // 如果路径线不存在，创建它
    if (!renderObjects.value.pathLine) {
      const pathGeometry = new THREE.BufferGeometry().setFromPoints(points)
      const pathMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 })
      renderObjects.value.pathLine = new THREE.Line(pathGeometry, pathMaterial)
      scene.add(renderObjects.value.pathLine)
    } else {
      // 更新路径点
      const pathGeometry = new THREE.BufferGeometry().setFromPoints(points)
      renderObjects.value.pathLine.geometry.dispose()
      renderObjects.value.pathLine.geometry = pathGeometry
    }
  }

  /**
   * 更新激光扫描渲染
   */
  const updateLaserScanRender = (componentId: string, message: any) => {
    if (!message || !message.ranges || message.ranges.length === 0) return

    // 获取组件配置
    const component = rvizStore.displayComponents.find(c => c.id === componentId)
    if (!component) return

    const options = component.options || {}
    const style = options.style || 'Flat Squares'
    const size = options.size || 0.01
    const alpha = options.alpha ?? 1
    const colorTransformer = options.colorTransformer || 'Intensity'
    const useRainbow = options.useRainbow ?? true
    const minIntensity = options.minIntensity ?? 0
    const maxIntensity = options.maxIntensity ?? 0
    const autocomputeIntensityBounds = options.autocomputeIntensityBounds ?? true

    // 解析 LaserScan 数据
    const ranges = message.ranges || []
    const intensities = message.intensities || []
    const angleMin = message.angle_min || 0
    const angleMax = message.angle_max || 0
    const angleIncrement = message.angle_increment || 0
    const rangeMin = message.range_min || 0
    const rangeMax = message.range_max || 0

    if (ranges.length === 0 || angleIncrement === 0) return

    // 创建点云数据
    const points: THREE.Vector3[] = []
    const pointIntensities: number[] = [] // 存储每个点对应的强度值
    let intensityMin = Infinity
    let intensityMax = -Infinity

    // 第一遍：计算点位置和强度范围
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i]
      
      // 过滤无效范围
      if (!range || range < rangeMin || range > rangeMax || !isFinite(range)) {
        continue
      }

      const angle = angleMin + i * angleIncrement
      // 注意：ROS 坐标系中，x 是前方，y 是左侧，z 是上方
      // 在 RViz 中，通常将激光扫描显示在 XY 平面（俯视图）
      const x = range * Math.cos(angle)
      const y = range * Math.sin(angle)
      const z = 0 // 2D 激光扫描在 XY 平面（俯视图）

      points.push(new THREE.Vector3(x, y, z))

      // 获取对应的强度值
      const intensity = (intensities.length > i && intensities[i] !== undefined) ? intensities[i] : 0
      pointIntensities.push(intensity)

      // 计算强度范围（如果需要自动计算）
      if (colorTransformer === 'Intensity' && autocomputeIntensityBounds) {
        intensityMin = Math.min(intensityMin, intensity)
        intensityMax = Math.max(intensityMax, intensity)
      }
    }

    if (points.length === 0) return

    // 计算强度边界
    const finalMinIntensity = autocomputeIntensityBounds ? intensityMin : minIntensity
    const finalMaxIntensity = autocomputeIntensityBounds ? intensityMax : maxIntensity
    const intensityRange = finalMaxIntensity - finalMinIntensity || 1

    // 生成颜色
    const colors: THREE.Color[] = []
    for (let i = 0; i < points.length; i++) {
      let color: THREE.Color

      if (colorTransformer === 'Intensity') {
        const intensity = pointIntensities[i] || 0
        const normalizedIntensity = intensityRange > 0 
          ? Math.max(0, Math.min(1, (intensity - finalMinIntensity) / intensityRange))
          : 0

        if (useRainbow) {
          // 彩虹色映射：从红色到紫色
          // 反转：高强度对应红色（hue=0），低强度对应紫色（hue=0.7）
          const invertRainbow = options.invertRainbow ?? false
          const hueValue = invertRainbow 
            ? normalizedIntensity * 0.7 
            : (1 - normalizedIntensity) * 0.7
          color = new THREE.Color().setHSL(hueValue, 1, 0.5)
        } else {
          // 线性插值：从 minColor 到 maxColor
          const minColor = options.minColor || { r: 0, g: 0, b: 0 }
          const maxColor = options.maxColor || { r: 255, g: 255, b: 255 }
          const r = (minColor.r + (maxColor.r - minColor.r) * normalizedIntensity) / 255
          const g = (minColor.g + (maxColor.g - minColor.g) * normalizedIntensity) / 255
          const b = (minColor.b + (maxColor.b - minColor.b) * normalizedIntensity) / 255
          color = new THREE.Color(r, g, b)
        }
      } else {
        // 默认红色（Flat 模式）
        color = new THREE.Color(0xff0000)
      }

      colors.push(color)
    }

    // 创建或更新渲染对象
    let laserscanGroup = renderObjects.value.laserscanGroup
    if (!laserscanGroup) {
      laserscanGroup = new THREE.Group()
      renderObjects.value.laserscanGroup = laserscanGroup
      scene.add(laserscanGroup)
    }

    // 移除旧的该组件的点云
    const oldPoints = laserscanGroup.children.find(child => child.userData.componentId === componentId)
    if (oldPoints) {
      laserscanGroup.remove(oldPoints)
      if (oldPoints.geometry) oldPoints.geometry.dispose()
      if (oldPoints.material) {
        if (Array.isArray(oldPoints.material)) {
          oldPoints.material.forEach(mat => mat.dispose())
        } else {
          oldPoints.material.dispose()
        }
      }
    }

    // 根据样式创建点云
    if (style === 'Flat Squares' || style === 'Points') {
      // 使用 THREE.Points 渲染点云
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const colorArray = new Float32Array(points.length * 3)
      colors.forEach((color, i) => {
        colorArray[i * 3] = color.r
        colorArray[i * 3 + 1] = color.g
        colorArray[i * 3 + 2] = color.b
      })
      geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3))

      const material = new THREE.PointsMaterial({
        size: size,
        vertexColors: true,
        transparent: true,
        opacity: alpha,
        sizeAttenuation: false // 固定大小，不受距离影响
      })

      const pointsObject = new THREE.Points(geometry, material)
      pointsObject.userData.componentId = componentId
      laserscanGroup.add(pointsObject)
    } else if (style === 'Billboards') {
      // 使用 Sprite 渲染（类似广告牌效果）
      const sprites: THREE.Sprite[] = []
      colors.forEach((color, i) => {
        const spriteMaterial = new THREE.SpriteMaterial({
          color: color,
          transparent: true,
          opacity: alpha
        })
        const sprite = new THREE.Sprite(spriteMaterial)
        sprite.position.copy(points[i])
        sprite.scale.set(size, size, 1)
        sprite.userData.componentId = componentId
        sprites.push(sprite)
      })

      const spriteGroup = new THREE.Group()
      spriteGroup.userData.componentId = componentId
      sprites.forEach(sprite => spriteGroup.add(sprite))
      laserscanGroup.add(spriteGroup)
    } else {
      // 默认使用 Points
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const colorArray = new Float32Array(points.length * 3)
      colors.forEach((color, i) => {
        colorArray[i * 3] = color.r
        colorArray[i * 3 + 1] = color.g
        colorArray[i * 3 + 2] = color.b
      })
      geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3))

      const material = new THREE.PointsMaterial({
        size: size,
        vertexColors: true,
        transparent: true,
        opacity: alpha,
        sizeAttenuation: false
      })

      const pointsObject = new THREE.Points(geometry, material)
      pointsObject.userData.componentId = componentId
      laserscanGroup.add(pointsObject)
    }
  }

  /**
   * 更新点云渲染
   */
  const updatePointCloudRender = (componentId: string, message: any) => {
    if (!message || !message.data || message.data.length === 0) return

    // TODO: 实现点云的 3D 渲染
    // 可以创建 THREE.Points 对象
  }

  /**
   * 更新组件渲染
   */
  const updateComponentRender = (componentId: string, componentType: string, message: any) => {
    if (!message) return

    // 使用数据转换器转换数据
    const unifiedMessage = DataConverter.convert(message, componentType, 'ros')
    if (!unifiedMessage) return

    // 根据组件类型调用相应的渲染函数
    switch (componentType) {
      case 'map':
        updateMapRender(componentId, unifiedMessage.data)
        break
      case 'path':
        updatePathRender(componentId, unifiedMessage.data)
        break
      case 'laserscan':
        updateLaserScanRender(componentId, unifiedMessage.data)
        break
      case 'pointcloud2':
        updatePointCloudRender(componentId, unifiedMessage.data)
        break
      default:
        break
    }
  }

  /**
   * 设置组件可见性
   */
  const setComponentVisibility = (componentType: string, visible: boolean, componentId?: string) => {
    switch (componentType) {
      case 'map':
        if (renderObjects.value.mapMesh) {
          renderObjects.value.mapMesh.visible = visible
        }
        break
      case 'path':
        if (renderObjects.value.pathLine) {
          renderObjects.value.pathLine.visible = visible
        }
        break
      case 'laserscan':
        if (renderObjects.value.laserscanGroup && componentId) {
          // 设置特定组件的可见性
          renderObjects.value.laserscanGroup.children.forEach(child => {
            if (child.userData.componentId === componentId) {
              child.visible = visible
            }
          })
        } else if (renderObjects.value.laserscanGroup) {
          // 设置所有 LaserScan 的可见性
          renderObjects.value.laserscanGroup.visible = visible
        }
        break
      default:
        break
    }
  }

  /**
   * 清理渲染对象
   */
  const cleanup = () => {
    Object.values(renderObjects.value).forEach((obj) => {
      if (obj && obj.geometry) {
        obj.geometry.dispose()
      }
      if (obj && obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => mat.dispose())
        } else {
          obj.material.dispose()
        }
      }
      if (obj && scene) {
        scene.remove(obj)
      }
    })
    renderObjects.value = {}
  }

  return {
    renderObjects,
    updateComponentRender,
    setComponentVisibility,
    cleanup
  }
}
