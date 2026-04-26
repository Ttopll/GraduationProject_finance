<template>
  <article class="stat-card">
    <div class="stat-label">{{ label }}</div>
    <div class="stat-value">{{ value }}</div>
    <div class="stat-meta">{{ meta }}</div>
  </article>
</template>

<script setup>
defineProps({
  label: { type: String, default: "" },
  value: { type: [String, Number], default: "-" },
  meta: { type: String, default: "" }
});
</script>
