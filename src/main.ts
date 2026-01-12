import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'

// 创建应用实例
const app = createApp(App)

// 使用 Pinia
app.use(createPinia())

// 使用路由
app.use(router)

// 挂载应用
app.mount('#app')
