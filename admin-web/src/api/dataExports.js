import { request } from "@/utils/http";

export const dataExportsApi = {
  list(familyId) {
    return request("/api/data-exports", {
      params: { familyId }
    });
  },
  exportTransactions(familyId, requestedByMemberId, month = "") {
    return request("/api/data-exports/transactions", {
      method: "POST",
      params: { familyId, requestedByMemberId, month }
    });
  },
  exportBudgets(familyId, requestedByMemberId, month = "") {
    return request("/api/data-exports/budgets", {
      method: "POST",
      params: { familyId, requestedByMemberId, month }
    });
  },
  download(exportId) {
    return request(`/api/data-exports/${exportId}/download`, {
      responseType: "blob"
    });
  },
  remove(exportId) {
    return request(`/api/data-exports/${exportId}`, {
      method: "DELETE"
    });
  }
};
