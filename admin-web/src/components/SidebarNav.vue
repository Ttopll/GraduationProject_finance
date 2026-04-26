<template>
  <aside class="sidebar">
    <div class="brand-block">
      <div class="brand-logo">FM</div>
      <div class="brand-copy">
        <strong>家庭财务后台</strong>
        <span>Vue 3 管理端</span>
      </div>
    </div>
    <nav class="nav-list">
      <RouterLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        active-class="is-active"
      >
        <span class="nav-title">{{ item.label }}</span>
        <small class="nav-meta">{{ item.meta }}</small>
      </RouterLink>
    </nav>
  </aside>
</template>

<script setup>
import { RouterLink } from "vue-router";

const items = [
  { to: "/analysis", label: "真实数据分析", meta: "导入、汇总、趋势" },
  { to: "/family", label: "用户与家庭", meta: "登录态与家庭上下文" },
  { to: "/business", label: "业务数据管理", meta: "账户、分类、预算、交易" },
  { to: "/rules", label: "规则与通知", meta: "规则评估与提醒中心" },
  { to: "/system", label: "系统说明", meta: "迁移进度与后续计划" }
];
</script>
