/**
 * 点云中心计算服务
 * 
 * 核心功能：
 * 1. 计算点云在 fixed frame 坐标系下的中心位置
 * 2. 支持 LaserScan 和 PointCloud2 两种消息类型
 * 3. 提供平滑的中心位置更新（避免抖动）
 */

import * as THREE from 'three'
import { convertROSTranslationToThree } from './coordinateConverter'
import { tfManager } from './tfManager'

export interface PointCloudCenter {
  position: THREE.Vector3
  isValid: boolean
  pointCount: number
  timestamp: number
}

class PointCloudCenterCalculator {
  private currentCenter: PointCloudCenter | null = null
  private smoothingFactor: number = 0.1 // 平滑因子，0-1之间，越小越平滑
  private minPointCount: number = 10 // 最小点数，少于这个数不计算中心

  /**
   * 计算 LaserScan 点云的中心位置（在 fixed frame 坐标系下）
   */
  calculateLaserScanCenter(
    message: any,
    fixedFrame: string = 'map'
  ): PointCloudCenter | null {
    if (!message || !message.ranges || message.ranges.length === 0) {
      return null
    }

    const ranges = message.ranges || []
    const angleMin = message.angle_min || 0
    const angleMax = message.angle_max || 0
    const angleIncrement = message.angle_increment || 0
    const rangeMin = message.range_min || 0
    const rangeMax = message.range_max || 0

    if (ranges.length === 0 || angleIncrement === 0) {
      return null
    }

    // 获取 scan frame
    const scanFrame = message.header?.frame_id || 'base_scan'

    // 计算从 scanFrame 到 fixedFrame 的变换矩阵
    const transformMatrix = tfManager.getTransformMatrix(scanFrame, fixedFrame)
    if (!transformMatrix) {
      console.warn(`PointCloudCenterCalculator: Could not find TF transform from ${scanFrame} to ${fixedFrame}`)
      return null
    }

    // 在 scan frame 坐标系下计算点云中心
    let sumX = 0
    let sumY = 0
    let validPointCount = 0

    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i]
      
      // 过滤无效范围
      if (!range || range < rangeMin || range > rangeMax || !isFinite(range)) {
        continue
      }

      const angle = angleMin + i * angleIncrement
      
      // 极坐标转笛卡尔坐标（在 scan frame 下）
      const rosX = range * Math.cos(angle)
      const rosY = range * Math.sin(angle)
      const rosZ = 0

      // 转换到 THREE.js 坐标系
      const threePosition = convertROSTranslationToThree({ x: rosX, y: rosY, z: rosZ })
      
      sumX += threePosition.x
      sumY += threePosition.z // 注意：ROS Y → THREE.js Z
      validPointCount++
    }

    if (validPointCount < this.minPointCount) {
      return null
    }

    // 计算中心位置（在 scan frame 下）
    const centerX = sumX / validPointCount
    const centerZ = sumY / validPointCount
    const centerY = 0 // LaserScan 在 XY 平面，Z=0

    // 创建中心点（在 scan frame 下）
    const centerInScanFrame = new THREE.Vector3(centerX, centerY, centerZ)

    // 转换到 fixed frame 坐标系
    const centerInFixedFrame = centerInScanFrame.clone()
    centerInFixedFrame.applyMatrix4(transformMatrix)

    // 应用平滑
    const smoothedCenter = this.smoothCenter(centerInFixedFrame)

    return {
      position: smoothedCenter,
      isValid: true,
      pointCount: validPointCount,
      timestamp: Date.now()
    }
  }

  /**
   * 计算 PointCloud2 点云的中心位置（在 fixed frame 坐标系下）
   */
  calculatePointCloud2Center(
    message: any,
    fixedFrame: string = 'map'
  ): PointCloudCenter | null {
    if (!message || !message.fields || !message.data) {
      return null
    }

    const fields = message.fields || []
    const data = message.data instanceof Uint8Array ? message.data : new Uint8Array(message.data || [])
    const pointStep = message.point_step || 0

    if (data.length === 0 || pointStep === 0) {
      return null
    }

    // 查找字段索引
    const findField = (name: string) => {
      return fields.findIndex((f: any) => f.name === name)
    }

    const xIndex = findField('x')
    const yIndex = findField('y')
    const zIndex = findField('z')

    if (xIndex === -1 || yIndex === -1 || zIndex === -1) {
      return null
    }

    // 获取字段偏移
    const getFieldOffset = (fieldIndex: number) => {
      if (fieldIndex === -1) return -1
      return fields[fieldIndex].offset || 0
    }

    const xOffset = getFieldOffset(xIndex)
    const yOffset = getFieldOffset(yIndex)
    const zOffset = getFieldOffset(zIndex)

    // 获取点云 frame
    const pointCloudFrame = message.header?.frame_id || 'base_link'

    // 计算从 pointCloudFrame 到 fixedFrame 的变换矩阵
    const transformMatrix = tfManager.getTransformMatrix(pointCloudFrame, fixedFrame)
    if (!transformMatrix) {
      console.warn(`PointCloudCenterCalculator: Could not find TF transform from ${pointCloudFrame} to ${fixedFrame}`)
      return null
    }

    // 在 pointCloudFrame 坐标系下计算点云中心
    let sumX = 0
    let sumY = 0
    let sumZ = 0
    let validPointCount = 0

    const pointCount = Math.floor(data.length / pointStep)

    for (let i = 0; i < pointCount; i++) {
      const pointOffset = i * pointStep

      if (pointOffset + Math.max(xOffset, yOffset, zOffset) + 4 > data.length) {
        break
      }

      // 读取 ROS 坐标系中的 x, y, z 坐标
      const rosX = this.readFloat32(data, pointOffset + xOffset)
      const rosY = this.readFloat32(data, pointOffset + yOffset)
      const rosZ = this.readFloat32(data, pointOffset + zOffset)

      // 过滤无效点
      if (!isFinite(rosX) || !isFinite(rosY) || !isFinite(rosZ)) {
        continue
      }

      // 转换到 THREE.js 坐标系
      const threePosition = convertROSTranslationToThree({ x: rosX, y: rosY, z: rosZ })
      
      sumX += threePosition.x
      sumY += threePosition.y
      sumZ += threePosition.z
      validPointCount++
    }

    if (validPointCount < this.minPointCount) {
      return null
    }

    // 计算中心位置（在 pointCloudFrame 下）
    const centerX = sumX / validPointCount
    const centerY = sumY / validPointCount
    const centerZ = sumZ / validPointCount

    // 创建中心点（在 pointCloudFrame 下）
    const centerInPointCloudFrame = new THREE.Vector3(centerX, centerY, centerZ)

    // 转换到 fixed frame 坐标系
    const centerInFixedFrame = centerInPointCloudFrame.clone()
    centerInFixedFrame.applyMatrix4(transformMatrix)

    // 应用平滑
    const smoothedCenter = this.smoothCenter(centerInFixedFrame)

    return {
      position: smoothedCenter,
      isValid: true,
      pointCount: validPointCount,
      timestamp: Date.now()
    }
  }

  /**
   * 平滑中心位置（避免抖动）
   */
  private smoothCenter(newCenter: THREE.Vector3): THREE.Vector3 {
    if (!this.currentCenter) {
      this.currentCenter = {
        position: newCenter.clone(),
        isValid: true,
        pointCount: 0,
        timestamp: Date.now()
      }
      return newCenter.clone()
    }

    // 使用指数移动平均进行平滑
    const smoothed = new THREE.Vector3()
    smoothed.lerpVectors(
      this.currentCenter.position,
      newCenter,
      this.smoothingFactor
    )

    this.currentCenter.position.copy(smoothed)
    this.currentCenter.timestamp = Date.now()

    return smoothed
  }

  /**
   * 获取当前计算的中心位置
   */
  getCurrentCenter(): PointCloudCenter | null {
    return this.currentCenter
  }

  /**
   * 重置中心位置（清除历史数据）
   */
  reset(): void {
    this.currentCenter = null
  }

  /**
   * 设置平滑因子
   */
  setSmoothingFactor(factor: number): void {
    this.smoothingFactor = Math.max(0, Math.min(1, factor))
  }

  /**
   * 设置最小点数
   */
  setMinPointCount(count: number): void {
    this.minPointCount = Math.max(1, count)
  }

  /**
   * 从字节数组中读取 Float32
   */
  private readFloat32(data: Uint8Array, offset: number): number {
    try {
      if (offset + 4 > data.length) {
        return 0
      }
      const view = new DataView(data.buffer, data.byteOffset + offset, 4)
      return view.getFloat32(0, true) // little endian
    } catch (error) {
      console.error('PointCloudCenterCalculator: Error reading Float32:', error)
      return 0
    }
  }
}

// 导出单例
export const pointCloudCenterCalculator = new PointCloudCenterCalculator()
