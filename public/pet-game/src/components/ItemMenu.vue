<script setup>
import { useGameStore } from '@/stores/game'

const game = useGameStore()

const emit = defineEmits(['select-item'])

const select = (itemOption) => {
  emit('select-item', itemOption)
}
</script>

<template>
  <div class="item-menu" :style="{ left: `${game.menu.position.x}px`, top: `${game.menu.position.y}px` }">
    <button v-for="option in game.menu.options" :key="option.emoji" @click="select(option)">
      {{ option.emoji }}
    </button>
  </div>
</template>

<style scoped>
.item-menu {
  position: absolute;
  background: white;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 5px;
  display: flex;
  gap: 5px;
  z-index: 100;
}
button {
  font-size: 24px;
  border: 1px solid #ddd;
  background: #f9f9f9;
  border-radius: 5px;
  cursor: pointer;
}
button:hover {
  background: #eee;
}
</style> 