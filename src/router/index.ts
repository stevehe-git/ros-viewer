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
      path: '/navigation',
      name: 'navigation',
      component: () => import('../views/navigation/NavigationView.vue'),
      meta: {
        title: '导航',
        icon: 'navigation',
        requiresAuth: false
      },
      children: [
        {
          path: '',
          redirect: '/navigation/rviz'
        },
        {
          path: 'rviz',
          name: 'navigation-rviz',
          component: () => import('../views/navigation/RVizView.vue'),
          meta: {
            title: 'RViz 可视化',
            icon: 'rviz',
            requiresAuth: false
          }
        },
        {
          path: 'move_base',
          name: 'navigation-movebase',
          component: () => import('../views/navigation/MoveBaseView.vue'),
          meta: {
            title: 'Move Base',
            icon: 'movebase',
            requiresAuth: false
          }
        }
      ]
    },
    {
      path: '/control',
      name: 'control',
      component: () => import('../views/control/ControlView.vue'),
      meta: {
        title: '控制',
        icon: 'control',
        requiresAuth: false
      },
      children: [
        {
          path: '',
          redirect: '/control/task'
        },
        {
          path: 'task',
          name: 'control-task',
          component: () => import('../views/control/TaskControlView.vue'),
          meta: {
            title: '任务控制',
            icon: 'task',
            requiresAuth: false
          }
        },
        {
          path: 'teleop',
          name: 'control-teleop',
          component: () => import('../views/control/TeleopControlView.vue'),
          meta: {
            title: '遥控控制',
            icon: 'teleop',
            requiresAuth: false
          }
        },
        {
          path: 'simulation',
          name: 'control-simulation',
          component: () => import('../views/control/SimulationControlView.vue'),
          meta: {
            title: '仿真控制',
            icon: 'simulation',
            requiresAuth: false
          }
        }
      ]
    },
    {
      path: '/analysis',
      name: 'analysis',
      component: () => import('../views/analysis/AnalysisView.vue'),
      meta: {
        title: '分析',
        icon: 'analysis',
        requiresAuth: false
      },
      children: [
        {
          path: '',
          redirect: '/analysis/bag'
        },
        {
          path: 'bag',
          name: 'analysis-bag',
          component: () => import('../views/analysis/BagAnalysisView.vue'),
          meta: {
            title: 'Bag 分析',
            icon: 'bag',
            requiresAuth: false
          }
        },
        {
          path: 'logs',
          name: 'analysis-logs',
          component: () => import('../views/analysis/LogAnalysisView.vue'),
          meta: {
            title: '日志分析',
            icon: 'logs',
            requiresAuth: false
          }
        }
      ]
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
