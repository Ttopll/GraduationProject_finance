import { request } from "@/utils/http";

export const familyFinancialProfileApi = {
  get(familyId) {
    return request("/api/family-financial-profile", {
      params: { familyId }
    });
  },
  save(payload) {
    return request("/api/family-financial-profile", {
      method: "PUT",
      body: payload
    });
  }
};
