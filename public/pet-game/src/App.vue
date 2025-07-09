<script setup>
import { onMounted, computed } from 'vue'
import { useGameStore } from './stores/game'
import PetCharacter from './components/PetCharacter.vue'
import Zone from './components/Zone.vue'
import ItemMenu from './components/ItemMenu.vue'

const game = useGameStore()

const zoneAStyle = computed(() => ({
  left: `${game.zones.a.x}px`,
  top: `${game.zones.a.y}px`,
  width: `${game.zones.a.width}px`,
  height: `${game.zones.a.height}px`,
}))

const zoneBStyle = computed(() => ({
  left: `${game.zones.b.x}px`,
  top: `${game.zones.b.y}px`,
  width: `${game.zones.b.width}px`,
  height: `${game.zones.b.height}px`,
}))

const zoneCStyle = computed(() => ({
  left: `${game.zones.c.x}px`,
  top: `${game.zones.c.y}px`,
  width: `${game.zones.c.width}px`,
  height: `${game.zones.c.height}px`,
}))

const handleItemSelect = (emoji) => {
  game.selectItem(emoji)
}

const gameLoop = () => {
  if (game.isTaskActive || game.pet.state === 'wandering') {
    game.updatePetPosition()
  }
  requestAnimationFrame(gameLoop)
}

onMounted(() => {
  requestAnimationFrame(gameLoop)
})
</script>

<template>
  <div id="game-container" @click.self="game.menu.isVisible = false">
    <h1>pet-game</h1>
    <div class="game-area" :style="{ width: `${game.gameArea.width}px`, height: `${game.gameArea.height}px` }">
      <PetCharacter />
      <Zone label="Ⓐ" :style="zoneAStyle" @click.stop="game.openItemMenu('A')" />
      <Zone label="Ⓑ" :style="zoneBStyle" />
      <Zone label="Ⓒ" :style="zoneCStyle" @click.stop="game.openItemMenu('C')" />
      <div 
        v-for="item in game.visibleItems" 
        :key="item.id" 
        class="item" 
        :style="{ left: `${item.x}px`, top: `${item.y}px` }"
      >
        {{ item.emoji }}
      </div>
      <ItemMenu v-if="game.menu.isVisible" @select-item="handleItemSelect" />
    </div>
  </div>
</template>

<style scoped>
#game-container {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}

.game-area {
  position: relative;
  margin: 0 auto;
  border: 1px solid #000;
  background-color: #f0f0f0;
  overflow: hidden;
}

.item {
    position: absolute;
    font-size: 30px;
    user-select: none;
    transition: left 0.05s linear, top 0.05s linear;
}
</style>
