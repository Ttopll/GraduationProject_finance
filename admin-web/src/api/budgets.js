import { request } from "@/utils/http";

export const budgetsApi = {
  listByFamily(familyId) {
    return request("/api/budgets", {
      params: { familyId }
    });
  },
  usage(familyId, month = "") {
    return request("/api/budgets/usage", {
      params: { familyId, month }
    });
  },
  create(payload) {
    return request("/api/budgets", {
      method: "POST",
      body: payload
    });
  },
  update(budgetId, payload) {
    return request(`/api/budgets/${budgetId}`, {
      method: "PUT",
      body: payload
    });
  },
  enable(budgetId) {
    return request(`/api/budgets/${budgetId}/enable`, {
      method: "POST"
    });
  },
  disable(budgetId) {
    return request(`/api/budgets/${budgetId}/disable`, {
      method: "POST"
    });
  },
  remove(budgetId) {
    return request(`/api/budgets/${budgetId}`, {
      method: "DELETE"
    });
  }
};
