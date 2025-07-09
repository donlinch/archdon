<script setup>
import { useGameStore } from '@/stores/game'

const game = useGameStore()
</script>

<template>
  <div class="pet-character" :style="game.petStyle">
    {{ game.pet.emoji }}
  </div>
</template>

<style scoped>
.pet-character {
  position: absolute;
  font-size: 30px;
  user-select: none;
  transition: transform 0.2s ease;
}
</style> 