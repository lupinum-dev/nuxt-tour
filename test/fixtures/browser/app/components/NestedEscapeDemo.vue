<script setup lang="ts">
const open = ref(false)
const popup = useTemplateRef<HTMLButtonElement>('popup')

async function showPopup(): Promise<void> {
  open.value = true
  await nextTick()
  popup.value?.focus()
}

function closePopup(): void {
  open.value = false
}
</script>

<template>
  <button
    data-testid="open-popup"
    type="button"
    @click="showPopup"
  >
    Open nested popup
  </button>
  <button
    v-if="open"
    ref="popup"
    data-testid="nested-popup"
    type="button"
    @keydown.esc.stop.prevent="closePopup"
  >
    Close nested popup
  </button>
</template>
