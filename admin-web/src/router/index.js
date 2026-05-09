import { createRouter, createWebHistory } from "vue-router";
import { authStore } from "@/stores/auth";
import LoginPage from "@/pages/LoginPage.vue";
import AdminLayout from "@/layouts/AdminLayout.vue";
import DashboardPage from "@/pages/DashboardPage.vue";
import FinanceCorePage from "@/pages/FinanceCorePage.vue";
import AnalysisPage from "@/pages/AnalysisPage.vue";
import FamilyPage from "@/pages/FamilyPage.vue";
import BusinessPage from "@/pages/BusinessPage.vue";
import AssetsPage from "@/pages/AssetsPage.vue";
import OperationsPage from "@/pages/OperationsPage.vue";
import BillParseRulesPage from "@/pages/BillParseRulesPage.vue";
import RulesPage from "@/pages/RulesPage.vue";
import SystemPage from "@/pages/SystemPage.vue";

const routes = [
  {
    path: "/login",
    name: "login",
    component: LoginPage,
    meta: { public: true }
  },
  {
    path: "/",
    component: AdminLayout,
    children: [
      { path: "", redirect: "/dashboard" },
      { path: "dashboard", name: "dashboard", component: DashboardPage },
      { path: "finance-core", name: "finance-core", component: FinanceCorePage },
      { path: "analysis", name: "analysis", component: AnalysisPage },
      { path: "family", name: "family", component: FamilyPage },
      { path: "business", name: "business", component: BusinessPage },
      { path: "assets", name: "assets", component: AssetsPage },
      { path: "operations", name: "operations", component: OperationsPage },
      { path: "bill-parse-rules", name: "bill-parse-rules", component: BillParseRulesPage },
      { path: "rules", name: "rules", component: RulesPage },
      { path: "system", name: "system", component: SystemPage }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to) => {
  if (to.meta.public) {
    return true;
  }

  if (!authStore.token) {
    authStore.restore();
  }

  if (!authStore.token) {
    return { name: "login", query: { redirect: to.fullPath } };
  }

  if (!authStore.user) {
    try {
      await authStore.fetchMe();
    } catch (_error) {
      authStore.logout();
      return { name: "login", query: { redirect: to.fullPath } };
    }
  }

  return true;
});

export default router;
