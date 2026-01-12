import type { ProtocolConfig, DataPacket } from '../../types/data'

/**
 * 通信协议接口
 * 抽象不同通信协议的通用操作
 */
export interface IProtocol {
  /**
   * 连接到协议服务
   */
  connect(config: ProtocolConfig): Promise<void>

  /**
   * 断开连接
   */
  disconnect(): Promise<void>

  /**
   * 订阅主题/频道
   */
  subscribe(topic: string, callback: (packet: DataPacket) => void): Promise<void>

  /**
   * 取消订阅
   */
  unsubscribe(topic: string): Promise<void>

  /**
   * 发布消息
   */
  publish(topic: string, data: any, type?: string): Promise<void>

  /**
   * 调用服务/方法
   */
  callService(service: string, request: any): Promise<any>

  /**
   * 获取连接状态
   */
  isConnected(): boolean

  /**
   * 获取协议类型
   */
  getType(): string

  /**
   * 获取连接信息
   */
  getConnectionInfo(): {
    url: string
    connected: boolean
    lastMessage?: number
    error?: string
  }
}

/**
 * 协议工厂接口
 */
export interface IProtocolFactory {
  createProtocol(type: string): IProtocol
  getSupportedTypes(): string[]
}

/**
 * 数据转换器接口
 * 用于将不同协议的数据转换为统一格式
 */
export interface IDataTransformer {
  /**
   * 转换接收到的数据
   */
  transformIncoming(packet: DataPacket): DataPacket

  /**
   * 转换发送的数据
   */
  transformOutgoing(data: any, topic: string): any

  /**
   * 获取支持的消息类型
   */
  getSupportedMessageTypes(): string[]
}

/**
 * 协议管理器接口
 */
export interface IProtocolManager {
  /**
   * 注册协议工厂
   */
  registerProtocolFactory(type: string, factory: IProtocolFactory): void

  /**
   * 创建协议实例
   */
  createProtocol(type: string, config: ProtocolConfig): IProtocol

  /**
   * 获取支持的协议类型
   */
  getSupportedTypes(): string[]

  /**
   * 注册数据转换器
   */
  registerTransformer(protocolType: string, transformer: IDataTransformer): void

  /**
   * 获取数据转换器
   */
  getTransformer(protocolType: string): IDataTransformer | undefined
}
