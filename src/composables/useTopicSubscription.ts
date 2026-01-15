import { ref, watch, onUnmounted } from 'vue'
import * as ROSLIB from 'roslib'
import { useRvizStore } from '@/stores/rviz'

export interface TopicSubscriptionStatus {
  subscribed: boolean
  hasData: boolean
  messageCount: number
  lastMessageTime: number | null
  error: string | null
}

export interface CachedMessage {
  data: any
  timestamp: number
}

/**
 * 话题订阅和数据缓存 composable
 */
export function useTopicSubscription(
  componentId: string,
  topic: string | undefined,
  messageType: string,
  queueSize: number = 10
) {
  console.log("useTopicSubscription", componentId, topic, messageType, queueSize)
  const rvizStore = useRvizStore()
  
  // 订阅状态
  const status = ref<TopicSubscriptionStatus>({
    subscribed: false,
    hasData: false,
    messageCount: 0,
    lastMessageTime: null,
    error: null
  })
  
  // 数据缓存队列
  const messageQueue = ref<CachedMessage[]>([])
  
  // ROS 订阅者
  let subscriber: ROSLIB.Topic<any> | null = null
  
  // 获取 ROS 实例
  const getROSInstance = (): ROSLIB.Ros | null => {
    const rosPlugin = rvizStore.getPlugin('ros')
    if (rosPlugin) {
      return (rosPlugin as any).getROSInstance?.() as ROSLIB.Ros | null
    }
    return null
  }
  
  // 订阅话题
  const subscribe = () => {
    // 先取消旧的订阅
    unsubscribe()
    
    // 检查 ROS 连接
    const ros = getROSInstance()
    if (!ros || !ros.isConnected) {
      status.value = {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: 'ROS not connected'
      }
      return
    }
    
    // 检查话题是否有效
    if (!topic || topic.trim() === '') {
      status.value = {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: 'Topic not specified'
      }
      return
    }
    
    try {
      // 创建订阅者
      subscriber = new ROSLIB.Topic({
        ros: ros,
        name: topic,
        messageType: messageType,
        queue_size: queueSize
      })
      
      // 订阅消息
      subscriber.subscribe((message: any) => {
        const timestamp = Date.now()
        
        // 添加到缓存队列
        messageQueue.value.push({
          data: message,
          timestamp: timestamp
        })
        
        // 保持队列大小
        if (messageQueue.value.length > queueSize) {
          messageQueue.value.shift() // 移除最旧的消息
        }
        
        // 更新状态
        status.value = {
          subscribed: true,
          hasData: true,
          messageCount: status.value.messageCount + 1,
          lastMessageTime: timestamp,
          error: null
        }
      })
      
      status.value = {
        subscribed: true,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: null
      }
      
      console.log(`Subscribed to topic: ${topic} for component: ${componentId}`)
    } catch (error: any) {
      console.error(`Failed to subscribe to topic ${topic}:`, error)
      status.value = {
        subscribed: false,
        hasData: false,
        messageCount: 0,
        lastMessageTime: null,
        error: error?.message || 'Subscription failed'
      }
    }
  }
  
  // 取消订阅
  const unsubscribe = () => {
    if (subscriber) {
      try {
        subscriber.unsubscribe()
      } catch (error) {
        console.error('Error unsubscribing:', error)
      }
      subscriber = null
    }
    
    status.value = {
      subscribed: false,
      hasData: false,
      messageCount: status.value.messageCount,
      lastMessageTime: status.value.lastMessageTime,
      error: null
    }
  }
  
  // 获取最新消息
  const getLatestMessage = (): any | null => {
    if (messageQueue.value.length === 0) {
      return null
    }
    const lastMessage = messageQueue.value[messageQueue.value.length - 1]
    return lastMessage?.data ?? null
  }
  
  // 获取所有缓存的消息
  const getAllMessages = (): CachedMessage[] => {
    return [...messageQueue.value]
  }
  
  // 清空缓存
  const clearCache = () => {
    messageQueue.value = []
    status.value.hasData = false
  }
  
  // 监听话题变化
  watch(() => topic, (newTopic: string | undefined) => {
    if (newTopic && newTopic.trim() !== '') {
      subscribe()
    } else {
      unsubscribe()
      clearCache()
    }
  }, { immediate: true })
  
  // 监听队列大小变化
  watch(() => queueSize, (newSize: number) => {
    // 如果队列大小变小，移除多余的消息
    if (messageQueue.value.length > newSize) {
      messageQueue.value = messageQueue.value.slice(-newSize)
    }
    // 重新订阅以应用新的队列大小
    if (status.value.subscribed && topic && topic.trim() !== '') {
      subscribe()
    }
  })
  
  // 监听 ROS 连接状态
  watch(() => rvizStore.robotConnection.connected, (connected) => {
    if (connected && topic && topic.trim() !== '') {
      subscribe()
    } else {
      unsubscribe()
      clearCache()
    }
  })
  
  // 组件卸载时取消订阅
  onUnmounted(() => {
    unsubscribe()
    clearCache()
  })
  
  return {
    status,
    messageQueue,
    subscribe,
    unsubscribe,
    getLatestMessage,
    getAllMessages,
    clearCache
  }
}
