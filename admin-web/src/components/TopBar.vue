<template>
  <header class="topbar">
    <div>
      <div class="page-kicker">{{ kicker }}</div>
      <h1 class="page-title">{{ title }}</h1>
      <p class="page-hint">{{ hint }}</p>
    </div>
    <div class="topbar-actions">
      <button class="ghost-button" type="button" @click="$emit('refresh')">刷新</button>
      <div class="profile-chip">
        <div class="profile-avatar">{{ initials }}</div>
        <div class="profile-copy">
          <strong>{{ authStore.user?.nickname || authStore.user?.username || '访客' }}</strong>
          <span>{{ authStore.user?.userType || 'USER' }}</span>
        </div>
      </div>
      <button class="ghost-button danger" type="button" @click="$emit('logout')">退出登录</button>
    </div>
  </header>
</template>

<script setup>
import { computed } from "vue";
import { authStore } from "@/stores/auth";

defineProps({
  title: { type: String, default: "" },
  hint: { type: String, default: "" },
  kicker: { type: String, default: "" }
});

defineEmits(["logout", "refresh"]);

const initials = computed(() => {
  const name = authStore.user?.nickname || authStore.user?.username || "G";
  return String(name).slice(0, 1).toUpperCase();
});
</script>
