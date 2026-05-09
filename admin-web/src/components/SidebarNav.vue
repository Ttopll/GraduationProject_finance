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
  { to: "/dashboard", label: "总控台", meta: "全局指标、待办、快速入口" },
  { to: "/finance-core", label: "家庭理财看板", meta: "收支、预算、资产、建议" },
  { to: "/family", label: "用户与家庭", meta: "登录态与家庭上下文" },
  { to: "/business", label: "家庭账本管理", meta: "账户、分类、预算、交易" },
  { to: "/assets", label: "资产负债管理", meta: "固定资产、债务、还款" },
  { to: "/operations", label: "账单导入导出", meta: "导入、归类、备份导出" },
  { to: "/bill-parse-rules", label: "账单自动归类", meta: "商户识别、分类规则" },
  { to: "/rules", label: "消费预警提醒", meta: "预算预警与消息中心" },
  { to: "/analysis", label: "外部消费数据", meta: "导入、汇总、趋势" },
  { to: "/system", label: "系统说明", meta: "迁移进度与后续计划" }
];
</script>
