import { request } from "@/utils/http";

export const financeAnalysisApi = {
  dashboard(familyId, month = "", trendMonths = 6) {
    return request("/api/financial-analysis/dashboard", {
      params: { familyId, month, trendMonths }
    });
  }
};
