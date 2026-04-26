import { request } from "@/utils/http";

export const transactionsApi = {
  search(params) {
    return request("/api/transaction-records/search", {
      params
    });
  },
  monthlySummary(familyId, months = 6) {
    return request(`/api/transaction-records/family/${familyId}/monthly-summary`, {
      params: { months }
    });
  },
  create(payload) {
    return request("/api/transaction-records", {
      method: "POST",
      body: payload
    });
  },
  update(recordId, payload) {
    return request(`/api/transaction-records/${recordId}`, {
      method: "PUT",
      body: payload
    });
  },
  remove(recordId) {
    return request(`/api/transaction-records/${recordId}`, {
      method: "DELETE"
    });
  }
};
