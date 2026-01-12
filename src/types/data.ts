/**
 * 通用数据结构定义
 * 支持多种数据格式 (ROS, Protobuf, JSON等)
 */

// 基础几何类型
export interface Point2D {
  x: number
  y: number
}

export interface Point3D extends Point2D {
  z: number
}

export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
}

export interface Pose {
  position: Point3D
  orientation: Quaternion
}

export interface Twist {
  linear: Point3D
  angular: Point3D
}

// 时间戳类型
export interface Timestamp {
  sec: number
  nsec: number
}

// 通用消息头
export interface Header {
  seq: number
  stamp: Timestamp
  frame_id: string
}

// 地图数据
export interface OccupancyGrid {
  header: Header
  info: {
    map_load_time: Timestamp
    resolution: number
    width: number
    height: number
    origin: Pose
  }
  data: Int8Array
}

// 激光扫描数据
export interface LaserScan {
  header: Header
  angle_min: number
  angle_max: number
  angle_increment: number
  time_increment: number
  scan_time: number
  range_min: number
  range_max: number
  ranges: Float32Array
  intensities: Float32Array
}

// 里程计数据
export interface Odometry {
  header: Header
  child_frame_id: string
  pose: {
    pose: Pose
    covariance: Float64Array
  }
  twist: {
    twist: Twist
    covariance: Float64Array
  }
}

// 路径数据
export interface Path {
  header: Header
  poses: Array<{
    header: Header
    pose: Pose
  }>
}

// 目标点数据
export interface PoseStamped {
  header: Header
  pose: Pose
}

// 机器人状态
export interface RobotState {
  id: string
  name: string
  type: string
  pose: Pose
  velocity: Twist
  battery_level?: number
  status: 'online' | 'offline' | 'error' | 'charging'
  last_update: number
}

// 传感器数据
export interface SensorData {
  id: string
  type: 'laser' | 'camera' | 'imu' | 'gps' | 'ultrasonic'
  timestamp: number
  data: any
}

// 任务状态
export interface Task {
  id: string
  type: 'navigation' | 'pickup' | 'delivery' | 'inspection'
  status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'
  progress: number
  description: string
  start_time: number
  end_time?: number
}

// 通信协议类型
export type ProtocolType = 'ros' | 'mqtt' | 'websocket' | 'tcp' | 'udp' | 'http'

// 协议配置
export interface ProtocolConfig {
  type: ProtocolType
  url: string
  options?: Record<string, any>
}

// 数据包类型
export type DataPacket = {
  topic: string
  type: string
  data: any
  timestamp: number
  source: ProtocolType
}

// UI 状态
export interface UIState {
  theme: 'light' | 'dark' | 'auto'
  layout: 'default' | 'minimal' | 'extended'
  sidebarCollapsed: boolean
  fullscreenMode: boolean
  activeView: string
  layers: Record<string, boolean>
}

// 性能指标
export interface PerformanceMetrics {
  fps: number
  memoryUsage: number
  dataThroughput: number
  latency: number
}

// 机器人类型配置
export interface RobotType {
  id: string
  name: string
  description: string
  capabilities: string[]
  uiConfig: {
    theme: 'light' | 'dark' | 'auto'
    layout: string
    components: string[]
    panels: Array<{
      id: string
      title: string
      position: 'left' | 'right' | 'top' | 'bottom' | 'center'
      size: { width: number; height: number }
      visible: boolean
      collapsible: boolean
    }>
  }
  dataMapping: Record<string, {
    topic?: string
    path?: string[]
    transform?: (data: any) => any
  }>
}
