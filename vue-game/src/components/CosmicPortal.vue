<template>
  <div class="portal-container w-full h-full bg-black border border-purple-500 rounded-lg flex items-center justify-center">
    <p class="text-purple-300">Cosmic Portal</p>
  </div>
</template>

<script lang="ts" setup>
function activatePortal() {
  console.log("Portal activated!");
  // Add portal activation animation logic here
}

function shiftDimensions() {
  console.log("Shifting dimensions!");
  // Add dimension shifting animation logic here
}

defineExpose({
  activatePortal,
  shiftDimensions,
});
</script>

<style scoped>
.portal-container {
  box-shadow: 0 0 15px 5px rgba(168, 85, 247, 0.4);
}
</style> 