<template>
  <section class="page-section">
    <div class="stats-grid">
      <StatCard label="当前用户" :value="authStore.user?.nickname || authStore.user?.username || '-'" :meta="authStore.user?.userType || 'USER'" />
      <StatCard label="家庭关系数" :value="authStore.memberships.length" meta="数据来自 /api/auth/me" />
      <StatCard label="当前家庭" :value="authStore.currentFamilyId || '-'" meta="默认取当前登录态下第一个家庭" />
    </div>
    <article class="panel-card">
      <div class="panel-head">
        <div>
            <div class="panel-kicker">家庭上下文</div>
            <h2>用户与家庭关系</h2>
        </div>
      </div>
      <div class="table-list">
        <div v-for="item in authStore.memberships" :key="`${item.familyId}-${item.familyMemberId}`" class="table-row">
          <strong>{{ item.familyName || `家庭 ${item.familyId}` }}</strong>
          <span>角色：{{ item.roleCode }}</span>
          <span>成员 ID：{{ item.familyMemberId }}</span>
          <span>加入时间：{{ formatDateTime(item.joinedAt) }}</span>
        </div>
        <div v-if="authStore.memberships.length === 0" class="empty-text">当前会话下暂无家庭成员关系数据。</div>
      </div>
    </article>
  </section>
</template>

<script setup>
import StatCard from "@/components/StatCard.vue";
import { authStore } from "@/stores/auth";

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}
</script>
