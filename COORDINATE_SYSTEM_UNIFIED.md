# 坐标系统一标准文档

## 概述

本次重构确保了所有组件（TF、Axes、Grid、LaserScan、PointCloud2）使用统一的坐标系转换标准，与 RViz 完全一致。

## 统一坐标系标准

### ROS (RViz) 坐标系
- **X 轴**：机器人正前方（红色 `0xff0000`）
- **Y 轴**：机器人左侧方（绿色 `0x00ff00`）
- **Z 轴**：垂直地面正上方（蓝色 `0x0000ff`）
- **XY平面**：水平面（地面，Z=0）

### THREE.js 坐标系
- **X 轴**：屏幕右侧方
- **Y 轴**：屏幕正上方（垂直向上）
- **Z 轴**：屏幕正前方（朝向自己）
- **XZ平面**：水平面（地面，Y=0）

### 统一转换公式

**所有组件必须使用此公式**：

```typescript
// ROS(x, y, z) → THREE.js(x, z, -y)
THREE.js X = ROS X
THREE.js Y = ROS Z
THREE.js Z = -ROS Y
```

**四元数转换**：

```typescript
// ROS(x, y, z, w) → THREE.js(x, z, -y, w)
THREE.js Qx = ROS Qx
THREE.js Qy = ROS Qz
THREE.js Qz = -ROS Qy
THREE.js Qw = ROS Qw
```

## 组件实现验证

### ✅ TF 坐标系 (`tfManager.ts`, `tfRenderer.ts`)
- **使用函数**：`convertROSTranslationToThree()`, `convertROSRotationToThree()`
- **状态**：已统一
- **说明**：所有 TF 变换矩阵计算使用统一的坐标转换

### ✅ Axes 组件 (`coordinateConverter.ts`, `use3DRenderer.ts`)
- **使用函数**：`createROSAxes()`
- **状态**：已统一
- **说明**：所有坐标轴创建使用统一的 `createROSAxes()` 函数

### ✅ Grid 组件 (`Rviz3DViewer.vue`)
- **使用函数**：`getROSGridRotation()`, `convertROSOffsetToThree()`
- **状态**：已统一
- **说明**：网格旋转和偏移使用统一的转换函数

### ✅ LaserScan (/scan) (`use3DRenderer.ts`)
- **使用函数**：`convertROSTranslationToThree()`
- **状态**：已统一
- **说明**：点云坐标转换使用统一的转换函数

### ✅ PointCloud2 (`use3DRenderer.ts`)
- **使用函数**：`convertROSTranslationToThree()`
- **状态**：已统一
- **说明**：点云坐标转换使用统一的转换函数

### ✅ Path (`use3DRenderer.ts`)
- **使用函数**：`convertROSTranslationToThree()`
- **状态**：已统一
- **说明**：路径点坐标转换使用统一的转换函数

## 核心文件

### `src/services/coordinateConverter.ts`
**职责**：提供统一的坐标系转换函数

**关键函数**：
- `convertROSTranslationToThree()` - ROS 平移坐标转换
- `convertROSRotationToThree()` - ROS 四元数转换
- `createROSAxes()` - 创建统一的 ROS 坐标轴
- `getROSGridRotation()` - 获取统一的网格旋转
- `convertROSOffsetToThree()` - ROS 偏移转换
- `convertThreeToROSTranslation()` - 反向转换（THREE.js → ROS）

## 重构要点

1. **统一坐标轴创建**：
   - 所有组件使用 `createROSAxes()` 创建坐标轴
   - 移除了 `use3DRenderer.ts` 中不一致的 `createFrameAxes()` 实现

2. **修复 TF 逆变换**：
   - 修复了 `tfManager.ts` 中逆变换计算的坐标系问题
   - 确保逆变换结果正确转换回 ROS 坐标系

3. **统一转换函数**：
   - 所有组件必须使用 `coordinateConverter.ts` 中的转换函数
   - 禁止直接进行坐标转换计算

## 验证清单

- [x] TF 坐标系使用统一转换
- [x] Axes 组件使用统一创建函数
- [x] Grid 组件使用统一旋转和偏移
- [x] LaserScan 使用统一转换
- [x] PointCloud2 使用统一转换
- [x] Path 使用统一转换
- [x] 所有组件位置一致
- [x] 所有组件方向一致
- [x] 与 RViz 显示效果一致

## 使用示例

```typescript
// ✅ 正确：使用统一转换函数
import { convertROSTranslationToThree, createROSAxes } from '@/services/coordinateConverter'

const threePosition = convertROSTranslationToThree({ x: 1, y: 2, z: 0 })
const axes = createROSAxes(1.0, 0.01)

// ❌ 错误：直接计算转换
const threePosition = new THREE.Vector3(rosX, rosZ, -rosY) // 不要这样做！
```

## 注意事项

1. **禁止直接转换**：所有坐标转换必须使用 `coordinateConverter.ts` 中的函数
2. **统一坐标轴**：所有坐标轴必须使用 `createROSAxes()` 创建
3. **一致性检查**：新增组件时必须使用统一的转换函数
4. **测试验证**：确保所有组件在场景中位置和方向一致

## 更新日期

2024-12-XX - 完成坐标系统一重构
