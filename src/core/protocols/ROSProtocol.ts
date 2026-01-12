import type { IProtocol, IDataTransformer } from './ProtocolInterface'
import type { ProtocolConfig, DataPacket } from '../../types/data'

/**
 * ROS 协议实现
 * 支持 ROS1 的 WebSocket 通信
 */
export class ROSProtocol implements IProtocol {
  private ros: any = null
  private subscriptions: Map<string, any> = new Map()
  private services: Map<string, any> = new Map()
  private isConnectedFlag = false
  private lastMessage = 0
  private connectionError: string | undefined

  async connect(config: ProtocolConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      // 动态导入 roslib
      import('roslib').then((ROSLIB) => {
        this.ros = new ROSLIB.Ros({
          url: config.url
        })

        this.ros.on('connection', () => {
          this.isConnectedFlag = true
          this.connectionError = undefined
          console.log('ROS connected to:', config.url)
          resolve()
        })

        this.ros.on('error', (error: any) => {
          this.isConnectedFlag = false
          this.connectionError = error.message || 'ROS connection error'
          console.error('ROS connection error:', error)
          reject(error)
        })

        this.ros.on('close', () => {
          this.isConnectedFlag = false
          console.log('ROS connection closed')
        })

        // 连接超时处理
        setTimeout(() => {
          if (!this.isConnectedFlag) {
            reject(new Error('ROS connection timeout'))
          }
        }, 10000)
      }).catch(reject)
    })
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ros) {
        // 清理所有订阅
        this.subscriptions.forEach((topic, topicName) => {
          try {
            topic.unsubscribe()
          } catch (error) {
            console.warn(`Error unsubscribing from ${topicName}:`, error)
          }
        })
        this.subscriptions.clear()

        // 清理所有服务
        this.services.clear()

        // 断开连接
        this.ros.close()
        this.ros = null
        this.isConnectedFlag = false
      }
      resolve()
    })
  }

  async subscribe(topic: string, callback: (packet: DataPacket) => void): Promise<void> {
    if (!this.ros || !this.isConnectedFlag) {
      throw new Error('ROS not connected')
    }

    return new Promise((resolve, reject) => {
      import('roslib').then((ROSLIB) => {
        try {
          const topicInstance = new ROSLIB.Topic({
            ros: this.ros,
            name: topic,
            messageType: this.inferMessageType(topic)
          })

          topicInstance.subscribe((message: any) => {
            this.lastMessage = Date.now()
            const packet: DataPacket = {
              topic,
              type: this.inferMessageType(topic),
              data: message,
              timestamp: Date.now(),
              source: 'ros'
            }
            callback(packet)
          })

          this.subscriptions.set(topic, topicInstance)
          resolve()
        } catch (error) {
          reject(error)
        }
      }).catch(reject)
    })
  }

  async unsubscribe(topic: string): Promise<void> {
    const subscription = this.subscriptions.get(topic)
    if (subscription) {
      try {
        subscription.unsubscribe()
      } catch (error) {
        console.warn(`Error unsubscribing from ${topic}:`, error)
      }
      this.subscriptions.delete(topic)
    }
  }

  async publish(topicName: string, data: any, messageType?: string): Promise<void> {
    if (!this.ros || !this.isConnectedFlag) {
      throw new Error('ROS not connected')
    }

    return new Promise((resolve, reject) => {
      import('roslib').then((ROSLIB) => {
        try {
          const topicInstance = new ROSLIB.Topic({
            ros: this.ros,
            name: topicName,
            messageType: messageType || this.inferMessageType(topicName)
          })

          topicInstance.publish(data)
          resolve()
        } catch (error) {
          reject(error)
        }
      }).catch(reject)
    })
  }

  async callService(service: string, request: any): Promise<any> {
    if (!this.ros || !this.isConnectedFlag) {
      throw new Error('ROS not connected')
    }

    return new Promise((resolve, reject) => {
      import('roslib').then((ROSLIB) => {
        try {
          const serviceInstance = new ROSLIB.Service({
            ros: this.ros,
            name: service,
            serviceType: this.inferServiceType(service)
          })

          const requestInstance = request // ROSLIB 服务请求直接使用对象

          serviceInstance.callService(requestInstance, (response: any) => {
            resolve(response)
          }, (error: any) => {
            reject(error)
          })
        } catch (error) {
          reject(error)
        }
      }).catch(reject)
    })
  }

  isConnected(): boolean {
    return this.isConnectedFlag
  }

  getType(): string {
    return 'ros'
  }

  getConnectionInfo() {
    return {
      url: this.ros?.socket?.url || '',
      connected: this.isConnectedFlag,
      lastMessage: this.lastMessage,
      error: this.connectionError
    }
  }

  /**
   * 根据话题名称推断消息类型
   */
  private inferMessageType(topicName: string): string {
    if (topicName.includes('/odom')) return 'nav_msgs/Odometry'
    if (topicName.includes('/map')) return 'nav_msgs/OccupancyGrid'
    if (topicName.includes('/scan')) return 'sensor_msgs/LaserScan'
    if (topicName.includes('/cmd_vel')) return 'geometry_msgs/Twist'
    if (topicName.includes('/goal')) return 'geometry_msgs/PoseStamped'
    if (topicName.includes('/plan')) return 'nav_msgs/Path'
    if (topicName.includes('/status')) return 'actionlib_msgs/GoalStatusArray'
    return 'std_msgs/String' // 默认类型
  }

  /**
   * 根据服务名称推断服务类型
   */
  private inferServiceType(_serviceName: string): string {
    // TODO: 实现服务类型推断逻辑
    return 'std_srvs/Trigger' // 默认类型
  }
}

/**
 * ROS 数据转换器
 */
export class ROSDataTransformer implements IDataTransformer {
  transformIncoming(packet: DataPacket): DataPacket {
    // ROS 数据基本已经是标准格式，这里可以进行数据验证和标准化
    return {
      ...packet,
      data: this.normalizeROSData(packet.data, packet.type)
    }
  }

  transformOutgoing(data: any, _topic: string): any {
    // 对于发送到 ROS 的数据，通常不需要转换
    return data
  }

  getSupportedMessageTypes(): string[] {
    return [
      'nav_msgs/Odometry',
      'nav_msgs/OccupancyGrid',
      'sensor_msgs/LaserScan',
      'geometry_msgs/Twist',
      'geometry_msgs/PoseStamped',
      'nav_msgs/Path',
      'actionlib_msgs/GoalStatusArray',
      'std_msgs/String'
    ]
  }

  /**
   * 标准化 ROS 数据
   */
  private normalizeROSData(data: any, messageType: string): any {
    switch (messageType) {
      case 'nav_msgs/Odometry':
        return this.normalizeOdometry(data)
      case 'nav_msgs/OccupancyGrid':
        return this.normalizeOccupancyGrid(data)
      case 'sensor_msgs/LaserScan':
        return this.normalizeLaserScan(data)
      default:
        return data
    }
  }

  private normalizeOdometry(data: any): any {
    return {
      ...data,
      pose: {
        ...data.pose,
        covariance: new Float64Array(data.pose.covariance || [])
      },
      twist: {
        ...data.twist,
        covariance: new Float64Array(data.twist.covariance || [])
      }
    }
  }

  private normalizeOccupancyGrid(data: any): any {
    return {
      ...data,
      data: new Int8Array(data.data || [])
    }
  }

  private normalizeLaserScan(data: any): any {
    return {
      ...data,
      ranges: new Float32Array(data.ranges || []),
      intensities: new Float32Array(data.intensities || [])
    }
  }
}
