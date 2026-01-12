import type { IProtocol, IDataTransformer } from './ProtocolInterface'
import type { ProtocolConfig, DataPacket } from '../../types/data'

/**
 * MQTT 协议实现
 * 支持 MQTT 3.1.1 和 5.0
 */
export class MQTTProtocol implements IProtocol {
  private client: any = null
  private subscriptions: Map<string, ((packet: DataPacket) => void)[]> = new Map()
  private isConnectedFlag = false
  private lastMessage = 0
  private connectionError: string | undefined

  async connect(config: ProtocolConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      import('mqtt').then((mqtt) => {
        this.client = mqtt.connect(config.url, {
          ...config.options,
          reconnectPeriod: 1000,
          connectTimeout: 10000,
          keepalive: 60
        })

        this.client.on('connect', () => {
          this.isConnectedFlag = true
          this.connectionError = undefined
          console.log('MQTT connected to:', config.url)
          resolve()
        })

        this.client.on('error', (error: any) => {
          this.isConnectedFlag = false
          this.connectionError = error.message || 'MQTT connection error'
          console.error('MQTT connection error:', error)
          reject(error)
        })

        this.client.on('close', () => {
          this.isConnectedFlag = false
          console.log('MQTT connection closed')
        })

        this.client.on('message', (topic: string, message: Buffer) => {
          this.lastMessage = Date.now()
          try {
            const data = JSON.parse(message.toString())
            const packet: DataPacket = {
              topic,
              type: this.inferMessageType(topic),
              data,
              timestamp: Date.now(),
              source: 'mqtt'
            }

            // 通知所有订阅者
            const callbacks = this.subscriptions.get(topic) || []
            callbacks.forEach(callback => callback(packet))
          } catch (error) {
            console.error('MQTT message parse error:', error)
          }
        })
      }).catch(reject)
    })
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.end(false, () => {
          this.isConnectedFlag = false
          this.subscriptions.clear()
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  async subscribe(topic: string, callback: (packet: DataPacket) => void): Promise<void> {
    if (!this.client || !this.isConnectedFlag) {
      throw new Error('MQTT not connected')
    }

    return new Promise((resolve, reject) => {
      if (!this.subscriptions.has(topic)) {
        this.subscriptions.set(topic, [])

        this.client.subscribe(topic, { qos: 0 }, (error: any, _granted: any) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      } else {
        resolve()
      }

      this.subscriptions.get(topic)!.push(callback)
    })
  }

  async unsubscribe(topic: string): Promise<void> {
    if (!this.client) {
      throw new Error('MQTT not connected')
    }

    return new Promise((resolve, reject) => {
      this.client.unsubscribe(topic, (error: any) => {
        if (error) {
          reject(error)
        } else {
          this.subscriptions.delete(topic)
          resolve()
        }
      })
    })
  }

  async publish(topic: string, data: any, _type?: string): Promise<void> {
    if (!this.client || !this.isConnectedFlag) {
      throw new Error('MQTT not connected')
    }

    return new Promise((resolve, reject) => {
      const message = JSON.stringify(data)
      this.client.publish(topic, message, { qos: 0 }, (error: any) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  async callService(serviceName: string, requestPayload: any): Promise<any> {
    // MQTT 不支持服务调用，这里可以实现基于 MQTT 的 RPC
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).substr(2, 9)
      const requestTopic = `${serviceName}/request/${requestId}`
      const responseTopic = `${serviceName}/response/${requestId}`

      // 设置响应监听器
      const responseHandler = (packet: DataPacket) => {
        if (packet.topic === responseTopic) {
          this.unsubscribe(responseTopic)
          resolve(packet.data)
        }
      }

      // 先订阅响应话题
      this.subscribe(responseTopic, responseHandler)
        .then(() => {
          // 发送请求
          return this.publish(requestTopic, requestPayload)
        })
        .catch(reject)

      // 超时处理
      setTimeout(() => {
        this.unsubscribe(responseTopic)
        reject(new Error('Service call timeout'))
      }, 10000)
    })
  }

  isConnected(): boolean {
    return this.isConnectedFlag && this.client && this.client.connected
  }

  getType(): string {
    return 'mqtt'
  }

  getConnectionInfo() {
    return {
      url: this.client?.options?.href || '',
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
    return 'std_msgs/String'
  }
}

/**
 * MQTT 数据转换器
 */
export class MQTTDataTransformer implements IDataTransformer {
  transformIncoming(packet: DataPacket): DataPacket {
    // MQTT 数据通常是 JSON 格式，这里可以进行数据验证和标准化
    return {
      ...packet,
      data: this.normalizeMQTTData(packet.data, packet.type)
    }
  }

  transformOutgoing(data: any, _topic: string): any {
    // 对于发送到 MQTT 的数据，确保是可序列化的
    return JSON.parse(JSON.stringify(data))
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
   * 标准化 MQTT 数据
   */
  private normalizeMQTTData(data: any, messageType: string): any {
    // MQTT 数据通常已经是标准格式，但可能需要类型转换
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
        covariance: data.pose.covariance ? new Float64Array(data.pose.covariance) : new Float64Array(36)
      },
      twist: {
        ...data.twist,
        covariance: data.twist.covariance ? new Float64Array(data.twist.covariance) : new Float64Array(36)
      }
    }
  }

  private normalizeOccupancyGrid(data: any): any {
    return {
      ...data,
      data: data.data ? new Int8Array(data.data) : new Int8Array()
    }
  }

  private normalizeLaserScan(data: any): any {
    return {
      ...data,
      ranges: data.ranges ? new Float32Array(data.ranges) : new Float32Array(),
      intensities: data.intensities ? new Float32Array(data.intensities) : new Float32Array()
    }
  }
}
