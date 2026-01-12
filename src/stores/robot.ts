import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import type {
  RobotState,
  SensorData,
  Task,
  OccupancyGrid,
  LaserScan,
  Odometry,
  Path,
  PoseStamped,
  DataPacket,
  PerformanceMetrics,
  RobotType
} from '../types/data'

/**
 * 机器人数据管理 Store
 * 使用 Pinia 进行集中式状态管理
 */
export const useRobotStore = defineStore('robot', () => {
  // 状态数据
  const robots = ref<Map<string, RobotState>>(new Map())
  const sensors = ref<Map<string, SensorData>>(new Map())
  const tasks = ref<Map<string, Task>>(new Map())

  // 地图数据
  const maps = ref<Map<string, OccupancyGrid>>(new Map())
  const currentMapId = ref<string>('')

  // 路径数据
  const paths = ref<Map<string, Path>>(new Map())

  // 传感器数据
  const laserScans = ref<Map<string, LaserScan>>(new Map())
  const odometry = ref<Map<string, Odometry>>(new Map())

  // 目标点
  const goals = ref<Map<string, PoseStamped>>(new Map())

  // 数据包历史
  const dataPackets = ref<DataPacket[]>([])
  const maxPacketHistory = 1000

  // 性能指标
  const performanceMetrics = reactive<PerformanceMetrics>({
    fps: 60,
    memoryUsage: 0,
    dataThroughput: 0,
    latency: 0
  })

  // 机器人类型配置
  const robotTypes = ref<Map<string, RobotType>>(new Map())

  // 计算属性
  const connectedRobots = computed(() =>
    Array.from(robots.value.values()).filter(robot => robot.status === 'online')
  )

  const activeTasks = computed(() =>
    Array.from(tasks.value.values()).filter(task => task.status === 'active')
  )

  const currentMap = computed(() => {
    return currentMapId.value ? maps.value.get(currentMapId.value) : undefined
  })

  const currentRobot = computed(() => {
    // 返回第一个在线机器人，或者第一个机器人
    const onlineRobots = connectedRobots.value
    return onlineRobots.length > 0 ? onlineRobots[0] : Array.from(robots.value.values())[0]
  })

  const systemStatus = computed(() => {
    const hasErrors = Array.from(robots.value.values()).some(robot => robot.status === 'error')
    const hasOffline = Array.from(robots.value.values()).some(robot => robot.status === 'offline')

    if (hasErrors) return 'error'
    if (hasOffline) return 'warning'
    if (robots.value.size > 0) return 'normal'
    return 'idle'
  })

  const dataFreshness = computed(() => {
    const now = Date.now()
    const lastUpdate = Math.max(
      ...Array.from(robots.value.values()).map(robot => robot.last_update),
      ...Array.from(sensors.value.values()).map(sensor => sensor.timestamp),
      0
    )

    const timeDiff = now - lastUpdate
    if (timeDiff < 1000) return 'fresh'
    if (timeDiff < 5000) return 'normal'
    return 'stale'
  })

  // 动作方法
  function addRobot(robot: RobotState) {
    robots.value.set(robot.id, robot)
  }

  function updateRobot(robotId: string, updates: Partial<RobotState>) {
    const robot = robots.value.get(robotId)
    if (robot) {
      Object.assign(robot, updates)
    }
  }

  function removeRobot(robotId: string) {
    robots.value.delete(robotId)
  }

  function addSensor(sensor: SensorData) {
    sensors.value.set(sensor.id, sensor)
  }

  function updateSensor(sensorId: string, updates: Partial<SensorData>) {
    const sensor = sensors.value.get(sensorId)
    if (sensor) {
      Object.assign(sensor, updates)
    }
  }

  function addTask(task: Task) {
    tasks.value.set(task.id, task)
  }

  function updateTask(taskId: string, updates: Partial<Task>) {
    const task = tasks.value.get(taskId)
    if (task) {
      Object.assign(task, updates)
    }
  }

  function removeTask(taskId: string) {
    tasks.value.delete(taskId)
  }

  function setMap(mapId: string, map: OccupancyGrid) {
    maps.value.set(mapId, map)
    if (!currentMapId.value) {
      currentMapId.value = mapId
    }
  }

  function setCurrentMap(mapId: string) {
    if (maps.value.has(mapId)) {
      currentMapId.value = mapId
    }
  }

  function addPath(pathId: string, path: Path) {
    paths.value.set(pathId, path)
  }

  function addLaserScan(scanId: string, scan: LaserScan) {
    laserScans.value.set(scanId, scan)
  }

  function addOdometry(odomId: string, odom: Odometry) {
    odometry.value.set(odomId, odom)
  }

  function addGoal(goalId: string, goal: PoseStamped) {
    goals.value.set(goalId, goal)
  }

  function addDataPacket(packet: DataPacket) {
    dataPackets.value.push(packet)
    if (dataPackets.value.length > maxPacketHistory) {
      dataPackets.value.shift()
    }
  }

  function clearDataPackets() {
    dataPackets.value = []
  }

  function updatePerformanceMetrics(metrics: Partial<PerformanceMetrics>) {
    Object.assign(performanceMetrics, metrics)
  }

  function registerRobotType(robotType: RobotType) {
    robotTypes.value.set(robotType.id, robotType)
  }

  function getRobotType(typeId: string): RobotType | undefined {
    return robotTypes.value.get(typeId)
  }

  function getAllRobotTypes(): RobotType[] {
    return Array.from(robotTypes.value.values())
  }

  // 数据处理方法
  function processDataPacket(packet: DataPacket) {
    addDataPacket(packet)

    // 根据数据类型分发到相应的处理器
    switch (packet.type) {
      case 'nav_msgs/Odometry':
        handleOdometryData(packet)
        break
      case 'nav_msgs/OccupancyGrid':
        handleMapData(packet)
        break
      case 'sensor_msgs/LaserScan':
        handleLaserScanData(packet)
        break
      case 'nav_msgs/Path':
        handlePathData(packet)
        break
      case 'geometry_msgs/PoseStamped':
        handleGoalData(packet)
        break
      default:
        handleGenericData(packet)
    }
  }

  function handleOdometryData(packet: DataPacket) {
    const odom = packet.data as Odometry
    const robotId = packet.topic.split('/')[1] || 'robot'

    addOdometry(`${robotId}_odom`, odom)

    // 更新机器人状态
    const robot: RobotState = {
      id: robotId,
      name: `Robot ${robotId}`,
      type: 'turtlebot',
      pose: odom.pose.pose,
      velocity: odom.twist.twist,
      status: 'online',
      last_update: packet.timestamp
    }

    addRobot(robot)
  }

  function handleMapData(packet: DataPacket) {
    const map = packet.data as OccupancyGrid
    const mapId = packet.topic.split('/').pop() || 'map'

    setMap(mapId, map)
  }

  function handleLaserScanData(packet: DataPacket) {
    const scan = packet.data as LaserScan
    const robotId = packet.topic.split('/')[1] || 'robot'

    addLaserScan(`${robotId}_laser`, scan)

    // 更新传感器数据
    const sensor: SensorData = {
      id: `${robotId}_laser`,
      type: 'laser',
      timestamp: packet.timestamp,
      data: scan
    }

    addSensor(sensor)
  }

  function handlePathData(packet: DataPacket) {
    const path = packet.data as Path
    const pathId = packet.topic.split('/').pop() || 'path'

    addPath(pathId, path)
  }

  function handleGoalData(packet: DataPacket) {
    const goal = packet.data as PoseStamped
    const goalId = packet.topic.split('/').pop() || 'goal'

    addGoal(goalId, goal)
  }

  function handleGenericData(packet: DataPacket) {
    // 处理其他类型的数据
    const sensor: SensorData = {
      id: packet.topic,
      type: 'laser',
      timestamp: packet.timestamp,
      data: packet.data
    }

    addSensor(sensor)
  }

  // 清理方法
  function clearAllData() {
    robots.value.clear()
    sensors.value.clear()
    tasks.value.clear()
    maps.value.clear()
    paths.value.clear()
    laserScans.value.clear()
    odometry.value.clear()
    goals.value.clear()
    dataPackets.value = []
    currentMapId.value = ''
  }

  // 导出数据
  function exportData() {
    return {
      robots: Array.from(robots.value.values()),
      sensors: Array.from(sensors.value.values()),
      tasks: Array.from(tasks.value.values()),
      maps: Array.from(maps.value.values()),
      paths: Array.from(paths.value.values()),
      laserScans: Array.from(laserScans.value.values()),
      odometry: Array.from(odometry.value.values()),
      goals: Array.from(goals.value.values()),
      timestamp: Date.now()
    }
  }

  // 导入数据
  function importData(data: any) {
    if (data.robots) {
      data.robots.forEach((robot: RobotState) => addRobot(robot))
    }
    if (data.sensors) {
      data.sensors.forEach((sensor: SensorData) => addSensor(sensor))
    }
    if (data.tasks) {
      data.tasks.forEach((task: Task) => addTask(task))
    }
    if (data.maps) {
      data.maps.forEach((map: OccupancyGrid) => setMap(map.header.frame_id, map))
    }
  }

  return {
    // 状态
    robots,
    sensors,
    tasks,
    maps,
    currentMapId,
    paths,
    laserScans,
    odometry,
    goals,
    dataPackets,
    performanceMetrics,
    robotTypes,

    // 计算属性
    connectedRobots,
    activeTasks,
    currentMap,
    currentRobot,
    systemStatus,
    dataFreshness,

    // 方法
    addRobot,
    updateRobot,
    removeRobot,
    addSensor,
    updateSensor,
    addTask,
    updateTask,
    removeTask,
    setMap,
    setCurrentMap,
    addPath,
    addLaserScan,
    addOdometry,
    addGoal,
    addDataPacket,
    clearDataPackets,
    updatePerformanceMetrics,
    registerRobotType,
    getRobotType,
    getAllRobotTypes,
    processDataPacket,
    clearAllData,
    exportData,
    importData
  }
})
