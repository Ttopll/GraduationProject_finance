<template>
  <article class="panel-card table-panel">
    <div class="table-toolbar" :class="compact ? 'compact' : ''">
      <div>
        <div v-if="kicker" class="panel-kicker">{{ kicker }}</div>
        <h2>{{ title }}</h2>
      </div>
      <div v-if="$slots.actions" class="toolbar-actions">
        <slot name="actions" />
      </div>
    </div>
    <slot name="filters" />
    <slot name="feedback" />
    <slot />
  </article>
</template>

<script setup>
defineProps({
  kicker: {
    type: String,
    default: ""
  },
  title: {
    type: String,
    default: ""
  },
  compact: {
    type: Boolean,
    default: false
  }
});
</script>
