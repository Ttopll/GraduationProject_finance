import { request } from "@/utils/http";

export const financialAdvicesApi = {
  list(familyId, status = "") {
    return request("/api/financial-advices", {
      params: { familyId, status }
    });
  },
  generate(familyId, month = "") {
    return request("/api/financial-advices/generate", {
      method: "POST",
      params: { familyId, month }
    });
  },
  markRead(adviceId) {
    return request(`/api/financial-advices/${adviceId}/read`, {
      method: "POST"
    });
  },
  markUnread(adviceId) {
    return request(`/api/financial-advices/${adviceId}/unread`, {
      method: "POST"
    });
  },
  remove(adviceId) {
    return request(`/api/financial-advices/${adviceId}`, {
      method: "DELETE"
    });
  }
};
