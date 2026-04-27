<template>
  <section class="page-section">
    <div class="stats-grid">
      <StatCard label="&#24403;&#21069;&#29992;&#25143;" :value="authStore.user?.nickname || authStore.user?.username || '-'" :meta="authStore.user?.userType || 'USER'" />
      <StatCard label="&#23478;&#24237;&#20851;&#31995;&#25968;" :value="authStore.memberships.length" meta="&#25968;&#25454;&#26469;&#33258; /api/auth/me" />
      <StatCard label="&#24403;&#21069;&#23478;&#24237;" :value="authStore.currentFamilyId || '-'" :meta="currentFamilyName" />
      <StatCard label="&#24403;&#21069;&#25104;&#21592;&#25968;" :value="familyMembers.length" meta="&#22522;&#20110;&#24403;&#21069;&#36873;&#20013;&#23478;&#24237;&#21152;&#36733;" />
    </div>

    <AdminTableCard kicker="&#23478;&#24237;&#19978;&#19979;&#25991;" title="&#24403;&#21069;&#23478;&#24237;&#19982;&#25104;&#21592;&#20851;&#31995;">
      <template #actions>
        <button class="ghost-button" type="button" @click="refreshAll">&#21047;&#26032;</button>
      </template>
      <template #feedback>
        <div v-if="pageFeedback" class="feedback-box info">{{ pageFeedback }}</div>
      </template>
      <div class="form-grid">
        <label class="field-block">
          <span>&#24403;&#21069;&#23478;&#24237;</span>
          <select :value="authStore.currentFamilyId || ''" class="field-input" @change="switchFamily($event.target.value)">
            <option value="">&#26410;&#36873;&#25321;&#23478;&#24237;</option>
            <option v-for="item in authStore.memberships" :key="`${item.familyId}-${item.familyMemberId}`" :value="item.familyId">
              {{ item.familyName || `\u5bb6\u5ead ${item.familyId}` }} / {{ item.roleCode }}
            </option>
          </select>
        </label>
      </div>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>&#23478;&#24237;&#21517;&#31216;</th>
              <th>&#23478;&#24237; ID</th>
              <th>&#25104;&#21592; ID</th>
              <th>&#35282;&#33394;</th>
              <th>&#21152;&#20837;&#26102;&#38388;</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in authStore.memberships" :key="`${item.familyId}-${item.familyMemberId}`">
              <td>{{ item.familyName || `\u5bb6\u5ead ${item.familyId}` }}</td>
              <td>{{ item.familyId }}</td>
              <td>{{ item.familyMemberId }}</td>
              <td>{{ item.roleCode }}</td>
              <td>{{ formatDateTime(item.joinedAt) }}</td>
            </tr>
            <tr v-if="authStore.memberships.length === 0">
              <td colspan="5" class="table-empty">&#24403;&#21069;&#36134;&#21495;&#36824;&#27809;&#26377;&#21152;&#20837;&#20219;&#20309;&#23478;&#24237;&#12290;&#35831;&#20808;&#22312;&#19979;&#26041;&#21019;&#24314;&#23478;&#24237;&#25110;&#36890;&#36807;&#36992;&#35831;&#30721;&#21152;&#20837;&#23478;&#24237;&#12290;</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="&#21019;&#24314;&#23478;&#24237;" title="&#26032;&#24314;&#23478;&#24237;">
        <template #feedback>
          <div v-if="createFeedback" class="feedback-box info">{{ createFeedback }}</div>
        </template>
        <div class="form-grid">
          <label class="field-block">
            <span>&#23478;&#24237;&#21517;&#31216;</span>
            <input v-model.trim="createForm.familyName" class="field-input" type="text" />
          </label>
          <label class="field-block">
            <span>&#24065;&#31181;</span>
            <input v-model.trim="createForm.currencyCode" class="field-input" type="text" placeholder="CNY" />
          </label>
          <label class="field-block">
            <span>&#26102;&#21306;</span>
            <input v-model.trim="createForm.timezone" class="field-input" type="text" placeholder="Asia/Shanghai" />
          </label>
          <label class="field-block field-block-full">
            <span>&#22791;&#27880;</span>
            <input v-model.trim="createForm.remark" class="field-input" type="text" />
          </label>
        </div>
        <div class="button-row">
          <button class="primary-button" type="button" @click="createFamily">&#21019;&#24314;&#23478;&#24237;</button>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="&#21152;&#20837;&#23478;&#24237;" title="&#36890;&#36807;&#36992;&#35831;&#30721;&#21152;&#20837;">
        <template #feedback>
          <div v-if="joinFeedback" class="feedback-box info">{{ joinFeedback }}</div>
        </template>
        <div class="form-grid">
          <label class="field-block">
            <span>&#36992;&#35831;&#30721;</span>
            <input v-model.trim="joinForm.inviteCode" class="field-input" type="text" />
          </label>
          <label class="field-block">
            <span>&#25104;&#21592;&#21517;&#31216;</span>
            <input v-model.trim="joinForm.memberName" class="field-input" type="text" placeholder="&#21487;&#36873;" />
          </label>
        </div>
        <div class="button-row">
          <button class="primary-button" type="button" @click="joinFamily">&#21152;&#20837;&#23478;&#24237;</button>
        </div>
      </AdminTableCard>
    </div>

    <AdminTableCard kicker="&#25104;&#21592;&#21015;&#34920;" title="&#24403;&#21069;&#23478;&#24237;&#25104;&#21592;">
      <template #feedback>
        <div v-if="memberFeedback" class="feedback-box info">{{ memberFeedback }}</div>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>&#25104;&#21592;&#20449;&#24687;</th>
              <th>&#35282;&#33394;</th>
              <th>&#25104;&#21592; ID</th>
              <th>&#29992;&#25143; ID</th>
              <th>&#21152;&#20837;&#26102;&#38388;</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in familyMembers" :key="item.memberId">
              <td>
                <div class="primary-cell">{{ item.memberName || item.nickname || item.username || `\u6210\u5458 ${item.memberId}` }}</div>
                <div class="secondary-cell">{{ item.username || "-" }} / {{ item.nickname || "-" }}</div>
              </td>
              <td>{{ item.roleCode }}</td>
              <td>{{ item.memberId }}</td>
              <td>{{ item.userId }}</td>
              <td>{{ formatDateTime(item.joinedAt) }}</td>
            </tr>
            <tr v-if="familyMembers.length === 0">
              <td colspan="5" class="table-empty">&#24403;&#21069;&#27809;&#26377;&#21487;&#23637;&#31034;&#30340;&#23478;&#24237;&#25104;&#21592;&#25968;&#25454;&#12290;</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import StatCard from "@/components/StatCard.vue";
import AdminTableCard from "@/components/AdminTableCard.vue";
import { authStore } from "@/stores/auth";
import { familiesApi } from "@/api/families";
import { usePageRefresh } from "@/composables/pageRefresh";

const familyMembers = ref([]);
const pageFeedback = ref("");
const createFeedback = ref("");
const joinFeedback = ref("");
const memberFeedback = ref("");

const createForm = reactive({
  familyName: "",
  currencyCode: "CNY",
  timezone: "Asia/Shanghai",
  remark: ""
});

const joinForm = reactive({
  inviteCode: "",
  memberName: ""
});

const currentFamilyName = computed(() => authStore.memberships.find((item) => item.familyId === authStore.currentFamilyId)?.familyName || "\u6682\u65e0\u5bb6\u5ead\u4e0a\u4e0b\u6587");

async function refreshAll() {
  try {
    await authStore.fetchMe();
    await loadMembers();
    pageFeedback.value = authStore.currentFamilyId
      ? "\u5bb6\u5ead\u4e0a\u4e0b\u6587\u5df2\u5237\u65b0\u3002"
      : "\u5f53\u524d\u8d26\u53f7\u8fd8\u6ca1\u6709\u5bb6\u5ead\u5173\u7cfb\uff0c\u8bf7\u5148\u521b\u5efa\u5bb6\u5ead\u6216\u52a0\u5165\u5bb6\u5ead\u3002";
  } catch (error) {
    pageFeedback.value = `\u5237\u65b0\u5bb6\u5ead\u4e0a\u4e0b\u6587\u5931\u8d25\uff1a${error.message}`;
  }
}

async function loadMembers() {
  if (!authStore.currentFamilyId) {
    familyMembers.value = [];
    memberFeedback.value = "\u5f53\u524d\u672a\u9009\u62e9\u5bb6\u5ead\uff0c\u65e0\u6cd5\u52a0\u8f7d\u6210\u5458\u5217\u8868\u3002";
    return;
  }
  try {
    familyMembers.value = await familiesApi.listMembers(authStore.currentFamilyId);
    memberFeedback.value = "";
  } catch (error) {
    familyMembers.value = [];
    memberFeedback.value = `\u6210\u5458\u5217\u8868\u52a0\u8f7d\u5931\u8d25\uff1a${error.message}`;
  }
}

async function createFamily() {
  if (!createForm.familyName) {
    createFeedback.value = "\u8bf7\u5148\u8f93\u5165\u5bb6\u5ead\u540d\u79f0\u3002";
    return;
  }
  try {
    const family = await familiesApi.create({
      familyName: createForm.familyName,
      ownerUserId: authStore.user?.id,
      currencyCode: createForm.currencyCode || null,
      timezone: createForm.timezone || null,
      remark: createForm.remark || null
    });
    await authStore.fetchMe();
    authStore.setCurrentFamilyId(family.id);
    await loadMembers();
    createFeedback.value = `\u5bb6\u5ead\u521b\u5efa\u6210\u529f\uff0c\u5f53\u524d\u5bb6\u5ead ID\uff1a${family.id}\u3002`;
    createForm.familyName = "";
    createForm.remark = "";
  } catch (error) {
    createFeedback.value = `\u521b\u5efa\u5bb6\u5ead\u5931\u8d25\uff1a${error.message}`;
  }
}

async function joinFamily() {
  if (!joinForm.inviteCode) {
    joinFeedback.value = "\u8bf7\u5148\u8f93\u5165\u9080\u8bf7\u7801\u3002";
    return;
  }
  try {
    const member = await familiesApi.join({
      inviteCode: joinForm.inviteCode,
      memberName: joinForm.memberName || null
    });
    await authStore.fetchMe();
    authStore.setCurrentFamilyId(member.familyId);
    await loadMembers();
    joinFeedback.value = `\u52a0\u5165\u5bb6\u5ead\u6210\u529f\uff0c\u5f53\u524d\u5bb6\u5ead ID\uff1a${member.familyId}\u3002`;
    joinForm.inviteCode = "";
    joinForm.memberName = "";
  } catch (error) {
    joinFeedback.value = `\u52a0\u5165\u5bb6\u5ead\u5931\u8d25\uff1a${error.message}`;
  }
}

function switchFamily(value) {
  authStore.setCurrentFamilyId(value ? Number(value) : null);
  loadMembers();
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

watch(() => authStore.currentFamilyId, () => {
  loadMembers();
});

onMounted(async () => {
  await refreshAll();
});

usePageRefresh(refreshAll);
</script>
