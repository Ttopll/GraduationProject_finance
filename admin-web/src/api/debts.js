import { request } from "@/utils/http";

export const debtsApi = {
  listByFamily(familyId) {
    return request("/api/debts", {
      params: { familyId }
    });
  },
  create(payload) {
    return request("/api/debts", {
      method: "POST",
      body: payload
    });
  },
  update(debtId, payload) {
    return request(`/api/debts/${debtId}`, {
      method: "PUT",
      body: payload
    });
  },
  clear(debtId) {
    return request(`/api/debts/${debtId}/clear`, {
      method: "POST"
    });
  },
  remove(debtId) {
    return request(`/api/debts/${debtId}`, {
      method: "DELETE"
    });
  },
  repay(debtId, payload) {
    return request(`/api/debts/${debtId}/repayments`, {
      method: "POST",
      body: payload
    });
  },
  repaymentList(debtId) {
    return request(`/api/debts/${debtId}/repayments`);
  },
  checkReminders(familyId, daysAhead = 7) {
    return request("/api/debts/check-reminders", {
      method: "POST",
      params: { familyId, daysAhead }
    });
  }
};
