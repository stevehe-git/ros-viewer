import type { IProtocolManager, IProtocolFactory, IProtocol, IDataTransformer } from './ProtocolInterface'
import { ROSProtocol, ROSDataTransformer } from './ROSProtocol'
import { MQTTProtocol, MQTTDataTransformer } from './MQTTProtocol'
import type { ProtocolConfig } from '../../types/data'

/**
 * 协议管理器实现
 * 管理所有通信协议的创建和配置
 */
export class ProtocolManager implements IProtocolManager {
  private protocolFactories: Map<string, IProtocolFactory> = new Map()
  private dataTransformers: Map<string, IDataTransformer> = new Map()
  private activeProtocols: Map<string, IProtocol> = new Map()

  constructor() {
    this.registerDefaultProtocols()
  }

  registerProtocolFactory(_type: string, factory: IProtocolFactory): void {
    this.protocolFactories.set(_type, factory)
  }

  createProtocol(protocolType: string, _config: ProtocolConfig): IProtocol {
    const factory = this.protocolFactories.get(protocolType)
    if (!factory) {
      throw new Error(`Unsupported protocol type: ${protocolType}`)
    }

    const protocol = factory.createProtocol(protocolType)

    // 如果有数据转换器，包装协议
    const transformer = this.dataTransformers.get(protocolType)
    if (transformer) {
      return new TransformedProtocol(protocol, transformer)
    }

    return protocol
  }

  getSupportedTypes(): string[] {
    return Array.from(this.protocolFactories.keys())
  }

  // 私有方法 - 注册默认协议

  registerTransformer(_protocolType: string, transformer: IDataTransformer): void {
    this.dataTransformers.set(_protocolType, transformer)
  }

  getTransformer(_protocolType: string): IDataTransformer | undefined {
    return this.dataTransformers.get(_protocolType)
  }

  // 私有方法

  /**
   * 创建并连接协议实例
   */
  async createAndConnectProtocol(id: string, protocolType: string, config: ProtocolConfig): Promise<IProtocol> {
    const protocol = this.createProtocol(protocolType, config)
    await protocol.connect(config)
    this.activeProtocols.set(id, protocol)
    return protocol
  }

  /**
   * 断开并移除协议实例
   */
  async disconnectProtocol(id: string): Promise<void> {
    const protocol = this.activeProtocols.get(id)
    if (protocol) {
      await protocol.disconnect()
      this.activeProtocols.delete(id)
    }
  }

  /**
   * 获取活跃协议
   */
  getActiveProtocol(id: string): IProtocol | undefined {
    return this.activeProtocols.get(id)
  }

  /**
   * 获取所有活跃协议
   */
  getAllActiveProtocols(): Map<string, IProtocol> {
    return new Map(this.activeProtocols)
  }

  /**
   * 注册默认协议
   */
  private registerDefaultProtocols(): void {
    // ROS 协议
    this.registerProtocolFactory('ros', new ROSProtocolFactory())
    this.registerTransformer('ros', new ROSDataTransformer())

    // MQTT 协议
    this.registerProtocolFactory('mqtt', new MQTTProtocolFactory())
    this.registerTransformer('mqtt', new MQTTDataTransformer())

    // WebSocket 协议 (TODO)
    // TCP 协议 (TODO)
    // UDP 协议 (TODO)
    // HTTP 协议 (TODO)
  }
}

/**
 * ROS 协议工厂
 */
class ROSProtocolFactory implements IProtocolFactory {
  createProtocol(_type: string): IProtocol {
    return new ROSProtocol()
  }

  getSupportedTypes(): string[] {
    return ['ros']
  }
}

/**
 * MQTT 协议工厂
 */
class MQTTProtocolFactory implements IProtocolFactory {
  createProtocol(_type: string): IProtocol {
    return new MQTTProtocol()
  }

  getSupportedTypes(): string[] {
    return ['mqtt']
  }
}

/**
 * 包装协议，添加数据转换功能
 */
class TransformedProtocol implements IProtocol {
  private protocol: IProtocol
  private transformer: IDataTransformer

  constructor(protocol: IProtocol, transformer: IDataTransformer) {
    this.protocol = protocol
    this.transformer = transformer
  }

  async connect(config: ProtocolConfig): Promise<void> {
    return this.protocol.connect(config)
  }

  async disconnect(): Promise<void> {
    return this.protocol.disconnect()
  }

  async subscribe(topic: string, callback: (packet: any) => void): Promise<void> {
    const transformedCallback = (packet: any) => {
      const transformedPacket = this.transformer.transformIncoming(packet)
      callback(transformedPacket)
    }
    return this.protocol.subscribe(topic, transformedCallback)
  }

  async unsubscribe(topic: string): Promise<void> {
    return this.protocol.unsubscribe(topic)
  }

  async publish(topic: string, data: any, type?: string): Promise<void> {
    const transformedData = this.transformer.transformOutgoing(data, topic)
    return this.protocol.publish(topic, transformedData, type)
  }

  async callService(service: string, request: any): Promise<any> {
    return this.protocol.callService(service, request)
  }

  isConnected(): boolean {
    return this.protocol.isConnected()
  }

  getType(): string {
    return this.protocol.getType()
  }

  getConnectionInfo() {
    return this.protocol.getConnectionInfo()
  }
}

// 单例实例
export const protocolManager = new ProtocolManager()
