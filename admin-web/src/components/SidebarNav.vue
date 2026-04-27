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
  { to: "/analysis", label: "真实数据分析", meta: "导入、汇总、趋势" },
  { to: "/family", label: "用户与家庭", meta: "登录态与家庭上下文" },
  { to: "/business", label: "业务数据管理", meta: "账户、分类、预算、交易" },
  { to: "/assets", label: "资产与负债", meta: "固定资产、债务、还款" },
  { to: "/operations", label: "导入与导出", meta: "账单导入、待处理项、导出记录" },
  { to: "/bill-parse-rules", label: "解析规则", meta: "账单解析规则表格管理" },
  { to: "/rules", label: "规则与通知", meta: "规则评估与提醒中心" },
  { to: "/system", label: "系统说明", meta: "迁移进度与后续计划" }
];
</script>
