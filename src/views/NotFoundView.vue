<template>
  <div class="not-found-view">
    <div class="error-content">
      <div class="error-icon">🤖</div>
      <h1 class="error-title">404</h1>
      <h2 class="error-subtitle">页面未找到</h2>
      <p class="error-description">
        您访问的页面不存在或已被移动。
      </p>
      <router-link to="/" class="btn btn-primary">
        返回首页
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
// 404 页面组件
</script>

<style scoped>
.not-found-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  background: var(--bg-color);
  color: var(--text-color);
}

.error-content {
  text-align: center;
  max-width: 400px;
}

.error-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.error-title {
  font-size: 72px;
  font-weight: 700;
  color: var(--primary-color);
  margin-bottom: 8px;
}

.error-subtitle {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-color);
}

.error-description {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 32px;
}

.btn {
  display: inline-block;
  padding: 12px 24px;
  background: var(--primary-color);
  color: white;
  text-decoration: none;
  border-radius: 6px;
  transition: all 0.2s;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
}
</style>
