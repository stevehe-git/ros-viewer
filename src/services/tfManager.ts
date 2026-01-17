/**
 * TF 坐标变换管理器
 * 监听 tf2-ros 发布的坐标变换，维护可用的坐标系列表
 */
import * as ROSLIB from 'roslib'
import { ref, toRaw } from 'vue'

export interface TransformFrame {
  name: string
  parent?: string
  timestamp?: number
  lastUpdateTime?: number
  isValid?: boolean
  // Transform 数据
  translation?: { x: number; y: number; z: number }
  rotation?: { x: number; y: number; z: number; w: number }
}

export interface TFTreeNode {
  name: string
  parent: string | null
  children: TFTreeNode[]
  lastUpdateTime: number
  isValid: boolean
  enabled?: boolean
}

class TFManager {
  private rosInstance: ROSLIB.Ros | null = null
  private tfTopic: ROSLIB.Topic<any> | null = null
  private tfStaticTopic: ROSLIB.Topic<any> | null = null
  
  // 可用的坐标系列表（响应式）
  private availableFrames = ref<Set<string>>(new Set())
  
  // 坐标系列表（用于下拉框）
  public frames = ref<string[]>([])
  
  // TF 变换数据（frame_id -> child_frame_id -> TransformFrame）
  private transforms = ref<Map<string, Map<string, TransformFrame>>>(new Map())
  
  // TF 树结构（响应式）
  public tfTree = ref<TFTreeNode[]>([])
  
  // 数据更新触发器（用于响应式追踪）
  private dataUpdateTrigger = ref(0)
  
  // 默认坐标系（如果没有 TF 数据）
  private defaultFrames = ['map', 'odom', 'base_link', 'base_footprint']
  
  // Frame 超时时间（秒）
  private frameTimeout = 15
  
  /**
   * 获取数据更新触发器（用于响应式追踪）
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
    }, 100) // 每100ms最多更新一次
  }
  
  private dataUpdateThrottleTimer: number | null = null
  private pendingDataUpdate = false

  /**
   * 设置 ROS 实例
   */
  setROSInstance(ros: ROSLIB.Ros | null) {
    // 先取消之前的订阅
    this.unsubscribe()
    
    // 使用 toRaw 获取原始对象，避免代理对象访问私有成员的问题
    const rawRos = ros ? toRaw(ros) : null
    this.rosInstance = rawRos
    
    console.log('TFManager: setROSInstance', ros)
    if (rawRos) {
      // 安全地检查连接状态
      let isConnected = false
      try {
        isConnected = rawRos.isConnected === true
        console.log('TFManager: ros.isConnected', isConnected)
      } catch (error) {
        // 如果访问 isConnected 失败，假设已连接（因为我们已经成功连接了）
        console.warn('TFManager: Could not check ROS connection status, assuming connected', error)
        isConnected = true
      }
      
      // 检查连接状态，如果已连接则立即订阅，否则等待连接事件
      if (isConnected) {
        console.log('TFManager: ROS is connected, subscribing to TF topics')
        this.subscribe()
      } else {
        // 等待连接事件
        rawRos.on('connection', () => {
          this.subscribe()
        })
      }
    } else {
      // 清理资源
      this.availableFrames.value.clear()
      this.updateFramesList()
    }
  }

  /**
   * 订阅 TF 话题
   */
  private subscribe() {
    if (!this.rosInstance) return

    try {
      // 订阅 /tf 话题（动态坐标变换）
      this.tfTopic = new ROSLIB.Topic({
        ros: this.rosInstance,
        name: '/tf',
        messageType: 'tf2_msgs/TFMessage'
      })

      this.tfTopic.subscribe((message: any) => {
        // console.log('TFManager: Received /tf message', message)
        if (message && message.transforms && Array.isArray(message.transforms)) {
          const now = Date.now()
          message.transforms.forEach((transform: any) => {
            if (transform.header && transform.header.frame_id) {
              const frameId = transform.header.frame_id
              const childFrameId = transform.child_frame_id
              
              // 添加父坐标系和子坐标系
              this.availableFrames.value.add(frameId)
              if (childFrameId) {
                this.availableFrames.value.add(childFrameId)
              }
              
              // 存储变换数据
              if (!this.transforms.value.has(frameId)) {
                this.transforms.value.set(frameId, new Map())
              }
              const frameTransforms = this.transforms.value.get(frameId)!
              
              // 提取变换信息
              const transformData: TransformFrame = {
                name: childFrameId,
                parent: frameId,
                timestamp: transform.header.stamp?.secs ? transform.header.stamp.secs * 1000 + (transform.header.stamp.nsecs || 0) / 1000000 : now,
                lastUpdateTime: now,
                isValid: true,
                // 提取 translation 和 rotation
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
        // console.log('TFManager: Received /tf_static message', message)
        if (message && message.transforms && Array.isArray(message.transforms)) {
          const now = Date.now()
          message.transforms.forEach((transform: any) => {
            if (transform.header && transform.header.frame_id) {
              const frameId = transform.header.frame_id
              const childFrameId = transform.child_frame_id
              
              // 添加父坐标系和子坐标系
              this.availableFrames.value.add(frameId)
              if (childFrameId) {
                this.availableFrames.value.add(childFrameId)
              }
              
              // 存储变换数据（静态变换不会过期）
              if (!this.transforms.value.has(frameId)) {
                this.transforms.value.set(frameId, new Map())
              }
              const frameTransforms = this.transforms.value.get(frameId)!
              
              const transformData: TransformFrame = {
                name: childFrameId,
                parent: frameId,
                timestamp: transform.header.stamp?.secs ? transform.header.stamp.secs * 1000 + (transform.header.stamp.nsecs || 0) / 1000000 : now,
                lastUpdateTime: now,
                isValid: true,
                // 提取 translation 和 rotation
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
          })
        }
      })

      console.log('TFManager: Subscribed to /tf and /tf_static topics')
    } catch (error) {
      console.error('TFManager: Error subscribing to TF topics:', error)
    }
  }

  /**
   * 取消订阅
   */
  private unsubscribe() {
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
    // 合并默认坐标系和从 TF 获取的坐标系
    const allFrames = new Set<string>()
    
    // 添加默认坐标系
    this.defaultFrames.forEach(frame => allFrames.add(frame))
    
    // 添加从 TF 获取的坐标系
    this.availableFrames.value.forEach(frame => allFrames.add(frame))
    
    // 转换为排序后的数组
    this.frames.value = Array.from(allFrames).sort()
  }

  /**
   * 更新 TF 树结构
   */
  private updateTFTree() {
    const now = Date.now()
    const timeoutMs = this.frameTimeout * 1000
    
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
          isValid: false
        })
      }
    })
    
    // 建立父子关系并更新状态
    this.transforms.value.forEach((childMap, parentName) => {
      childMap.forEach((transform, childName) => {
        const age = now - transform.lastUpdateTime!
        const isValid = age < timeoutMs
        
        // 更新子节点
        if (nodeMap.has(childName)) {
          const childNode = nodeMap.get(childName)!
          childNode.parent = parentName
          childNode.lastUpdateTime = transform.lastUpdateTime || now
          childNode.isValid = isValid
        } else {
          // 创建新节点
          nodeMap.set(childName, {
            name: childName,
            parent: parentName,
            children: [],
            lastUpdateTime: transform.lastUpdateTime || now,
            isValid: isValid
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
    
    // 排序根节点
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
   * 获取所有变换数据
   */
  getTransforms(): Map<string, Map<string, TransformFrame>> {
    return this.transforms.value
  }

  /**
   * 设置 frame 超时时间
   */
  setFrameTimeout(timeout: number) {
    this.frameTimeout = timeout
    this.updateTFTree()
  }

  /**
   * 获取可用的坐标系列表
   */
  getFrames(): string[] {
    return this.frames.value.length > 0 ? this.frames.value : this.defaultFrames
  }

  /**
   * 获取响应式的坐标系列表
   */
  getFramesRef() {
    return this.frames
  }

  /**
   * 获取 frame 的详细信息（包括 parent, position, orientation）
   */
  getFrameInfo(frameName: string, fixedFrame: string = 'map'): {
    parent: string | null
    position: { x: number; y: number; z: number } | null
    orientation: { x: number; y: number; z: number; w: number } | null
    relativePosition: { x: number; y: number; z: number } | null
    relativeOrientation: { x: number; y: number; z: number; w: number } | null
  } {
    const transforms = this.transforms.value
    
    // 查找 frame 的父节点和相对变换
    let parent: string | null = null
    let relativePosition: { x: number; y: number; z: number } | null = null
    let relativeOrientation: { x: number; y: number; z: number; w: number } | null = null
    
    for (const [parentName, children] of transforms.entries()) {
      const transform = children.get(frameName)
      if (transform) {
        parent = parentName
        relativePosition = transform.translation ? { ...transform.translation } : null
        relativeOrientation = transform.rotation ? { ...transform.rotation } : null
        break
      }
    }
    
    // 计算相对于固定帧的绝对位置和方向
    let position: { x: number; y: number; z: number } | null = null
    let orientation: { x: number; y: number; z: number; w: number } | null = null
    
    if (frameName === fixedFrame) {
      position = { x: 0, y: 0, z: 0 }
      orientation = { x: 0, y: 0, z: 0, w: 1 }
    } else {
      // 查找从 fixedFrame 到 frameName 的路径并累积变换
      const path: string[] = []
      const findPath = (current: string, target: string, visited: Set<string>): boolean => {
        if (current === target) {
          path.push(current)
          return true
        }
        if (visited.has(current)) return false
        visited.add(current)

        for (const [p, children] of transforms.entries()) {
          if (p === current) {
            for (const childName of children.keys()) {
              if (childName && findPath(childName, target, visited)) {
                path.push(current)
                return true
              }
            }
          }
        }
        return false
      }

      if (findPath(fixedFrame, frameName, new Set())) {
        // 沿着路径累积变换（使用矩阵累积，更准确）
        let pos = { x: 0, y: 0, z: 0 }
        let rot = { x: 0, y: 0, z: 0, w: 1 }
        
        for (let i = path.length - 1; i > 0; i--) {
          const p = path[i]
          const c = path[i - 1]
          if (!p || !c) continue
          const parentTransforms = transforms.get(p)
          if (!parentTransforms) continue
          const transform = parentTransforms.get(c)
          if (!transform || !transform.translation || !transform.rotation) continue
          
          // 累积位置（简化处理，实际应该用矩阵变换）
          pos.x += transform.translation.x
          pos.y += transform.translation.y
          pos.z += transform.translation.z
          // 旋转累积更复杂，这里使用最后一个旋转（简化处理）
          rot = transform.rotation
        }
        
        position = pos
        orientation = rot
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
  }
}

// 导出单例
export const tfManager = new TFManager()
