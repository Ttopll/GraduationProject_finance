<template>
  <teleport to="body">
    <div v-if="modelValue" class="modal-mask" @click.self="emit('update:modelValue', false)">
      <div class="modal-card">
        <div class="modal-head">
          <div>
            <div class="panel-kicker">Form Dialog</div>
            <h3>{{ title }}</h3>
          </div>
          <button class="ghost-button small" type="button" @click="emit('update:modelValue', false)">Close</button>
        </div>
        <div class="modal-body">
          <slot />
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: "Edit"
  }
});

const emit = defineEmits(["update:modelValue"]);
</script>
