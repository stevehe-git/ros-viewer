# TF 变换矩阵修复文档

## 问题描述

在 RViz 中，`base_footprint` frame 的 Z 轴高度应该比 `base_scan` frame 的 Z 轴高度低，但当前项目显示是反的。

### TF 数据

```yaml
base_footprint → base_link:
  translation: {x: 0.0, y: 0.0, z: 0.01}
  rotation: {x: 0.0, y: 0.0, z: 0.0, w: 1.0}

base_link → base_scan:
  translation: {x: -0.064, y: 0.0, z: 0.122}
  rotation: {x: 0.0, y: 0.0, z: 0.0, w: 1.0}
```

### 期望结果

- `base_scan` 在 `base_footprint` 中的位置应该是：
  - ROS: {x: -0.064, y: 0.0, z: 0.132} (0.01 + 0.122)
  - THREE.js: {x: -0.064, y: 0.132, z: 0} (ROS z → THREE.js y)
- `base_scan` 的 Z 轴（蓝色线）应该在 `base_footprint` 的 Z 轴（蓝色线）上方 0.132m

## 问题根源

### 原始实现的问题

1. **矩阵累积方向错误**：
   - 原始代码使用 `resultMatrix = localMatrix.multiply(resultMatrix)`
   - 这导致矩阵累积方向不正确

2. **路径遍历方向错误**：
   - 原始代码从 sourceFrame 向前遍历到 targetFrame
   - 但 TF 数据存储的是 parent → child 的变换
   - 需要从 targetFrame 反向遍历到 sourceFrame 来累积位置

3. **逆变换计算复杂**：
   - 原始代码在 THREE.js 坐标系中计算逆变换，然后转换回 ROS
   - 这可能导致精度损失和错误

## 修复方案

### 核心思路

TF 数据存储的是 **parent → child** 的变换，表示 **child 在 parent 中的位置**。

要计算 `sourceFrame` 在 `targetFrame` 中的位置，需要：
1. 从 `targetFrame` 向下到 `sourceFrame` 反向遍历路径
2. 累积每个 child 在 parent 中的位置
3. 将每个位置转换到 `targetFrame` 坐标系中

### 修复后的逻辑

```typescript
// 路径：base_scan → base_link → base_footprint
// 反向遍历：从 base_footprint 向下到 base_scan

// i=1: parent=base_footprint, child=base_link
//   - base_link 在 base_footprint 中的位置: {x:0, y:0, z:0.01}
//   - 转换为 THREE.js: {x:0, y:0.01, z:0}
//   - accumulatedPosition = {x:0, y:0.01, z:0}

// i=0: parent=base_link, child=base_scan
//   - base_scan 在 base_link 中的位置: {x:-0.064, y:0, z:0.122}
//   - 转换为 THREE.js: {x:-0.064, y:0.122, z:0}
//   - 转换到 base_footprint 坐标系: {x:-0.064, y:0.122, z:0} (无旋转)
//   - accumulatedPosition += {x:-0.064, y:0.122, z:0}
//   - 最终: {x:-0.064, y:0.132, z:0} ✅
```

### 关键修改

1. **反向遍历路径**：
   ```typescript
   for (let i = path.length - 1; i > 0; i--) {
     const parent = path[i]      // 更接近 targetFrame
     const child = path[i - 1]   // 更接近 sourceFrame
   }
   ```

2. **直接累积位置**：
   ```typescript
   // 将每个 child 在 parent 中的位置转换到 targetFrame 坐标系
   const rotatedPosition = position.clone().applyQuaternion(accumulatedQuaternion)
   accumulatedPosition.add(rotatedPosition)
   ```

3. **正确的旋转累积**：
   ```typescript
   // 先应用新的旋转，再应用累积的旋转
   accumulatedQuaternion.premultiply(quaternion)
   ```

## 验证结果

测试显示修复后的位置计算正确：
- 计算得到：{x: -0.064, y: 0.132, z: 0}
- 期望结果：{x: -0.064, y: 0.132, z: 0}
- ✅ 完全匹配

## 修改的文件

- `src/services/tfManager.ts`
  - 修复 `getTransformMatrix` 方法的矩阵累积逻辑
  - 改为反向遍历路径并直接累积位置
  - 修复旋转累积的顺序

## 更新日期

2024-12-XX - 修复 TF 变换矩阵计算，确保 frame 高度关系正确
