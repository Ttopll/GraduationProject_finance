<template>
  <div class="auth-shell">
    <section class="auth-panel">
      <div class="auth-copy">
        <div class="page-kicker">Family Finance Admin</div>
        <h1>Vue 3 Admin Console</h1>
        <p>
          The admin client is now moving from static pages to Vue 3. This first wave connects login,
          the admin shell, and the real-data analysis workspace.
        </p>
        <ul class="auth-list">
          <li>No need to restart Spring Boot for every UI edit.</li>
          <li>Vite proxy forwards /api to http://localhost:8088.</li>
          <li>The layout is now component-based and easier to extend.</li>
        </ul>
      </div>
      <form class="auth-form" @submit.prevent="submit">
        <div class="auth-form-head">
          <h2>Admin Login</h2>
          <p>Use an existing account created in the current backend.</p>
        </div>
        <label class="field-block">
          <span>Username</span>
          <input v-model.trim="form.username" class="field-input" type="text" placeholder="Enter username" />
        </label>
        <label class="field-block">
          <span>Password</span>
          <input v-model="form.password" class="field-input" type="password" placeholder="Enter password" />
        </label>
        <div v-if="message" :class="['feedback-box', messageType]">{{ message }}</div>
        <button class="primary-button" type="submit" :disabled="submitting">
          {{ submitting ? 'Signing in...' : 'Enter Console' }}
        </button>
        <div class="auth-tip">Existing users from the old static admin page can sign in here directly.</div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { authStore } from "@/stores/auth";

const router = useRouter();
const route = useRoute();
const submitting = ref(false);
const message = ref("");
const messageType = ref("info");
const form = reactive({
  username: "",
  password: ""
});

async function submit() {
  if (!form.username || !form.password) {
    message.value = "Please enter username and password.";
    messageType.value = "error";
    return;
  }

  submitting.value = true;
  message.value = "";
  try {
    await authStore.login(form);
    message.value = "Login successful. Redirecting...";
    messageType.value = "success";
    router.replace(route.query.redirect || "/analysis");
  } catch (error) {
    message.value = `Login failed: ${error.message}`;
    messageType.value = "error";
  } finally {
    submitting.value = false;
  }
}
</script>
