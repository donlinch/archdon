import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useGameStore = defineStore('game', () => {
  // State
  const pet = ref({
    x: 50,
    y: 50,
    facing: 'right',
    state: 'wandering', // wandering, waiting, goingToA, goingToB, goingToC
    carriedItemId: null,
    targetItemId: null,
    emoji: '🐶',
  })

  const items = ref([])
  let nextItemId = 0

  const zones = ref({
    a: { x: 50, y: 250, width: 100, height: 100 },
    b: { x: 450, y: 250, width: 100, height: 100 },
    c: { x: 250, y: 50, width: 100, height: 100 },
  })

  const menu = ref({
    isVisible: false,
    targetZone: null,
    position: { x: 0, y: 0 },
    options: [
      { emoji: '🍎', speedModifier: 0.95 }, // -5%
      { emoji: '⚽', speedModifier: 0.90 }, // -10%
      { emoji: '💎', speedModifier: 0.85 }, // -15%
      { emoji: '💡', speedModifier: 0.80 }, // -20%
    ]
  })

  const path = ref(null) // { start, end, duration, startTime }
  const gameArea = ref({ width: 600, height: 400 })

  // Getters
  const petStyle = computed(() => ({
    left: `${pet.value.x}px`,
    top: `${pet.value.y}px`,
    transform: `scaleX(${pet.value.facing === 'right' ? 1 : -1})`,
  }))

  const visibleItems = computed(() => items.value.filter(i => i.state !== 'carried'))
  
  const isTaskActive = computed(() => !['wandering', 'waiting'].includes(pet.value.state))

  // Actions
  function setNewLinearPath(endTarget) {
    const start = { x: pet.value.x, y: pet.value.y }
    const end = endTarget

    const distance = Math.hypot(end.x - start.x, end.y - start.y)
    
    // Base speed: 60 pixels per second (50% slower than original 120px/s)
    const baseSpeed = 60; 
    let currentSpeed = baseSpeed;

    if (pet.value.carriedItemId !== null) {
      const carriedItem = items.value.find(i => i.id === pet.value.carriedItemId)
      if (carriedItem) {
        currentSpeed *= carriedItem.speedModifier
      }
    }
    
    // duration in milliseconds
    const duration = (distance / currentSpeed) * 1000;
    
    path.value = { start, end, duration, startTime: Date.now() }
  }

  function setRandomTarget() {
    const randomTarget = {
      x: Math.random() * (gameArea.value.width - 50),
      y: Math.random() * (gameArea.value.height - 50),
    }
    setNewLinearPath(randomTarget)
  }

  function openItemMenu(zoneId) {
    const zoneHasItem = items.value.some(item => item.state === `in${zoneId}`)
    if (zoneHasItem) {
      menu.value.isVisible = false
      return
    }

    if (menu.value.isVisible && menu.value.targetZone === zoneId) {
      menu.value.isVisible = false
      return
    }

    const zone = zones.value[zoneId.toLowerCase()]
    menu.value.targetZone = zoneId
    menu.value.position = { x: zone.x + zone.width, y: zone.y }
    menu.value.isVisible = true
  }

  function selectItem(itemOption) {
    if (!menu.value.targetZone) return

    const zoneId = menu.value.targetZone
    const zone = zones.value[zoneId.toLowerCase()]

    items.value.push({
      id: nextItemId++,
      emoji: itemOption.emoji,
      speedModifier: itemOption.speedModifier,
      x: zone.x + zone.width / 2 - 15,
      y: zone.y + zone.height / 2 - 15,
      state: `in${zoneId}`
    })
    
    menu.value.isVisible = false
    menu.value.targetZone = null

    if (!isTaskActive.value) {
      findNextTask()
    }
  }

  function findNextTask() {
    if (pet.value.carriedItemId !== null) return;

    const availableItems = items.value.filter(i => i.state === 'inA' || i.state === 'inC')

    if (availableItems.length === 0) {
      pet.value.state = 'wandering'
      setRandomTarget()
      return
    }

    let closestItem = availableItems.reduce((prev, curr) => {
        const prevDist = Math.hypot(prev.x - pet.value.x, prev.y - pet.value.y);
        const currDist = Math.hypot(curr.x - pet.value.x, curr.y - pet.value.y);
        return (prevDist < currDist) ? prev : curr;
    });

    pet.value.targetItemId = closestItem.id
    pet.value.state = closestItem.state === 'inA' ? 'goingToA' : 'goingToC'
    setNewLinearPath({ x: closestItem.x, y: closestItem.y })
  }

  function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  function updatePetPosition() {
    if (!path.value) return;

    const elapsed = Date.now() - path.value.startTime;
    const progress = Math.min(elapsed / path.value.duration, 1);

    const easedProgress = easeInOutSine(progress);

    const p0 = path.value.start;
    const p1 = path.value.end;
    const oldX = pet.value.x;
    
    pet.value.x = p0.x + (p1.x - p0.x) * easedProgress;
    pet.value.y = p0.y + (p1.y - p0.y) * easedProgress;

    if (Math.abs(pet.value.x - oldX) > 0.01) {
      pet.value.facing = pet.value.x > oldX ? 'right' : 'left';
    }

    if (pet.value.carriedItemId !== null) {
      const carriedItem = items.value.find(i => i.id === pet.value.carriedItemId)
      if (carriedItem) {
        carriedItem.x = pet.value.x
        carriedItem.y = pet.value.y
      }
    }

    if (progress >= 1) {
      path.value = null
      handleTargetReached()
    }
  }

  function findPlacementInZoneB() {
    const zone = zones.value.b
    const itemsInB = items.value.filter(i => i.state === 'inB')
    const itemSize = 30
    const itemsPerRow = Math.floor(zone.width / itemSize)
    const row = Math.floor(itemsInB.length / itemsPerRow)
    const col = itemsInB.length % itemsPerRow
    const newX = zone.x + col * itemSize + (itemSize / 2) - 15
    const newY = zone.y + row * itemSize + (itemSize / 2) - 15

    if (newY > zone.y + zone.height - itemSize) return null
    return { x: newX, y: newY }
  }

  function handleTargetReached() {
    switch (pet.value.state) {
      case 'wandering':
        pet.value.state = 'waiting'
        setTimeout(() => {
          findNextTask()
        }, 1000 + Math.random() * 2000)
        break
      
      case 'goingToA':
      case 'goingToC':
        pet.value.carriedItemId = pet.value.targetItemId
        pet.value.targetItemId = null
        pet.value.emoji = '🏃'
        
        const pickedItem = items.value.find(i => i.id === pet.value.carriedItemId)
        if (pickedItem) pickedItem.state = 'carried'
        
        pet.value.state = 'goingToB'
        const zoneB = zones.value.b
        setNewLinearPath({ 
            x: zoneB.x + zoneB.width / 2 - 15, 
            y: zoneB.y + zoneB.height / 2 - 15 
        })
        break

      case 'goingToB':
        const droppedItem = items.value.find(i => i.id === pet.value.carriedItemId)
        if (droppedItem) {
          const placement = findPlacementInZoneB()
          if (placement) {
            droppedItem.x = placement.x
            droppedItem.y = placement.y
            droppedItem.state = 'inB'
          } else {
            droppedItem.state = 'none' 
          }
        }

        pet.value.carriedItemId = null
        pet.value.emoji = '🐶'
        
        findNextTask()
        break
    }
  }

  // Init
  setRandomTarget()

  return {
    pet,
    items,
    zones,
    menu,
    gameArea,
    petStyle,
    visibleItems,
    openItemMenu,
    selectItem,
    updatePetPosition,
    isTaskActive,
  }
}) 