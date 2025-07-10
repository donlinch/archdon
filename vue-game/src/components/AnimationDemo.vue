<template>
  <div class="h-[28rem] w-full flex flex-col overflow-clip gap-4">
    <CosmicPortal
      ref="cosmicPortal"
      container-class="rounded-lg"
    />
    <div class="flex flex-row items-center justify-center gap-4">
      <UiButton @click="activatePortal"> Activate Portal </UiButton>
      <UiButton @click="shiftDimensions"> Shift Dimensions </UiButton>
    </div>
  </div>
</template>

<script lang="ts" setup>
import CosmicPortal from './CosmicPortal.vue';
import UiButton from './UiButton.vue';
import { ref } from 'vue';

// In a real scenario, useTemplateRef from VueUse would be better,
// but for this demo, a simple ref is sufficient.
const cosmicPortal = ref<InstanceType<typeof CosmicPortal> | null>(null);

function activatePortal() {
  if (!cosmicPortal.value) return;
  cosmicPortal.value.activatePortal();
}

function shiftDimensions() {
  if (!cosmicPortal.value) return;
  cosmicPortal.value.shiftDimensions();
}
</script> 