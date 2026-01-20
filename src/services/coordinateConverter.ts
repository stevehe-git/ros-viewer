/**
 * ROS 坐标系到 THREE.js 坐标系转换工具
 *
 * 核心原理：
 * - ROS (RViz) 标准坐标系：右手坐标系
 *   X 轴 → 机器人正前方
 *   Y 轴 → 机器人左侧方
 *   Z 轴 → 垂直地面正上方
 *
 * - THREE.js 标准坐标系：右手坐标系
 *   X 轴 → 屏幕右侧方
 *   Y 轴 → 屏幕正上方
 *   Z 轴 → 屏幕正前方（朝向自己）
 *
 * 唯一正确的转换公式（100% 必用，无任何例外）：
 * ROS(x, y, z) → THREE.js(x, z, -y)
 *
 * 坐标轴对应关系：
 * - ROS X(向前) → THREE.js X
 * - ROS Y(向左) → THREE.js -Z（取反）
 * - ROS Z(向上) → THREE.js Y
 *
 * 可视化颜色：
 * - ROS X轴：红色 (0xff0000)
 * - ROS Y轴：绿色 (0x00ff00)
 * - ROS Z轴：蓝色 (0x0000ff)
 */

import * as THREE from 'three'

/**
 * ROS 平移坐标转换为 THREE.js 坐标
 * 
 * 转换公式：ROS(x, y, z) → THREE.js(x, z, -y)
 * 
 * @param rosTranslation ROS 原始平移数据 {x, y, z}
 * @returns THREE.js Vector3 坐标
 * 
 * @example
 * // ROS 数据：x: -0.0185, y: -0.0443, z: 0.0012
 * // 转换后：x: -0.0185, y: 0.0012, z: 0.0443
 */
export function convertROSTranslationToThree(rosTranslation: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(
    rosTranslation.x,   // ROS X → THREE.js X（机器人前进方向一致）
    rosTranslation.z,   // ROS Z → THREE.js Y（垂直高度）
    -rosTranslation.y   // ROS Y → THREE.js Z（取反解决左右方向颠倒）
  )
}

/**
 * ROS 四元数转换为 THREE.js 四元数
 * 
 * 核心原理：
 * - ROS 和 THREE.js 的四元数数学定义完全相同
 * - 分量一一对应，数值完全不变，直接赋值即可
 * - 轴向映射已包含在平移坐标转换中，无需额外修正
 * 
 * @param rosRotation ROS 原始四元数 {x, y, z, w}
 * @returns THREE.js Quaternion
 * 
 * @example
 * // ROS 数据：{x: 0.0011255, y: -0.0011247, z: -0.0086739, w: 0.9999611}
 * // 直接赋值，无需修改
 */
export function convertROSRotationToThree(rosRotation: { x: number; y: number; z: number; w: number }): THREE.Quaternion {
  return new THREE.Quaternion(
    rosRotation.x,
    rosRotation.y,
    rosRotation.z,
    rosRotation.w
  )
}

/**
 * 应用 ROS Transform 到 THREE.js 对象
 *
 * 这是一个便捷函数，同时应用平移和旋转转换
 *
 * @param object THREE.js 对象（Group、Mesh 等）
 * @param rosTransform ROS Transform 数据
 */
export function applyROSTransformToObject(
  object: THREE.Object3D,
  rosTransform: {
    translation: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number; w: number }
  }
): void {
  // 应用平移转换
  const position = convertROSTranslationToThree(rosTransform.translation)
  object.position.copy(position)

  // 应用旋转转换（直接赋值）
  const quaternion = convertROSRotationToThree(rosTransform.rotation)
  object.quaternion.copy(quaternion)
}

/**
 * 创建ROS坐标轴的可视化对象
 *
 * @param axisLength 坐标轴长度
 * @param axisRadius 坐标轴半径
 * @returns THREE.Group 包含三个坐标轴的对象
 */
export function createROSAxes(axisLength: number = 1, axisRadius: number = 0.01): THREE.Group {
  const axesGroup = new THREE.Group()
  axesGroup.name = 'ROS_Axes'

  // X 轴（红色）- ROS X 向前 → THREE.js X 方向
  const xGeometry = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8)
  const xMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
  const xAxis = new THREE.Mesh(xGeometry, xMaterial)
  xAxis.rotation.z = Math.PI / 2  // 旋转到 X 轴方向
  xAxis.position.x = axisLength / 2
  xAxis.name = 'ROS_X_Axis'
  axesGroup.add(xAxis)

  // Y 轴（绿色）- ROS Y 向左 → THREE.js -Z 方向
  const yGeometry = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8)
  const yMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  const yAxis = new THREE.Mesh(yGeometry, yMaterial)
  yAxis.rotation.x = Math.PI / 2  // 旋转到 Z 轴方向
  yAxis.position.z = -axisLength / 2  // 负 Z 方向（对应 ROS Y 向左）
  yAxis.name = 'ROS_Y_Axis'
  axesGroup.add(yAxis)

  // Z 轴（蓝色）- ROS Z 向上 → THREE.js Y 方向
  const zGeometry = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8)
  const zMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff })
  const zAxis = new THREE.Mesh(zGeometry, zMaterial)
  zAxis.position.y = axisLength / 2  // Y 方向（向上，对应 ROS Z）
  zAxis.name = 'ROS_Z_Axis'
  axesGroup.add(zAxis)

  return axesGroup
}

/**
 * 根据ROS平面类型设置THREE.js网格的旋转
 *
 * @param plane ROS平面类型 ('XY', 'XZ', 'YZ')
 * @returns THREE.Euler 旋转角度
 */
export function getROSGridRotation(plane: 'XY' | 'XZ' | 'YZ'): THREE.Euler {
  switch (plane) {
    case 'XY':
      // ROS XY 平面：网格线沿 ROS X（THREE.js X）和 ROS Y（THREE.js -Z）
      // GridHelper默认在XY平面，需要旋转使其Y方向变为-Z
      return new THREE.Euler(0, 0, 0) // 默认XY平面
    case 'XZ':
      // ROS XZ 平面：网格线沿 ROS X（THREE.js X）和 ROS Z（THREE.js Y）
      // 绕X轴旋转-90度，使Y方向变为Z方向
      return new THREE.Euler(-Math.PI / 2, 0, 0)
    case 'YZ':
      // ROS YZ 平面：网格线沿 ROS Y（THREE.js -Z）和 ROS Z（THREE.js Y）
      // 先绕X轴旋转-90度，再绕Z轴旋转90度
      return new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2)
    default:
      return new THREE.Euler(0, 0, 0)
  }
}

/**
 * 转换ROS位置偏移到THREE.js坐标系
 *
 * @param rosOffset ROS坐标系下的偏移 {x, y, z}
 * @returns THREE.Vector3 THREE.js坐标系下的偏移
 */
export function convertROSOffsetToThree(rosOffset: { x: number; y: number; z: number }): THREE.Vector3 {
  return convertROSTranslationToThree(rosOffset)
}
