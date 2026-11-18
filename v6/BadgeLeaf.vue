<script>
export default {
	props: ["label", "variant", "onPick"],
};
</script>

<template>
	<span class="leaf-badge" :data-variant="variant" @click="onPick && onPick(label)">{{ label }}</span>
</template>
