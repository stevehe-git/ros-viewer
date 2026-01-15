/**
 * 统一的话题订阅管理器
 * 负责管理所有组件的话题订阅，避免重复订阅
 * 支持多种数据格式（ROS/protobuf/json）
 */
import * as ROSLIB from 'roslib'
import type { CommunicationPlugin } from '@/stores/rviz'
import { DataConverter } from './dataConverter'

export interface SubscriptionStatus {
  subscribed: boolean
  hasData: boolean
  messageCount: number
  lastMessageTime: number | null
  error: string | null
}

export interface CachedMessage {
  data: any
  timestamp: number
  format: 'ros' | 'protobuf' | 'json'
}

export class TopicSubscriptionManager {
  private subscribers = new Map<string, ROSLIB.Topic<any>>()
  private messageQueues = new Map<string, CachedMessage[]>()
  private statuses = new Map<string, SubscriptionStatus>()
  private rosInstance: ROSLIB.Ros | null = null
  private rosPlugin: CommunicationPlugin | null = null

  // 组件类型到消息类型的映射
  private readonly COMPONENT_MESSAGE_TYPES: Record<string, string> = {
    map: 'nav_msgs/OccupancyGrid',
    path: 'nav_msgs/Path',
    laserscan: 'sensor_msgs/LaserScan',
    pointcloud2: 'sensor_msgs/PointCloud2',
    marker: 'visualization_msgs/Marker',
    image: 'sensor_msgs/Image',
    camera: 'sensor_msgs/Image'
  }

  /**
   * 设置 ROS 插件实例
   */
  setROSPlugin(plugin: CommunicationPlugin | null) {
    this.rosPlugin = plugin
    this.updateROSInstance()
  }

  /**
   * 更新 ROS 实例
   */
  private updateROSInstance() {
    if (this.rosPlugin) {
      this.rosInstance = (this.rosPlugin as any).getROSInstance?.() as ROSLIB.Ros | null
    } else {
      this.rosInstance = null
    }
  }

  /**
   * 检查话题是否有效
   */
  private isValidTopic(topic: string | undefined): boolean {
    return !!(topic && topic.trim() !== '' && topic !== '<Fixed Frame>')
  }

  /**
   * 检查数据是否有效（使用数据转换层）
   */
  private isValidData(message: any, componentType: string): boolean {
    return DataConverter.isValidData(message, componentType, 'ros')
  }

  /**
   * 订阅话题
   */
  subscribe(
    componentId: string,
    componentType: string,
    topic: string | undefined,
    queueSize: number = 10
  ): boolean {
    // 先取消旧的订阅
    this.unsubscribe(componentId)

    // 检查话题是否有效
    if (!this.isValidTopic(topic)) {
      this.statuses.set(componentId, {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: 'Topic not specified'
      })
      return false
    }

    // 更新 ROS 实例
    this.updateROSInstance()

    // 检查 ROS 连接
    if (!this.rosInstance || !this.rosInstance.isConnected) {
      this.statuses.set(componentId, {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: 'ROS not connected'
      })
      return false
    }

    // 获取消息类型
    const messageType = this.COMPONENT_MESSAGE_TYPES[componentType]
    if (!messageType) {
      this.statuses.set(componentId, {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: `Unknown message type for component type: ${componentType}`
      })
      return false
    }

    try {
      // 创建订阅者
      const subscriber = new ROSLIB.Topic({
        ros: this.rosInstance,
        name: topic!,
        messageType: messageType,
        queue_size: queueSize
      })

      // 初始化消息队列
      if (!this.messageQueues.has(componentId)) {
        this.messageQueues.set(componentId, [])
      }

      // 订阅消息
      subscriber.subscribe((message: any) => {
        const timestamp = Date.now()

        // 检查数据是否有效
        const hasData = this.isValidData(message, componentType)

        // 获取当前状态
        const currentStatus = this.statuses.get(componentId) || {
          subscribed: true,
          hasData: false,
          messageCount: 0,
          lastMessageTime: null,
          error: null
        }

        // 更新状态
        this.statuses.set(componentId, {
          subscribed: true,
          hasData: hasData,
          messageCount: currentStatus.messageCount + 1,
          lastMessageTime: timestamp,
          error: null
        })

        // 如果数据有效，添加到缓存队列
        if (hasData) {
          const queue = this.messageQueues.get(componentId)!
          queue.push({
            data: message,
            timestamp: timestamp,
            format: 'ros' // 目前只支持 ROS，后续可扩展
          })

          // 保持队列大小
          if (queue.length > queueSize) {
            queue.shift()
          }
        }
      })

      this.subscribers.set(componentId, subscriber)

      // 初始化状态
      this.statuses.set(componentId, {
        subscribed: true,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: null
      })

      console.log(`Subscribed to topic: ${topic} for component: ${componentId} (${componentType})`)
      return true
    } catch (error: any) {
      console.error(`Failed to subscribe to topic ${topic}:`, error)
      this.statuses.set(componentId, {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: error?.message || 'Subscription failed'
      })
      return false
    }
  }

  /**
   * 取消订阅
   */
  unsubscribe(componentId: string): void {
    const subscriber = this.subscribers.get(componentId)
    if (subscriber) {
      try {
        subscriber.unsubscribe()
      } catch (error) {
        console.error('Error unsubscribing:', error)
      }
      this.subscribers.delete(componentId)
    }

    // 保留状态和队列，但标记为未订阅
    const currentStatus = this.statuses.get(componentId)
    if (currentStatus) {
      this.statuses.set(componentId, {
        ...currentStatus,
        subscribed: false
      })
    }
  }

  /**
   * 获取最新消息
   */
  getLatestMessage(componentId: string): any | null {
    const queue = this.messageQueues.get(componentId)
    if (!queue || queue.length === 0) {
      return null
    }
    return queue[queue.length - 1]?.data ?? null
  }

  /**
   * 获取所有缓存的消息
   */
  getAllMessages(componentId: string): CachedMessage[] {
    return [...(this.messageQueues.get(componentId) || [])]
  }

  /**
   * 获取订阅状态
   */
  getStatus(componentId: string): SubscriptionStatus | null {
    return this.statuses.get(componentId) || null
  }

  /**
   * 清空缓存
   */
  clearCache(componentId: string): void {
    const queue = this.messageQueues.get(componentId)
    if (queue) {
      queue.length = 0
    }
    const status = this.statuses.get(componentId)
    if (status) {
      this.statuses.set(componentId, {
        ...status,
        hasData: false
      })
    }
  }

  /**
   * 取消所有订阅
   */
  unsubscribeAll(): void {
    this.subscribers.forEach((subscriber, componentId) => {
      try {
        subscriber.unsubscribe()
      } catch (error) {
        console.error('Error unsubscribing:', error)
      }
    })
    this.subscribers.clear()
  }

  /**
   * 清空所有缓存
   */
  clearAllCache(): void {
    this.messageQueues.clear()
    this.statuses.clear()
  }
}

// 单例实例
export const topicSubscriptionManager = new TopicSubscriptionManager()
