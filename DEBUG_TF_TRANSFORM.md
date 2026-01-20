# TF 变换矩阵调试分析

## 问题描述

根据提供的 TF 数据：
- `base_footprint` → `base_link`: translation z = 0.01
- `base_link` → `base_scan`: translation z = 0.122

期望结果：
- `base_scan` 的 Z 轴应该在 `base_footprint` 的 Z 轴上方
- 相对高度 = 0.01 + 0.122 = 0.132m

实际结果：
- `base_scan` 的 Z 轴显示在 `base_footprint` 的 Z 轴下方（反了）

## TF 数据

```yaml
base_footprint → base_link:
  translation: {x: 0.0, y: 0.0, z: 0.01}
  rotation: {x: 0.0, y: 0.0, z: 0.0, w: 1.0}

base_link → base_scan:
  translation: {x: -0.064, y: 0.0, z: 0.122}
  rotation: {x: 0.0, y: 0.0, z: 0.0, w: 1.0}
```

## 坐标转换

ROS 坐标系 → THREE.js 坐标系：
- ROS(x, y, z) → THREE.js(x, z, -y)

所以：
- `base_footprint` → `base_link`: ROS(0, 0, 0.01) → THREE.js(0, 0.01, 0)
- `base_link` → `base_scan`: ROS(-0.064, 0, 0.122) → THREE.js(-0.064, 0.122, 0)

## 矩阵累积分析

当前代码：
```typescript
resultMatrix = localMatrix.multiply(resultMatrix)
```

这表示：`resultMatrix = localMatrix * resultMatrix`

如果路径是 `base_scan → base_link → base_footprint`：
- path[0] = base_scan
- path[1] = base_link  
- path[2] = base_footprint

循环：
- i=0: from=base_scan, to=base_link
  - 需要 base_scan → base_link 的变换（但存储的是 base_link → base_scan）
  - 需要取逆！
- i=1: from=base_link, to=base_footprint
  - 需要 base_link → base_footprint 的变换（但存储的是 base_footprint → base_link）
  - 需要取逆！

## 问题根源

`getTransformMatrix(sourceFrame, targetFrame)` 计算的是从 sourceFrame 到 targetFrame 的变换矩阵。

但是：
1. TF 数据存储的是 parent → child 的变换
2. 路径是从 sourceFrame 到 targetFrame（可能向上或向下）
3. 矩阵累积方向可能错误

## 正确的逻辑

如果路径是 `base_scan → base_link → base_footprint`（向上查找）：
- 需要 base_scan → base_link 的变换（存储的是 base_link → base_scan，需要取逆）
- 需要 base_link → base_footprint 的变换（存储的是 base_footprint → base_link，需要取逆）

如果路径是 `base_footprint → base_link → base_scan`（向下查找）：
- 需要 base_footprint → base_link 的变换（直接使用）
- 需要 base_link → base_scan 的变换（直接使用）

## 修复方案

需要检查：
1. `getTransformPath` 返回的路径方向
2. 矩阵累积的顺序和方向
3. 是否需要取逆变换
