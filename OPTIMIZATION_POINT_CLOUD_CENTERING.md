# 点云居中功能优化：移除硬编码 fixedFrame 判断

## 问题描述

原代码中存在多处硬编码 `if (fixedFrame === 'map')` 的判断，导致：
- **工程复用性差**：当 `fixedFrame` 动态变化时，代码逻辑失效
- **可维护性差**：硬编码的字符串判断难以扩展和维护
- **灵活性不足**：无法根据实际需求灵活控制点云居中行为

## 优化方案

### 1. 添加配置选项

在 `GlobalOptions` 接口中添加 `enablePointCloudCentering` 配置项：

```typescript
export interface GlobalOptions {
  fixedFrame: string
  backgroundColor: string
  frameRate: number
  defaultLight: boolean
  enablePointCloudCentering: boolean // 新增：是否启用点云中心偏移
}
```

### 2. 移除硬编码判断

将所有 `if (fixedFrame === 'map')` 替换为 `if (rvizStore.globalOptions.enablePointCloudCentering)`：

**修改前**：
```typescript
if (fixedFrame === 'map') {
  const center = pointCloudCenterCalculator.calculateLaserScanCenter(message, fixedFrame)
  // ... 点云居中逻辑
}
```

**修改后**：
```typescript
if (rvizStore.globalOptions.enablePointCloudCentering) {
  const center = pointCloudCenterCalculator.calculateLaserScanCenter(message, fixedFrame)
  // ... 点云居中逻辑
}
```

### 3. 更新 UI 配置面板

在 `DisplayPanel.vue` 中添加点云居中配置选项，用户可以通过 UI 控制是否启用点云居中。

## 修改文件清单

1. **src/stores/rviz.ts**
   - 添加 `enablePointCloudCentering` 到 `GlobalOptions` 接口
   - 设置默认值为 `false`（保持向后兼容）

2. **src/composables/use3DRenderer.ts**
   - 移除 4 处 `if (fixedFrame === 'map')` 硬编码判断
   - 替换为 `if (rvizStore.globalOptions.enablePointCloudCentering)`

3. **src/services/tfRenderer.ts**
   - 移除 `updateAllFramePositions()` 中的 `this.fixedFrame === 'map'` 判断
   - 更新注释说明，移除对 'map' 的特殊说明

4. **src/components/panels/DisplayPanel.vue**
   - 在 Global Options 中添加 "Point Cloud Centering" 复选框
   - 添加说明文字："将点云中心移动到原点，便于观察大范围点云"

## 优势

### ✅ 提高复用性
- 不再依赖 `fixedFrame` 的具体值
- 适用于任何坐标系（map、odom、base_link 等）

### ✅ 提高灵活性
- 用户可以根据需要动态开启/关闭点云居中
- 不限制于特定的坐标系

### ✅ 提高可维护性
- 配置集中管理，易于理解和修改
- 移除硬编码字符串，降低维护成本

### ✅ 向后兼容
- 默认值为 `false`，保持原有行为
- 不影响现有代码和用户习惯

## 使用说明

### 启用点云居中

1. 打开 Display Panel
2. 展开 "Global Options"
3. 勾选 "Point Cloud Centering" 复选框
4. 点云中心将自动移动到原点，便于观察大范围点云

### 适用场景

- ✅ **大范围地图点云**：当地图范围很大时，启用点云居中可以更好地观察点云细节
- ✅ **动态坐标系**：当 `fixedFrame` 动态变化时，仍然可以控制点云居中行为
- ✅ **多坐标系切换**：在不同坐标系之间切换时，可以灵活控制是否启用点云居中

## 技术细节

### 点云居中逻辑

1. **计算点云中心**：在 `fixedFrame` 坐标系下计算点云的中心位置
2. **应用偏移**：将点云对象的位置设置为 `-center`，使点云中心移动到原点
3. **通知 TF Renderer**：更新 TF 渲染器，确保坐标系可视化与点云位置一致

### 坐标系处理

- 点云居中计算始终在 `fixedFrame` 坐标系下进行
- 无论 `fixedFrame` 是什么值，都能正确计算和应用偏移
- TF 变换逻辑保持不变，确保坐标系关系正确

## 测试建议

1. **基本功能测试**
   - 启用点云居中，验证点云中心是否移动到原点
   - 禁用点云居中，验证点云位置是否恢复正常

2. **坐标系切换测试**
   - 切换 `fixedFrame` 到不同坐标系（map、odom、base_link）
   - 验证点云居中功能在不同坐标系下是否正常工作

3. **动态切换测试**
   - 在运行时动态切换 `fixedFrame`
   - 验证点云居中配置是否仍然有效

4. **向后兼容测试**
   - 验证默认配置（`enablePointCloudCentering: false`）是否保持原有行为
   - 验证现有代码是否正常工作
