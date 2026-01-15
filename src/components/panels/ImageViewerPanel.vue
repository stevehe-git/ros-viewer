<template>
  <BasePanel :title="panelTitle" :icon="Picture" :collapsible="true">
    <div class="image-viewer-container">
      <div v-if="!imageUrl" class="image-placeholder">
        <el-icon class="placeholder-icon"><Picture /></el-icon>
        <p class="placeholder-text">等待图像数据...</p>
        <p v-if="topic" class="topic-text">Topic: {{ topic }}</p>
      </div>
      <div v-else class="image-display">
        <img 
          :src="imageUrl" 
          alt="Camera/Image View"
          class="image-content"
          @error="handleImageError"
        />
        <div v-if="imageInfo" class="image-info">
          <span>尺寸: {{ imageInfo.width }} × {{ imageInfo.height }}</span>
          <span v-if="imageInfo.encoding">编码: {{ imageInfo.encoding }}</span>
        </div>
      </div>
    </div>
  </BasePanel>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Picture } from '@element-plus/icons-vue'
import { useRvizStore } from '@/stores/rviz'
import BasePanel from './BasePanel.vue'
import * as ROSLIB from 'roslib'

interface Props {
  componentId: string
  componentName: string
  topic?: string
}

const props = defineProps<Props>()

const rvizStore = useRvizStore()

const imageUrl = ref<string>('')
const imageInfo = ref<{ width: number; height: number; encoding?: string } | null>(null)
let imageSubscriber: ROSLIB.Topic | null = null

const panelTitle = computed(() => {
  return props.componentName || '图像视图'
})

// 将 ROS Image 消息转换为 Data URL
const convertImageMessageToDataURL = (message: any): string => {
  try {
    if (!message || !message.data) {
      return ''
    }

    // 获取图像尺寸
    const width = message.width || 0
    const height = message.height || 0
    const encoding = message.encoding || 'rgb8'
    const step = message.step || (width * 3) // 默认每行字节数
    
    if (width === 0 || height === 0) {
      return ''
    }

    // 处理 data 字段（可能是 Uint8Array 或 base64 字符串）
    let data: Uint8Array
    if (typeof message.data === 'string') {
      // 如果是 base64 字符串，需要解码
      try {
        const binaryString = atob(message.data)
        data = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          data[i] = binaryString.charCodeAt(i)
        }
      } catch (e) {
        console.error('Failed to decode base64 image data:', e)
        return ''
      }
    } else if (message.data instanceof Uint8Array) {
      data = message.data
    } else if (Array.isArray(message.data)) {
      data = new Uint8Array(message.data)
    } else {
      console.error('Unsupported image data type:', typeof message.data)
      return ''
    }

    if (data.length === 0) {
      return ''
    }

    // 创建 canvas 来渲染图像
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      return ''
    }

    // 根据编码类型处理图像数据
    const imageData = ctx.createImageData(width, height)
    
    // 处理不同的编码格式
    if (encoding === 'rgb8' || encoding === 'bgr8') {
      // RGB/BGR 格式，每像素 3 字节
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIndex = y * step + x * 3
          const dstIndex = (y * width + x) * 4
          
          if (srcIndex + 2 < data.length) {
            if (encoding === 'rgb8') {
              imageData.data[dstIndex] = data[srcIndex]         // R
              imageData.data[dstIndex + 1] = data[srcIndex + 1] // G
              imageData.data[dstIndex + 2] = data[srcIndex + 2] // B
            } else {
              imageData.data[dstIndex] = data[srcIndex + 2]     // R
              imageData.data[dstIndex + 1] = data[srcIndex + 1] // G
              imageData.data[dstIndex + 2] = data[srcIndex]     // B
            }
            imageData.data[dstIndex + 3] = 255 // Alpha
          }
        }
      }
    } else if (encoding === 'rgba8' || encoding === 'bgra8') {
      // RGBA/BGRA 格式，每像素 4 字节
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIndex = y * step + x * 4
          const dstIndex = (y * width + x) * 4
          
          if (srcIndex + 3 < data.length) {
            if (encoding === 'rgba8') {
              imageData.data[dstIndex] = data[srcIndex]
              imageData.data[dstIndex + 1] = data[srcIndex + 1]
              imageData.data[dstIndex + 2] = data[srcIndex + 2]
              imageData.data[dstIndex + 3] = data[srcIndex + 3]
            } else {
              imageData.data[dstIndex] = data[srcIndex + 2]
              imageData.data[dstIndex + 1] = data[srcIndex + 1]
              imageData.data[dstIndex + 2] = data[srcIndex]
              imageData.data[dstIndex + 3] = data[srcIndex + 3]
            }
          }
        }
      }
    } else if (encoding === 'mono8') {
      // 灰度图像，每像素 1 字节
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIndex = y * step + x
          const dstIndex = (y * width + x) * 4
          
          if (srcIndex < data.length) {
            const gray = data[srcIndex]
            imageData.data[dstIndex] = gray
            imageData.data[dstIndex + 1] = gray
            imageData.data[dstIndex + 2] = gray
            imageData.data[dstIndex + 3] = 255
          }
        }
      }
    } else {
      console.warn(`Unsupported image encoding: ${encoding}`)
      return ''
    }

    ctx.putImageData(imageData, 0, 0)
    imageInfo.value = { width, height, encoding }
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('Error converting image message:', error)
    return ''
  }
}

// 获取 ROS 实例
const getROSInstance = (): ROSLIB.Ros | null => {
  const rosPlugin = rvizStore.getPlugin('ros')
  if (rosPlugin) {
    return (rosPlugin as any).getROSInstance?.() as ROSLIB.Ros | null
  }
  return null
}

// 订阅图像话题
const subscribeImageTopic = () => {
  // 先取消旧的订阅
  unsubscribeImageTopic()

  const ros = getROSInstance()
  if (!ros || !ros.isConnected) {
    return
  }

  const topic = props.topic || ''
  if (!topic) {
    return
  }

  try {
    imageSubscriber = new ROSLIB.Topic({
      ros: ros,
      name: topic,
      messageType: 'sensor_msgs/Image',
      queue_size: 1 // 只保留最新的一帧
    })

    imageSubscriber.subscribe((message: any) => {
      const dataUrl = convertImageMessageToDataURL(message)
      if (dataUrl) {
        imageUrl.value = dataUrl
      }
    })

    console.log(`Subscribed to image topic: ${topic} for component: ${props.componentName}`)
  } catch (error) {
    console.error(`Failed to subscribe to image topic ${topic}:`, error)
  }
}

// 取消订阅
const unsubscribeImageTopic = () => {
  if (imageSubscriber) {
    imageSubscriber.unsubscribe()
    imageSubscriber = null
  }
  imageUrl.value = ''
  imageInfo.value = null
}

const handleImageError = () => {
  console.error('Failed to load image')
  imageUrl.value = ''
}

// 监听 topic 变化
watch(() => props.topic, (newTopic) => {
  if (newTopic) {
    subscribeImageTopic()
  } else {
    unsubscribeImageTopic()
  }
}, { immediate: true })

// 监听 ROS 连接状态
watch(() => rvizStore.robotConnection.connected, (connected) => {
  if (connected && props.topic) {
    subscribeImageTopic()
  } else {
    unsubscribeImageTopic()
  }
})

onMounted(() => {
  if (props.topic && rvizStore.robotConnection.connected) {
    subscribeImageTopic()
  }
})

onUnmounted(() => {
  unsubscribeImageTopic()
})
</script>

<style scoped>
.image-viewer-container {
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
}

.image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  padding: 20px;
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.placeholder-text {
  margin: 8px 0;
  font-size: 14px;
}

.topic-text {
  margin: 4px 0;
  font-size: 12px;
  color: #606266;
}

.image-display {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.image-content {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.image-info {
  position: absolute;
  bottom: 8px;
  left: 8px;
  right: 8px;
  display: flex;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}
</style>