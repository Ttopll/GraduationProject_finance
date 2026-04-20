package com.example.finance.service;

import com.example.finance.entity.ExternalWorldBankConsumption;
import com.example.finance.repository.ExternalRetailTransactionRepository.CountryAmountRow;
import com.example.finance.repository.ExternalFredSeriesRepository;
import com.example.finance.repository.ExternalRetailTransactionRepository;
import com.example.finance.repository.ExternalWorldBankConsumptionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RealDataAnalysisServiceTests {

    @Mock
    private ExternalRetailTransactionRepository externalRetailTransactionRepository;

    @Mock
    private ExternalWorldBankConsumptionRepository externalWorldBankConsumptionRepository;

    @Mock
    private ExternalFredSeriesRepository externalFredSeriesRepository;

    @InjectMocks
    private RealDataAnalysisService realDataAnalysisService;

    @Test
    void worldBankTrendShouldComputeYearOnYearGrowth() {
        ExternalWorldBankConsumption y2022 = new ExternalWorldBankConsumption();
        y2022.setCountryIso3("CHN");
        y2022.setCountryName("China");
        y2022.setPeriodYear(2022);
        y2022.setMetricValue(new BigDecimal("100.00"));

        ExternalWorldBankConsumption y2023 = new ExternalWorldBankConsumption();
        y2023.setCountryIso3("CHN");
        y2023.setCountryName("China");
        y2023.setPeriodYear(2023);
        y2023.setMetricValue(new BigDecimal("110.00"));

        when(externalWorldBankConsumptionRepository.findByCountryIso3OrderByPeriodYearAsc("CHN"))
                .thenReturn(List.of(y2022, y2023));

        var response = realDataAnalysisService.worldBankTrend("chn");
        assertEquals("CHN", response.countryIso3());
        assertEquals(2, response.points().size());
        assertEquals(null, response.points().get(0).yearOnYearGrowthRatio());
        assertEquals(new BigDecimal("0.100000"), response.points().get(1).yearOnYearGrowthRatio());
    }

    @Test
    void worldBankTrendShouldReturnNotFoundWhenNoData() {
        when(externalWorldBankConsumptionRepository.findByCountryIso3OrderByPeriodYearAsc("USA"))
                .thenReturn(List.of());

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> realDataAnalysisService.worldBankTrend("USA")
        );
        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void defenseSummaryShouldAggregateAndGenerateConclusions() {
        List<Object[]> summaryRows = Collections.singletonList(new Object[]{
                2L,
                new BigDecimal("200.00"),
                new BigDecimal("100.00"),
                LocalDateTime.parse("2026-01-01T00:00:00"),
                LocalDateTime.parse("2026-02-01T00:00:00")
        });
        when(externalRetailTransactionRepository.summaryRows())
                .thenReturn(summaryRows);

        CountryAmountRow top1 = mock(CountryAmountRow.class);
        when(top1.getCountry()).thenReturn("United Kingdom");
        when(top1.getRecordCount()).thenReturn(2L);
        when(top1.getTotalAmount()).thenReturn(new BigDecimal("160.00"));
        when(externalRetailTransactionRepository.topCountryRows(org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of(top1));

        ExternalWorldBankConsumption y2022 = new ExternalWorldBankConsumption();
        y2022.setCountryIso3("CHN");
        y2022.setCountryName("China");
        y2022.setPeriodYear(2022);
        y2022.setMetricValue(new BigDecimal("100.00"));

        ExternalWorldBankConsumption y2023 = new ExternalWorldBankConsumption();
        y2023.setCountryIso3("CHN");
        y2023.setCountryName("China");
        y2023.setPeriodYear(2023);
        y2023.setMetricValue(new BigDecimal("110.00"));

        when(externalWorldBankConsumptionRepository.findByCountryIso3OrderByPeriodYearAsc("CHN"))
                .thenReturn(List.of(y2022, y2023));
        when(externalFredSeriesRepository.findBySeriesIdOrderByMetricDateAsc("PCE"))
                .thenReturn(List.of());

        var response = realDataAnalysisService.defenseSummary("CHN", "PCE", 10);
        assertEquals(3, response.conclusions().size());
        assertTrue(response.conclusions().get(0).contains("国家趋势结论"));
        assertTrue(response.conclusions().get(1).contains("交易结构结论"));
        assertTrue(response.conclusions().get(2).contains("FRED状态结论"));
    }
}
