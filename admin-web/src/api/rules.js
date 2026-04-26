import { request } from "@/utils/http";

export const rulesApi = {
  listByFamily(familyId) {
    return request("/api/rules", {
      params: { familyId }
    });
  },
  create(payload) {
    return request("/api/rules", {
      method: "POST",
      body: payload
    });
  },
  update(ruleId, payload) {
    return request(`/api/rules/${ruleId}`, {
      method: "PUT",
      body: payload
    });
  },
  enable(ruleId) {
    return request(`/api/rules/${ruleId}/enable`, {
      method: "POST"
    });
  },
  disable(ruleId) {
    return request(`/api/rules/${ruleId}/disable`, {
      method: "POST"
    });
  },
  remove(ruleId) {
    return request(`/api/rules/${ruleId}`, {
      method: "DELETE"
    });
  },
  evaluate(familyId, month = "") {
    return request("/api/rules/evaluate", {
      method: "POST",
      params: { familyId, month }
    });
  }
};
