<template>
  <div class="admin-shell">
    <SidebarNav />
    <div class="admin-main">
      <TopBar
        :kicker="routeMeta.kicker"
        :title="routeMeta.title"
        :hint="routeMeta.hint"
        @logout="handleLogout"
        @refresh="handleRefresh"
      />
      <main class="page-body">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import SidebarNav from "@/components/SidebarNav.vue";
import TopBar from "@/components/TopBar.vue";
import { authStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();

const routeMeta = computed(() => {
  const mapping = {
    analysis: {
      kicker: "数据治理工作台",
      title: "真实数据导入与分析",
      hint: "先登录并导入真实数据，再刷新分析摘要和趋势结论。"
    },
    family: {
      kicker: "身份与家庭工作台",
      title: "用户与家庭上下文",
      hint: "查看当前账号、家庭成员关系和当前会话绑定的家庭范围。"
    },
    business: {
      kicker: "业务数据工作台",
      title: "账户分类预算交易管理",
      hint: "以标准后台 CRUD 方式维护账户、分类、预算和交易数据。"
    },
    rules: {
      kicker: "规则引擎工作台",
      title: "规则与通知中心",
      hint: "维护预警规则，执行规则评估，并查看生成的通知结果。"
    },
    system: {
      kicker: "系统说明工作台",
      title: "系统说明与迁移进度",
      hint: "记录当前 Vue 管理端已完成范围和后续迁移计划。"
    }
  };
  return mapping[route.name] || mapping.analysis;
});

function handleLogout() {
  authStore.logout();
  router.push("/login");
}

function handleRefresh() {
  window.location.reload();
}
</script>
