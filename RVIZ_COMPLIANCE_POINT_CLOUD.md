# 按 RViz 标准实现：移除点云中心偏移功能

## 修改说明

根据用户要求，已完全按照 RViz 的实现方式，移除了点云中心偏移功能。现在点云位置严格按照 TF 变换后的位置显示，与 RViz 行为完全一致。

## 修改内容

### 1. 移除点云中心偏移代码

**文件：`src/composables/use3DRenderer.ts`**
- ✅ 移除了 4 处点云中心偏移代码（LaserScan 的 3 种样式 + PointCloud2）
- ✅ 移除了 `pointCloudCenterCalculator` 的 import
- ✅ 移除了所有 `enablePointCloudCentering` 相关的判断逻辑

**修改前**：
```typescript
// 应用从 scanFrame 到 fixedFrame 的变换
if (scanToFixedTransform) {
  pointsObject.applyMatrix4(scanToFixedTransform)
}

// 计算点云中心并调整点云位置
if (rvizStore.globalOptions.enablePointCloudCentering) {
  const center = pointCloudCenterCalculator.calculateLaserScanCenter(message, fixedFrame)
  // ... 偏移逻辑
}
```

**修改后**：
```typescript
// 应用从 scanFrame 到 fixedFrame 的变换
if (scanToFixedTransform) {
  pointsObject.applyMatrix4(scanToFixedTransform)
}

// 直接添加到场景，不进行点云中心偏移
laserscanGroup.add(pointsObject)
```

### 2. 移除配置选项

**文件：`src/stores/rviz.ts`**
- ✅ 从 `GlobalOptions` 接口中移除了 `enablePointCloudCentering` 字段
- ✅ 从 `globalOptions` 初始化中移除了该配置项

### 3. 移除 UI 配置

**文件：`src/components/panels/DisplayPanel.vue`**
- ✅ 移除了 "Point Cloud Centering" 复选框
- ✅ 移除了相关的说明文字

### 4. 简化 TF Renderer

**文件：`src/services/tfRenderer.ts`**
- ✅ 移除了 `pointCloudCenter` 和 `enablePointCloudCentering` 属性
- ✅ 移除了 `setPointCloudCenter()` 和 `setEnablePointCloudCentering()` 方法
- ✅ 移除了 `PointCloudCenter` 类型的 import
- ✅ 简化了 `updateAllFramePositions()` 方法，移除了点云居中相关的复杂逻辑

**修改前**：
```typescript
private updateAllFramePositions() {
  const isCenteringEnabled = this.enablePointCloudCentering && 
                             this.pointCloudCenter && 
                             this.pointCloudCenter.isValid
  
  // 复杂的点云居中逻辑...
}
```

**修改后**：
```typescript
private updateAllFramePositions() {
  this.frameObjects.forEach((frameObject, frameName) => {
    if (frameName === this.fixedFrame) {
      // fixed frame 位于原点
      frameObject.group.position.set(0, 0, 0)
      frameObject.group.quaternion.set(0, 0, 0, 1)
    } else {
      // 计算从 frameName 到 fixedFrame 的变换矩阵
      const transformMatrix = tfManager.getTransformMatrix(frameName, this.fixedFrame)
      // ... 应用变换
    }
  })
}
```

### 5. 更新文档

**文件：`SCAN_RENDERING_LOGIC_SUMMARY.md`**
- ✅ 更新了对比表格，说明已按 RViz 实现
- ✅ 移除了点云中心偏移相关的说明
- ✅ 更新了渲染流程，移除了点云中心偏移步骤

## 行为变化

### 修改前
- 当 `fixedFrame === 'map'` 时，会自动计算点云中心并偏移到原点
- 点云会"居中"显示，便于观察大范围地图

### 修改后（按 RViz 标准）
- ✅ **不执行点云中心偏移**：无论 `fixedFrame` 是什么值
- ✅ **点云位置严格按照 TF 变换后的位置显示**
- ✅ **与 RViz 行为完全一致**

## 优势

1. **与 RViz 完全一致**：行为与标准 RViz 实现保持一致
2. **代码更简洁**：移除了复杂的点云居中逻辑
3. **位置更准确**：点云位置准确反映机器人在地图中的实际位置
4. **维护性更好**：代码逻辑更简单，易于理解和维护

## 注意事项

- `pointCloudCenterCalculator.ts` 文件仍然保留在代码库中，但已不再使用
- 如果将来需要点云中心计算功能（用于其他用途），可以继续使用该服务
- 所有点云（LaserScan 和 PointCloud2）现在都按照相同的逻辑处理，不进行任何偏移

## 测试建议

1. **验证点云位置**：确认点云位置与 RViz 中显示的位置一致
2. **测试不同 fixedFrame**：切换不同的 `fixedFrame`，验证点云位置是否正确
3. **测试 TF 变换**：验证点云是否正确跟随 TF 变换更新位置
