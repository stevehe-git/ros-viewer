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
import { TFRenderer } from '@/services/tfRenderer'
import { 
  convertROSTranslationToThree, 
  convertROSRotationToThree,
  createROSAxes
} from '@/services/coordinateConverter'
import { urdfLoaderService } from '@/services/urdfLoader'
import type { RobotModel } from '@/services/urdfLoader'

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
  axesGroup?: THREE.Group // 支持多个 Axes 组件
  robotModelGroup?: THREE.Group // 支持多个 RobotModel 组件
  robotModels?: Map<string, RobotModel> // 存储每个组件的机器人模型
  [key: string]: any
}

/**
 * 3D 渲染器 composable
 */
export function use3DRenderer(scene: THREE.Scene) {
  const rvizStore = useRvizStore()
  const renderObjects = ref<RendererObjects>({})
  
  // TF 渲染器实例（单例，在场景中共享）
  let tfRenderer: TFRenderer | null = null

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
      // ROS 地图在 XY 平面（水平面，Z=0），转换后应该在 THREE.js 的 XZ 平面（Y=0）
      // 绕X轴旋转-90度，使XY平面变为XZ平面
      renderObjects.value.mapMesh.rotation.set(-Math.PI / 2, 0, 0)
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
    if (!message || !message.poses || message.poses.length === 0) {
      // 如果没有数据，隐藏路径线
      if (renderObjects.value.pathLine) {
        renderObjects.value.pathLine.visible = false
      }
      return
    }

    // ✅ 使用正确的坐标转换公式：ROS(x, y, z) → THREE.js(x, z, -y)
    const points = message.poses.map((pose: any) => {
      const position = pose.pose?.position || pose.position || {}
      const rosX = position.x || 0
      const rosY = position.y || 0
      const rosZ = position.z || 0.1
      
      // 转换到 THREE.js 坐标系：ROS(x, y, z) → THREE.js(x, z, -y)
      return convertROSTranslationToThree({ x: rosX, y: rosY, z: rosZ })
    })

    if (points.length === 0) {
      // 如果没有有效点，隐藏路径线
      if (renderObjects.value.pathLine) {
        renderObjects.value.pathLine.visible = false
      }
      return
    }

    // 获取组件配置
    const component = rvizStore.displayComponents.find(c => c.id === componentId)
    const options = component?.options || {}
    const color = options.color || '#ff0000'
    const lineWidth = options.lineWidth || 2

    // 如果路径线不存在，创建它
    if (!renderObjects.value.pathLine) {
      const pathGeometry = new THREE.BufferGeometry().setFromPoints(points)
      const pathMaterial = new THREE.LineBasicMaterial({ 
        color: new THREE.Color(color), 
        linewidth: lineWidth 
      })
      renderObjects.value.pathLine = new THREE.Line(pathGeometry, pathMaterial)
      renderObjects.value.pathLine.visible = false // ✅ 默认不可见，只有在组件启用且有数据时才显示
      scene.add(renderObjects.value.pathLine)
    } else {
      // 更新路径点
      const pathGeometry = new THREE.BufferGeometry().setFromPoints(points)
      renderObjects.value.pathLine.geometry.dispose()
      renderObjects.value.pathLine.geometry = pathGeometry
      
      // 更新颜色和线宽
      if (renderObjects.value.pathLine.material instanceof THREE.LineBasicMaterial) {
        renderObjects.value.pathLine.material.color = new THREE.Color(color)
        renderObjects.value.pathLine.material.linewidth = lineWidth
      }
    }
    
    // ✅ 只有在组件启用时才显示路径
    if (component?.enabled) {
      renderObjects.value.pathLine.visible = true
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

    // 获取 LaserScan 的 frame_id 和 fixedFrame
    const scanFrame = message.header?.frame_id || 'base_scan'
    const fixedFrame = rvizStore.globalOptions.fixedFrame || 'map'

    console.log(`LaserScan: Processing scan in frame "${scanFrame}", fixed frame is "${fixedFrame}"`)

    // 检查 TF 可用性
    const hasScanFrame = tfManager.hasFrame(scanFrame)
    const hasFixedFrame = tfManager.hasFrame(fixedFrame)
    const scanParent = tfManager.getFrameParent(scanFrame)
    const transformPath = tfManager.getTransformPath(scanFrame, fixedFrame)

    console.log(`LaserScan TF Debug:`, {
      scanFrame: scanFrame,
      fixedFrame: fixedFrame,
      hasScanFrame: hasScanFrame,
      hasFixedFrame: hasFixedFrame,
      scanParent: scanParent,
      transformPath: transformPath,
      availableFrames: Array.from(tfManager.getFrames())
    })

    // 计算从 scanFrame 到 fixedFrame 的变换
    const transforms = tfManager.getTransforms()
    const getScanFrameTransformToFixed = (): THREE.Matrix4 | null => {
      if (scanFrame === fixedFrame) {
        return new THREE.Matrix4().identity()
      }

      // 从 scanFrame 向上查找路径到 fixedFrame
      const findPathUp = (current: string, target: string, path: string[]): boolean => {
        if (current === target) {
          path.push(current)
          return true
        }

        // 查找 current 的父节点
        for (const [parent, children] of transforms.entries()) {
          if (children.has(current)) {
            if (findPathUp(parent, target, path)) {
              path.push(current)
              return true
            }
          }
        }
        return false
      }

      const path: string[] = []
      if (findPathUp(scanFrame, fixedFrame, path)) {
        // 累积变换矩阵：从 scanFrame 到 fixedFrame
        let transformMatrix = new THREE.Matrix4().identity()

        // path[0] 是 fixedFrame，path[path.length-1] 是 scanFrame
        // 我们需要从 scanFrame 开始向上累积变换到 fixedFrame
        for (let i = path.length - 1; i > 0; i--) {
          const child = path[i]      // 当前坐标系
          const parent = path[i - 1] // 父坐标系

          if (!child || !parent) continue

          const parentTransforms = transforms.get(parent)
          if (!parentTransforms) continue

          const transform = parentTransforms.get(child)
          if (!transform || !transform.translation || !transform.rotation) continue

          // ✅ 使用正确的坐标转换公式：ROS(x, y, z) → THREE.js(x, z, -y)
          const threePosition = convertROSTranslationToThree(transform.translation)
          const threeQuat = convertROSRotationToThree(transform.rotation)

          const localTransform = new THREE.Matrix4()
          localTransform.compose(threePosition, threeQuat, new THREE.Vector3(1, 1, 1))

          // 从右向左累积变换（THREE.js矩阵乘法）
          transformMatrix = localTransform.multiply(transformMatrix)
        }

        return transformMatrix
      }

      console.warn(`LaserScan: Could not find TF path from ${scanFrame} to ${fixedFrame}`)
      return null
    }

    const scanToFixedTransform = getScanFrameTransformToFixed()

    if (scanToFixedTransform) {
      console.log(`LaserScan: Found TF transform from ${scanFrame} to ${fixedFrame}`)
    } else {
      console.warn(`LaserScan: No TF transform found from ${scanFrame} to ${fixedFrame}. Point cloud will not be transformed.`)
    }

    // 创建点云数据（保持原始坐标，在 base_scan frame 下）
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
      // ✅ 使用正确的坐标转换公式：ROS(x, y, z) → THREE.js(x, z, -y)
      // 
      // ROS 坐标系：
      // - X 轴 → 机器人正前方
      // - Y 轴 → 机器人左侧方
      // - Z 轴 → 垂直地面正上方
      //
      // LaserScan 在 ROS XY 平面（俯视图）
      const rosX = range * Math.cos(angle)  // ROS X (向前)
      const rosY = range * Math.sin(angle)  // ROS Y (向左)
      const rosZ = 0 // ROS Z = 0 (在XY平面)
      
      // 转换到 THREE.js 坐标系：ROS(x, y, z) → THREE.js(x, z, -y)
      // - ROS X (向前) → THREE.js X
      // - ROS Y (向左) → THREE.js -Z（取反）
      // - ROS Z (向上) → THREE.js Y
      const threePosition = convertROSTranslationToThree({ x: rosX, y: rosY, z: rosZ })
      points.push(threePosition)

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
      
      // 应用从 scanFrame 到 fixedFrame 的变换
      if (scanToFixedTransform) {
        pointsObject.applyMatrix4(scanToFixedTransform)
      }
      
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
      
      // 应用从 scanFrame 到 fixedFrame 的变换
      if (scanToFixedTransform) {
        spriteGroup.applyMatrix4(scanToFixedTransform)
      }
      
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
      
      // 应用从 scanFrame 到 fixedFrame 的变换
      if (scanToFixedTransform) {
        pointsObject.applyMatrix4(scanToFixedTransform)
      }
      
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

      // ✅ 使用统一的坐标转换公式：ROS(x, y, z) → THREE.js(x, z, -y)
      // - ROS X (向前) → THREE.js X
      // - ROS Y (向左) → THREE.js -Z（取反）
      // - ROS Z (向上) → THREE.js Y
      const threePosition = convertROSTranslationToThree({ x: rosX, y: rosY, z: rosZ })
      points.push(threePosition)

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
   * 创建坐标系轴可视化（已废弃，请使用 coordinateConverter.createROSAxes）
   * 
   * 注意：此函数已被 coordinateConverter.createROSAxes 替代
   * 所有组件应使用统一的 createROSAxes 函数以确保坐标系一致性
   * 
   * @deprecated 使用 createROSAxes 代替
   */
  const createFrameAxes = (axisLength: number, markerAlpha: number): THREE.Group => {
    // 使用统一的坐标轴创建函数
    const axesGroup = createROSAxes(axisLength, 0.01)
    
    // 应用透明度
    axesGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (child.material instanceof THREE.MeshBasicMaterial) {
          child.material.transparent = true
          child.material.opacity = markerAlpha
        }
      }
    })
    
    return axesGroup
  }

  /**
   * 创建坐标系名称标签
   */
  const createFrameLabel = (frameName: string, markerScale: number, markerAlpha: number): THREE.Sprite => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    canvas.width = 256
    canvas.height = 64
    
    context.fillStyle = 'rgba(255, 255, 255, ' + markerAlpha + ')'
    context.font = 'Bold 24px Arial'
    context.fillText(frameName, 10, 40)
    
    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: markerAlpha
    })
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.scale.set(0.5 * markerScale, 0.125 * markerScale, 1)
    sprite.position.set(0, 0.2 * markerScale, 0)
    return sprite
  }

  /**
   * 更新 TF 渲染
   * 
   * 核心原理重构（基于用户提供的核心结论）：
   * 1. ROS 和 THREE.js 使用不同的坐标系定义，必须做坐标映射转换
   * 2. 坐标转换公式（唯一正确）：ROS(x, y, z) → THREE.js(x, z, -y)
   * 3. 四元数直接赋值，分量一一对应，无需修改
   * 4. 使用 THREE.Group 建立父子关系，严格还原 ROS TF 树的层级结构
   * 5. 所有坐标都是本地坐标（相对父坐标系），Three.js 自动计算世界坐标
   * 
   * 设计原则：
   * - 逻辑拆分：坐标转换、TF树构建、渲染分离
   * - 层级还原：严格使用 Group 父子关系还原 ROS TF 树
   * - 本地坐标：所有坐标都是相对父坐标系的本地坐标
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
    if (options.frames && Array.isArray(options.frames) && options.frames.length > 0) {
      // 如果配置了 frames 列表，只渲染启用的 frames
      options.frames.forEach((frame: any) => {
        if (frame.enabled) {
          enabledFrames.add(frame.name)
        }
      })
    } else {
      // 如果没有配置 frames 列表，默认渲染所有 frame
      const allFrames = tfManager.getFrames()
      allFrames.forEach(frameName => {
        enabledFrames.add(frameName)
      })
    }

    // 初始化或获取 TF 渲染器
    if (!tfRenderer) {
      tfRenderer = new TFRenderer(scene)
      // 将 TF 渲染器的根组存储到 renderObjects 中
      renderObjects.value.tfGroup = tfRenderer.rootGroup
    }

    // 设置固定帧
    const fixedFrame = rvizStore.globalOptions.fixedFrame || 'map'
    tfRenderer.setFixedFrame(fixedFrame)

    // 从 tfManager 获取变换数据和树结构
    const transforms = tfManager.getTransforms()
    const tfTree = tfManager.getTFTree()

    // 使用 TFRenderer 构建 TF 层级结构
    // 这会根据 TF 树创建 THREE.Group 的父子关系，并应用正确的坐标转换
    // buildFrameHierarchy 内部会应用所有变换数据，使用正确的坐标转换公式
    tfRenderer.buildFrameHierarchy(tfTree, transforms)

    // ✅ 对于每个启用的 frame，需要确保它的所有父节点也被显示
    // 这样即使父节点没有被选中，只要子节点被选中，父节点也会显示
    const framesToShow = new Set<string>(enabledFrames)
    
    // 确保固定帧也在显示列表中（作为根节点）
    framesToShow.add(fixedFrame)
    
    // 查找每个启用 frame 的所有父节点（从 tfManager 获取父节点信息）
    const findParentPath = (frameName: string, visited: Set<string> = new Set()): string[] => {
      if (visited.has(frameName)) return [] // 避免循环
      visited.add(frameName)
      
      const path: string[] = []
      // 从 transforms 中查找 frameName 的父节点
      for (const [parentName, children] of transforms.entries()) {
        if (children.has(frameName)) {
          path.push(parentName)
          // 递归查找父节点的父节点
          const parentPath = findParentPath(parentName, visited)
          path.push(...parentPath)
          break
        }
      }
      return path
    }
    
    // 为每个启用的 frame 添加其所有父节点到显示列表
    enabledFrames.forEach(frameName => {
      const parentPath = findParentPath(frameName)
      parentPath.forEach(parentName => {
        framesToShow.add(parentName)
      })
    })
    
    // 配置每个需要显示的 frame 的显示选项
    framesToShow.forEach(frameName => {
      const frameObject = tfRenderer!.getFrame(frameName)
      if (frameObject) {
        // 如果是启用的 frame，显示完整的配置（axes, names等）
        // 如果是父节点（未启用但需要显示），只显示基本结构，不显示 axes 和 names
        const isEnabled = enabledFrames.has(frameName)
        tfRenderer!.configureFrame(frameName, {
          showAxes: isEnabled ? showAxes : false,
          showNames: isEnabled ? showNames : false,
          markerScale,
          markerAlpha
        })
        
        // 设置可见性
        tfRenderer!.setFrameVisibility(frameName, true)
      }
    })

    // 隐藏未启用且不在显示列表中的 frames
    tfRenderer.getAllFrameNames().forEach(frameName => {
      if (!framesToShow.has(frameName)) {
        tfRenderer!.setFrameVisibility(frameName, false)
      }
    })

    // TODO: 实现箭头连接线绘制（showArrows）
    // 如果需要显示箭头，可以遍历 TF 树，在父子 frame 之间绘制箭头
  }

  /**
   * 更新 RobotModel 渲染
   * 
   * 加载并显示 URDF 机器人模型
   * 支持从 ROS 参数或文件 URL 加载
   */
  async function updateRobotModelRender(componentId: string) {
    // 获取组件配置
    const component = rvizStore.displayComponents.find(c => c.id === componentId)
    if (!component) {
      console.warn('RobotModel: Component not found', componentId)
      return
    }

    const options = component.options || {}
    const urdfParameter = options.urdfParameter || 'robot_description'
    const urdfFileUrl = options.urdfFileUrl || ''
    const visualEnabled = options.visualEnabled !== false // 默认启用
    const collisionEnabled = options.collisionEnabled || false
    const alpha = options.alpha ?? 1
    const packages = options.packages || {}

    // 创建或获取 RobotModel 组
    let robotModelGroup = renderObjects.value.robotModelGroup
    if (!robotModelGroup) {
      robotModelGroup = new THREE.Group()
      robotModelGroup.name = 'RobotModel_Group'
      renderObjects.value.robotModelGroup = robotModelGroup
      scene.add(robotModelGroup)
    }

    // 初始化 robotModels Map
    if (!renderObjects.value.robotModels) {
      renderObjects.value.robotModels = new Map()
    }

    // 移除旧的该组件的机器人模型
    const oldModel = renderObjects.value.robotModels.get(componentId)
    if (oldModel) {
      robotModelGroup.remove(oldModel.scene)
      renderObjects.value.robotModels.delete(componentId)
    }

    try {
      let robotModel: RobotModel | null = null

      // 优先从文件 URL 加载，否则从 ROS 参数加载
      if (urdfFileUrl) {
        robotModel = await urdfLoaderService.loadURDF(urdfFileUrl, {
          packages,
          showVisual: visualEnabled,
          showCollision: collisionEnabled
        })
      } else {
        // 从 ROS 参数加载（需要 ROS 连接）
        if (rvizStore.robotConnection.connected && rvizStore.robotConnection.protocol === 'ros') {
          const rosPlugin = rvizStore.getPlugin('ros')
          if (rosPlugin && typeof (rosPlugin as any).getROSInstance === 'function') {
            const ros = (rosPlugin as any).getROSInstance()
            if (ros) {
              robotModel = await urdfLoaderService.loadURDFFromROSParam(
                ros,
                urdfParameter,
                {
                  packages,
                  showVisual: visualEnabled,
                  showCollision: collisionEnabled
                }
              )
            } else {
              console.warn('RobotModel: ROS instance not available')
              return
            }
          } else {
            console.warn('RobotModel: ROS plugin not available. Please provide URDF File URL or connect to ROS.')
            return
          }
        } else {
          console.warn('RobotModel: No ROS connection available. Please provide URDF File URL or connect to ROS.')
          return
        }
      }

      if (!robotModel) {
        console.warn('RobotModel: Failed to load robot model')
        return
      }

      // 应用透明度
      robotModel.scene.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              if (mat instanceof THREE.Material) {
                mat.transparent = true
                mat.opacity = alpha
              }
            })
          } else if (child.material instanceof THREE.Material) {
            child.material.transparent = true
            child.material.opacity = alpha
          }
        }
      })

      // 设置组件 ID
      robotModel.scene.userData.componentId = componentId

      // 添加到场景
      robotModelGroup.add(robotModel.scene)

      // 存储模型引用
      renderObjects.value.robotModels!.set(componentId, robotModel)

      // 设置可见性
      robotModel.scene.visible = component.enabled

      console.log('RobotModel: Loaded successfully', {
        componentId,
        jointsCount: robotModel.joints.size,
        linksCount: robotModel.links.size
      })
    } catch (error) {
      console.error('RobotModel: Error loading robot model', error)
    }
  }

  /**
   * 更新 Axes 渲染
   * 
   * 根据选择的 referenceFrame，将 axes 渲染到对应的坐标系位置
   * 使用正确的坐标转换公式：ROS(x, y, z) → THREE.js(x, z, -y)
   */
  function updateAxesRender(componentId: string) {
    // 获取组件配置
    const component = rvizStore.displayComponents.find(c => c.id === componentId)
    if (!component) return

    const options = component.options || {}
    const referenceFrame = options.referenceFrame || rvizStore.globalOptions.fixedFrame || 'map'
    const length = options.length ?? 1
    const radius = options.radius ?? 0.1
    const alpha = options.alpha ?? 1
    const showTrail = options.showTrail ?? false

    // 创建或获取 Axes 组
    let axesGroup = renderObjects.value.axesGroup
    if (!axesGroup) {
      axesGroup = new THREE.Group()
      axesGroup.name = 'Axes_Group'
      renderObjects.value.axesGroup = axesGroup
      scene.add(axesGroup)
    }

    // 查找或创建该组件的 axes 对象
    let axesObject = axesGroup.children.find(
      child => child.userData.componentId === componentId
    ) as THREE.Group | undefined

    if (!axesObject) {
      axesObject = new THREE.Group()
      axesObject.name = `Axes_${componentId}`
      axesObject.userData.componentId = componentId
      axesGroup.add(axesObject)
    }

    // 清理旧的坐标轴
    const oldAxes = [...axesObject.children]
    oldAxes.forEach(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (child.material instanceof THREE.Material) {
          child.material.dispose()
        }
      }
      axesObject!.remove(child)
    })

    // 获取固定帧
    const fixedFrame = rvizStore.globalOptions.fixedFrame || 'map'

    // 计算 referenceFrame 相对于固定帧的变换
    const getFrameTransformToFixed = (frameName: string): THREE.Matrix4 | null => {
      if (frameName === fixedFrame) {
        return new THREE.Matrix4().identity()
      }

      const transforms = tfManager.getTransforms()
      
      // 从 frameName 向上查找路径到 fixedFrame
      const findPathUp = (current: string, target: string, path: string[]): boolean => {
        if (current === target) {
          path.push(current)
          return true
        }

        // 查找 current 的父节点
        for (const [parent, children] of transforms.entries()) {
          if (children.has(current)) {
            if (findPathUp(parent, target, path)) {
              path.push(current)
              return true
            }
          }
        }
        return false
      }

      const path: string[] = []
      if (findPathUp(frameName, fixedFrame, path)) {
        // 累积变换矩阵：从 frameName 到 fixedFrame
        let transformMatrix = new THREE.Matrix4().identity()

        // path[0] 是 fixedFrame，path[path.length-1] 是 frameName
        // 我们需要从 frameName 开始向上累积变换到 fixedFrame
        for (let i = path.length - 1; i > 0; i--) {
          const child = path[i]      // 当前坐标系
          const parent = path[i - 1] // 父坐标系

          if (!child || !parent) continue

          const parentTransforms = transforms.get(parent)
          if (!parentTransforms) continue

          const transform = parentTransforms.get(child)
          if (!transform || !transform.translation || !transform.rotation) continue

          // ✅ 使用正确的坐标转换公式：ROS(x, y, z) → THREE.js(x, z, -y)
          const position = convertROSTranslationToThree(transform.translation)
          const quaternion = convertROSRotationToThree(transform.rotation)

          const localTransform = new THREE.Matrix4()
          localTransform.compose(position, quaternion, new THREE.Vector3(1, 1, 1))

          // 从右向左累积变换（THREE.js矩阵乘法）
          transformMatrix = localTransform.multiply(transformMatrix)
        }

        return transformMatrix
      }

      console.warn(`Axes: Could not find TF path from ${frameName} to ${fixedFrame}`)

      return null
    }

    const transform = getFrameTransformToFixed(referenceFrame)
    
    if (transform) {
      // 提取位置和旋转
      const position = new THREE.Vector3()
      const quaternion = new THREE.Quaternion()
      const scale = new THREE.Vector3(1, 1, 1)
      transform.decompose(position, quaternion, scale)

      // 设置 axes 的位置和旋转
      axesObject.position.copy(position)
      axesObject.quaternion.copy(quaternion)
    } else {
      // 如果找不到变换，设置为原点
      axesObject.position.set(0, 0, 0)
      axesObject.quaternion.set(0, 0, 0, 1)
    }

    // 使用统一的坐标轴创建函数（确保与TF、Grid等组件一致）
    const rosAxes = createROSAxes(length, radius)
    
    // 应用透明度
    rosAxes.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (child.material instanceof THREE.MeshBasicMaterial) {
          child.material.transparent = true
          child.material.opacity = alpha
        }
      }
    })
    
    axesObject.add(rosAxes)

    // TODO: 实现 Show Trail 功能（如果需要）
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
      case 'axes':
        updateAxesRender(componentId)
        break
      case 'robotmodel':
        updateRobotModelRender(componentId)
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
        // ✅ 路径可见性由 updatePathRender 控制，这里只处理隐藏的情况
        if (renderObjects.value.pathLine && !visible) {
          renderObjects.value.pathLine.visible = false
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
      case 'axes':
        if (renderObjects.value.axesGroup && componentId) {
          // 设置特定组件的可见性
          renderObjects.value.axesGroup.children.forEach(child => {
            if (child.userData.componentId === componentId) {
              child.visible = visible
            }
          })
        } else if (renderObjects.value.axesGroup) {
          // 设置所有 Axes 的可见性
          renderObjects.value.axesGroup.visible = visible
        }
        break
      case 'robotmodel':
        if (renderObjects.value.robotModelGroup && componentId) {
          // 设置特定组件的可见性
          const robotModel = renderObjects.value.robotModels?.get(componentId)
          if (robotModel) {
            robotModel.scene.visible = visible
          }
        } else if (renderObjects.value.robotModelGroup) {
          // 设置所有 RobotModel 的可见性
          renderObjects.value.robotModelGroup.visible = visible
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
    // 清理 TF 渲染器
    if (tfRenderer) {
      tfRenderer.dispose()
      tfRenderer = null
    }

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
