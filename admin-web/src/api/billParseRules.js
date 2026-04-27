import { request } from "@/utils/http";

export const billParseRulesApi = {
  list(familyId) {
    return request("/api/bill-parse-rules", {
      params: { familyId }
    });
  },
  create(payload) {
    return request("/api/bill-parse-rules", {
      method: "POST",
      body: payload
    });
  },
  update(ruleId, payload) {
    return request(`/api/bill-parse-rules/${ruleId}`, {
      method: "PUT",
      body: payload
    });
  },
  enable(ruleId) {
    return request(`/api/bill-parse-rules/${ruleId}/enable`, {
      method: "POST"
    });
  },
  disable(ruleId) {
    return request(`/api/bill-parse-rules/${ruleId}/disable`, {
      method: "POST"
    });
  },
  remove(ruleId) {
    return request(`/api/bill-parse-rules/${ruleId}`, {
      method: "DELETE"
    });
  }
};
