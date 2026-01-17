/**
 * TF 坐标变换管理器
 * 监听 tf2-ros 发布的坐标变换，维护可用的坐标系列表
 */
import * as ROSLIB from 'roslib'
import { ref, watch } from 'vue'

export interface TransformFrame {
  name: string
  parent?: string
  timestamp?: number
}

class TFManager {
  private rosInstance: ROSLIB.Ros | null = null
  private tfTopic: ROSLIB.Topic | null = null
  private tfStaticTopic: ROSLIB.Topic | null = null
  
  // 可用的坐标系列表（响应式）
  private availableFrames = ref<Set<string>>(new Set())
  
  // 坐标系列表（用于下拉框）
  public frames = ref<string[]>([])
  
  // 默认坐标系（如果没有 TF 数据）
  private defaultFrames = ['map', 'odom', 'base_link', 'base_footprint']

  /**
   * 设置 ROS 实例
   */
  setROSInstance(ros: ROSLIB.Ros | null) {
    // 先取消之前的订阅
    this.unsubscribe()
    
    this.rosInstance = ros
    
    if (ros) {
      // 检查连接状态，如果已连接则立即订阅，否则等待连接事件
      if (ros.isConnected) {
        this.subscribe()
      } else {
        // 等待连接事件
        ros.on('connection', () => {
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
        if (message && message.transforms && Array.isArray(message.transforms)) {
          message.transforms.forEach((transform: any) => {
            if (transform.header && transform.header.frame_id) {
              const frameId = transform.header.frame_id
              const childFrameId = transform.child_frame_id
              
              // 添加父坐标系和子坐标系
              this.availableFrames.value.add(frameId)
              if (childFrameId) {
                this.availableFrames.value.add(childFrameId)
              }
              
              // 更新 frames 列表
              this.updateFramesList()
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
        if (message && message.transforms && Array.isArray(message.transforms)) {
          message.transforms.forEach((transform: any) => {
            if (transform.header && transform.header.frame_id) {
              const frameId = transform.header.frame_id
              const childFrameId = transform.child_frame_id
              
              // 添加父坐标系和子坐标系
              this.availableFrames.value.add(frameId)
              if (childFrameId) {
                this.availableFrames.value.add(childFrameId)
              }
              
              // 更新 frames 列表
              this.updateFramesList()
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
