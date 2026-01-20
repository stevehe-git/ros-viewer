/**
 * TF 坐标系渲染服务
 * 
 * 核心原理：
 * 1. ROS 和 THREE.js 使用不同的坐标系定义，必须做坐标映射转换
 * 2. ROS TF 树是层级结构，必须用 THREE.Group 建立父子关系严格还原
 * 3. 坐标转换公式：ROS(x, y, z) → THREE.js(x, z, -y)
 * 4. 四元数直接赋值，无需修改
 * 
 * 设计原则：
 * - 逻辑拆分：坐标转换、TF树构建、渲染分离
 * - 层级还原：严格使用 Group 父子关系还原 ROS TF 树
 * - 本地坐标：所有坐标都是相对父坐标系的本地坐标
 */

import * as THREE from 'three'
import { convertROSTranslationToThree, convertROSRotationToThree, createROSAxes } from './coordinateConverter'
import type { TransformFrame } from './tfManager'

/**
 * TF Frame 的 THREE.js 表示
 */
export interface TFFrameObject {
  group: THREE.Group
  name: string
  parent: string | null
  children: TFFrameObject[]
  axes?: THREE.Group  // 坐标轴可视化
  label?: THREE.Sprite  // 名称标签
}

/**
 * TF 渲染器类
 * 负责将 ROS TF 数据转换为 THREE.js 场景对象
 */
export class TFRenderer {
  private scene: THREE.Scene
  public rootGroup: THREE.Group  // 公开，供外部访问
  private frameObjects = new Map<string, TFFrameObject>()
  private fixedFrame: string = 'map'

  constructor(scene: THREE.Scene) {
    this.scene = scene
    // 创建根组，所有 TF frame 都添加到这个组下
    this.rootGroup = new THREE.Group()
    this.rootGroup.name = 'TF_Root'
    this.scene.add(this.rootGroup)
  }

  /**
   * 设置固定帧（Fixed Frame）
   * 固定帧作为根节点，所有其他 frame 都相对于它
   */
  setFixedFrame(frameName: string) {
    this.fixedFrame = frameName
  }

  /**
   * 根据 TF 树结构创建 THREE.js Group 层级
   * 
   * 核心逻辑（基于用户提供的核心结论）：
   * 1. 遍历 TF 树，为每个 frame 创建 Group
   * 2. 建立父子关系，严格还原 ROS TF 树的层级结构
   * 3. 所有坐标都是本地坐标（相对父坐标系），使用正确的转换公式
   * 4. 坐标转换：ROS(x, y, z) → THREE.js(x, z, -y)
   * 5. 四元数直接赋值，无需修改
   * 
   * 关键点：
   * - 使用 THREE.Group 建立父子关系，子对象的坐标永远是相对父对象的本地坐标
   * - 和 ROS 的 TF 逻辑完全一致，这是最优解，无任何替代方案
   * 
   * @param tfTree TF 树结构
   * @param transforms TF 变换数据
   */
  buildFrameHierarchy(
    tfTree: Array<{ name: string; parent: string | null; children: any[] }>,
    transforms: Map<string, Map<string, TransformFrame>>
  ) {
    // 如果 frame 对象已存在，只更新变换，不重建树结构
    const hasExistingFrames = this.frameObjects.size > 0
    
    if (!hasExistingFrames) {
      // 首次构建：清理旧的 frame 对象
      this.clearAllFrames()
    }

    // 递归创建或更新 frame 对象
    const createOrUpdateFrameObject = (
      node: { name: string; parent: string | null; children: any[] },
      parentGroup: THREE.Group | null
    ): TFFrameObject => {
      let frameObject = this.frameObjects.get(node.name)
      
      if (!frameObject) {
        // 创建新的 frame 的 Group
        const frameGroup = new THREE.Group()
        frameGroup.name = `TF_${node.name}`

        // 创建 frame 对象
        frameObject = {
          group: frameGroup,
          name: node.name,
          parent: node.parent,
          children: []
        }

        // ✅ 建立父子关系（核心！严格还原 ROS TF 树的层级结构）
        if (parentGroup) {
          // 子节点添加到父节点的 Group 中
          parentGroup.add(frameGroup)
        } else {
          // 根节点（固定帧）添加到 rootGroup
          this.rootGroup.add(frameGroup)
        }

        // 存储 frame 对象
        this.frameObjects.set(node.name, frameObject)
      }

      // ✅ 应用 TF 变换数据（如果是子节点）
      // 这是本地坐标，相对于父坐标系
      // 每次更新时都重新应用，确保使用最新的 TF 数据
      if (node.parent && transforms.has(node.parent)) {
        const parentTransforms = transforms.get(node.parent)!
        const transform = parentTransforms.get(node.name)
        if (transform && transform.translation && transform.rotation) {
          // 使用正确的坐标转换公式：ROS(x, y, z) → THREE.js(x, z, -y)
          this.applyTransform(frameObject.group, transform)
        }
      } else if (!node.parent) {
        // 根节点（固定帧）的位置和旋转都是单位变换
        frameObject.group.position.set(0, 0, 0)
        frameObject.group.quaternion.set(0, 0, 0, 1)
      }

      // 递归处理子节点
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          const childFrame = createOrUpdateFrameObject(child, frameObject!.group)
          // 如果子节点不在 children 列表中，添加它
          if (!frameObject!.children.find(c => c.name === child.name)) {
            frameObject!.children.push(childFrame)
          }
        })
      }

      return frameObject
    }

    // 从根节点开始构建
    // 找到固定帧作为根节点
    const findRootNode = (): { name: string; parent: string | null; children: any[] } | null => {
      // 首先尝试找到固定帧作为根节点
      for (const rootNode of tfTree) {
        if (rootNode.name === this.fixedFrame) {
          return rootNode
        }
        // 递归查找固定帧
        const findInTree = (node: any): any => {
          if (node.name === this.fixedFrame) {
            return node
          }
          for (const child of node.children || []) {
            const found = findInTree(child)
            if (found) return found
          }
          return null
        }
        const fixedFrameNode = findInTree(rootNode)
        if (fixedFrameNode !== null) {
          // 重新构建以固定帧为根
          const rebuildTree = (node: any, parent: string | null): any => {
            return {
              name: node.name,
              parent: parent,
              children: (node.children || []).map((child: any) => rebuildTree(child, node.name))
            }
          }
          return rebuildTree(fixedFrameNode, null)
        }
      }
      // 如果找不到固定帧，使用第一个根节点
      return tfTree.length > 0 ? tfTree[0] : null
    }

    const rootNode = findRootNode()
    if (rootNode) {
      createOrUpdateFrameObject(rootNode, null)
    } else {
      console.warn('TFRenderer: No valid root node found for TF tree')
    }
  }

  /**
   * 应用 ROS Transform 到 THREE.js Group
   * 
   * 使用正确的坐标转换公式：
   * - 平移：ROS(x, y, z) → THREE.js(x, z, -y)
   * - 旋转：四元数直接赋值
   * 
   * @param group THREE.js Group
   * @param transform ROS Transform 数据
   */
  private applyTransform(group: THREE.Group, transform: TransformFrame) {
    if (!transform.translation || !transform.rotation) return

    // ✅ 平移坐标转换：ROS(x, y, z) → THREE.js(x, z, -y)
    const position = convertROSTranslationToThree(transform.translation)
    group.position.copy(position)

    // ✅ 四元数直接赋值：分量一一对应，无需修改
    const quaternion = convertROSRotationToThree(transform.rotation)
    group.quaternion.copy(quaternion)
  }

  /**
   * 更新 TF 变换数据
   * 当收到新的 TF 数据时，更新对应 frame 的位置和姿态
   * 
   * @param parentFrame 父坐标系名称
   * @param childFrame 子坐标系名称
   * @param transform TF 变换数据
   */
  updateTransform(parentFrame: string, childFrame: string, transform: TransformFrame) {
    const frameObject = this.frameObjects.get(childFrame)
    if (!frameObject) {
      // Frame 对象不存在，可能需要重新构建树
      return
    }

    // ✅ 应用新的变换数据（使用正确的坐标转换公式）
    if (transform.translation && transform.rotation) {
      this.applyTransform(frameObject.group, transform)
    }
  }

  /**
   * 更新所有 frame 的变换数据
   * 根据当前的 transforms Map 更新所有已存在的 frame
   * 
   * @param transforms TF 变换数据 Map
   */
  updateAllTransforms(transforms: Map<string, Map<string, TransformFrame>>) {
    // 遍历所有 frame 对象，更新其变换
    this.frameObjects.forEach((frameObject, frameName) => {
      if (frameObject.parent) {
        const parentTransforms = transforms.get(frameObject.parent)
        if (parentTransforms) {
          const transform = parentTransforms.get(frameName)
          if (transform && transform.translation && transform.rotation) {
            // ✅ 应用变换（使用正确的坐标转换公式）
            this.applyTransform(frameObject.group, transform)
          }
        }
      }
    })
  }

  /**
   * 添加坐标轴可视化
   * 
   * @param frameName 坐标系名称
   * @param axisLength 坐标轴长度
   * @param axisRadius 坐标轴半径
   * @param showAxes 是否显示坐标轴
   */
  addAxes(frameName: string, axisLength: number = 0.3, axisRadius: number = 0.01, showAxes: boolean = true) {
    const frameObject = this.frameObjects.get(frameName)
    if (!frameObject) return

    // 移除旧的坐标轴
    if (frameObject.axes) {
      frameObject.group.remove(frameObject.axes)
      frameObject.axes.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (child.material instanceof THREE.Material) {
            child.material.dispose()
          }
        }
      })
    }

    if (!showAxes) {
      frameObject.axes = undefined
      return
    }

    // ✅ 使用统一的ROS坐标轴创建函数
    const axesGroup = createROSAxes(axisLength, axisRadius)
    axesGroup.name = `Axes_${frameName}`

    frameObject.group.add(axesGroup)
    frameObject.axes = axesGroup
  }

  /**
   * 添加名称标签
   * 
   * @param frameName 坐标系名称
   * @param showNames 是否显示名称
   * @param markerScale 标记缩放
   * @param markerAlpha 标记透明度
   */
  addLabel(frameName: string, showNames: boolean = true, markerScale: number = 1, markerAlpha: number = 1) {
    const frameObject = this.frameObjects.get(frameName)
    if (!frameObject) return

    // 移除旧的标签
    if (frameObject.label) {
      frameObject.group.remove(frameObject.label)
      if (frameObject.label.material instanceof THREE.SpriteMaterial) {
        if (frameObject.label.material.map) {
          frameObject.label.material.map.dispose()
        }
        frameObject.label.material.dispose()
      }
    }

    if (!showNames) {
      frameObject.label = undefined
      return
    }

    // 创建文本标签
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    canvas.width = 256
    canvas.height = 64

    context.fillStyle = `rgba(255, 255, 255, ${markerAlpha})`
    context.font = 'Bold 24px Arial'
    context.fillText(frameName, 10, 40)

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: markerAlpha
    })
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.scale.set(0.5 * markerScale, 0.125 * markerScale, 1)
    sprite.position.set(0, 0.2 * markerScale, 0)
    sprite.name = `Label_${frameName}`

    frameObject.group.add(sprite)
    frameObject.label = sprite
  }

  /**
   * 配置 frame 的显示选项
   * 
   * @param frameName 坐标系名称
   * @param options 显示选项
   */
  configureFrame(
    frameName: string,
    options: {
      showAxes?: boolean
      showNames?: boolean
      markerScale?: number
      markerAlpha?: number
    }
  ) {
    const { showAxes = true, showNames = true, markerScale = 1, markerAlpha = 1 } = options

    this.addAxes(frameName, 0.3 * markerScale, 0.01, showAxes)
    this.addLabel(frameName, showNames, markerScale, markerAlpha)
  }

  /**
   * 设置 frame 的可见性
   * 
   * @param frameName 坐标系名称
   * @param visible 是否可见
   */
  setFrameVisibility(frameName: string, visible: boolean) {
    const frameObject = this.frameObjects.get(frameName)
    if (frameObject) {
      frameObject.group.visible = visible
    }
  }

  /**
   * 获取 frame 对象
   * 
   * @param frameName 坐标系名称
   * @returns Frame 对象或 undefined
   */
  getFrame(frameName: string): TFFrameObject | undefined {
    return this.frameObjects.get(frameName)
  }

  /**
   * 获取所有 frame 名称
   */
  getAllFrameNames(): string[] {
    return Array.from(this.frameObjects.keys())
  }

  /**
   * 清理所有 frame 对象
   */
  clearAllFrames() {
    // 清理所有资源
    this.frameObjects.forEach(frameObject => {
      // 清理坐标轴
      if (frameObject.axes) {
        frameObject.axes.traverse(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose()
            if (child.material instanceof THREE.Material) {
              child.material.dispose()
            }
          }
        })
      }

      // 清理标签
      if (frameObject.label) {
        if (frameObject.label.material instanceof THREE.SpriteMaterial) {
          if (frameObject.label.material.map) {
            frameObject.label.material.map.dispose()
          }
          frameObject.label.material.dispose()
        }
      }

      // 从场景中移除
      if (frameObject.group.parent) {
        frameObject.group.parent.remove(frameObject.group)
      }
    })

    // 清空 map
    this.frameObjects.clear()

    // 清空根组
    this.rootGroup.clear()
  }

  /**
   * 销毁渲染器，清理所有资源
   */
  dispose() {
    this.clearAllFrames()
    if (this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup)
    }
  }
}
