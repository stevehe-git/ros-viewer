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
  convertROSRotationToThree 
} from '@/services/coordinateConverter'

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
    
    // 计算从 scanFrame 到 fixedFrame 的变换（重用 TF 渲染中的逻辑）
    const transforms = tfManager.getTransforms()
    const getScanFrameTransformToFixed = (): THREE.Matrix4 | null => {
      if (scanFrame === fixedFrame) {
        return new THREE.Matrix4().identity()
      }

      // 查找路径的辅助函数（从 current 向下查找 target）
      const findPath = (current: string, target: string, visited: Set<string>, path: string[]): boolean => {
        if (current === target) {
          path.push(current)
          return true
        }
        if (visited.has(current)) return false
        visited.add(current)

        for (const [parent, children] of transforms.entries()) {
          if (parent === current) {
            for (const [childName] of children.entries()) {
              if (findPath(childName, target, visited, path)) {
                path.push(current)
                return true
              }
            }
          }
        }
        return false
      }

      // 尝试从 fixedFrame 向下查找路径到 scanFrame
      const pathDown: string[] = []
      if (findPath(fixedFrame, scanFrame, new Set(), pathDown)) {
        // 沿着路径累积变换（从 fixedFrame 到 scanFrame），然后取逆得到从 scanFrame 到 fixedFrame
        let transformToScan = new THREE.Matrix4().identity()
        for (let i = pathDown.length - 1; i > 0; i--) {
          const parent = pathDown[i]
          const child = pathDown[i - 1]
          if (!parent || !child) continue
          const parentTransforms = transforms.get(parent)
          if (!parentTransforms) continue
          const transform = parentTransforms.get(child)
          if (!transform || !transform.translation || !transform.rotation) continue

          // ✅ 使用正确的坐标转换公式：ROS(x, y, z) → THREE.js(x, z, -y)
          const threePosition = convertROSTranslationToThree(transform.translation)
          const threeQuat = convertROSRotationToThree(transform.rotation)

          const localTransform = new THREE.Matrix4()
          localTransform.compose(threePosition, threeQuat, new THREE.Vector3(1, 1, 1))
          transformToScan = transformToScan.multiply(localTransform)
        }
        // 取逆得到从 scanFrame 到 fixedFrame 的变换
        return transformToScan.clone().invert()
      }

      // 尝试从 scanFrame 向下查找路径到 fixedFrame（需要取逆）
      const pathUp: string[] = []
      if (findPath(scanFrame, fixedFrame, new Set(), pathUp)) {
        let transformToFixed = new THREE.Matrix4().identity()
        for (let i = pathUp.length - 1; i > 0; i--) {
          const parent = pathUp[i]
          const child = pathUp[i - 1]
          if (!parent || !child) continue
          const parentTransforms = transforms.get(parent)
          if (!parentTransforms) continue
          const transform = parentTransforms.get(child)
          if (!transform || !transform.translation || !transform.rotation) continue

          // ✅ 使用正确的坐标转换公式：ROS(x, y, z) → THREE.js(x, z, -y)
          const threePosition = convertROSTranslationToThree(transform.translation)
          const threeQuat = convertROSRotationToThree(transform.rotation)

          const localTransform = new THREE.Matrix4()
          localTransform.compose(threePosition, threeQuat, new THREE.Vector3(1, 1, 1))
          transformToFixed = transformToFixed.multiply(localTransform)
        }
        return transformToFixed.clone().invert()
      }

      return null
    }

    const scanToFixedTransform = getScanFrameTransformToFixed()

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

      // 转换 ROS 坐标到 THREE.js 坐标
      // 当前坐标轴映射：
      // - ROS X (向前) → THREE.js Z (向前)
      // - ROS Y (向左) → THREE.js -X (向左)
      // - ROS Z (向上) → THREE.js Y (向上)
          // 右手系：Y轴绕Z轴旋转180度，从-X变成+X
          const threeX = rosY   // ROS Y (向右，右手系) → THREE.js +X
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
   * 创建坐标系轴可视化
   * ROS 标准：X(红)向前, Y(绿)向左, Z(蓝)向上
   * 在 THREE.js 中：X(红)对应 ROS X → THREE.js Z, Y(绿)对应 ROS Y → THREE.js X, Z(蓝)对应 ROS Z → THREE.js Y
   */
  const createFrameAxes = (axisLength: number, markerAlpha: number): THREE.Group => {
    const axesGroup = new THREE.Group()
    
    // X轴（红色）- ROS X 向前 → THREE.js Z 方向
    const xGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, axisLength)
    ])
    const xMaterial = new THREE.LineBasicMaterial({ 
      color: 0xff0000, 
      transparent: true, 
      opacity: markerAlpha 
    })
    const xAxis = new THREE.Line(xGeometry, xMaterial)
    axesGroup.add(xAxis)

    // Y轴（绿色）- ROS Y 向左 → THREE.js X 方向（取反后）
    const yGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(axisLength, 0, 0)
    ])
    const yMaterial = new THREE.LineBasicMaterial({ 
      color: 0x00ff00, 
      transparent: true, 
      opacity: markerAlpha 
    })
    const yAxis = new THREE.Line(yGeometry, yMaterial)
    axesGroup.add(yAxis)

    // Z轴（蓝色）- ROS Z 向上 → THREE.js Y 方向
    const zGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, axisLength, 0)
    ])
    const zMaterial = new THREE.LineBasicMaterial({ 
      color: 0x0000ff, 
      transparent: true, 
      opacity: markerAlpha 
    })
    const zAxis = new THREE.Line(zGeometry, zMaterial)
    axesGroup.add(zAxis)

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
      
      // 查找路径的辅助函数
      const findPath = (current: string, target: string, visited: Set<string>, path: string[]): boolean => {
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
              if (findPath(childName, target, visited, path)) {
                path.push(current)
                return true
              }
            }
          }
        }
        return false
      }

      // 尝试从 fixedFrame 向下查找路径到 frameName
      const pathDown: string[] = []
      const foundDown = findPath(fixedFrame, frameName, new Set(), pathDown)

      if (foundDown) {
        // 沿着路径累积变换（从 fixedFrame 到 frameName）
        let result = new THREE.Matrix4().identity()
        for (let i = pathDown.length - 1; i > 0; i--) {
          const parent = pathDown[i]
          const child = pathDown[i - 1]
          if (!parent || !child) continue
          const parentTransforms = transforms.get(parent)
          if (!parentTransforms) continue
          const transform = parentTransforms.get(child)
          if (!transform || !transform.translation || !transform.rotation) continue

          // ✅ 使用正确的坐标转换公式：ROS(x, y, z) → THREE.js(x, z, -y)
          const position = convertROSTranslationToThree(transform.translation)
          const quaternion = convertROSRotationToThree(transform.rotation)

          const localTransform = new THREE.Matrix4()
          localTransform.compose(
            position,
            quaternion,
            new THREE.Vector3(1, 1, 1)
          )

          result = result.multiply(localTransform)
        }
        return result
      }

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

    // 创建坐标轴（使用圆柱体）
    // X 轴（红色）- ROS X 向前 → THREE.js X 方向
    const xGeometry = new THREE.CylinderGeometry(radius, radius, length, 8)
    const xMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,
      transparent: true,
      opacity: alpha
    })
    const xAxis = new THREE.Mesh(xGeometry, xMaterial)
    xAxis.rotation.z = Math.PI / 2
    xAxis.position.x = length / 2
    axesObject.add(xAxis)

    // Y 轴（绿色）- ROS Y 向左 → THREE.js -Z 方向
    const yGeometry = new THREE.CylinderGeometry(radius, radius, length, 8)
    const yMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00,
      transparent: true,
      opacity: alpha
    })
    const yAxis = new THREE.Mesh(yGeometry, yMaterial)
    yAxis.rotation.x = Math.PI / 2
    yAxis.position.z = -length / 2  // 负 Z 方向（对应 ROS Y 向左）
    axesObject.add(yAxis)

    // Z 轴（蓝色）- ROS Z 向上 → THREE.js Y 方向
    const zGeometry = new THREE.CylinderGeometry(radius, radius, length, 8)
    const zMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x0000ff,
      transparent: true,
      opacity: alpha
    })
    const zAxis = new THREE.Mesh(zGeometry, zMaterial)
    zAxis.position.y = length / 2  // Y 方向（向上，对应 ROS Z）
    axesObject.add(zAxis)

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
