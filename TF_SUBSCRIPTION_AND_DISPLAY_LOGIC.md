# TF 话题订阅与 Frame 显示逻辑

## 一、话题订阅机制

### 1.1 订阅流程

TF 的话题订阅由 `tfManager` 服务管理，**不通过统一的 `topicSubscriptionManager`**，而是直接使用 ROSLIB 订阅。

#### 初始化流程

```
1. ROS 连接建立
   ↓
2. tfManager.setROSInstance(ros) 被调用
   ↓
3. 检查 ROS 连接状态
   ↓
4. 如果已连接 → 立即订阅
   如果未连接 → 等待 'connection' 事件后订阅
   ↓
5. 同时订阅两个话题：
   - /tf (动态坐标变换)
   - /tf_static (静态坐标变换)
```

#### 订阅的话题

| 话题名称 | 消息类型 | 说明 |
|---------|---------|------|
| `/tf` | `tf2_msgs/TFMessage` | 动态坐标变换，会定期更新 |
| `/tf_static` | `tf2_msgs/TFMessage` | 静态坐标变换，只发布一次 |

### 1.2 消息处理

#### `/tf` 消息处理

```typescript
// 位置：tfManager.ts:182-244

this.tfTopic.subscribe((message: any) => {
  // 1. 更新订阅状态
  this.subscriptionStatus.value = {
    subscribed: true,
    hasData: true,
    messageCount: this.subscriptionStatus.value.messageCount + 1,
    lastMessageTime: now
  }
  
  // 2. 遍历所有 transforms
  message.transforms.forEach((transform: any) => {
    const frameId = transform.header.frame_id        // 父坐标系
    const childFrameId = transform.child_frame_id    // 子坐标系
    
    // 3. 添加到可用坐标系列表
    this.availableFrames.value.add(frameId)
    this.availableFrames.value.add(childFrameId)
    
    // 4. 存储变换数据
    // 结构：transforms[parentFrame][childFrame] = TransformFrame
    const transformData: TransformFrame = {
      name: childFrameId,
      parent: frameId,
      timestamp: ...,
      translation: { x, y, z },
      rotation: { x, y, z, w }
    }
    
    // 5. 更新 frames 列表和 TF 树结构
    this.updateFramesList()
    this.updateTFTree()
    
    // 6. 触发数据更新通知（节流，每100ms最多一次）
    this.triggerDataUpdateThrottled()
  })
})
```

#### `/tf_static` 消息处理

与 `/tf` 处理逻辑相同，但：
- 静态变换**不会过期**（没有超时检查）
- 通常只发布一次，用于定义固定的坐标系关系（如 `map` → `odom`）

### 1.3 订阅状态管理

```typescript
// 订阅状态结构
subscriptionStatus = {
  subscribed: boolean      // 是否已订阅
  hasData: boolean         // 是否收到过数据
  messageCount: number     // 消息计数
  lastMessageTime: number | null  // 最后消息时间
}

// 获取订阅状态
tfManager.getSubscriptionStatus()        // 获取当前值
tfManager.getSubscriptionStatusRef()    // 获取响应式引用
```

### 1.4 取消订阅

```typescript
// 位置：tfManager.ts:332-358

private unsubscribe() {
  // 1. 更新订阅状态
  this.subscriptionStatus.value = {
    subscribed: false,
    hasData: false,
    messageCount: 0,
    lastMessageTime: null
  }
  
  // 2. 取消订阅 /tf
  if (this.tfTopic) {
    this.tfTopic.unsubscribe()
    this.tfTopic = null
  }
  
  // 3. 取消订阅 /tf_static
  if (this.tfStaticTopic) {
    this.tfStaticTopic.unsubscribe()
    this.tfStaticTopic = null
  }
}
```

---

## 二、Frame 显示逻辑

### 2.1 显示流程概览

```
1. TF 组件启用
   ↓
2. updateTFRender(componentId) 被调用
   ↓
3. 获取组件配置（enabledFrames, showAxes, showNames 等）
   ↓
4. 从 tfManager 获取 TF 树和变换数据
   ↓
5. tfRenderer.buildFrameHierarchy() 构建 THREE.js 层级结构
   ↓
6. 确定需要显示的 frames（enabledFrames + 所有父节点）
   ↓
7. 配置每个 frame 的显示选项（axes, names, visibility）
   ↓
8. 隐藏未启用的 frames
```

### 2.2 启用 Frame 的确定

#### 方式一：从组件配置读取

```typescript
// 位置：use3DRenderer.ts:825-838

if (options.frames && Array.isArray(options.frames) && options.frames.length > 0) {
  // 如果配置了 frames 列表，只渲染启用的 frames
  options.frames.forEach((frame: any) => {
    if (frame.enabled) {
      enabledFrames.add(frame.name)
    }
  })
}
```

#### 方式二：默认渲染所有 Frame

```typescript
// 如果没有配置 frames 列表，默认渲染所有 frame
const allFrames = tfManager.getFrames()
allFrames.forEach(frameName => {
  enabledFrames.add(frameName)
})
```

### 2.3 父节点自动显示逻辑

**核心原则**：当任意 frame 被选中后，**立即显示**，不需要对应的父节点显示才显示。但为了保持 TF 树的完整性，**所有父节点也会自动显示**（但不显示 axes 和 names）。

```typescript
// 位置：use3DRenderer.ts:860-892

// 1. 创建显示列表，包含所有启用的 frames
const framesToShow = new Set<string>(enabledFrames)

// 2. 确保固定帧也在显示列表中（作为根节点）
framesToShow.add(fixedFrame)

// 3. 查找每个启用 frame 的所有父节点
const findParentPath = (frameName: string, visited: Set<string> = new Set()): string[] => {
  if (visited.has(frameName)) return [] // 避免循环
  visited.add(frameName)
  
  const path: string[] = []
  // 从 transforms 中查找 frameName 的父节点
  for (const [parentName, children] of transforms.entries()) {
    if (children.has(frameName)) {
      path.push(parentName)
      // 递归查找父节点的父节点
      const parentPath = findParentPath(parentName, visited)
      path.push(...parentPath)
      break
    }
  }
  return path
}

// 4. 为每个启用的 frame 添加其所有父节点到显示列表
enabledFrames.forEach(frameName => {
  const parentPath = findParentPath(frameName)
  parentPath.forEach(parentName => {
    framesToShow.add(parentName)
  })
})
```

**示例**：
- 如果启用了 `base_footprint`，且其父节点链为：`map` → `odom` → `base_link` → `base_footprint`
- 则 `framesToShow` 将包含：`{ base_footprint, base_link, odom, map }`

### 2.4 Frame 显示配置

```typescript
// 位置：use3DRenderer.ts:894-911

framesToShow.forEach(frameName => {
  const frameObject = tfRenderer!.getFrame(frameName)
  if (frameObject) {
    // 判断是否是启用的 frame（而非仅作为父节点显示）
    const isEnabled = enabledFrames.has(frameName)
    
    // 配置显示选项
    tfRenderer!.configureFrame(frameName, {
      showAxes: isEnabled ? showAxes : false,      // 只有启用的 frame 显示 axes
      showNames: isEnabled ? showNames : false,    // 只有启用的 frame 显示 names
      markerScale,
      markerAlpha
    })
    
    // 设置可见性
    tfRenderer!.setFrameVisibility(frameName, true)
  }
})
```

**显示规则**：
- **启用的 frame**：显示 axes、names、完整配置
- **父节点（未启用）**：只显示基本结构（Group），不显示 axes 和 names

### 2.5 隐藏未启用的 Frames

```typescript
// 位置：use3DRenderer.ts:913-918

// 隐藏未启用且不在显示列表中的 frames
tfRenderer.getAllFrameNames().forEach(frameName => {
  if (!framesToShow.has(frameName)) {
    tfRenderer!.setFrameVisibility(frameName, false)
  }
})
```

### 2.6 TF 树构建

```typescript
// 位置：tfRenderer.ts:75-190

buildFrameHierarchy(
  tfTree: Array<{ name: string; parent: string | null; children: any[] }>,
  transforms: Map<string, Map<string, TransformFrame>>
) {
  // 1. 递归创建或更新 frame 对象
  const createOrUpdateFrameObject = (node, parentGroup) => {
    // 创建 THREE.Group
    const frameGroup = new THREE.Group()
    frameGroup.name = `TF_${node.name}`
    
    // 2. 建立父子关系（核心！严格还原 ROS TF 树的层级结构）
    if (parentGroup) {
      parentGroup.add(frameGroup)  // 子节点添加到父节点
    } else {
      this.rootGroup.add(frameGroup)  // 根节点添加到 rootGroup
    }
    
    // 3. 应用 TF 变换数据（使用正确的坐标转换公式）
    if (node.parent && transforms.has(node.parent)) {
      const transform = transforms.get(node.parent)!.get(node.name)
      if (transform) {
        // ROS(x, y, z) → THREE.js(x, z, -y)
        this.applyTransform(frameGroup, transform)
      }
    }
    
    // 4. 递归处理子节点
    node.children.forEach(child => {
      createOrUpdateFrameObject(child, frameGroup)
    })
  }
  
  // 5. 从固定帧开始构建
  const rootNode = findRootNode()  // 找到固定帧作为根节点
  if (rootNode) {
    createOrUpdateFrameObject(rootNode, null)
  }
}
```

### 2.7 坐标转换

**核心公式**：`ROS(x, y, z) → THREE.js(x, z, -y)`

```typescript
// 位置：tfRenderer.ts:202-212

private applyTransform(group: THREE.Group, transform: TransformFrame) {
  // ✅ 平移坐标转换：ROS(x, y, z) → THREE.js(x, z, -y)
  const position = convertROSTranslationToThree(transform.translation)
  group.position.copy(position)

  // ✅ 四元数直接赋值：分量一一对应，无需修改
  const quaternion = convertROSRotationToThree(transform.rotation)
  group.quaternion.copy(quaternion)
}
```

---

## 三、数据流图

```
┌─────────────────────────────────────────────────────────────┐
│                    ROS 系统                                  │
│  ┌──────────┐         ┌──────────────┐                     │
│  │  /tf     │─────────▶│ tf2_msgs/    │                     │
│  │          │         │ TFMessage    │                     │
│  └──────────┘         └──────────────┘                     │
│  ┌──────────────┐     ┌──────────────┐                     │
│  │ /tf_static  │─────▶│ tf2_msgs/    │                     │
│  │             │     │ TFMessage    │                     │
│  └──────────────┘     └──────────────┘                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              tfManager (订阅管理)                            │
│  ┌──────────────────────────────────────────┐               │
│  │  subscribe()                            │               │
│  │  - 订阅 /tf                              │               │
│  │  - 订阅 /tf_static                       │               │
│  └──────────────────────────────────────────┘               │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────┐               │
│  │  消息处理                                │               │
│  │  - 提取 frame_id, child_frame_id        │               │
│  │  - 提取 translation, rotation            │               │
│  │  - 存储到 transforms Map                  │               │
│  │  - 更新 availableFrames                  │               │
│  │  - 更新 tfTree                           │               │
│  └──────────────────────────────────────────┘               │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────┐               │
│  │  数据存储                                │               │
│  │  - transforms: Map<parent, Map<child>>  │               │
│  │  - tfTree: TFTreeNode[]                 │               │
│  │  - frames: string[]                     │               │
│  │  - subscriptionStatus                   │               │
│  └──────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│         use3DRenderer.updateTFRender()                     │
│  ┌──────────────────────────────────────────┐               │
│  │  1. 获取组件配置                          │               │
│  │     - enabledFrames                      │               │
│  │     - showAxes, showNames                │               │
│  └──────────────────────────────────────────┘               │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────┐               │
│  │  2. 从 tfManager 获取数据                 │               │
│  │     - transforms = tfManager.getTransforms()│            │
│  │     - tfTree = tfManager.getTFTree()      │               │
│  └──────────────────────────────────────────┘               │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────┐               │
│  │  3. tfRenderer.buildFrameHierarchy()     │               │
│  │     - 创建 THREE.Group 层级结构          │               │
│  │     - 应用坐标转换                       │               │
│  └──────────────────────────────────────────┘               │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────┐               │
│  │  4. 确定显示列表                         │               │
│  │     - enabledFrames                     │               │
│  │     + 所有父节点                         │               │
│  │     + fixedFrame                        │               │
│  └──────────────────────────────────────────┘               │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────┐               │
│  │  5. 配置显示选项                         │               │
│  │     - 启用的 frame: showAxes, showNames │               │
│  │     - 父节点: 仅显示结构                 │               │
│  └──────────────────────────────────────────┘               │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────┐               │
│  │  6. 设置可见性                           │               │
│  │     - framesToShow: visible = true      │               │
│  │     - 其他: visible = false             │               │
│  └──────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              THREE.js 场景渲染                                │
│  ┌──────────────────────────────────────────┐               │
│  │  tfRenderer.rootGroup                    │               │
│  │  ├── TF_map (Group)                      │               │
│  │  │   ├── Axes_map (Group)                │               │
│  │  │   └── Label_map (Sprite)              │               │
│  │  └── TF_odom (Group)                     │               │
│  │      └── TF_base_link (Group)            │               │
│  │          └── TF_base_footprint (Group)   │               │
│  │              ├── Axes_base_footprint      │               │
│  │              └── Label_base_footprint    │               │
│  └──────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、关键点总结

### 4.1 话题订阅

1. **独立订阅**：TF 不通过 `topicSubscriptionManager`，而是直接使用 ROSLIB 订阅
2. **双话题订阅**：同时订阅 `/tf` 和 `/tf_static`
3. **自动订阅**：ROS 连接建立后自动订阅，无需手动触发
4. **状态追踪**：`subscriptionStatus` 实时反映订阅状态和数据接收情况

### 4.2 Frame 显示

1. **立即显示**：任意 frame 选中后立即显示，不依赖父节点
2. **父节点自动显示**：所有父节点自动显示，但只显示结构（不显示 axes/names）
3. **固定帧保证**：固定帧（fixedFrame）始终在显示列表中
4. **层级结构**：使用 THREE.Group 严格还原 ROS TF 树的层级关系
5. **坐标转换**：使用 `ROS(x, y, z) → THREE.js(x, z, -y)` 公式

### 4.3 数据更新

1. **节流更新**：数据更新通知每 100ms 最多触发一次
2. **实时更新**：收到新 TF 数据后立即更新树结构和变换
3. **响应式**：使用 Vue 的 `ref` 实现响应式数据追踪

---

## 五、相关文件

- **话题订阅**：`src/services/tfManager.ts`
- **渲染逻辑**：`src/services/tfRenderer.ts`
- **显示控制**：`src/composables/use3DRenderer.ts` (updateTFRender)
- **坐标转换**：`src/services/coordinateConverter.ts`
- **组件状态**：`src/components/panels/DisplayComponent.vue`
