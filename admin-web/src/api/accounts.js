import { request } from "@/utils/http";

export const accountsApi = {
  listByFamily(familyId) {
    return request("/api/accounts", {
      params: { familyId }
    });
  },
  create(payload) {
    return request("/api/accounts", {
      method: "POST",
      body: payload
    });
  },
  update(accountId, payload) {
    return request(`/api/accounts/${accountId}`, {
      method: "PUT",
      body: payload
    });
  },
  enable(accountId) {
    return request(`/api/accounts/${accountId}/enable`, {
      method: "POST"
    });
  },
  disable(accountId) {
    return request(`/api/accounts/${accountId}/disable`, {
      method: "POST"
    });
  },
  remove(accountId) {
    return request(`/api/accounts/${accountId}`, {
      method: "DELETE"
    });
  }
};
