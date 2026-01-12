import { createRouter, createWebHistory } from 'vue-router'

/**
 * 路由配置
 * 支持导航、控制、数据包分析等功能页面
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: {
        title: '仪表板',
        icon: 'dashboard',
        requiresAuth: false
      }
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
      meta: {
        title: '页面未找到',
        requiresAuth: false
      }
    }
  ]
})

// 路由守卫
router.beforeEach((to, _from, next) => {
  // 设置页面标题
  if (to.meta?.title) {
    document.title = `${to.meta.title} - 机器人可视化平台`
  }

  // 这里可以添加认证检查等逻辑
  next()
})

// 路由后置守卫
router.afterEach((_to, _from) => {
  // 更新UI状态中的当前视图
  // TODO: 导入 uiStore
})

export default router
