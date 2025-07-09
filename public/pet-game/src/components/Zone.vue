<script setup>
defineProps({
  label: String,
  style: Object,
})

const emit = defineEmits(['click'])
</script>

<template>
  <div class="zone" :style="style" @click="(event) => emit('click', event)">
    <span class="label">{{ label }}</span>
  </div>
</template>

<style scoped>
.zone {
  position: absolute;
  border: 2px dashed #ccc;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}
.label {
  font-size: 40px;
  color: #ddd;
  user-select: none;
}
</style> 