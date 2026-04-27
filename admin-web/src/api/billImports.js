import { request } from "@/utils/http";

export const billImportsApi = {
  upload(formData, params) {
    return request("/api/bill-imports/upload", {
      method: "POST",
      params,
      body: formData
    });
  },
  list(familyId) {
    return request("/api/bill-imports", {
      params: { familyId }
    });
  },
  pendingItems(familyId, status = "") {
    return request("/api/bill-imports/pending-items", {
      params: { familyId, status }
    });
  },
  resolve(pendingItemId, payload) {
    return request(`/api/bill-imports/pending-items/${pendingItemId}/resolve`, {
      method: "POST",
      body: payload
    });
  }
};
