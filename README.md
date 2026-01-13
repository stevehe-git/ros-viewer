机器人可视化平台

基于 Vue3 + TypeScript 开发的通用机器人可视化平台，支持多种通信协议（ROS、MQTT、WebSocket等），可扩展实现不同机型可视化UI，类似 RViz 的功能，用于调试和监控各类机器人系统。
🎯 核心特性
✅ 已实现的核心功能
1. 多协议通信支持

    ✅ ROS1/ROS2 - 完整的 ROS 生态系统支持
    ✅ MQTT - 轻量级物联网通信协议
    ✅ WebSocket - 实时双向通信
    ✅ 可扩展架构 - 支持自定义协议扩展

2. 统一数据格式

    ✅ 标准化机器人数据模型
    ✅ 自动协议数据转换
    ✅ 类型安全的数据处理
    ✅ 实时数据流管理

3. 高性能UI系统

    ✅ 组件化设计 - 每个功能模块独立封装
    ✅ 业务逻辑分离 - UI显示与业务逻辑完全分离
    ✅ 单一职责原则 - 每个组件职责清晰
    ✅ 可复用架构 - 组件和函数高度可复用
    ✅ 低延迟渲染 - 优化性能和响应速度

4. 先进的可视化功能

    ✅ 2D地图渲染和交互
    ✅ 机器人位姿实时跟踪
    ✅ 路径规划可视化
    ✅ 传感器数据展示
    ✅ 多图层管理
    ✅ 实时状态监控

5. 完整的数据管理系统

    ✅ Pinia状态管理 - 集中式状态管理
    ✅ 通用数据结构 - 支持 ROS/Protobuf/JSON 数据格式
    ✅ 数据持久化 - 本地存储和导出功能
    ✅ 实时数据流 - 高性能数据处理管道

6. 路由和导航系统

    ✅ Vue Router - 完整的路由支持
    ✅ 多页面架构 - 仪表板、控制面板、数据分析等
    ✅ 导航控制 - 直观的页面导航

🏗️ 技术架构
前端框架

    Vue 3 - Composition API + Script Setup
    TypeScript - 完整的类型安全
    Vite - 快速构建工具
    Pinia - 现代化状态管理

通信协议栈

    ProtocolManager - 协议管理器
    ROSProtocol - ROS 通信实现
    MQTTProtocol - MQTT 通信实现
    WebSocketProtocol - WebSocket 通信实现
    DataTransformer - 数据转换器

UI 组件系统

    MainLayout - 主布局框架
    DashboardView - 仪表板页面
    ControlPanel - 控制面板组件
    MapViewer - 地图可视化器
    StatusPanel - 状态监控面板
    SensorPanel - 传感器数据显示

数据管理

    RobotStore - 机器人数据状态
    UIStore - UI 状态管理
    通用数据结构 - 标准化的数据模型

📦 安装和运行
前置要求

    Node.js >= 20
    ROS1 环境（可选，用于 ROS 通信）

安装依赖

npm install

开发模式

npm run dev

应用将在 http://localhost:5173 启动
构建生产版本

npm run build

🎨 使用指南
1. 启动应用

访问 http://localhost:5173 进入仪表板
2. 配置通信

    选择通信协议（ROS/MQTT/WebSocket）
    配置连接参数
    点击连接建立通信链路

3. 数据可视化

    地图查看 - 实时地图显示和交互
    机器人跟踪 - 位姿和轨迹可视化
    传感器数据 - 激光雷达等传感器数据显示
    状态监控 - 系统和机器人状态实时监控

4. 控制操作

    发送导航目标点
    控制机器人运动
    管理传感器订阅
    调整可视化参数

🔧 开发指南
架构原则

    组件封装 - 每个功能模块独立组件
    函数抽取 - 业务逻辑抽取为独立函数
    职责分离 - UI显示与业务逻辑分离
    单一职责 - 每个组件/函数职责清晰
    高性能 - 优化渲染和数据处理性能
    类型安全 - 完整的 TypeScript 类型支持

添加新协议

    实现 IProtocol 接口
    创建数据转换器
    在 ProtocolManager 中注册

添加新组件

    创建 Vue 组件文件
    在相应页面中导入使用
    遵循组件封装原则

数据流设计

    Store → 组件 → UI 显示
    数据处理 → 类型转换 → UI 渲染
    事件处理 → Store 更新 → 响应式更新
