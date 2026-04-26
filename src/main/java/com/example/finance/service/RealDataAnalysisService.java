package com.example.finance.service;

import com.example.finance.dto.RealDataAnalysisApiModels;
import com.example.finance.entity.ExternalFredSeries;
import com.example.finance.entity.ExternalRetailTransaction;
import com.example.finance.entity.ExternalWorldBankConsumption;
import com.example.finance.entity.RealDataImportBatch;
import com.example.finance.repository.ExternalFredSeriesRepository;
import com.example.finance.repository.ExternalRetailTransactionRepository;
import com.example.finance.repository.ExternalWorldBankConsumptionRepository;
import com.example.finance.repository.RealDataImportBatchRepository;
import com.opencsv.CSVReaderHeaderAware;
import com.opencsv.CSVReaderHeaderAwareBuilder;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
public class RealDataAnalysisService {

    private static final DateTimeFormatter ONLINE_RETAIL_TIME_FORMATTER = DateTimeFormatter.ofPattern("M/d/yy H:mm", Locale.ROOT);
    private static final int DEFAULT_BATCH_SIZE = 5_000;

    private final ExternalRetailTransactionRepository externalRetailTransactionRepository;
    private final ExternalWorldBankConsumptionRepository externalWorldBankConsumptionRepository;
    private final ExternalFredSeriesRepository externalFredSeriesRepository;
    private final RealDataImportBatchRepository realDataImportBatchRepository;
    private final EntityManager entityManager;

    public RealDataAnalysisService(
            ExternalRetailTransactionRepository externalRetailTransactionRepository,
            ExternalWorldBankConsumptionRepository externalWorldBankConsumptionRepository,
            ExternalFredSeriesRepository externalFredSeriesRepository,
            RealDataImportBatchRepository realDataImportBatchRepository,
            EntityManager entityManager
    ) {
        this.externalRetailTransactionRepository = externalRetailTransactionRepository;
        this.externalWorldBankConsumptionRepository = externalWorldBankConsumptionRepository;
        this.externalFredSeriesRepository = externalFredSeriesRepository;
        this.realDataImportBatchRepository = realDataImportBatchRepository;
        this.entityManager = entityManager;
    }

    @Transactional
    public RealDataAnalysisApiModels.ImportResponse importProcessedData(
            String processedDir,
            boolean truncateBeforeImport,
            Integer batchSize
    ) {
        Path dir = Path.of(processedDir == null || processedDir.isBlank() ? "data/processed" : processedDir);
        if (!Files.isDirectory(dir)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "processedDir does not exist: " + dir.toAbsolutePath());
        }
        int safeBatchSize = (batchSize == null || batchSize < 100) ? DEFAULT_BATCH_SIZE : Math.min(batchSize, 20_000);
        if (truncateBeforeImport) {
            externalRetailTransactionRepository.deleteAllInBatch();
            externalWorldBankConsumptionRepository.deleteAllInBatch();
            externalFredSeriesRepository.deleteAllInBatch();
        }

        int retailImported = importRetail(dir.resolve("online_retail_transactions.csv"), safeBatchSize);
        int worldBankImported = importWorldBank(dir.resolve("world_bank_household_consumption.csv"), safeBatchSize);
        int fredImported = importFred(dir.resolve("fred_macro_series.csv"), safeBatchSize);
        RealDataImportBatch batch = new RealDataImportBatch();
        batch.setProcessedDir(dir.toAbsolutePath().toString());
        batch.setTruncatedBeforeImport(truncateBeforeImport);
        batch.setBatchSize(safeBatchSize);
        batch.setRetailImported(retailImported);
        batch.setWorldBankImported(worldBankImported);
        batch.setFredImported(fredImported);
        batch.setImportStatus("SUCCESS");
        batch.setImportedAt(LocalDateTime.now());
        RealDataImportBatch savedBatch = realDataImportBatchRepository.save(batch);
        return new RealDataAnalysisApiModels.ImportResponse(
                savedBatch.getId(),
                dir.toAbsolutePath().toString(),
                safeBatchSize,
                truncateBeforeImport,
                retailImported,
                worldBankImported,
                fredImported,
                savedBatch.getImportStatus(),
                savedBatch.getImportedAt()
        );
    }

    public List<RealDataAnalysisApiModels.ImportHistoryItem> importHistory() {
        return realDataImportBatchRepository.findTop20ByOrderByCreatedAtDescIdDesc().stream()
                .map(batch -> new RealDataAnalysisApiModels.ImportHistoryItem(
                        batch.getId(),
                        batch.getProcessedDir(),
                        batch.getBatchSize(),
                        Boolean.TRUE.equals(batch.getTruncatedBeforeImport()),
                        batch.getRetailImported(),
                        batch.getWorldBankImported(),
                        batch.getFredImported(),
                        batch.getImportStatus(),
                        batch.getImportedAt(),
                        batch.getCreatedAt()
                ))
                .toList();
    }

    public RealDataAnalysisApiModels.RetailOverviewResponse retailOverview(Integer topCountries) {
        Object[] summaryRow = externalRetailTransactionRepository.summaryRows().stream()
                .findFirst()
                .orElse(new Object[]{0L, BigDecimal.ZERO, BigDecimal.ZERO, null, null});
        long totalRecords = ((Number) summaryRow[0]).longValue();
        BigDecimal totalAmount = toBigDecimal(summaryRow[1]);
        BigDecimal avgAmount = toBigDecimal(summaryRow[2]);
        LocalDateTime earliest = (LocalDateTime) summaryRow[3];
        LocalDateTime latest = (LocalDateTime) summaryRow[4];

        int safeTop = (topCountries == null || topCountries < 1) ? 10 : Math.min(topCountries, 50);
        List<RealDataAnalysisApiModels.CountryAmountItem> topCountryItems = externalRetailTransactionRepository
                .topCountryRows(PageRequest.of(0, safeTop))
                .stream()
                .map(row -> new RealDataAnalysisApiModels.CountryAmountItem(
                        row.getCountry(),
                        row.getRecordCount(),
                        row.getTotalAmount()
                ))
                .toList();

        return new RealDataAnalysisApiModels.RetailOverviewResponse(
                totalRecords,
                totalAmount,
                avgAmount,
                earliest,
                latest,
                topCountryItems
        );
    }

    public RealDataAnalysisApiModels.WorldBankTrendResponse worldBankTrend(String countryIso3) {
        if (countryIso3 == null || countryIso3.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "countryIso3 is required");
        }
        String iso3 = countryIso3.trim().toUpperCase(Locale.ROOT);
        List<ExternalWorldBankConsumption> rows = externalWorldBankConsumptionRepository.findByCountryIso3OrderByPeriodYearAsc(iso3);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "world bank data not found for countryIso3=" + iso3);
        }

        List<RealDataAnalysisApiModels.WorldBankPoint> points = new ArrayList<>();
        BigDecimal previous = null;
        for (ExternalWorldBankConsumption row : rows) {
            BigDecimal growth = null;
            if (previous != null && previous.compareTo(BigDecimal.ZERO) != 0) {
                growth = row.getMetricValue()
                        .subtract(previous)
                        .divide(previous, 6, RoundingMode.HALF_UP);
            }
            points.add(new RealDataAnalysisApiModels.WorldBankPoint(
                    row.getPeriodYear(),
                    row.getMetricValue(),
                    growth
            ));
            previous = row.getMetricValue();
        }

        return new RealDataAnalysisApiModels.WorldBankTrendResponse(
                iso3,
                rows.get(0).getCountryName(),
                points
        );
    }

    public RealDataAnalysisApiModels.FredSeriesResponse fredSeries(String seriesId) {
        if (seriesId == null || seriesId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "seriesId is required");
        }
        String normalized = seriesId.trim().toUpperCase(Locale.ROOT);
        List<ExternalFredSeries> rows = externalFredSeriesRepository.findBySeriesIdOrderByMetricDateAsc(normalized);
        return new RealDataAnalysisApiModels.FredSeriesResponse(
                normalized,
                rows.stream()
                        .map(row -> new RealDataAnalysisApiModels.FredPoint(row.getMetricDate(), row.getMetricValue()))
                .toList()
        );
    }

    public RealDataAnalysisApiModels.DefenseSummaryResponse defenseSummary(
            String countryIso3,
            String seriesId,
            Integer topCountries
    ) {
        RealDataAnalysisApiModels.RetailOverviewResponse retail = retailOverview(topCountries);
        RealDataAnalysisApiModels.WorldBankTrendResponse worldBank = worldBankTrend(countryIso3);
        RealDataAnalysisApiModels.FredSeriesResponse fred = fredSeries(seriesId);

        List<String> conclusions = new ArrayList<>();
        conclusions.add(buildWorldBankConclusion(worldBank));
        conclusions.add(buildRetailConclusion(retail));
        conclusions.add(buildFredConclusion(fred));

        return new RealDataAnalysisApiModels.DefenseSummaryResponse(
                retail,
                worldBank,
                fred,
                conclusions
        );
    }

    private int importRetail(Path filePath, int batchSize) {
        if (!Files.exists(filePath)) {
            return 0;
        }
        int count = 0;
        List<ExternalRetailTransaction> buffer = new ArrayList<>(batchSize);
        try (CSVReaderHeaderAware reader = new CSVReaderHeaderAwareBuilder(Files.newBufferedReader(filePath, StandardCharsets.UTF_8)).build()) {
            Map<String, String> row;
            while ((row = reader.readMap()) != null) {
                ExternalRetailTransaction entity = new ExternalRetailTransaction();
                entity.setSourceDataset(readColumn(row, "source_dataset"));
                entity.setInvoiceNo(readColumn(row, "invoice_no"));
                entity.setStockCode(readColumn(row, "stock_code"));
                entity.setDescription(trimToNull(readColumn(row, "description")));
                entity.setQuantity(parseInteger(readColumn(row, "quantity")));
                entity.setUnitPrice(parseBigDecimal(readColumn(row, "unit_price")));
                entity.setAmount(parseBigDecimal(readColumn(row, "amount")));
                entity.setInvoiceTime(parseRetailTime(readColumn(row, "invoice_time")));
                entity.setCustomerId(trimToNull(readColumn(row, "customer_id")));
                entity.setCountry(trimToNull(readColumn(row, "country")));
                entity.setFetchedAt(parseFetchedAt(readColumn(row, "fetched_at")));
                buffer.add(entity);
                if (buffer.size() >= batchSize) {
                    count += flushRetailBatch(buffer);
                }
            }
            if (!buffer.isEmpty()) {
                count += flushRetailBatch(buffer);
            }
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "failed to import online retail csv: " + exception.getMessage(), exception);
        }
        return count;
    }

    private int importWorldBank(Path filePath, int batchSize) {
        if (!Files.exists(filePath)) {
            return 0;
        }
        int count = 0;
        List<ExternalWorldBankConsumption> buffer = new ArrayList<>(batchSize);
        try (CSVReaderHeaderAware reader = new CSVReaderHeaderAwareBuilder(Files.newBufferedReader(filePath, StandardCharsets.UTF_8)).build()) {
            Map<String, String> row;
            while ((row = reader.readMap()) != null) {
                ExternalWorldBankConsumption entity = new ExternalWorldBankConsumption();
                entity.setSourceDataset(readColumn(row, "source_dataset"));
                entity.setCountryIso3(upper(readColumn(row, "country_iso3")));
                entity.setCountryName(trimToNull(readColumn(row, "country_name")));
                entity.setIndicator(trimToNull(readColumn(row, "indicator")));
                entity.setPeriodYear(parseInteger(readColumn(row, "year")));
                entity.setMetricValue(parseBigDecimal(readColumn(row, "value")));
                entity.setFetchedAt(parseFetchedAt(readColumn(row, "fetched_at")));
                if (entity.getCountryIso3() == null || entity.getPeriodYear() == null || entity.getMetricValue() == null) {
                    continue;
                }
                buffer.add(entity);
                if (buffer.size() >= batchSize) {
                    count += flushWorldBankBatch(buffer);
                }
            }
            if (!buffer.isEmpty()) {
                count += flushWorldBankBatch(buffer);
            }
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "failed to import world bank csv: " + exception.getMessage(), exception);
        }
        return count;
    }

    private int importFred(Path filePath, int batchSize) {
        if (!Files.exists(filePath)) {
            return 0;
        }
        int count = 0;
        List<ExternalFredSeries> buffer = new ArrayList<>(batchSize);
        try (CSVReaderHeaderAware reader = new CSVReaderHeaderAwareBuilder(Files.newBufferedReader(filePath, StandardCharsets.UTF_8)).build()) {
            Map<String, String> row;
            while ((row = reader.readMap()) != null) {
                ExternalFredSeries entity = new ExternalFredSeries();
                entity.setSourceDataset(readColumn(row, "source_dataset"));
                entity.setSeriesId(upper(readColumn(row, "series_id")));
                entity.setSeriesName(trimToNull(readColumn(row, "series_name")));
                entity.setMetricDate(parseDate(readColumn(row, "date")));
                entity.setMetricValue(parseBigDecimal(readColumn(row, "value")));
                entity.setFetchedAt(parseFetchedAt(readColumn(row, "fetched_at")));
                if (entity.getSeriesId() == null || entity.getMetricDate() == null || entity.getMetricValue() == null) {
                    continue;
                }
                buffer.add(entity);
                if (buffer.size() >= batchSize) {
                    count += flushFredBatch(buffer);
                }
            }
            if (!buffer.isEmpty()) {
                count += flushFredBatch(buffer);
            }
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "failed to import fred csv: " + exception.getMessage(), exception);
        }
        return count;
    }

    private int flushRetailBatch(List<ExternalRetailTransaction> buffer) {
        int size = buffer.size();
        externalRetailTransactionRepository.saveAll(buffer);
        externalRetailTransactionRepository.flush();
        entityManager.clear();
        buffer.clear();
        return size;
    }

    private int flushWorldBankBatch(List<ExternalWorldBankConsumption> buffer) {
        int size = buffer.size();
        externalWorldBankConsumptionRepository.saveAll(buffer);
        externalWorldBankConsumptionRepository.flush();
        entityManager.clear();
        buffer.clear();
        return size;
    }

    private int flushFredBatch(List<ExternalFredSeries> buffer) {
        int size = buffer.size();
        externalFredSeriesRepository.saveAll(buffer);
        externalFredSeriesRepository.flush();
        entityManager.clear();
        buffer.clear();
        return size;
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        return new BigDecimal(String.valueOf(value));
    }

    private Integer parseInteger(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            return null;
        }
        try {
            return Integer.parseInt(normalized);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private BigDecimal parseBigDecimal(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            return null;
        }
        try {
            return new BigDecimal(normalized);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private LocalDate parseDate(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            return null;
        }
        try {
            return LocalDate.parse(normalized);
        } catch (Exception ignored) {
            return null;
        }
    }

    private LocalDateTime parseRetailTime(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            return null;
        }
        try {
            return LocalDateTime.parse(normalized, ONLINE_RETAIL_TIME_FORMATTER);
        } catch (Exception ignored) {
            return null;
        }
    }

    private LocalDateTime parseFetchedAt(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            return null;
        }
        try {
            return OffsetDateTime.parse(normalized).toLocalDateTime();
        } catch (Exception ignored) {
        }
        try {
            return LocalDateTime.parse(normalized);
        } catch (Exception ignored) {
            return null;
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String upper(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? null : normalized.toUpperCase(Locale.ROOT);
    }

    private String readColumn(Map<String, String> row, String expectedKey) {
        String direct = row.get(expectedKey);
        if (direct != null) {
            return direct;
        }
        String normalizedExpected = normalizeColumnName(expectedKey);
        for (Map.Entry<String, String> entry : row.entrySet()) {
            if (Objects.equals(normalizeColumnName(entry.getKey()), normalizedExpected)) {
                return entry.getValue();
            }
        }
        return null;
    }

    private String normalizeColumnName(String rawColumnName) {
        if (rawColumnName == null) {
            return "";
        }
        String normalized = rawColumnName.trim();
        if (!normalized.isEmpty() && normalized.charAt(0) == '\uFEFF') {
            normalized = normalized.substring(1);
        }
        if (normalized.length() >= 2 && normalized.startsWith("\"") && normalized.endsWith("\"")) {
            normalized = normalized.substring(1, normalized.length() - 1);
        }
        return normalized.toLowerCase(Locale.ROOT);
    }

    private String buildWorldBankConclusion(RealDataAnalysisApiModels.WorldBankTrendResponse worldBankTrend) {
        List<RealDataAnalysisApiModels.WorldBankPoint> points = worldBankTrend.points();
        if (points == null || points.isEmpty()) {
            return "国家趋势结论：当前无可用 World Bank 趋势点。";
        }
        RealDataAnalysisApiModels.WorldBankPoint first = points.get(0);
        RealDataAnalysisApiModels.WorldBankPoint last = points.get(points.size() - 1);
        BigDecimal growthPct = null;
        if (first.value() != null && first.value().compareTo(BigDecimal.ZERO) > 0 && last.value() != null) {
            growthPct = last.value()
                    .divide(first.value(), 8, RoundingMode.HALF_UP)
                    .subtract(BigDecimal.ONE)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(2, RoundingMode.HALF_UP);
        }
        return String.format(
                Locale.ROOT,
                "国家趋势结论：%s（%s）从 %d 年 %s 增至 %d 年 %s，累计变化 %s%%。",
                worldBankTrend.countryName(),
                worldBankTrend.countryIso3(),
                first.year(),
                first.value(),
                last.year(),
                last.value(),
                growthPct == null ? "0.00" : growthPct.toPlainString()
        );
    }

    private String buildRetailConclusion(RealDataAnalysisApiModels.RetailOverviewResponse retailOverview) {
        List<RealDataAnalysisApiModels.CountryAmountItem> items = retailOverview.topCountries();
        if (items == null || items.isEmpty() || items.get(0).totalAmount() == null || retailOverview.totalAmount() == null
                || retailOverview.totalAmount().compareTo(BigDecimal.ZERO) == 0) {
            return "交易结构结论：当前无可用国家分布数据。";
        }
        RealDataAnalysisApiModels.CountryAmountItem topCountry = items.get(0);
        BigDecimal sharePct = topCountry.totalAmount()
                .divide(retailOverview.totalAmount(), 8, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);
        return String.format(
                Locale.ROOT,
                "交易结构结论：%s 交易额占比约 %s%%。",
                topCountry.country(),
                sharePct.toPlainString()
        );
    }

    private String buildFredConclusion(RealDataAnalysisApiModels.FredSeriesResponse fredSeries) {
        int count = fredSeries.points() == null ? 0 : fredSeries.points().size();
        return String.format(
                Locale.ROOT,
                "FRED状态结论：%s 数据点数为 %d。",
                fredSeries.seriesId(),
                count
        );
    }
}
