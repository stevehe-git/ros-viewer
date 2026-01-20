/**
 * TF 坐标变换管理器（重构版）
 * 
 * 核心设计原则（参考RViz）：
 * 1. 统一处理静态和动态TF数据
 * 2. 维护完整的TF树结构
 * 3. 提供高效的变换查询接口
 * 4. 区分静态和动态变换，静态变换永不过期
 */

import * as ROSLIB from 'roslib'
import { ref, toRaw } from 'vue'
import * as THREE from 'three'
import { convertROSTranslationToThree, convertROSRotationToThree } from './coordinateConverter'

export interface TransformFrame {
  name: string
  parent?: string
  timestamp?: number
  lastUpdateTime?: number
  isValid?: boolean
  isStatic?: boolean  // 是否为静态变换
  translation?: { x: number; y: number; z: number }
  rotation?: { x: number; y: number; z: number; w: number }
}

export interface TFTreeNode {
  name: string
  parent: string | null
  children: TFTreeNode[]
  lastUpdateTime: number
  isValid: boolean
  isStatic?: boolean
}

class TFManager {
  private rosInstance: ROSLIB.Ros | null = null
  private tfTopic: ROSLIB.Topic<any> | null = null
  private tfStaticTopic: ROSLIB.Topic<any> | null = null
  
  // 可用的坐标系列表（响应式）
  private availableFrames = ref<Set<string>>(new Set())
  
  // 坐标系列表（用于下拉框）
  public frames = ref<string[]>([])
  
  // TF 变换数据（parent_frame -> child_frame -> TransformFrame）
  // 区分静态和动态：静态变换存储在单独的Map中
  private dynamicTransforms = ref<Map<string, Map<string, TransformFrame>>>(new Map())
  private staticTransforms = ref<Map<string, Map<string, TransformFrame>>>(new Map())
  
  // TF 树结构（响应式）
  public tfTree = ref<TFTreeNode[]>([])
  
  // 数据更新触发器（用于响应式追踪）
  private dataUpdateTrigger = ref(0)
  
  // Frame 超时时间（秒）- 仅对动态变换有效
  private frameTimeout = 15
  
  // 订阅状态（响应式）
  private subscriptionStatus = ref<{
    subscribed: boolean
    hasData: boolean
    messageCount: number
    lastMessageTime: number | null
  }>({
    subscribed: false,
    hasData: false,
    messageCount: 0,
    lastMessageTime: null
  })
  
  private dataUpdateThrottleTimer: number | null = null
  private pendingDataUpdate = false

  /**
   * 获取所有变换数据（合并静态和动态）
   */
  getTransforms(): Map<string, Map<string, TransformFrame>> {
    const merged = new Map<string, Map<string, TransformFrame>>()
    
    // 先添加静态变换（优先级更高）
    this.staticTransforms.value.forEach((children, parent) => {
      if (!merged.has(parent)) {
        merged.set(parent, new Map())
      }
      const parentMap = merged.get(parent)!
      children.forEach((transform, child) => {
        parentMap.set(child, transform)
      })
    })
    
    // 再添加动态变换（覆盖静态变换，如果有的话）
    this.dynamicTransforms.value.forEach((children, parent) => {
      if (!merged.has(parent)) {
        merged.set(parent, new Map())
      }
      const parentMap = merged.get(parent)!
      children.forEach((transform, child) => {
        parentMap.set(child, transform)
      })
    })
    
    return merged
  }

  /**
   * 获取订阅状态
   */
  getSubscriptionStatus() {
    return this.subscriptionStatus.value
  }

  /**
   * 获取响应式的订阅状态
   */
  getSubscriptionStatusRef() {
    return this.subscriptionStatus
  }

  /**
   * 获取数据更新触发器
   */
  getDataUpdateTrigger() {
    return this.dataUpdateTrigger
  }

  /**
   * 触发数据更新（节流）
   */
  private triggerDataUpdateThrottled() {
    if (this.dataUpdateThrottleTimer) {
      this.pendingDataUpdate = true
      return
    }
    
    this.dataUpdateTrigger.value++
    this.pendingDataUpdate = false
    
    this.dataUpdateThrottleTimer = window.setTimeout(() => {
      this.dataUpdateThrottleTimer = null
      if (this.pendingDataUpdate) {
        this.triggerDataUpdateThrottled()
      }
    }, 100)
  }

  /**
   * 设置 ROS 实例
   */
  setROSInstance(ros: ROSLIB.Ros | null) {
    this.unsubscribe()
    
    const rawRos = ros ? toRaw(ros) : null
    this.rosInstance = rawRos
    
    if (rawRos) {
      let isConnected = false
      try {
        isConnected = rawRos.isConnected === true
      } catch (error) {
        console.warn('TFManager: Could not check ROS connection status, assuming connected', error)
        isConnected = true
      }
      
      if (isConnected) {
        this.subscribe()
      } else {
        rawRos.on('connection', () => {
          this.subscribe()
        })
      }
    } else {
      this.availableFrames.value.clear()
      this.updateFramesList()
    }
  }

  /**
   * 订阅 TF 话题
   */
  private subscribe() {
    if (!this.rosInstance) {
      this.subscriptionStatus.value = {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null
      }
      return
    }

    try {
      this.subscriptionStatus.value = {
        subscribed: true,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null
      }
      
      // 订阅 /tf 话题（动态坐标变换）
      this.tfTopic = new ROSLIB.Topic({
        ros: this.rosInstance,
        name: '/tf',
        messageType: 'tf2_msgs/TFMessage'
      })

      this.tfTopic.subscribe((message: any) => {
        const now = Date.now()
        
        this.subscriptionStatus.value = {
          subscribed: true,
          hasData: true,
          messageCount: this.subscriptionStatus.value.messageCount + 1,
          lastMessageTime: now
        }
        
        if (message && message.transforms && Array.isArray(message.transforms)) {
          message.transforms.forEach((transform: any) => {
            this.processTransform(transform, false, now) // false = 动态变换
          })
        }
      })

      // 订阅 /tf_static 话题（静态坐标变换）
      this.tfStaticTopic = new ROSLIB.Topic({
        ros: this.rosInstance,
        name: '/tf_static',
        messageType: 'tf2_msgs/TFMessage'
      })

      this.tfStaticTopic.subscribe((message: any) => {
        const now = Date.now()
        
        this.subscriptionStatus.value = {
          subscribed: true,
          hasData: true,
          messageCount: this.subscriptionStatus.value.messageCount + 1,
          lastMessageTime: now
        }
        
        if (message && message.transforms && Array.isArray(message.transforms)) {
          message.transforms.forEach((transform: any) => {
            this.processTransform(transform, true, now) // true = 静态变换
          })
        }
      })

      console.log('TFManager: Subscribed to /tf and /tf_static topics')
    } catch (error) {
      console.error('TFManager: Error subscribing to TF topics:', error)
      this.subscriptionStatus.value = {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null
      }
    }
  }

  /**
   * 处理单个变换数据
   */
  private processTransform(transform: any, isStatic: boolean, now: number) {
    if (!transform.header || !transform.header.frame_id) return

    const frameId = transform.header.frame_id
    const childFrameId = transform.child_frame_id
    
    if (!childFrameId) return

    // 添加到可用坐标系列表
    this.availableFrames.value.add(frameId)
    this.availableFrames.value.add(childFrameId)
    
    // 选择存储位置（静态或动态）
    const targetMap = isStatic ? this.staticTransforms : this.dynamicTransforms
    
    // 存储变换数据
    if (!targetMap.value.has(frameId)) {
      targetMap.value.set(frameId, new Map())
    }
    const frameTransforms = targetMap.value.get(frameId)!
    
    const transformData: TransformFrame = {
      name: childFrameId,
      parent: frameId,
      timestamp: transform.header.stamp?.secs ? transform.header.stamp.secs * 1000 + (transform.header.stamp.nsecs || 0) / 1000000 : now,
      lastUpdateTime: now,
      isValid: true,
      isStatic: isStatic,
      translation: transform.transform?.translation ? {
        x: transform.transform.translation.x || 0,
        y: transform.transform.translation.y || 0,
        z: transform.transform.translation.z || 0
      } : undefined,
      rotation: transform.transform?.rotation ? {
        x: transform.transform.rotation.x || 0,
        y: transform.transform.rotation.y || 0,
        z: transform.transform.rotation.z || 0,
        w: transform.transform.rotation.w !== undefined ? transform.transform.rotation.w : 1
      } : undefined
    }
    
    frameTransforms.set(childFrameId, transformData)
    
    // 更新 frames 列表和树结构
    this.updateFramesList()
    this.updateTFTree()
    
    // 触发数据更新通知（节流）
    this.triggerDataUpdateThrottled()
  }

  /**
   * 取消订阅
   */
  private unsubscribe() {
    this.subscriptionStatus.value = {
      subscribed: false,
      hasData: false,
      messageCount: 0,
      lastMessageTime: null
    }
    
    if (this.tfTopic) {
      try {
        this.tfTopic.unsubscribe()
      } catch (error) {
        console.error('TFManager: Error unsubscribing from /tf:', error)
      }
      this.tfTopic = null
    }

    if (this.tfStaticTopic) {
      try {
        this.tfStaticTopic.unsubscribe()
      } catch (error) {
        console.error('TFManager: Error unsubscribing from /tf_static:', error)
      }
      this.tfStaticTopic = null
    }
  }

  /**
   * 更新坐标系列表
   */
  private updateFramesList() {
    const allFrames = new Set<string>()
    this.availableFrames.value.forEach(frame => allFrames.add(frame))
    this.frames.value = Array.from(allFrames).sort()
  }

  /**
   * 更新 TF 树结构
   */
  private updateTFTree() {
    const now = Date.now()
    const timeoutMs = this.frameTimeout * 1000
    
    // 合并静态和动态变换
    const allTransforms = this.getTransforms()
    
    // 构建节点映射
    const nodeMap = new Map<string, TFTreeNode>()
    
    // 创建所有节点
    this.availableFrames.value.forEach(frameName => {
      if (!nodeMap.has(frameName)) {
        nodeMap.set(frameName, {
          name: frameName,
          parent: null,
          children: [],
          lastUpdateTime: 0,
          isValid: false,
          isStatic: false
        })
      }
    })
    
    // 建立父子关系并更新状态
    allTransforms.forEach((childMap, parentName) => {
      childMap.forEach((transform, childName) => {
        // 静态变换永不过期，动态变换检查超时
        const age = now - transform.lastUpdateTime!
        const isValid = transform.isStatic || age < timeoutMs
        
        // 更新子节点
        if (nodeMap.has(childName)) {
          const childNode = nodeMap.get(childName)!
          childNode.parent = parentName
          childNode.lastUpdateTime = transform.lastUpdateTime || now
          childNode.isValid = isValid
          childNode.isStatic = transform.isStatic
        } else {
          nodeMap.set(childName, {
            name: childName,
            parent: parentName,
            children: [],
            lastUpdateTime: transform.lastUpdateTime || now,
            isValid: isValid,
            isStatic: transform.isStatic
          })
        }
        
        // 更新父节点的子节点列表
        if (nodeMap.has(parentName)) {
          const parentNode = nodeMap.get(parentName)!
          if (!parentNode.children.find(c => c.name === childName)) {
            parentNode.children.push(nodeMap.get(childName)!)
          }
        }
      })
    })
    
    // 找到根节点（没有父节点的节点）
    const rootNodes: TFTreeNode[] = []
    nodeMap.forEach((node) => {
      if (!node.parent) {
        rootNodes.push(node)
      }
    })
    
    // 如果没有根节点，使用 map 作为默认根
    if (rootNodes.length === 0 && nodeMap.has('map')) {
      rootNodes.push(nodeMap.get('map')!)
    }
    
    rootNodes.sort((a, b) => a.name.localeCompare(b.name))
    
    this.tfTree.value = rootNodes
  }

  /**
   * 获取 TF 树结构
   */
  getTFTree(): TFTreeNode[] {
    return this.tfTree.value
  }

  /**
   * 获取响应式的 TF 树结构
   */
  getTFTreeRef() {
    return this.tfTree
  }

  /**
   * 设置 frame 超时时间
   */
  setFrameTimeout(timeout: number) {
    this.frameTimeout = timeout
    this.updateTFTree()
  }

  /**
   * 检查 frame 是否在 TF 树中
   */
  hasFrame(frameName: string): boolean {
    return this.availableFrames.value.has(frameName)
  }

  /**
   * 获取 frame 的父节点
   */
  getFrameParent(frameName: string): string | null {
    const transforms = this.getTransforms()
    for (const [parent, children] of transforms.entries()) {
      if (children.has(frameName)) {
        return parent
      }
    }
    return null
  }

  /**
   * 查找从 sourceFrame 到 targetFrame 的路径（BFS）
   */
  getTransformPath(sourceFrame: string, targetFrame: string): string[] | null {
    if (sourceFrame === targetFrame) {
      return [sourceFrame]
    }

    const transforms = this.getTransforms()
    const visited = new Set<string>()
    const queue: { frame: string; path: string[] }[] = [{ frame: sourceFrame, path: [sourceFrame] }]

    while (queue.length > 0) {
      const { frame: currentFrame, path: currentPath } = queue.shift()!

      if (currentFrame === targetFrame) {
        return currentPath
      }

      if (visited.has(currentFrame)) {
        continue
      }
      visited.add(currentFrame)

      // 查找子节点（向下）
      const children = transforms.get(currentFrame)
      if (children) {
        for (const childName of children.keys()) {
          if (!visited.has(childName)) {
            queue.push({ frame: childName, path: [...currentPath, childName] })
          }
        }
      }

      // 查找父节点（向上）
      for (const [parentName, parentChildren] of transforms.entries()) {
        if (parentChildren.has(currentFrame) && !visited.has(parentName)) {
          queue.push({ frame: parentName, path: [...currentPath, parentName] })
        }
      }
    }
    return null
  }

  /**
   * 计算从 sourceFrame 到 targetFrame 的变换矩阵
   * 这是核心方法，用于计算任意两个frame之间的变换
   */
  getTransformMatrix(sourceFrame: string, targetFrame: string): THREE.Matrix4 | null {
    if (sourceFrame === targetFrame) {
      return new THREE.Matrix4().identity()
    }

    const path = this.getTransformPath(sourceFrame, targetFrame)
    if (!path) {
      return null
    }

    const transforms = this.getTransforms()
    let resultMatrix = new THREE.Matrix4().identity()

    // 沿着路径累积变换
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i]
      const to = path[i + 1]

      if (!from || !to) {
        console.warn(`TFManager: Invalid path segment at index ${i}`)
        continue
      }

      // 尝试查找从from到to的变换（正向）
      let transform: TransformFrame | null = null
      const fromTransforms = transforms.get(from)
      if (fromTransforms && fromTransforms.has(to)) {
        transform = fromTransforms.get(to) || null
      }

      // 如果没找到正向变换，尝试反向变换（从to到from，然后取逆）
      if (!transform) {
        const toTransforms = transforms.get(to)
        if (toTransforms && toTransforms.has(from)) {
          const inverseTransform = toTransforms.get(from)
          if (inverseTransform && inverseTransform.translation && inverseTransform.rotation) {
            // 计算逆变换矩阵（在THREE.js坐标系中）
            const matrix = new THREE.Matrix4()
            const position = convertROSTranslationToThree(inverseTransform.translation)
            const quaternion = convertROSRotationToThree(inverseTransform.rotation)
            matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1))

            const inverseMatrix = matrix.clone().invert()
            const invPosition = new THREE.Vector3()
            const invQuaternion = new THREE.Quaternion()
            const invScale = new THREE.Vector3()
            inverseMatrix.decompose(invPosition, invQuaternion, invScale)

            // 将THREE.js坐标转换回ROS坐标
            // THREE.js(x, y, z) → ROS(x, -z, y)
            transform = {
              name: from,
              parent: to,
              translation: {
                x: invPosition.x,      // THREE.js X → ROS X
                y: -invPosition.z,     // THREE.js -Z → ROS Y（取反）
                z: invPosition.y       // THREE.js Y → ROS Z
              },
              rotation: {
                // 四元数逆变换：从 THREE.js 转换回 ROS
                // THREE.js 四元数 (x, y, z, w) → ROS 四元数 (x, -z, -y, w)
                x: invQuaternion.x,    // X轴不变
                y: -invQuaternion.z,   // THREE.js Z → ROS Y（取反）
                z: invQuaternion.y,    // THREE.js Y → ROS Z
                w: invQuaternion.w
              }
            }
          }
        }
      }

      if (transform && transform.translation && transform.rotation) {
        const position = convertROSTranslationToThree(transform.translation)
        const quaternion = convertROSRotationToThree(transform.rotation)
        const localMatrix = new THREE.Matrix4()
        localMatrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1))
        
        // 累积变换：resultMatrix = localMatrix * resultMatrix
        resultMatrix = localMatrix.multiply(resultMatrix)
      } else {
        console.warn(`TFManager: Could not find transform from ${from} to ${to}`)
        return null
      }
    }

    return resultMatrix
  }

  /**
   * 获取可用的坐标系列表
   */
  getFrames(): string[] {
    return this.frames.value.length > 0 ? this.frames.value : ['map', 'odom', 'base_link', 'base_footprint']
  }

  /**
   * 获取响应式的坐标系列表
   */
  getFramesRef() {
    return this.frames
  }

  /**
   * 获取 frame 的详细信息
   */
  getFrameInfo(frameName: string, fixedFrame: string = 'map'): {
    parent: string | null
    position: { x: number; y: number; z: number } | null
    orientation: { x: number; y: number; z: number; w: number } | null
    relativePosition: { x: number; y: number; z: number } | null
    relativeOrientation: { x: number; y: number; z: number; w: number } | null
  } {
    const transforms = this.getTransforms()
    
    // 查找 frame 的父节点和相对变换
    let parent: string | null = null
    let relativePosition: { x: number; y: number; z: number } | null = null
    let relativeOrientation: { x: number; y: number; z: number; w: number } | null = null
    
    for (const [parentName, children] of transforms.entries()) {
      const transform = children.get(frameName)
      if (transform) {
        parent = parentName
        if (transform.translation) {
          relativePosition = {
            x: transform.translation.x,
            y: transform.translation.y,
            z: transform.translation.z
          }
        }
        if (transform.rotation) {
          relativeOrientation = {
            x: transform.rotation.x,
            y: transform.rotation.y,
            z: transform.rotation.z,
            w: transform.rotation.w
          }
        }
        break
      }
    }
    
    // 计算相对于固定帧的绝对位置和方向（使用矩阵变换）
    let position: { x: number; y: number; z: number } | null = null
    let orientation: { x: number; y: number; z: number; w: number } | null = null
    
    if (frameName === fixedFrame) {
      position = { x: 0, y: 0, z: 0 }
      orientation = { x: 0, y: 0, z: 0, w: 1 }
    } else {
      const transformMatrix = this.getTransformMatrix(frameName, fixedFrame)
      if (transformMatrix) {
        const pos = new THREE.Vector3()
        const quat = new THREE.Quaternion()
        const scale = new THREE.Vector3()
        transformMatrix.decompose(pos, quat, scale)
        
        position = { x: pos.x, y: pos.y, z: pos.z }
        orientation = { x: quat.x, y: quat.y, z: quat.z, w: quat.w }
      } else {
        position = null
        orientation = null
      }
    }
    
    return {
      parent,
      position,
      orientation,
      relativePosition,
      relativeOrientation
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.unsubscribe()
    this.availableFrames.value.clear()
    this.frames.value = []
    this.dynamicTransforms.value.clear()
    this.staticTransforms.value.clear()
    if (this.dataUpdateThrottleTimer) {
      clearTimeout(this.dataUpdateThrottleTimer)
      this.dataUpdateThrottleTimer = null
    }
  }
}

// 导出单例
export const tfManager = new TFManager()
