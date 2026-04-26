<template>
  <div class="auth-shell">
    <section class="auth-panel">
      <div class="auth-copy">
        <div class="page-kicker">&#23478;&#24237;&#36130;&#21153;&#21518;&#21488;</div>
        <h1>Vue 3 &#31649;&#29702;&#31471;&#30331;&#24405;&#20837;&#21475;</h1>
        <p>
          &#24403;&#21069;&#31649;&#29702;&#31471;&#27491;&#22312;&#20174;&#38745;&#24577;&#39029;&#38754;&#36801;&#31227;&#21040; Vue 3&#12290;&#30331;&#24405;&#21518;&#21487;&#20197;&#36827;&#20837;&#30495;&#23454;&#25968;&#25454;&#20998;&#26512;&#12289;&#23478;&#24237;&#19978;&#19979;&#25991;&#31649;&#29702;&#12289;
          &#36134;&#25143;&#20998;&#31867;&#39044;&#31639;&#20132;&#26131;&#32500;&#25252;&#65292;&#20197;&#21450;&#35268;&#21017;&#39044;&#35686;&#19982;&#36890;&#30693;&#20013;&#24515;&#12290;
        </p>
        <ul class="auth-list">
          <li>&#21069;&#31471;&#20462;&#25913;&#21518;&#26080;&#38656;&#27599;&#27425;&#37117;&#37325;&#21551; Spring Boot&#12290;</li>
          <li>Vite &#24050;&#23558; <code>/api</code> &#33258;&#21160;&#20195;&#29702;&#21040; <code>http://localhost:8088</code>&#12290;</li>
          <li>&#21518;&#21488;&#39029;&#38754;&#24050;&#36880;&#27493;&#20999;&#25104;&#32452;&#20214;&#21270;&#32467;&#26500;&#65292;&#21518;&#32493;&#32487;&#32493;&#25193;&#23637;&#26356;&#26041;&#20415;&#12290;</li>
        </ul>
      </div>
      <form class="auth-form" @submit.prevent="submit">
        <div class="auth-form-head">
          <h2>&#31649;&#29702;&#21592;&#30331;&#24405;</h2>
          <p>&#35831;&#36755;&#20837;&#24403;&#21069;&#21518;&#31471;&#20013;&#24050;&#23384;&#22312;&#30340;&#36134;&#21495;&#23494;&#30721;&#12290;</p>
        </div>
        <label class="field-block">
          <span>&#29992;&#25143;&#21517;</span>
          <input v-model.trim="form.username" class="field-input" type="text" placeholder="&#35831;&#36755;&#20837;&#29992;&#25143;&#21517;" />
        </label>
        <label class="field-block">
          <span>&#23494;&#30721;</span>
          <input v-model="form.password" class="field-input" type="password" placeholder="&#35831;&#36755;&#20837;&#23494;&#30721;" />
        </label>
        <div v-if="message" :class="['feedback-box', messageType]">{{ message }}</div>
        <button class="primary-button" type="submit" :disabled="submitting">
          {{ submitting ? '\u767b\u5f55\u4e2d...' : '\u8fdb\u5165\u540e\u53f0' }}
        </button>
        <div class="auth-tip">&#22914;&#26524;&#30331;&#24405;&#21518;&#27809;&#26377;&#23478;&#24237;&#19978;&#19979;&#25991;&#65292;&#35831;&#20808;&#21040;&#8220;&#29992;&#25143;&#19982;&#23478;&#24237;&#8221;&#39029;&#38754;&#21019;&#24314;&#23478;&#24237;&#25110;&#21152;&#20837;&#23478;&#24237;&#12290;</div>
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
    message.value = "\u8bf7\u8f93\u5165\u7528\u6237\u540d\u548c\u5bc6\u7801\u3002";
    messageType.value = "error";
    return;
  }

  submitting.value = true;
  message.value = "";
  try {
    await authStore.login(form);
    message.value = "\u767b\u5f55\u6210\u529f\uff0c\u6b63\u5728\u8df3\u8f6c\u3002";
    messageType.value = "success";
    router.replace(route.query.redirect || "/analysis");
  } catch (error) {
    message.value = `\u767b\u5f55\u5931\u8d25\uff1a${error.message}`;
    messageType.value = "error";
  } finally {
    submitting.value = false;
  }
}
</script>
