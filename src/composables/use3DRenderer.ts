/**
 * 3D 渲染 composable
 * 负责将数据渲染到 THREE.js 场景中
 * 分离业务逻辑和 UI 代码
 */
import * as THREE from 'three'
import { ref, watch } from 'vue'
import { useRvizStore } from '@/stores/rviz'
import { DataConverter } from '@/services/dataConverter'
import { tfManager } from '@/services/tfManager'

export interface RendererObjects {
  mapMesh?: THREE.Mesh
  pathLine?: THREE.Line
  laserscanMesh?: THREE.Mesh
  laserscanPoints?: THREE.Points
  laserscanGroup?: THREE.Group // 支持多个 LaserScan 组件
  pointcloudMesh?: THREE.Mesh
  pointcloudPoints?: THREE.Points
  pointcloudGroup?: THREE.Group // 支持多个 PointCloud2 组件
  tfGroup?: THREE.Group // TF 可视化组
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
      // ROS 地图通常在 XY 平面（俯视图），需要转换到 THREE.js 坐标系
      // ROS XY 平面：X向前（THREE.js Z），Y向左（THREE.js -X），Z向上（THREE.js Y）
      // 需要将 THREE.js 的 XY 平面旋转，使网格在 XZ 平面（THREE.js），然后绕 Z 轴旋转 90 度
      renderObjects.value.mapMesh.rotation.set(Math.PI / 2, 0, Math.PI / 2)
      renderObjects.value.mapMesh.position.set(0, 0, 0)
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

    // 提取路径点（ROS 坐标系）
    // 转换 ROS 坐标到 THREE.js 坐标
    // - ROS X (向前) → THREE.js Z (向前)
    // - ROS Y (向左) → THREE.js -X (向左)
    // - ROS Z (向上) → THREE.js Y (向上)
    const points = message.poses.map((pose: any) => {
      const position = pose.pose?.position || pose.position || {}
      const rosX = position.x || 0
      const rosY = position.y || 0
      const rosZ = position.z || 0.1
      
      // 转换到 THREE.js 坐标系
      return new THREE.Vector3(
        -rosY,  // ROS Y (向左) → THREE.js -X
        rosZ,   // ROS Z (向上) → THREE.js Y
        rosX    // ROS X (向前) → THREE.js Z
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
    if (!message || !message.ranges || message.ranges.length === 0) {
      console.warn('LaserScan: Message is null or has no ranges', { componentId, hasMessage: !!message, rangesLength: message?.ranges?.length })
      return
    }

    // 获取组件配置
    const component = rvizStore.displayComponents.find(c => c.id === componentId)
    if (!component) {
      console.warn('LaserScan: Component not found', componentId)
      return
    }

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
      // ROS 坐标系：x 是前方，y 是左侧，z 是上方
      // 当前坐标轴映射：
      // - ROS X (向前) → THREE.js Z (向前)
      // - ROS Y (向左) → THREE.js -X (向左)
      // - ROS Z (向上) → THREE.js Y (向上)
      // 
      // LaserScan 在 ROS XY 平面（俯视图），需要转换到 THREE.js 坐标系
      // ROS XY 平面：X向前（THREE.js Z），Y向左（THREE.js -X），Z向上（THREE.js Y）
      const rosX = range * Math.cos(angle)  // ROS X (向前)
      const rosY = range * Math.sin(angle)  // ROS Y (向左)
      const rosZ = 0 // ROS Z = 0 (在XY平面)
      
      // 转换到 THREE.js 坐标系
      // ROS (x, y, z) → THREE.js (x, y, z)
      // ROS X (向前) → THREE.js Z
      // ROS Y (向左) → THREE.js -X
      // ROS Z (向上) → THREE.js Y
      const threeX = -rosY  // ROS Y (向左) → THREE.js -X
      const threeY = rosZ   // ROS Z (向上) → THREE.js Y
      const threeZ = rosX   // ROS X (向前) → THREE.js Z

      points.push(new THREE.Vector3(threeX, threeY, threeZ))

      // 获取对应的强度值
      const intensity = (intensities.length > i && intensities[i] !== undefined) ? intensities[i] : 0
      pointIntensities.push(intensity)

      // 计算强度范围（如果需要自动计算）
      if (colorTransformer === 'Intensity' && autocomputeIntensityBounds) {
        intensityMin = Math.min(intensityMin, intensity)
        intensityMax = Math.max(intensityMax, intensity)
      }
    }

    if (points.length === 0) {
      console.warn('LaserScan: No valid points after filtering', { componentId, rangesLength: ranges.length })
      return
    }
    
    // console.log('LaserScan: Processing', { componentId, pointsCount: points.length, style, size, alpha })

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

      // Flat Squares: 使用世界单位（米），启用距离衰减
      // Points: 使用像素大小，不启用距离衰减，需要将米转换为像素（大约乘以100）
      const useSizeAttenuation = style === 'Flat Squares'
      const pointSize = useSizeAttenuation ? size : Math.max(size * 100, 2) // Points 模式需要像素大小，至少2像素才能看见

      const material = new THREE.PointsMaterial({
        size: pointSize,
        vertexColors: true,
        transparent: true,
        opacity: alpha,
        sizeAttenuation: useSizeAttenuation
      })

      const pointsObject = new THREE.Points(geometry, material)
      pointsObject.userData.componentId = componentId
      laserscanGroup.add(pointsObject)
      // console.log('LaserScan: Added points to scene', { componentId, pointsCount: points.length, pointSize, useSizeAttenuation, visible: pointsObject.visible, position: pointsObject.position })
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
      // 默认使用 Points（像素大小，不启用距离衰减）
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const colorArray = new Float32Array(points.length * 3)
      colors.forEach((color, i) => {
        colorArray[i * 3] = color.r
        colorArray[i * 3 + 1] = color.g
        colorArray[i * 3 + 2] = color.b
      })
      geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3))

      const material = new THREE.PointsMaterial({
        size: Math.max(size * 100, 2), // 像素大小，至少2像素才能看见
        vertexColors: true,
        transparent: true,
        opacity: alpha,
        sizeAttenuation: false // Points 模式使用固定像素大小
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
    if (!message) {
      console.warn('PointCloud2: Message is null or undefined')
      return
    }

    // 获取组件配置
    const component = rvizStore.displayComponents.find(c => c.id === componentId)
    if (!component) {
      console.warn('PointCloud2: Component not found', componentId)
      return
    }

    const options = component.options || {}
    const size = options.size || 0.01
    const alpha = options.alpha ?? 1
    const colorTransformer = options.colorTransformer || 'RGB'
    const useRainbow = options.useRainbow ?? true

    // 解析 PointCloud2 数据
    const fields = message.fields || []
    const height = message.height || 1
    const width = message.width || 0
    const pointStep = message.point_step || 0
    const rowStep = message.row_step || 0
    let data = message.data || []

    // 确保 data 是 Uint8Array
    if (Array.isArray(data)) {
      data = new Uint8Array(data)
    } else if (!(data instanceof Uint8Array)) {
      console.warn('PointCloud2: Invalid data format', typeof data)
      return
    }

    if (data.length === 0 || pointStep === 0) {
      console.warn('PointCloud2: Empty data or invalid point_step', { dataLength: data.length, pointStep })
      return
    }

    console.log('PointCloud2: Processing point cloud', {
      componentId,
      width,
      height,
      pointStep,
      dataLength: data.length,
      fields: fields.map((f: any) => f.name)
    })

    // 查找字段索引
    const findField = (name: string) => {
      return fields.findIndex((f: any) => f.name === name)
    }

    const xIndex = findField('x')
    const yIndex = findField('y')
    const zIndex = findField('z')
    const rgbIndex = findField('rgb')
    const intensityIndex = findField('intensity')

    // 检查必需字段
    if (xIndex === -1 || yIndex === -1 || zIndex === -1) {
      console.warn('PointCloud2: Missing required fields (x, y, z)')
      return
    }

    // 获取字段偏移和数据类型
    const getFieldOffset = (fieldIndex: number) => {
      if (fieldIndex === -1) return -1
      return fields[fieldIndex].offset || 0
    }

    const xOffset = getFieldOffset(xIndex)
    const yOffset = getFieldOffset(yIndex)
    const zOffset = getFieldOffset(zIndex)
    const rgbOffset = getFieldOffset(rgbIndex)
    const intensityOffset = getFieldOffset(intensityIndex)

    // 解析点云数据
    const points: THREE.Vector3[] = []
    const pointIntensities: number[] = [] // 存储每个点对应的强度值
    let intensityMin = Infinity
    let intensityMax = -Infinity

    // 计算点数量
    const pointCount = width * height || Math.floor(data.length / pointStep)

    // 第一遍：解析点位置和强度
    for (let i = 0; i < pointCount; i++) {
      const pointOffset = i * pointStep

      // 检查边界
      if (pointOffset + Math.max(xOffset, yOffset, zOffset) + 4 > data.length) {
        break
      }

      // 读取 ROS 坐标系中的 x, y, z 坐标
      const rosX = readFloat32(data, pointOffset + xOffset)
      const rosY = readFloat32(data, pointOffset + yOffset)
      const rosZ = readFloat32(data, pointOffset + zOffset)

      // 过滤无效点（NaN 或 Infinity）
      if (!isFinite(rosX) || !isFinite(rosY) || !isFinite(rosZ)) {
        continue
      }

      // 转换 ROS 坐标到 THREE.js 坐标
      // 当前坐标轴映射：
      // - ROS X (向前) → THREE.js Z (向前)
      // - ROS Y (向左) → THREE.js -X (向左)
      // - ROS Z (向上) → THREE.js Y (向上)
      const threeX = -rosY  // ROS Y (向左) → THREE.js -X
      const threeY = rosZ   // ROS Z (向上) → THREE.js Y
      const threeZ = rosX   // ROS X (向前) → THREE.js Z

      points.push(new THREE.Vector3(threeX, threeY, threeZ))

      // 获取强度值（如果存在）
      if (intensityOffset !== -1 && pointOffset + intensityOffset + 4 <= data.length) {
        const intensity = readFloat32(data, pointOffset + intensityOffset)
        pointIntensities.push(intensity)
        if (colorTransformer === 'Intensity') {
          intensityMin = Math.min(intensityMin, intensity)
          intensityMax = Math.max(intensityMax, intensity)
        }
      } else {
        pointIntensities.push(0)
      }
    }

    if (points.length === 0) {
      console.warn('PointCloud2: No valid points found')
      return
    }

    // 计算强度范围
    const intensityRange = intensityMax - intensityMin || 1

    // 生成颜色
    const colors: THREE.Color[] = []
    for (let i = 0; i < points.length; i++) {
      let color: THREE.Color

      if (colorTransformer === 'RGB' && rgbOffset !== -1) {
        // 从 RGB 字段读取颜色
        const pointOffset = i * pointStep
        if (pointOffset + rgbOffset + 4 <= data.length) {
          const rgb = readUint32(data, pointOffset + rgbOffset)
          // PointCloud2 中 RGB 通常存储为 uint32，格式可能是 RGB 或 BGR
          const r = (rgb >> 16) & 0xff
          const g = (rgb >> 8) & 0xff
          const b = rgb & 0xff
          color = new THREE.Color(r / 255, g / 255, b / 255)
        } else {
          color = new THREE.Color(0xff0000)
        }
      } else if (colorTransformer === 'Intensity' && pointIntensities.length > i) {
        // 从强度字段读取颜色
        const intensity = pointIntensities[i] || 0
        const normalizedIntensity = intensityRange > 0
          ? Math.max(0, Math.min(1, (intensity - intensityMin) / intensityRange))
          : 0

        if (useRainbow) {
          // 彩虹色映射
          const hue = (1 - normalizedIntensity) * 0.7
          color = new THREE.Color().setHSL(hue, 1, 0.5)
        } else {
          // 线性插值
          const minColor = options.minColor || { r: 0, g: 0, b: 0 }
          const maxColor = options.maxColor || { r: 255, g: 255, b: 255 }
          const r = (minColor.r + (maxColor.r - minColor.r) * normalizedIntensity) / 255
          const g = (minColor.g + (maxColor.g - minColor.g) * normalizedIntensity) / 255
          const b = (minColor.b + (maxColor.b - minColor.b) * normalizedIntensity) / 255
          color = new THREE.Color(r, g, b)
        }
      } else {
        // 默认颜色
        color = new THREE.Color(0xff0000)
      }

      colors.push(color)
    }

    // 创建或更新渲染对象
    let pointcloudGroup = renderObjects.value.pointcloudGroup
    if (!pointcloudGroup) {
      pointcloudGroup = new THREE.Group()
      renderObjects.value.pointcloudGroup = pointcloudGroup
      scene.add(pointcloudGroup)
    }

    // 移除旧的该组件的点云
    const oldPoints = pointcloudGroup.children.find(child => child.userData.componentId === componentId)
    if (oldPoints) {
      pointcloudGroup.remove(oldPoints)
      if (oldPoints.geometry) oldPoints.geometry.dispose()
      if (oldPoints.material) {
        if (Array.isArray(oldPoints.material)) {
          oldPoints.material.forEach((mat) => mat.dispose())
        } else {
          oldPoints.material.dispose()
        }
      }
    }

    // 创建点云几何体
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const colorArray = new Float32Array(points.length * 3)
    colors.forEach((color, i) => {
      colorArray[i * 3] = color.r
      colorArray[i * 3 + 1] = color.g
      colorArray[i * 3 + 2] = color.b
    })
    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3))

    // 创建材质
    const material = new THREE.PointsMaterial({
      size: size,
      vertexColors: true,
      transparent: true,
      opacity: alpha,
      sizeAttenuation: true // 点云通常需要距离衰减
    })

    const pointsObject = new THREE.Points(geometry, material)
    pointsObject.userData.componentId = componentId
    pointcloudGroup.add(pointsObject)

    console.log('PointCloud2: Rendered point cloud', {
      componentId,
      pointCount: points.length,
      colorTransformer,
      useRainbow
    })
  }

  /**
   * 更新 TF 渲染
   */
  function updateTFRender(componentId: string) {
    // 获取组件配置
    const component = rvizStore.displayComponents.find(c => c.id === componentId)
    if (!component) return

    const options = component.options || {}
    const showNames = options.showNames ?? true
    const showAxes = options.showAxes ?? true
    const showArrows = options.showArrows ?? true
    const markerScale = options.markerScale ?? 1
    const markerAlpha = options.markerAlpha ?? 1
    const enabledFrames = new Set<string>()
    
    // 获取启用的 frames
    if (options.frames && Array.isArray(options.frames)) {
      options.frames.forEach((frame: any) => {
        if (frame.enabled) {
          enabledFrames.add(frame.name)
        }
      })
    }

    // 创建或获取 TF 组
    let tfGroup = renderObjects.value.tfGroup
    if (!tfGroup) {
      tfGroup = new THREE.Group()
      renderObjects.value.tfGroup = tfGroup
      scene.add(tfGroup)
    }

    // 正确清理旧的 TF 对象：先 dispose 所有 WebGL 资源，再清除
    // 这是根治内存泄漏的关键：tfGroup.clear() 不会自动 dispose WebGL 资源
    const disposeObject = (obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
        // 清理 geometry
        if (obj.geometry) {
          obj.geometry.dispose()
        }
        // 清理 material
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => {
              if (mat.map) mat.map.dispose()
              mat.dispose()
            })
          } else {
            if (obj.material.map) obj.material.map.dispose()
            obj.material.dispose()
          }
        }
      } else if (obj instanceof THREE.Sprite) {
        // 清理 sprite 的 material 和 texture
        if (obj.material) {
          const spriteMat = obj.material as THREE.SpriteMaterial
          if (spriteMat.map) {
            spriteMat.map.dispose()
          }
          spriteMat.dispose()
        }
      } else if (obj instanceof THREE.Group) {
        // 递归清理 Group 的子对象
        const children = [...obj.children]
        children.forEach(child => disposeObject(child))
      }
    }
    
    // 遍历并清理所有子对象
    const childrenToDispose = [...tfGroup.children]
    childrenToDispose.forEach(child => disposeObject(child))
    
    // 现在可以安全地清除（所有资源已释放）
    tfGroup.clear()

    // 从 tfManager 获取变换数据
    const transforms = tfManager.getTransforms()
    const tfTree = tfManager.getTFTree()

    // 获取固定帧（用于计算变换）
    const fixedFrame = rvizStore.globalOptions.fixedFrame || 'map'

    // 存储所有 frame 的位置（用于绘制连接线）
    const framePositions = new Map<string, THREE.Vector3>()

    // 计算 frame 相对于固定帧的变换
    const getFrameTransformToFixed = (frameName: string): THREE.Matrix4 | null => {
      if (frameName === fixedFrame) {
        return new THREE.Matrix4().identity()
      }

      // 查找从 fixedFrame 到 frameName 的路径
      const path: string[] = []
      const findPath = (current: string, target: string, visited: Set<string>): boolean => {
        if (current === target) {
          path.push(current)
          return true
        }
        if (visited.has(current)) return false
        visited.add(current)

        // 查找 current 的所有子节点
        for (const [parent, children] of transforms.entries()) {
          if (parent === current) {
            for (const [childName, transform] of children.entries()) {
              if (findPath(childName, target, visited)) {
                path.push(current)
                return true
              }
            }
          }
        }
        return false
      }

      if (!findPath(fixedFrame, frameName, new Set())) {
        return null
      }

      // 沿着路径累积变换
      let result = new THREE.Matrix4().identity()
      for (let i = path.length - 1; i > 0; i--) {
        const parent = path[i]
        const child = path[i - 1]
        if (!parent || !child) continue
        const parentTransforms = transforms.get(parent)
        if (!parentTransforms) continue
        const transform = parentTransforms.get(child)
        if (!transform || !transform.translation || !transform.rotation) continue

        const rosX = transform.translation.x
        const rosY = transform.translation.y
        const rosZ = transform.translation.z
        const threeX = -rosY
        const threeY = rosZ
        const threeZ = rosX

        const rosQx = transform.rotation.x
        const rosQy = transform.rotation.y
        const rosQz = transform.rotation.z
        const rosQw = transform.rotation.w

        const rosQuat = new THREE.Quaternion(rosQx, rosQy, rosQz, rosQw)
        const coordRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)
        const threeQuat = new THREE.Quaternion()
        threeQuat.multiplyQuaternions(coordRot, rosQuat)

        const localTransform = new THREE.Matrix4()
        localTransform.compose(
          new THREE.Vector3(threeX, threeY, threeZ),
          threeQuat,
          new THREE.Vector3(1, 1, 1)
        )

        result = result.multiply(localTransform)
      }

      return result
    }

    // 递归渲染 TF 树
    // 修改：即使父节点未启用，也继续递归检查子节点
    const renderTFFrame = (node: any, parentWorldTransform?: THREE.Matrix4) => {
      const isEnabled = enabledFrames.has(node.name)
      let worldTransform: THREE.Matrix4 | null = null
      
      // 计算节点的世界变换（无论是否启用，都需要存储位置用于绘制箭头）
      worldTransform = getFrameTransformToFixed(node.name)
      
      // 如果无法找到到固定帧的路径，尝试使用父节点变换（向后兼容）
      if (!worldTransform) {
        let localTransform = new THREE.Matrix4().identity()
        
        if (node.parent && transforms.has(node.parent)) {
          const parentTransforms = transforms.get(node.parent)!
          const transform = parentTransforms.get(node.name)
          
          if (transform && transform.translation && transform.rotation) {
            const rosX = transform.translation.x
            const rosY = transform.translation.y
            const rosZ = transform.translation.z
            const threeX = -rosY
            const threeY = rosZ
            const threeZ = rosX
            
            const rosQx = transform.rotation.x
            const rosQy = transform.rotation.y
            const rosQz = transform.rotation.z
            const rosQw = transform.rotation.w
            
            const rosQuat = new THREE.Quaternion(rosQx, rosQy, rosQz, rosQw)
            const coordRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)
            const threeQuat = new THREE.Quaternion()
            threeQuat.multiplyQuaternions(coordRot, rosQuat)
            
            localTransform.compose(
              new THREE.Vector3(threeX, threeY, threeZ),
              threeQuat,
              new THREE.Vector3(1, 1, 1)
            )
          }
        }

        worldTransform = localTransform.clone()
        if (parentWorldTransform) {
          worldTransform = parentWorldTransform.clone().multiply(localTransform)
        }
      }
      
      // 如果计算出了变换，存储位置（无论节点是否启用，都需要用于绘制箭头）
      if (worldTransform) {
        const position = new THREE.Vector3()
        const quaternion = new THREE.Quaternion()
        const scale = new THREE.Vector3(1, 1, 1)
        worldTransform.decompose(position, quaternion, scale)
        
        // 存储位置（用于绘制连接线）
        framePositions.set(node.name, position.clone())
      }
      
      // 如果当前节点被启用，渲染它
      if (isEnabled && worldTransform) {
        // 计算相对于固定帧的变换（而不是相对于父节点）
        // 这样即使父节点未启用，也能正确显示子节点
        worldTransform = getFrameTransformToFixed(node.name)
        
        // 如果无法找到到固定帧的路径，尝试使用父节点变换（向后兼容）
        if (!worldTransform) {
          let localTransform = new THREE.Matrix4().identity()
          
          if (node.parent && transforms.has(node.parent)) {
            const parentTransforms = transforms.get(node.parent)!
            const transform = parentTransforms.get(node.name)
            
            if (transform && transform.translation && transform.rotation) {
              const rosX = transform.translation.x
              const rosY = transform.translation.y
              const rosZ = transform.translation.z
              const threeX = -rosY
              const threeY = rosZ
              const threeZ = rosX
              
              const rosQx = transform.rotation.x
              const rosQy = transform.rotation.y
              const rosQz = transform.rotation.z
              const rosQw = transform.rotation.w
              
              const rosQuat = new THREE.Quaternion(rosQx, rosQy, rosQz, rosQw)
              const coordRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)
              const threeQuat = new THREE.Quaternion()
              threeQuat.multiplyQuaternions(coordRot, rosQuat)
              
              localTransform.compose(
                new THREE.Vector3(threeX, threeY, threeZ),
                threeQuat,
                new THREE.Vector3(1, 1, 1)
              )
            }
          }

          worldTransform = localTransform.clone()
          if (parentWorldTransform) {
            worldTransform = parentWorldTransform.clone().multiply(localTransform)
          }
        }
        
        if (!worldTransform) {
          // 如果无法计算变换，跳过渲染，但继续递归子节点
          if (node.children && node.children.length > 0) {
            node.children.forEach((child: any) => {
              renderTFFrame(child, undefined)
            })
          }
          return
        }

        // 提取位置和旋转
        const position = new THREE.Vector3()
        const quaternion = new THREE.Quaternion()
        const scale = new THREE.Vector3(1, 1, 1)
        worldTransform.decompose(position, quaternion, scale)
        
        // 存储位置（用于绘制连接线）
        framePositions.set(node.name, position.clone())

        // 创建 frame 组
        const frameGroup = new THREE.Group()
        frameGroup.position.copy(position)
        frameGroup.quaternion.copy(quaternion)
        frameGroup.userData.frameName = node.name
        frameGroup.userData.componentId = componentId

        // 显示坐标轴（红色X、绿色Y、蓝色Z）
        if (showAxes) {
          const axisLength = 0.3 * markerScale
          
          // X轴（红色）- THREE.js X方向
          const xGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(axisLength, 0, 0)
          ])
          const xMaterial = new THREE.LineBasicMaterial({ 
            color: 0xff0000, 
            transparent: true, 
            opacity: markerAlpha 
          })
          const xAxis = new THREE.Line(xGeometry, xMaterial)
          frameGroup.add(xAxis)

          // Y轴（绿色）- THREE.js Y方向
          const yGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, axisLength, 0)
          ])
          const yMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: markerAlpha 
          })
          const yAxis = new THREE.Line(yGeometry, yMaterial)
          frameGroup.add(yAxis)

          // Z轴（蓝色）- THREE.js Z方向
          const zGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, axisLength)
          ])
          const zMaterial = new THREE.LineBasicMaterial({ 
            color: 0x0000ff, 
            transparent: true, 
            opacity: markerAlpha 
          })
          const zAxis = new THREE.Line(zGeometry, zMaterial)
          frameGroup.add(zAxis)
        }

        // 显示名称（使用 CSS2DRenderer 或 Canvas 纹理）
        if (showNames) {
          // 创建文本标签（使用 Canvas 纹理）
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')!
          canvas.width = 256
          canvas.height = 64
          
          context.fillStyle = 'rgba(255, 255, 255, ' + markerAlpha + ')'
          context.font = 'Bold 24px Arial'
          context.fillText(node.name, 10, 40)
          
          const texture = new THREE.CanvasTexture(canvas)
          const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: markerAlpha
          })
          const sprite = new THREE.Sprite(spriteMaterial)
          sprite.scale.set(0.5 * markerScale, 0.125 * markerScale, 1)
          sprite.position.set(0, 0.2 * markerScale, 0)
          sprite.userData.frameName = node.name
          frameGroup.add(sprite)
        }

        tfGroup.add(frameGroup)
      }

      // 递归渲染子节点（无论当前节点是否启用，都要检查子节点）
      if (node.children && node.children.length > 0) {
        node.children.forEach((child: any) => {
          // 如果当前节点启用且有 worldTransform，传递它；否则传递 undefined（让子节点自己计算）
          const childParentTransform = (isEnabled && worldTransform) ? worldTransform : undefined
          renderTFFrame(child, childParentTransform)
        })
      }
    }

    // 渲染所有根节点
    tfTree.forEach(rootNode => {
      renderTFFrame(rootNode)
    })


    // 渲染所有根节点
    tfTree.forEach(rootNode => {
      renderTFFrame(rootNode)
    })
  }

  /**
   * 从字节数组中读取 Float32
   */
  const readFloat32 = (data: Uint8Array, offset: number): number => {
    try {
      if (offset + 4 > data.length) {
        return 0
      }
      const view = new DataView(data.buffer, data.byteOffset + offset, 4)
      return view.getFloat32(0, true) // little endian
    } catch (error) {
      console.error('Error reading Float32:', error, { offset, dataLength: data.length })
      return 0
    }
  }

  /**
   * 从字节数组中读取 Uint32
   */
  const readUint32 = (data: Uint8Array, offset: number): number => {
    try {
      if (offset + 4 > data.length) {
        return 0
      }
      const view = new DataView(data.buffer, data.byteOffset + offset, 4)
      return view.getUint32(0, true) // little endian
    } catch (error) {
      console.error('Error reading Uint32:', error, { offset, dataLength: data.length })
      return 0
    }
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
      case 'tf':
        updateTFRender(componentId)
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
      case 'pointcloud2':
        if (renderObjects.value.pointcloudGroup && componentId) {
          // 设置特定组件的可见性
          renderObjects.value.pointcloudGroup.children.forEach(child => {
            if (child.userData.componentId === componentId) {
              child.visible = visible
            }
          })
        } else if (renderObjects.value.pointcloudGroup) {
          // 设置所有 PointCloud2 的可见性
          renderObjects.value.pointcloudGroup.visible = visible
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
