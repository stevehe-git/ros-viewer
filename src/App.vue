<script setup lang="ts">
</script>

<template>
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="/robot.svg" class="logo" alt="robot logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/robot.svg" class="logo robot" alt="robot logo" />
    </a>
  </div>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
