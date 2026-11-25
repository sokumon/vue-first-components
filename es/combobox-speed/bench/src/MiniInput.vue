<script setup>
// Reference: about the least a Vue Link input can be. Same props surface as the Desk usage.
defineProps({ modelValue: null, query: { type: String, default: '' }, placeholder: String, options: Array, open: Boolean })
const emit = defineEmits(['update:query', 'update:open', 'update:modelValue'])
</script>
<template>
  <div class="flex h-7 items-center rounded bg-surface-gray-2 px-2">
    <input class="min-w-0 flex-1 bg-transparent text-base outline-none" :value="query" :placeholder="placeholder" autocomplete="off"
      @input="emit('update:query', $event.target.value)" />
  </div>
</template>
