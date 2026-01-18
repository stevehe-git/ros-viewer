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
