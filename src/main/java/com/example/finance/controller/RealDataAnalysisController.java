package com.example.finance.controller;

import com.example.finance.dto.RealDataAnalysisApiModels;
import com.example.finance.service.RealDataAnalysisService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/real-data-analysis")
public class RealDataAnalysisController {

    private final RealDataAnalysisService realDataAnalysisService;

    public RealDataAnalysisController(RealDataAnalysisService realDataAnalysisService) {
        this.realDataAnalysisService = realDataAnalysisService;
    }

    @PostMapping("/import")
    public RealDataAnalysisApiModels.ImportResponse importProcessedData(
            @RequestParam(defaultValue = "data/processed") String processedDir,
            @RequestParam(defaultValue = "false") boolean truncateBeforeImport,
            @RequestParam(defaultValue = "5000") Integer batchSize
    ) {
        return realDataAnalysisService.importProcessedData(processedDir, truncateBeforeImport, batchSize);
    }

    @GetMapping("/retail-overview")
    public RealDataAnalysisApiModels.RetailOverviewResponse retailOverview(
            @RequestParam(defaultValue = "10") Integer topCountries
    ) {
        return realDataAnalysisService.retailOverview(topCountries);
    }

    @GetMapping("/world-bank-trend")
    public RealDataAnalysisApiModels.WorldBankTrendResponse worldBankTrend(
            @RequestParam String countryIso3
    ) {
        return realDataAnalysisService.worldBankTrend(countryIso3);
    }

    @GetMapping("/fred-series")
    public RealDataAnalysisApiModels.FredSeriesResponse fredSeries(
            @RequestParam String seriesId
    ) {
        return realDataAnalysisService.fredSeries(seriesId);
    }
}
