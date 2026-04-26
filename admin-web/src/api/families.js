import { request } from "@/utils/http";

export const familiesApi = {
  list() {
    return request("/api/families");
  },
  create(payload) {
    return request("/api/families", {
      method: "POST",
      body: payload
    });
  },
  join(payload) {
    return request("/api/families/join", {
      method: "POST",
      body: payload
    });
  },
  listMembers(familyId) {
    return request(`/api/families/${familyId}/members`);
  }
};
