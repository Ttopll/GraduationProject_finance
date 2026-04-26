import { request } from "@/utils/http";

export const realDataApi = {
  importData(params) {
    return request("/api/real-data-analysis/import", {
      method: "POST",
      params
    });
  },
  getImportHistory() {
    return request("/api/real-data-analysis/imports");
  },
  getDefenseSummary(params) {
    return request("/api/real-data-analysis/defense-summary", {
      params
    });
  },
  getRetailOverview(params) {
    return request("/api/real-data-analysis/retail-overview", {
      params
    });
  },
  getWorldBankTrend(params) {
    return request("/api/real-data-analysis/world-bank-trend", {
      params
    });
  },
  getFredSeries(params) {
    return request("/api/real-data-analysis/fred-series", {
      params
    });
  }
};
