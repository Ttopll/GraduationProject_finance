package com.example.finance.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class RealDataAnalysisApiModels {

    private RealDataAnalysisApiModels() {
    }

    public record ImportResponse(
            String processedDir,
            boolean truncatedBeforeImport,
            Integer retailImported,
            Integer worldBankImported,
            Integer fredImported
    ) {
    }

    public record RetailOverviewResponse(
            Long totalRecords,
            BigDecimal totalAmount,
            BigDecimal averageAmount,
            LocalDateTime earliestInvoiceTime,
            LocalDateTime latestInvoiceTime,
            List<CountryAmountItem> topCountries
    ) {
    }

    public record CountryAmountItem(
            String country,
            Long recordCount,
            BigDecimal totalAmount
    ) {
    }

    public record WorldBankTrendResponse(
            String countryIso3,
            String countryName,
            List<WorldBankPoint> points
    ) {
    }

    public record WorldBankPoint(
            Integer year,
            BigDecimal value,
            BigDecimal yearOnYearGrowthRatio
    ) {
    }

    public record FredSeriesResponse(
            String seriesId,
            List<FredPoint> points
    ) {
    }

    public record FredPoint(
            LocalDate date,
            BigDecimal value
    ) {
    }

    public record DefenseSummaryResponse(
            RetailOverviewResponse retailOverview,
            WorldBankTrendResponse worldBankTrend,
            FredSeriesResponse fredSeries,
            List<String> conclusions
    ) {
    }
}
